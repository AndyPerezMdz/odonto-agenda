import "server-only";
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

/** Hasta cuándo dura la prueba que empieza hoy: 1 mes + los meses extra de un código. */
export function finDePrueba(mesesExtra = 0) {
  return sumarDias(sumarMeses(fechaEnZona(0), 1 + mesesExtra), -1);
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
  const { data } = await db.from("pruebas").select("email,agenda_id,usada_at,devuelta_at").eq("email", normalizar(email)).maybeSingle();
  return (data as Prueba) ?? null;
}

/** ¿Ya gastó su prueba en OTRA agenda? (volver a la misma agenda no cuenta) */
export function gastadaEnOtra(p: Prueba | null, agendaId?: string) {
  return !!p?.usada_at && p.agenda_id !== agendaId;
}

export async function gastarPrueba(db: Db, email: string, agendaId: string) {
  const correo = normalizar(email);
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
  await db.from("pruebas").update({ usada_at: null, agenda_id: null, devuelta_at: new Date().toISOString() }).eq("email", normalizar(email));
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
  "Esta persona ya usó su mes gratis. Tienen dos opciones: que te invite a su agenda (la paga y tu mes gratis se queda guardado), o pagar la tuya para poder invitarla.";
