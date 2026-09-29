import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

// PATCH { estado: nueva | leida | hecha }
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const { estado } = (await request.json().catch(() => ({}))) as { estado?: string };
  if (!["nueva", "leida", "hecha"].includes(estado ?? "")) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  const { error } = await s.db.from("sugerencias").update({ estado }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE → borrar (spam o repetida)
export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const { error } = await s.db.from("sugerencias").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
