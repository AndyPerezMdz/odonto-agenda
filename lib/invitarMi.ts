import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fechaEnZona } from "@/lib/recordatorios";
import { sumarDias } from "@/lib/pagos";

type Db = ReturnType<typeof createAdminClient>;

// 2.9 · "Invita a un amigo" en Mi agenda: con tu link se registra alguien nuevo y los dos ganan un mes de Pro.
// Máximo 6 meses ganados por persona. A quien ya tiene Pro sin fecha (cortesía) no se le suma nada.

export const DIAS_REGALO = 30;
export const MAX_REGALOS = 6;

/** Tu código: las primeras 8 letras de tu id (no revela nada de ti). */
export const codigoInvitacion = (userId: string) => userId.replace(/-/g, "").slice(0, 8).toUpperCase();
const limpio = (c: string) => c.replace(/[^0-9a-f]/gi, "").slice(0, 8).toLowerCase();

async function invitadorPorCodigo(db: Db, codigo: string) {
  const c = limpio(codigo);
  if (c.length !== 8) return null;
  const { data } = await db.from("personales").select("user_id,activo");
  const quien = (data ?? []).filter((p) => p.activo && String(p.user_id).replace(/-/g, "").startsWith(c));
  return quien.length === 1 ? (quien[0].user_id as string) : null;
}

/** Suma días de Pro: desde su fecha de vencimiento si aún es Pro, o desde hoy. Cortesía (sin fecha): nada. */
async function sumarPro(db: Db, userId: string, dias: number, hoy: string) {
  const { data } = await db.from("personales").select("pagado_hasta").eq("user_id", userId).maybeSingle();
  if (!data || data.pagado_hasta == null) return false;
  const base = data.pagado_hasta >= hoy ? data.pagado_hasta : sumarDias(hoy, -1);
  await db.from("personales").update({ pagado_hasta: sumarDias(base, dias) }).eq("user_id", userId);
  return true;
}

/** Al crear una Mi agenda nueva con código: se apunta la invitación y se premia a los dos. */
export async function premiarInvitacion(db: Db, invitadoId: string, correo: string | null | undefined, codigo: string) {
  const invitador = await invitadorPorCodigo(db, codigo);
  if (!invitador || invitador === invitadoId) return { ok: false as const };
  const { count } = await db.from("p_invitaciones").select("invitado", { count: "exact", head: true }).eq("invitador", invitador);
  if (!correo) return { ok: false as const };
  const { error } = await db.from("p_invitaciones").insert({ correo: correo.trim().toLowerCase(), invitado: invitadoId, invitador, dias: DIAS_REGALO });
  if (error) return { ok: false as const }; // ese correo ya se usó con una invitación (o falta el SQL 2.9)
  const hoy = fechaEnZona(0);
  await sumarPro(db, invitadoId, DIAS_REGALO, hoy);
  if ((count ?? 0) < MAX_REGALOS) await sumarPro(db, invitador, DIAS_REGALO, hoy);
  return { ok: true as const };
}

/** Para Ajustes: tu código, cuántos se registraron con él y cuántos meses llevas ganados. */
export async function datosInvitacion(db: Db, userId: string) {
  const { count, error } = await db.from("p_invitaciones").select("invitado", { count: "exact", head: true }).eq("invitador", userId);
  const invitados = error ? 0 : count ?? 0;
  return { codigo: codigoInvitacion(userId), invitados, ganados: Math.min(invitados, MAX_REGALOS), max: MAX_REGALOS, listo: !error };
}
