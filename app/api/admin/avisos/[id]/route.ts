import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

// PATCH → descartar un aviso de pago ("no me llegó nada")
export async function PATCH(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const { error } = await s.db.from("avisos_pago").update({ estado: "descartado" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
