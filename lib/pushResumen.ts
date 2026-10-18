import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, proHoy, pushActivo } from "@/lib/push";
import { fechaEnZona } from "@/lib/recordatorios";

type Db = ReturnType<typeof createAdminClient>;

/** Cron de la mañana: "Hoy tienes 3 citas · la primera a las 8:00" a cada quien (sólo Pro). */
export async function resumenMatutino(db: Db) {
  if (!pushActivo()) return 0;
  const hoy = fechaEnZona(0);
  const { data: citas } = await db
    .from("citas")
    .select("owner_id,agenda_id,hora_inicio,paciente,confirmacion")
    .eq("fecha", hoy)
    .or("estado.is.null,estado.neq.cancelo")
    .order("hora_inicio");
  if (!citas?.length) return 0;
  const { data: agendas } = await db.from("agendas").select("id,pagado_hasta").in("id", [...new Set(citas.map((c) => c.agenda_id))]);
  const pro = new Set((agendas ?? []).filter((a) => proHoy(a.pagado_hasta, hoy)).map((a) => a.id));
  const porPersona = new Map<string, typeof citas>();
  for (const c of citas) if (pro.has(c.agenda_id)) porPersona.set(c.owner_id, [...(porPersona.get(c.owner_id) ?? []), c]);
  let n = 0;
  for (const [uid, cs] of porPersona) {
    const sinConfirmar = cs.filter((c) => !c.confirmacion).length;
    n += await enviarPush(db, [uid], {
      titulo: cs.length === 1 ? "Hoy tienes 1 cita" : `Hoy tienes ${cs.length} citas`,
      cuerpo: `La primera a las ${String(cs[0].hora_inicio).slice(0, 5)} (${cs[0].paciente})${sinConfirmar ? ` · ${sinConfirmar} sin confirmar` : ""}`,
      url: `/?dia=${hoy}`,
      etiqueta: `hoy-${hoy}`,
    });
  }
  return n;
}
