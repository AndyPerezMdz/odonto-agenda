import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

// PATCH { activo } → prender / apagar
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const { activo } = (await request.json().catch(() => ({}))) as { activo?: boolean };
  if (typeof activo !== "boolean") return NextResponse.json({ error: "Falta activo." }, { status: 400 });
  const { error } = await s.db.from("anuncios").update({ activo }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const { error } = await s.db.from("anuncios").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
