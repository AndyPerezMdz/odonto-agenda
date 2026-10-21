import { NextResponse, type NextRequest } from "next/server";
import { enviarRecordatorios, urlSitio } from "@/lib/recordatorios";
import { avisosVencimiento } from "@/lib/pagosServer";
import { createAdminClient } from "@/lib/supabase/admin";
import { correosPersonales } from "@/lib/personalServer";

// La llama el cron de Vercel cada madrugada (ver vercel.json).
// Vercel manda "Authorization: Bearer <CRON_SECRET>" automáticamente.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const sitio = urlSitio(request.nextUrl.origin);
    const resultados = await enviarRecordatorios({ sitio });
    // Mismo cron: avisos de vencimiento de la suscripción a los dueños
    const vencimientos = await avisosVencimiento(createAdminClient(), sitio).catch((e) => [{ agenda: "-", aviso: "error: " + e.message }]);
    // Y el de la agenda personal (2.1)
    const personales = await correosPersonales(createAdminClient(), sitio).catch((e) => [{ persona: "-", estado: "error: " + e.message }]);
    // Y los avisos del plan de Mi agenda (2.3): "te quedan 3 días de Pro" y "hoy es el último"
    const { avisosPlanMi } = await import("@/lib/planMiServer");
    const planesMi = await avisosPlanMi(createAdminClient(), sitio).catch((e) => [{ persona: "-", aviso: "error: " + e.message }]);
    console.log("[recordatorios]", JSON.stringify({ resultados, vencimientos, personales, planesMi }));
    return NextResponse.json({ ok: true, resultados, vencimientos, personales, planesMi });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[recordatorios]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
