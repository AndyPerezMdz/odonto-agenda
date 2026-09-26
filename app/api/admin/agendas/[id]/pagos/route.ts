import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { registrarPago, anularUltimoPago, notificarPagoConfirmado } from "@/lib/pagosServer";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

// POST { monto, meses, metodo?, referencia?, avisoId? } → registra un pago y extiende la suscripción
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as { monto?: number; meses?: number; metodo?: string; referencia?: string; avisoId?: string };

  const monto = Number(b.monto);
  if (!Number.isFinite(monto) || monto < 0) return NextResponse.json({ error: "Monto no válido." }, { status: 400 });

  // Si viene de un aviso, "lo apartamos" primero: sólo se puede confirmar UNA vez (evita el doble clic)
  if (b.avisoId) {
    const { data: tomado } = await s.db
      .from("avisos_pago")
      .update({ estado: "confirmado" })
      .eq("id", b.avisoId)
      .eq("agenda_id", id)
      .eq("estado", "pendiente")
      .select("id");
    if (!tomado?.length) return NextResponse.json({ error: "Este aviso ya se había procesado." }, { status: 409 });
  }

  const meses = Number(b.meses) || 1;
  const r = await registrarPago(s.db, id, { monto, meses, metodo: b.metodo || "spei", referencia: b.referencia });
  if (r.error) {
    if (b.avisoId) await s.db.from("avisos_pago").update({ estado: "pendiente" }).eq("id", b.avisoId); // devolverlo
    return NextResponse.json({ error: r.error }, { status: 500 });
  }

  // Le avisamos al cliente que su pago quedó (si falla el correo, el pago igual quedó registrado)
  let correo = true;
  try {
    await notificarPagoConfirmado(s.db, id, { monto, meses, hasta: r.hasta!, sitio: urlSitio(request.nextUrl.origin) });
  } catch (e) {
    correo = false;
    console.error("[pagos] correo de confirmación", e);
  }
  return NextResponse.json({ ok: true, hasta: r.hasta, correo });
}

// DELETE ?pago=ID → anula el pago más reciente (para corregir un error). No se le avisa al cliente.
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { id } = await ctx.params;
  const pagoId = request.nextUrl.searchParams.get("pago");
  if (!pagoId) return NextResponse.json({ error: "Falta el pago." }, { status: 400 });

  const { data: pago } = await s.db.from("pagos").select("id").eq("id", pagoId).eq("agenda_id", id).maybeSingle();
  if (!pago) return NextResponse.json({ error: "Ese pago no es de esta agenda." }, { status: 404 });

  const r = await anularUltimoPago(s.db, pagoId);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, hasta: r.hasta });
}
