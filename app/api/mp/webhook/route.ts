import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mpActivo, procesarPago } from "@/lib/mercadopago";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// Mercado Pago avisa aquí cuando cambia un pago. Formatos: { type: "payment", data: { id } } o ?topic=payment&id=…
async function manejar(request: NextRequest) {
  if (!mpActivo()) return NextResponse.json({ ok: true });
  const q = request.nextUrl.searchParams;
  const b = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; action?: string; data?: { id?: string | number } };
  const tipo = b.type ?? b.topic ?? q.get("type") ?? q.get("topic");
  const id = String(b.data?.id ?? q.get("data.id") ?? q.get("id") ?? "");
  if (tipo !== "payment" || !/^\d+$/.test(id)) return NextResponse.json({ ok: true, ignorado: true });
  try {
    const r = await procesarPago(createAdminClient(), id, urlSitio(request.nextUrl.origin));
    console.log("[mp]", r);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mp]", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // Mercado Pago reintenta
  }
}

export const POST = manejar;
export const GET = manejar;
