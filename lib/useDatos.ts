"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AJUSTES_DEFAULT, type AjustesAgenda, type Cita, type Clinica, type Horario, type Materia, type Material, type Paciente, type Perfil } from "@/lib/types";

export const CAMPOS_CITA = "id,owner_id,paciente,fecha,hora_inicio,hora_fin,clinica_id,materia_id,notas,estado,telefono,cobro,cobrado,folio,historia";

/** Perfiles + catálogos, con recarga en tiempo real. */
export function useCatalogos() {
  const supabase = useMemo(() => createClient(), []);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [nombreAgenda, setNombreAgenda] = useState<string>("");
  const [pagadoHasta, setPagadoHasta] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<AjustesAgenda>(AJUSTES_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const idCanal = useId(); // cada instancia con su propio canal (si no, Supabase reusa uno ya suscrito y truena)

  const recargar = useCallback(async () => {
    const [p, c, m, a] = await Promise.all([
      supabase.from("perfiles").select("id,nombre,color,preferencias,rol,periodo_confirmado,acepto_terminos_at,version_vista,fin_clinicas").order("created_at"),
      supabase.from("clinicas").select("id,numero,descripcion,activo").order("numero"),
      supabase.from("materias").select("id,nombre,color,activo,material,duracion_min").order("nombre"),
      supabase.from("agendas").select("nombre,pagado_hasta,periodos,semana_clinicas,turnos,turnos_inicia").maybeSingle(),
    ]);
    if (p.data) setPerfiles(p.data as Perfil[]);
    if (c.data) setClinicas(c.data as Clinica[]);
    if (m.data) setMaterias(m.data as Materia[]);
    if (a.data?.nombre) setNombreAgenda(a.data.nombre);
    if (a.data) setPagadoHasta(a.data.pagado_hasta ?? null);
    if (a.data) setAjustes({ ...AJUSTES_DEFAULT, ...Object.fromEntries(Object.entries(a.data).filter(([k, v]) => k in AJUSTES_DEFAULT && v != null)) } as AjustesAgenda);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    recargar();
    const canal = supabase
      .channel(`catalogos-${idCanal}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clinicas" }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "materias" }, recargar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, recargar, idCanal]);

  return { supabase, perfiles, clinicas, materias, nombreAgenda, pagadoHasta, ajustes, cargando, recargar };
}

/** Citas entre dos fechas (inclusive), con recarga en tiempo real. */
export function useCitas(desde: string, hasta: string) {
  const supabase = useMemo(() => createClient(), []);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const idCanal = useId();

  const recargar = useCallback(async () => {
    const { data } = await supabase
      .from("citas")
      .select(CAMPOS_CITA)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("hora_inicio");
    if (data) setCitas(data as Cita[]);
    setCargando(false);
  }, [supabase, desde, hasta]);

  useEffect(() => {
    recargar();
    const canal = supabase
      .channel(`citas-${desde}-${idCanal}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, recargar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, recargar, desde, idCanal]);

  return { citas, cargando, recargar };
}

/** Horario fijo de clínicas de los dos (bloques semanales). */
export function useHorarios() {
  const supabase = useMemo(() => createClient(), []);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const recargar = useCallback(async () => {
    const { data } = await supabase.from("horarios").select("id,owner_id,dia_semana,hora_inicio,hora_fin,clinica_id,etiqueta,materia_id").order("dia_semana").order("hora_inicio");
    if (data) setHorarios(data as Horario[]);
  }, [supabase]);
  useEffect(() => {
    recargar();
  }, [recargar]);
  return { horarios, recargar };
}

/** Banco de pacientes (los de los dos; cada quien edita los suyos). */
export function usePacientes() {
  const supabase = useMemo(() => createClient(), []);
  const [pacientes, setPacientes] = useState<Paciente[] | null>(null);
  const recargar = useCallback(async () => {
    const { data } = await supabase.from("pacientes").select("id,owner_id,nombre,telefono,materia_id,notas,estado,created_at").order("created_at", { ascending: false });
    setPacientes((data as Paciente[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    recargar();
  }, [recargar]);
  return { pacientes, recargar };
}

/** Material: tu instrumental y los consumibles de los dos. */
export function useMaterial() {
  const supabase = useMemo(() => createClient(), []);
  const [material, setMaterial] = useState<Material[] | null>(null);
  const recargar = useCallback(async () => {
    const { data } = await supabase.from("material").select("id,owner_id,compartido,nombre,materia_id,estado,en_ceye_desde,nivel,cambiado_por,updated_at").order("created_at");
    setMaterial((data as Material[]) ?? []);
  }, [supabase]);
  useEffect(() => {
    recargar();
  }, [recargar]);
  return { material, recargar };
}
