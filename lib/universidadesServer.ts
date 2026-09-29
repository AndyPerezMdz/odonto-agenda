import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { periodosDe, universidad } from "@/lib/universidades";

type Db = ReturnType<typeof createAdminClient>;

/** Al crear una agenda: materias de su universidad con su duración (sin duplicar). */
export async function sembrarMaterias(db: Db, agendaId: string, uni: string) {
  const u = universidad(uni);
  if (!u.materias.length) return;
  const { data: ya } = await db.from("materias").select("nombre").eq("agenda_id", agendaId);
  const existentes = new Set((ya ?? []).map((m) => String(m.nombre).trim().toLowerCase()));
  const nuevas = u.materias.filter((m) => !existentes.has(m.nombre.toLowerCase()));
  if (nuevas.length) {
    await db.from("materias").insert(nuevas.map((m) => ({ agenda_id: agendaId, nombre: m.nombre, color: m.color, duracion_min: m.duracion })));
  }
}

/** Calendario de la agenda (cuatrimestres o semestres) para calcular el periodo en el servidor. */
export async function periodosDeAgenda(db: Db, agendaId: string) {
  const { data } = await db.from("agendas").select("universidad").eq("id", agendaId).maybeSingle();
  return periodosDe(data?.universidad as string | undefined);
}

/** Precios configurados por universidad (Ajustes del panel). */
export async function preciosConfig(db: Db) {
  const { normalizarPrecios } = await import("@/lib/precios");
  const { data } = await db.from("configuracion").select("valor").eq("clave", "precios").maybeSingle();
  return normalizarPrecios(data?.valor);
}
