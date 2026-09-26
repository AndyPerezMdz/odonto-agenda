import { NextResponse, type NextRequest } from "next/server";
import { enviarRecordatorios, urlSitio } from "@/lib/recordatorios";

// La llama el cron de Vercel cada madrugada (ver vercel.json).
// Vercel manda "Authorization: Bearer <CRON_SECRET>" automáticamente.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultados = await enviarRecordatorios({ sitio: urlSitio(request.nextUrl.origin) });
    console.log("[recordatorios]", JSON.stringify(resultados));
    return NextResponse.json({ ok: true, resultados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[recordatorios]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
