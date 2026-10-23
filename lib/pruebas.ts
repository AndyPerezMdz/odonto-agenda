import "server-only";
import { DIAS_PRUEBA } from "@/lib/plan";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fechaEnZona } from "@/lib/recordatorios";
import { sumarDias, sumarMeses } from "@/lib/pagos";

type Db = ReturnType<typeof createAdminClient>;

/*
  REGLAS DEL MES GRATIS (una prueba por persona, por correo):
  1. Quien entra a una agenda EN PRUEBA gasta su prueba (dueño o compañero).
  2. Quien entra a una agenda PAGADA (o de cortesía) no gasta nada.
  3. A una agenda en prueba no se puede invitar a quien ya gastó la suya en OTRA agenda.
  4. Si alguien deja una agenda en prueba para entrar a una pagada dentro de los primeros
     DIAS_DEVOLUCION días, se le devuelve su prueba. Sólo una vez en la vida.
*/
export const DIAS_DEVOLUCION = 7;

export type Prueba = { email: string; agenda_id: string | null; usada_at: string | null; devuelta_at: string | null };

export const normalizar = (email: string) => email.trim().toLowerCase();

/** Llave del mes gratis: en Gmail ignora puntos y "+algo" (es el mismo buzón). Igual que public.correo_prueba(). */
export function clavePrueba(email: string) {
  const e = normalizar(email);
  const [local, dominio] = e.split("@");
  if (dominio === "gmail.com" || dominio === "googlemail.com") return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  return e;
}

/** Hasta cuándo dura la prueba que empieza hoy: 15 días de Pro + los días extra de un código. */
export function finDePrueba(diasExtra = 0) {
  return sumarDias(fechaEnZona(0), DIAS_PRUEBA + diasExtra - 1);
}

/** Una agenda está "en prueba" si nació con mes gratis y todavía no registra ningún pago. */
export async function agendaEnPrueba(db: Db, agendaId: string) {
  const [{ data: a }, { count }] = await Promise.all([
    db.from("agendas").select("prueba_hasta,pagado_hasta").eq("id", agendaId).single(),
    db.from("pagos").select("id", { count: "exact", head: true }).eq("agenda_id", agendaId),
  ]);
  if (!a || !a.prueba_hasta || a.pagado_hasta === null) return false; // cortesía o nunca fue prueba
  return (count ?? 0) === 0;
}

export async function pruebaDe(db: Db, email: string): Promise<Prueba | null> {
  const { data } = await db.from("pruebas").select("email,agenda_id,usada_at,devuelta_at").eq("email", clavePrueba(email)).maybeSingle();
  return (data as Prueba) ?? null;
}

/** ¿Ya gastó su prueba en OTRA agenda? (volver a la misma agenda no cuenta) */
export function gastadaEnOtra(p: Prueba | null, agendaId?: string) {
  return !!p?.usada_at && p.agenda_id !== agendaId;
}

export async function gastarPrueba(db: Db, email: string, agendaId: string) {
  const correo = clavePrueba(email);
  const p = await pruebaDe(db, correo);
  if (p?.usada_at && p.agenda_id === agendaId) return; // ya contada aquí
  if (p) await db.from("pruebas").update({ usada_at: new Date().toISOString(), agenda_id: agendaId }).eq("email", correo);
  else await db.from("pruebas").insert({ email: correo, agenda_id: agendaId, usada_at: new Date().toISOString() });
}

/** ¿Se le devolvería la prueba si deja ESA agenda ahora? */
export function devolucionAplica(p: Prueba | null, agendaId: string) {
  if (!p?.usada_at || p.agenda_id !== agendaId || p.devuelta_at) return false;
  return Date.now() - new Date(p.usada_at).getTime() <= DIAS_DEVOLUCION * 864e5;
}

export async function devolverSiAplica(db: Db, email: string, agendaId: string) {
  const p = await pruebaDe(db, email);
  if (!devolucionAplica(p, agendaId)) return false;
  await db.from("pruebas").update({ usada_at: null, agenda_id: null, devuelta_at: new Date().toISOString() }).eq("email", clavePrueba(email));
  return true;
}

