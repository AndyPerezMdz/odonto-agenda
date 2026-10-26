"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EVENTO_SINCRONIZADA } from "@/lib/conexion";
import { ejemploListas, ejemploPersonal, type PCategoria, type PEvento, type PerfilPersonal, type PHabito, type PMarca, type PPendiente } from "@/lib/personal";
import { hoyISO } from "@/lib/fechas";
import { sumarDias } from "@/lib/pagos";
import { CAMPOS_COSA, CAMPOS_PAGO, ejemploViajesPagos, type PCosa, type PPagoFijo, type PPagoHecho } from "@/lib/viajesPagos";

/** Preferencias de Mi agenda (personales.prefs). */
export type PrefsMi = { correo?: boolean; semana?: boolean; dia?: boolean; bienvenida?: boolean; novedades?: string; hoy_ocultos?: string[]; zona?: string; aviso_def?: number | null };

export const CAMPOS_P = "id,user_id,tipo,titulo,fecha,fecha_fin,hora_inicio,hora_fin,lugar,notas,categoria_id,hecho,hecho_at,repetir,repetir_hasta,excepciones";

/** Todo lo de la agenda personal de quien está viendo (es poco: se carga completo). */
export function usePersonal(demo = false, perfilDemo: PerfilPersonal = "odonto") {
  const supabase = useMemo(() => createClient(), []);
  const [eventos, setEventos] = useState<PEvento[] | null>(null);
  const [categorias, setCategorias] = useState<PCategoria[]>([]);
  const [pendientes, setPendientes] = useState<PPendiente[]>([]);
  const [habitos, setHabitos] = useState<PHabito[]>([]);
  const [marcas, setMarcas] = useState<PMarca[]>([]);
  // 2.5 · viajes completos y pagos fijos
  const [cosas, setCosas] = useState<PCosa[]>([]);
  const [presupuestos, setPresupuestos] = useState<Record<string, number | null>>({});
  const [pagosFijos, setPagosFijos] = useState<PPagoFijo[]>([]);
  const [pagosHechos, setPagosHechos] = useState<PPagoHecho[]>([]);
  const [prefs, setPrefs] = useState<PrefsMi>({});
  const [prefsCargadas, setPrefsCargadas] = useState(false);
  const prefsRef = useRef<PrefsMi>({});
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
      const vp = ejemploViajesPagos(hoy, perfilDemo);
      setCosas((x) => (x.length ? x : vp.cosas));
      setPresupuestos((x) => (Object.keys(x).length ? x : { "demo-4": 12000 }));
      setPagosFijos((x) => (x.length ? x : vp.pagos));
      setPagosHechos((x) => (x.length ? x : vp.hechos));
      return;
    }
    const desde = sumarDias(hoyISO(), -400);
    const [e, c, p, pe, h, m, vc, pr, pf, ph] = await Promise.all([
      supabase.from("p_eventos").select("*").order("fecha"),
      supabase.from("p_categorias").select("id,nombre,color,orden").order("orden").order("created_at"),
      supabase.from("personales").select("prefs").maybeSingle(),
      supabase.from("p_pendientes").select("*").order("orden").order("created_at"),
      supabase.from("p_habitos").select("*").order("orden").order("created_at"),
      supabase.from("p_habito_marcas").select("*").gte("fecha", desde),
      supabase.from("p_viaje_cosas").select(CAMPOS_COSA).order("orden").order("created_at"),
      supabase.from("p_eventos").select("id,presupuesto").eq("tipo", "viaje"),
      supabase.from("p_pagos_fijos").select(CAMPOS_PAGO).order("dia"),
      supabase.from("p_pagos_fijos_hechos").select("pago_id,periodo,monto,pagado_at").gte("periodo", desde),
    ]);
    if (e.error) setError(e.error.message);
    else {
      setError(null);
      setEventos(((e.data ?? []) as PEvento[]).map((x) => ({ ...x, excepciones: x.excepciones ?? [] })));
    }
    setCategorias((c.data ?? []) as PCategoria[]);
    prefsRef.current = ((p.data?.prefs ?? {}) as PrefsMi) || {};
    setPrefs(prefsRef.current);
    setPrefsCargadas(!p.error);
    // (si aún no se corre el SQL de 2.4, estas tablas no existen: se quedan vacías sin tronar)
    setPendientes(pe.error ? [] : ((pe.data ?? []) as PPendiente[]));
    setHabitos(h.error ? [] : ((h.data ?? []) as PHabito[]));
    setMarcas(m.error ? [] : ((m.data ?? []) as PMarca[]));
    // (2.5: lo mismo si aún no se corre su SQL)
    setCosas(vc.error ? [] : ((vc.data ?? []) as PCosa[]));
    setPresupuestos(pr.error ? {} : Object.fromEntries(((pr.data ?? []) as { id: string; presupuesto: number | null }[]).map((x) => [x.id, x.presupuesto == null ? null : Number(x.presupuesto)])));
    setPagosFijos(pf.error ? [] : ((pf.data ?? []) as PPagoFijo[]).map((x) => ({ ...x, monto: Number(x.monto) })));
    setPagosHechos(ph.error ? [] : ((ph.data ?? []) as PPagoHecho[]));
  }, [supabase, demo, perfilDemo]);

  /** Cambia algunas preferencias (en la demo sólo aquí, sin guardar). */
  const guardarPrefs = useCallback(
    async (cambios: Partial<PrefsMi>) => {
      const nuevas: PrefsMi = { ...prefsRef.current, ...cambios };
      prefsRef.current = nuevas;
      setPrefs(nuevas);
      if (demo) return;
      const { data: u } = await supabase.auth.getUser();
      if (u.user) await supabase.from("personales").update({ prefs: nuevas }).eq("user_id", u.user.id);
    },
    [supabase, demo]
  );

  useEffect(() => {
    recargar();
    // Si vuelve a la pestaña (o al cel), refresca
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener(EVENTO_SINCRONIZADA, recargar); // 3.4 · ya se subió lo que anotaste sin señal
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener(EVENTO_SINCRONIZADA, recargar);
    };
  }, [recargar]);

  return {
    supabase, eventos, categorias, pendientes, habitos, marcas, prefs, prefsCargadas, guardarPrefs, error, recargar, setEventos, setPendientes, setHabitos, setMarcas,
    cosas, setCosas, presupuestos, setPresupuestos, pagosFijos, setPagosFijos, pagosHechos, setPagosHechos,
  };
}
