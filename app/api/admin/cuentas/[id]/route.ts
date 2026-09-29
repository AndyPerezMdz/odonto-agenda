import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion, esSuperadmin } from "@/lib/admin";
import { recordarCuenta } from "@/lib/staff";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// POST → "Recordarle": reenvía su código o le escribe para que termine su agenda
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  try {
    const r = await recordarCuenta(s.db, id, urlSitio(request.nextUrl.origin));
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, tipo: r.tipo });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE → borra una cuenta SIN agenda (registro abandonado). Su mes gratis queda registrado igual.
export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  if (await esSuperadmin(s.db, id)) return NextResponse.json({ error: "Ésa es una cuenta de staff." }, { status: 400 });
  const { data: p } = await s.db.from("perfiles").select("agenda_id").eq("id", id).maybeSingle();
  if (p?.agenda_id) return NextResponse.json({ error: "Esa cuenta está en una agenda: quítala desde la agenda." }, { status: 400 });
  const { error } = await s.db.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
