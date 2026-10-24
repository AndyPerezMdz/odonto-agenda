import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, pushActivo } from "@/lib/push";
import { fechaEnZona } from "@/lib/recordatorios";
import { bloquesPorAvisar, habitosPorAvisar, recordatoriosPorAvisar } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// 2.4 · Cada 5 minutos (desde Supabase con pg_cron, ver supabase/cron-recordatorios.sql; Vercel Hobby no deja crons tan seguidos):
// avisa en el cel a la hora de cada recordatorio de Mi agenda (o X min antes), de los eventos con aviso de los hábitos con hora y (3.0) de los bloques de tiempo. Gratis.
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const db = createAdminClient();
  const { marcarCron } = await import("@/lib/salud");
  await marcarCron(db, "push-recordatorios");
  if (!pushActivo()) return NextResponse.json({ ok: true, omitido: "sin llaves VAPID" });

  const hoy = fechaEnZona(0);
  // Hora actual en Mérida (UTC-6, sin horario de verano)
  const ahora = new Date(Date.now() - 6 * 3600000);
  const min = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();

  const lista = await recordatoriosPorAvisar(db, hoy, min);
  let enviadas = 0;
  for (const e of lista) {
    // Se apunta primero: si dos vueltas del cron se enciman, sólo una lo manda
    const { data: nuevo } = await db.from("p_push_enviados").upsert({ evento_id: e.id, dia: hoy }, { onConflict: "evento_id,dia", ignoreDuplicates: true }).select("evento_id");
    if (!nuevo?.length) continue;
    const antes = e.aviso > 0 ? `En ${e.aviso < 60 ? `${e.aviso} min` : e.aviso === 60 ? "1 hora" : `${e.aviso / 60} horas`}: ` : "";
    enviadas += await enviarPush(db, [e.user_id], {
      titulo: `⏰ ${antes}${e.titulo}`,
      cuerpo: `${String(e.hora_inicio).slice(0, 5)}${e.lugar ? ` · ${e.lugar}` : ""}${e.notas ? ` · ${e.notas.slice(0, 80)}` : ""}`,
      url: "/personal",
      etiqueta: `rec-${e.id}-${hoy}`,
    });
  }
  // 2.7 · Hábitos con hora que todavía no se palomean
  let habitos = 0;
  for (const { h, racha } of await habitosPorAvisar(db, hoy, min).catch(() => [])) {
    const { data: nuevo } = await db.from("p_habitos_avisados").upsert({ habito_id: h.id, dia: hoy }, { onConflict: "habito_id,dia", ignoreDuplicates: true }).select("habito_id");
    if (!nuevo?.length) continue;
    habitos += await enviarPush(db, [h.user_id], {
      titulo: `¿Ya hiciste “${h.nombre}”?`,
      cuerpo: racha > 0 ? `Llevas ${racha} día${racha === 1 ? "" : "s"} 🔥 No la rompas.` : "Paloméalo en Mi agenda y empieza tu racha.",
      url: "/personal",
      etiqueta: `hab-${h.id}-${hoy}`,
    });
  }
  // 3.0 · Bloques de tiempo: "Ya toca: estudiar (1 h)"
  let bloques = 0;
  for (const p of await bloquesPorAvisar(db, hoy, min).catch(() => [])) {
    const { data: nuevo } = await db.from("p_pendientes_avisados").upsert({ pendiente_id: p.id, dia: hoy }, { onConflict: "pendiente_id,dia", ignoreDuplicates: true }).select("pendiente_id");
    if (!nuevo?.length) continue;
    const dur = p.duracion ?? 60;
    bloques += await enviarPush(db, [p.user_id], {
      titulo: `⏱ Ya toca: ${p.titulo}`,
      cuerpo: `${String(p.hora).slice(0, 5)} · ${dur < 60 ? `${dur} min` : dur % 60 ? `${Math.floor(dur / 60)} h ${dur % 60} min` : `${dur / 60} h`}. Paloméalo cuando acabes.`,
      url: "/personal",
      etiqueta: `blq-${p.id}-${hoy}`,
    });
  }
  return NextResponse.json({ ok: true, recordatorios: lista.length, enviadas, habitos, bloques });
}
