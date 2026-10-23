"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ejemploListas, ejemploPersonal, type PCategoria, type PEvento, type PerfilPersonal, type PHabito, type PMarca, type PPendiente } from "@/lib/personal";
import { hoyISO } from "@/lib/fechas";
import { sumarDias } from "@/lib/pagos";

export const CAMPOS_P = "id,user_id,tipo,titulo,fecha,fecha_fin,hora_inicio,hora_fin,lugar,notas,categoria_id,hecho,hecho_at,repetir,repetir_hasta,excepciones";
const CAMPOS_PEND = "id,user_id,padre_id,titulo,notas,lista,fecha,hecho,hecho_at,orden,created_at";

/** Todo lo de la agenda personal de quien está viendo (es poco: se carga completo). */
export function usePersonal(demo = false, perfilDemo: PerfilPersonal = "odonto") {
  const supabase = useMemo(() => createClient(), []);
  const [eventos, setEventos] = useState<PEvento[] | null>(null);
  const [categorias, setCategorias] = useState<PCategoria[]>([]);
  const [pendientes, setPendientes] = useState<PPendiente[]>([]);
  const [habitos, setHabitos] = useState<PHabito[]>([]);
  const [marcas, setMarcas] = useState<PMarca[]>([]);
  const [prefs, setPrefs] = useState<{ correo?: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (demo) {
      // Demo: datos de ejemplo; sólo se cargan la primera vez (lo que palomees se queda mientras no recargues)
      const hoy = hoyISO();
      setEventos((x) => x ?? ejemploPersonal(hoy, perfilDemo).eventos);
      setCategorias((x) => (x.length ? x : ejemploPersonal(hoy, perfilDemo).categorias));
      const l = ejemploListas(hoy, perfilDemo);
      setPendientes((x) => (x.length ? x : l.pendientes));
      setHabitos((x) => (x.length ? x : l.habitos));
      setMarcas((x) => (x.length ? x : l.marcas));
      return;
    }
    const desde = sumarDias(hoyISO(), -400);
    const [e, c, p, pe, h, m] = await Promise.all([
      supabase.from("p_eventos").select(CAMPOS_P).order("fecha"),
      supabase.from("p_categorias").select("id,nombre,color,orden").order("orden").order("created_at"),
      supabase.from("personales").select("prefs").maybeSingle(),
      supabase.from("p_pendientes").select(CAMPOS_PEND).order("orden").order("created_at"),
      supabase.from("p_habitos").select("id,user_id,nombre,color,dias,orden,archivado,created_at").order("orden").order("created_at"),
      supabase.from("p_habito_marcas").select("habito_id,fecha").gte("fecha", desde),
    ]);
    if (e.error) setError(e.error.message);
    else {
      setError(null);
      setEventos(((e.data ?? []) as PEvento[]).map((x) => ({ ...x, excepciones: x.excepciones ?? [] })));
    }
    setCategorias((c.data ?? []) as PCategoria[]);
    setPrefs(((p.data?.prefs ?? {}) as { correo?: boolean }) || {});
    // (si aún no se corre el SQL de 2.4, estas tablas no existen: se quedan vacías sin tronar)
    setPendientes(pe.error ? [] : ((pe.data ?? []) as PPendiente[]));
    setHabitos(h.error ? [] : ((h.data ?? []) as PHabito[]));
    setMarcas(m.error ? [] : ((m.data ?? []) as PMarca[]));
  }, [supabase, demo, perfilDemo]);

  useEffect(() => {
    recargar();
    // Si vuelve a la pestaña (o al cel), refresca
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);

  return { supabase, eventos, categorias, pendientes, habitos, marcas, prefs, error, recargar, setEventos, setPendientes, setHabitos, setMarcas };
}
