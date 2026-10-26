import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, pushActivo } from "@/lib/push";
import { ahoraEn, zonaValida, ZONA_BASE } from "@/lib/recordatorios";
import { bloquesPorAvisar, habitosPorAvisar, recordatoriosPorAvisar } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// 2.4 · Cada 5 minutos (desde Supabase con pg_cron, ver supabase/cron-recordatorios.sql; Vercel Hobby no deja crons tan seguidos):
// avisa en el cel a la hora de cada recordatorio de Mi agenda (o X min antes), de los eventos con aviso de los hábitos con hora y (3.0) de los bloques de tiempo. Gratis.
// 3.5 · Cada quien con SU hora: la zona la manda su cel (personales.prefs.zona); sin zona, Mérida.
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const db = createAdminClient();
  const { marcarCron } = await import("@/lib/salud");
  await marcarCron(db, "push-recordatorios");
  if (!pushActivo()) return NextResponse.json({ ok: true, omitido: "sin llaves VAPID" });

  // Zona de cada quien (sólo los que no están en Mérida; el resto cae en la base)
  const { data: pers } = await db.from("personales").select("user_id,prefs").eq("activo", true);
  const zonaDe = new Map<string, string>();
  for (const p of pers ?? []) {
    const z = zonaValida((p.prefs as { zona?: string } | null)?.zona);
    if (z !== ZONA_BASE) zonaDe.set(p.user_id as string, z);
  }
  const deZona = (userId: string, zona: string) => (zonaDe.get(userId) ?? ZONA_BASE) === zona;
  const zonas = [ZONA_BASE, ...new Set(zonaDe.values())];

  let total = 0, enviadas = 0, habitos = 0, bloques = 0;
  for (const zona of zonas) {
    const { hoy, min } = ahoraEn(zona);

    const lista = (await recordatoriosPorAvisar(db, hoy, min)).filter((e) => deZona(e.user_id, zona));
    total += lista.length;
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
    for (const { h, racha } of (await habitosPorAvisar(db, hoy, min).catch(() => [])).filter(({ h }) => deZona(h.user_id, zona))) {
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
    for (const p of (await bloquesPorAvisar(db, hoy, min).catch(() => [])).filter((p) => deZona(p.user_id, zona))) {
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
  }
  return NextResponse.json({ ok: true, zonas: zonas.length, recordatorios: total, enviadas, habitos, bloques });
}
