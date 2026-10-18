import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumenMatutino } from "@/lib/pushResumen";

export const dynamic = "force-dynamic";

// Cron diario (~6 a. m. Mérida, vercel.json): "Hoy tienes N citas" a quien tenga Pro y notificaciones.
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const enviadas = await resumenMatutino(createAdminClient()).catch((e) => { console.error("[push resumen]", e); return 0; });
  return NextResponse.json({ ok: true, enviadas });
}
