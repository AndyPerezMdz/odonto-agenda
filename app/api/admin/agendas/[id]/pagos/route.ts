import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { registrarPago, notificarPagoConfirmado } from "@/lib/pagosServer";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// POST { monto, meses, metodo?, referencia?, avisoId? } → registra un pago y extiende la suscripción
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as { monto?: number; meses?: number; metodo?: string; referencia?: string; avisoId?: string };

  const monto = Number(b.monto);
  if (!Number.isFinite(monto) || monto < 0) return NextResponse.json({ error: "Monto no válido." }, { status: 400 });

  const r = await registrarPago(s.db, id, { monto, meses: Number(b.meses) || 1, metodo: b.metodo || "spei", referencia: b.referencia });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });

  if (b.avisoId) await s.db.from("avisos_pago").update({ estado: "confirmado" }).eq("id", b.avisoId).eq("agenda_id", id);

  // Le avisamos al cliente que su pago quedó (si falla el correo, el pago igual quedó registrado)
  let correo = true;
  try {
    await notificarPagoConfirmado(s.db, id, { monto, meses: Number(b.meses) || 1, hasta: r.hasta!, sitio: urlSitio(request.nextUrl.origin) });
  } catch (e) {
    correo = false;
    console.error("[pagos] correo de confirmación", e);
  }
  return NextResponse.json({ ok: true, hasta: r.hasta, correo });
}
