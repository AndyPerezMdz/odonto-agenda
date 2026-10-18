import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, proHoy, pushActivo } from "@/lib/push";
import { fechaEnZona } from "@/lib/recordatorios";
import { AVISO_1H } from "@/lib/plan";

export const dynamic = "force-dynamic";

// Cron cada 15 min (vercel.json): "En 1 hora: Juan Pérez · 9:00 · Clínica 1" a quien atiende (sólo Pro).
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!pushActivo()) return NextResponse.json({ ok: true, omitido: "sin llaves VAPID" });

  const db = createAdminClient();
  const hoy = fechaEnZona(0);
  // Hora actual en Mérida (UTC-6, sin horario de verano)
  const ahora = new Date(Date.now() - 6 * 3600000);
  const min = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const desde = hhmm(min + 30);
  const hasta = hhmm(Math.min(min + 75, 23 * 60 + 59));
  // De 6:00 a 6:14 (una sola vuelta del cron): "Hoy tienes N citas"
  // El resumen de la mañana va en su propio cron diario (/api/push/resumen)
  const resumen = 0;
  if (!AVISO_1H) return NextResponse.json({ ok: true, omitido: "aviso de 1 hora apagado (AVISO_1H)" });

  const { data: citas } = await db
    .from("citas")
    .select("id,owner_id,agenda_id,paciente,hora_inicio,clinica_id,estado,confirmacion")
    .eq("fecha", hoy)
    .is("aviso_push_at", null)
    .gte("hora_inicio", desde)
    .lte("hora_inicio", hasta);
  const vivas = (citas ?? []).filter((c) => c.estado !== "cancelo");
  if (!vivas.length) return NextResponse.json({ ok: true, enviadas: 0, resumen });

  const [{ data: agendas }, { data: clinicas }] = await Promise.all([
    db.from("agendas").select("id,pagado_hasta").in("id", [...new Set(vivas.map((c) => c.agenda_id))]),
    db.from("clinicas").select("id,numero"),
  ]);
  const pro = new Set((agendas ?? []).filter((a) => proHoy(a.pagado_hasta, hoy)).map((a) => a.id));
  const clinica = new Map((clinicas ?? []).map((c) => [c.id, c.numero]));
  let enviadas = 0;
  for (const c of vivas) {
    // Se marca primero (aunque no sea Pro o no tenga celular) para no reintentarla cada 15 min
    await db.from("citas").update({ aviso_push_at: new Date().toISOString() }).eq("id", c.id);
    if (!pro.has(c.agenda_id)) continue;
    const conf = c.confirmacion === "confirmada" ? " · confirmó ✓" : c.confirmacion === "no_puede" ? " · dijo que no puede" : "";
    enviadas += await enviarPush(db, [c.owner_id], {
      titulo: `Tu paciente llega a las ${String(c.hora_inicio).slice(0, 5)}`,
      cuerpo: `${c.paciente}${c.clinica_id && clinica.get(c.clinica_id) ? ` · ${clinica.get(c.clinica_id)}` : ""}${conf}`,
      url: `/?dia=${hoy}`,
      etiqueta: `cita-${c.id}`,
    });
  }
  return NextResponse.json({ ok: true, citas: vivas.length, enviadas, resumen });
}
