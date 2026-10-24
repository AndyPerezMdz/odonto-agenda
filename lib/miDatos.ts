import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

// 2.9 · Tus datos de Mi agenda: descargarlos todos y borrarlos (tú solo, sin escribirnos).

/** Todo lo de su Mi agenda, en un JSON (las tablas que aún no existan salen vacías). */
export async function exportarMiAgenda(db: Db, userId: string, email: string | null) {
  const de = async (tabla: string, campo = "user_id") => {
    const { data, error } = await db.from(tabla).select("*").eq(campo, userId);
    return error ? [] : data ?? [];
  };
  const [cuenta, eventos, categorias, pendientes, habitos, marcas, viajes, pagosFijos, pagosHechos, pagosPro, compartidos] = await Promise.all([
    db.from("personales").select("nombre,perfil,prefs,created_at,pagado_hasta,prueba_hasta").eq("user_id", userId).maybeSingle().then((r) => r.data),
    de("p_eventos"),
    de("p_categorias"),
    de("p_pendientes"),
    de("p_habitos"),
    de("p_habito_marcas"),
    de("p_viaje_cosas"),
    de("p_pagos_fijos"),
    de("p_pagos_fijos_hechos"),
    de("p_pagos"),
    de("p_compartidos", "dueno"), // 3.0 · con quién compartiste qué (sólo correos)
  ]);
  const limpiar = (xs: Record<string, unknown>[]) => xs.map(({ user_id: _u, ...r }) => r);
  return {
    exportado: new Date().toISOString(),
    app: "Mi agenda",
    cuenta: { correo: email, ...(cuenta ?? {}) },
    eventos: limpiar(eventos),
    categorias: limpiar(categorias),
    pendientes: limpiar(pendientes),
    habitos: limpiar(habitos),
    habito_marcas: limpiar(marcas),
    viajes_itinerario_maleta_reservas_gastos: limpiar(viajes),
    pagos_fijos: limpiar(pagosFijos),
    pagos_fijos_hechos: limpiar(pagosHechos),
    pagos_de_tu_plan: limpiar(pagosPro),
    compartiste_con: (compartidos as Record<string, unknown>[]).map((r) => ({ correo: r.correo, evento_id: r.evento_id, pendiente_id: r.pendiente_id, created_at: r.created_at })),
  };
}

/**
 * Borra su Mi agenda y todo lo que tiene. Si no usa la agenda de clínicas, también su cuenta
 * (sin agenda de clínicas, la cuenta ya no sirve para nada). Lo usan tu panel y la persona misma.
 */
export async function borrarMiAgenda(db: Db, userId: string): Promise<{ ok: true; cuentaBorrada: boolean } | { ok: false; error: string }> {
  await db.from("p_eventos").delete().eq("user_id", userId); // (lo de los viajes y los avisos se va con sus eventos)
  await db.from("p_categorias").delete().eq("user_id", userId);
  await db.from("p_pendientes").delete().eq("user_id", userId);
  await db.from("p_habitos").delete().eq("user_id", userId); // (las marcas se van con sus hábitos)
  await db.from("p_pagos_fijos").delete().eq("user_id", userId);
  // 3.0 · lo que compartiste se va con tus eventos y pendientes; lo que te compartieron, también se suelta
  await db.from("p_compartidos").delete().eq("invitado", userId);
  // (la invitación se queda: así nadie gana meses borrando y volviendo a crear su agenda)
  await db.from("push_subs").delete().eq("user_id", userId);
  const { error } = await db.from("personales").delete().eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  const { data: p } = await db.from("perfiles").select("agenda_id").eq("id", userId).maybeSingle();
  if (p?.agenda_id) return { ok: true, cuentaBorrada: false };
  const { error: e2 } = await db.auth.admin.deleteUser(userId);
  return e2 ? { ok: false, error: e2.message } : { ok: true, cuentaBorrada: true };
}
