import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { notificarPagoNoReflejado } from "@/lib/pagosServer";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// PATCH → "No llegó": se descarta el aviso y se le avisa al cliente por correo
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;

  const { data: aviso } = await s.db.from("avisos_pago").select("agenda_id,monto,referencia,estado").eq("id", id).maybeSingle();
  if (!aviso) return NextResponse.json({ error: "Aviso no encontrado." }, { status: 404 });

  // Sólo si sigue pendiente (evita avisarle dos veces al cliente por un doble clic)
  const { data: tomado, error } = await s.db
    .from("avisos_pago")
    .update({ estado: "descartado" })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tomado?.length) return NextResponse.json({ error: "Este aviso ya se había procesado." }, { status: 409 });

  let correo = true;
  try {
    await notificarPagoNoReflejado(s.db, aviso.agenda_id, {
      monto: aviso.monto != null ? Number(aviso.monto) : null,
      referencia: aviso.referencia,
      sitio: urlSitio(request.nextUrl.origin),
    });
  } catch (e) {
    correo = false;
    console.error("[avisos] correo de no reflejado", e);
  }
  return NextResponse.json({ ok: true, correo });
}
