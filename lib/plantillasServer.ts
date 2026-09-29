import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { plantilla } from "@/lib/plantillas";

type Db = ReturnType<typeof createAdminClient>;

/** Aplica una plantilla de universidad a la agenda: calendario + materias (sin duplicar las que ya existan). */
export async function aplicarPlantilla(db: Db, agendaId: string, id: string) {
  const p = plantilla(id);
  if (!p) return { error: "Esa universidad no la conozco." };
  const { error } = await db.from("agendas").update({ periodos: p.periodos, semana_clinicas: p.semana }).eq("id", agendaId);
  if (error) return { error: error.message };
  if (p.materias.length) {
    const { data: ya } = await db.from("materias").select("id,nombre,duracion_min").eq("agenda_id", agendaId);
    const porNombre = new Map((ya ?? []).map((m) => [String(m.nombre).trim().toLowerCase(), m]));
    for (const m of p.materias) {
      const existe = porNombre.get(m.nombre.toLowerCase());
      if (!existe) await db.from("materias").insert({ agenda_id: agendaId, nombre: m.nombre, color: m.color, duracion_min: m.duracion });
      else if (!existe.duracion_min) await db.from("materias").update({ duracion_min: m.duracion }).eq("id", existe.id);
    }
  }
  return { error: null };
}

/** Calendario de la agenda (para calcular el periodo del lado del servidor). */
export async function periodosDe(db: Db, agendaId: string) {
  const { data } = await db.from("agendas").select("periodos").eq("id", agendaId).maybeSingle();
  return (data?.periodos as string | undefined) ?? "cuatrimestre";
}
