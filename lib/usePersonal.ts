"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PCategoria, PEvento } from "@/lib/personal";

export const CAMPOS_P = "id,user_id,tipo,titulo,fecha,fecha_fin,hora_inicio,hora_fin,lugar,notas,categoria_id,hecho,hecho_at,repetir,repetir_hasta,excepciones";

/** Todo lo de la agenda personal de quien está viendo (es poco: se carga completo). */
export function usePersonal() {
  const supabase = useMemo(() => createClient(), []);
  const [eventos, setEventos] = useState<PEvento[] | null>(null);
  const [categorias, setCategorias] = useState<PCategoria[]>([]);
  const [prefs, setPrefs] = useState<{ correo?: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const [e, c, p] = await Promise.all([
      supabase.from("p_eventos").select(CAMPOS_P).order("fecha"),
      supabase.from("p_categorias").select("id,nombre,color,orden").order("orden").order("created_at"),
      supabase.from("personales").select("prefs").maybeSingle(),
    ]);
    if (e.error) setError(e.error.message);
    else {
      setError(null);
      setEventos(((e.data ?? []) as PEvento[]).map((x) => ({ ...x, excepciones: x.excepciones ?? [] })));
    }
    setCategorias((c.data ?? []) as PCategoria[]);
    setPrefs(((p.data?.prefs ?? {}) as { correo?: boolean }) || {});
  }, [supabase]);

  useEffect(() => {
    recargar();
    // Si vuelve a la pestaña (o al cel), refresca
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);

  return { supabase, eventos, categorias, prefs, error, recargar };
}
