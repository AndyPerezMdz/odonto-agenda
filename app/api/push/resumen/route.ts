import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumenMatutino } from "@/lib/pushResumen";
import { enviarPush } from "@/lib/push";
import { resumenesPushPersonales } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// Cron diario (~6 a. m. Mérida, vercel.json): "Hoy tienes N citas" a quien tenga Pro y notificaciones.
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const db = createAdminClient();
  const enviadas = await resumenMatutino(db).catch((e) => { console.error("[push resumen]", e); return 0; });
  // Agenda personal (gratis): "Tu día"
  let personales = 0;
  try {
    for (const [uid, r] of await resumenesPushPersonales(db)) {
      personales += await enviarPush(db, [uid], { titulo: r.titulo, cuerpo: r.cuerpo, url: "/personal", etiqueta: "personal-hoy" });
    }
  } catch (e) {
    console.error("[push resumen personal]", e);
  }
  // Los domingos, además: "Tu semana" (2.6, Pro)
  let semanas = 0;
  try {
    const { pushSemanaPersonales } = await import("@/lib/personalServer");
    for (const [uid, r] of await pushSemanaPersonales(db)) {
      semanas += await enviarPush(db, [uid], { titulo: r.titulo, cuerpo: r.cuerpo, url: "/personal", etiqueta: "personal-semana" });
    }
  } catch (e) {
    console.error("[push semana personal]", e);
  }
  return NextResponse.json({ ok: true, enviadas, personales, semanas });
}