/** Invitación cancelada antes de aceptar: no cuenta como prueba gastada. */
export async function liberarPrueba(db: Db, email: string, agendaId: string) {
  const p = await pruebaDe(db, email);
  if (!p || p.agenda_id !== agendaId) return;
  if (p.devuelta_at) await db.from("pruebas").update({ usada_at: null, agenda_id: null }).eq("email", p.email);
  else await db.from("pruebas").delete().eq("email", p.email);
}

/** Busca una cuenta por correo (la plataforma es chica: basta con listar). */
export async function usuarioPorCorreo(db: Db, email: string) {
  const correo = normalizar(email);
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email?.toLowerCase() === correo);
    if (u) return u;
    if (data.users.length < 1000) break;
  }
  return null;
}

export const MENSAJE_PRUEBA_USADA =
  "Esta persona ya usó su prueba de Pro en otra agenda. Pueden compartir agenda cuando ésta tenga un plan pagado, o que te invite a la suya.";

/* ---------------- 2.3 · La prueba de Pro se activa cuando el dueño quiere ---------------- */

/**
 * ¿Puede esta agenda empezar su prueba de Pro? Nunca la ha tenido, nunca ha pagado, hoy no es Pro,
 * el dueño no la ha gastado y el compa (si hay) no la gastó en otra agenda.
 */
export async function pruebaAgendaDisponible(db: Db, agendaId: string): Promise<{ ok: true } | { ok: false; motivo: "ya" | "pro" | "dueno" | "compa" }> {
  const hoy = fechaEnZona(0);
  const [{ data: a }, { count }, { data: miembros }] = await Promise.all([
    db.from("agendas").select("pagado_hasta,prueba_hasta").eq("id", agendaId).single(),
    db.from("pagos").select("id", { count: "exact", head: true }).eq("agenda_id", agendaId),
    db.from("perfiles").select("id,rol").eq("agenda_id", agendaId),
  ]);
  if (!a || a.prueba_hasta || (count ?? 0) > 0) return { ok: false, motivo: "ya" };
  if (a.pagado_hasta === null || a.pagado_hasta >= hoy) return { ok: false, motivo: "pro" };
  for (const m of miembros ?? []) {
    const { data: u } = await db.auth.admin.getUserById(m.id);
    const p = u.user?.email ? await pruebaDe(db, u.user.email) : null;
    if (m.rol === "owner" && p?.usada_at) return { ok: false, motivo: "dueno" };
    if (m.rol !== "owner" && gastadaEnOtra(p, agendaId)) return { ok: false, motivo: "compa" };
  }
  return { ok: true };
}

export const MOTIVO_SIN_PRUEBA: Record<"ya" | "pro" | "dueno" | "compa", string> = {
  ya: "Esta agenda ya usó su prueba de Pro.",
  pro: "Tu agenda ya tiene Pro.",
  dueno: "Ya usaste tu prueba de Pro en otra agenda. Para tener Pro, elige un plan.",
  compa: "Tu compa ya usó su prueba de Pro en otra agenda. Para tener Pro, elijan un plan.",
};

/** El dueño activa la prueba: 15 días de Pro (+ los de su código de creador) y se gasta la del dueño y la del compa. */
export async function activarPruebaAgenda(db: Db, agendaId: string): Promise<{ hasta?: string; error?: string }> {
  const disp = await pruebaAgendaDisponible(db, agendaId);
  if (!disp.ok) return { error: MOTIVO_SIN_PRUEBA[disp.motivo] };
  const { data: a } = await db.from("agendas").select("codigo").eq("id", agendaId).single();
  let extra = 0;
  if (a?.codigo) {
    const { data: c } = await db.from("codigos").select("dias_extra,activo").eq("codigo", a.codigo).maybeSingle();
    if (c?.activo) extra = c.dias_extra ?? 15;
  }
  const hasta = finDePrueba(extra);
  const { error } = await db.from("agendas").update({ pagado_hasta: hasta, prueba_hasta: hasta }).eq("id", agendaId);
  if (error) return { error: error.message };
  const { data: miembros } = await db.from("perfiles").select("id").eq("agenda_id", agendaId);
  for (const m of miembros ?? []) {
    const { data: u } = await db.auth.admin.getUserById(m.id);
    if (u.user?.email) await gastarPrueba(db, u.user.email, agendaId);
  }
  return { hasta };
}
