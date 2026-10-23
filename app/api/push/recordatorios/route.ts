import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, pushActivo } from "@/lib/push";
import { fechaEnZona } from "@/lib/recordatorios";
import { recordatoriosPorAvisar } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// 2.4 · Cada 5 minutos (desde Supabase con pg_cron, ver supabase/cron-recordatorios.sql; Vercel Hobby no deja crons tan seguidos):
// avisa en el cel a la hora de cada recordatorio de Mi agenda. Gratis.
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!pushActivo()) return NextResponse.json({ ok: true, omitido: "sin llaves VAPID" });

  const db = createAdminClient();
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
    enviadas += await enviarPush(db, [e.user_id], {
      titulo: `⏰ ${e.titulo}`,
      cuerpo: `${String(e.hora_inicio).slice(0, 5)}${e.lugar ? ` · ${e.lugar}` : ""}${e.notas ? ` · ${e.notas.slice(0, 80)}` : ""}`,
      url: "/personal",
      etiqueta: `rec-${e.id}-${hoy}`,
    });
  }
  return NextResponse.json({ ok: true, recordatorios: lista.length, enviadas });
}
