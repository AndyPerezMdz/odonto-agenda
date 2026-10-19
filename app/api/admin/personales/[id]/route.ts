import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { urlSitio } from "@/lib/recordatorios";
import { enviarEnlacePersonal } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// PATCH { activo } → pausar / reactivar. POST → mandarle su link otra vez.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await params;
  const { activo } = (await request.json().catch(() => ({}))) as { activo?: boolean };
  const { error } = await s.db.from("personales").update({ activo: !!activo }).eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await params;
  const { data } = await s.db.auth.admin.getUserById(id);
  if (!data.user?.email) return NextResponse.json({ error: "No encontré esa cuenta." }, { status: 404 });
  try {
    const r = await enviarEnlacePersonal(s.db, data.user.email, urlSitio(request.nextUrl.origin), { forzar: true });
    if (r !== "enviado") return NextResponse.json({ error: "Está pausada: reactívala primero." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE → le quita la agenda personal y BORRA sus eventos y categorías. Su cuenta (y su agenda de clínicas, si tiene) se quedan.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await params;
  await s.db.from("p_eventos").delete().eq("user_id", id);
  await s.db.from("p_categorias").delete().eq("user_id", id);
  const { error } = await s.db.from("personales").delete().eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Si sólo tenía agenda personal, la cuenta ya no sirve para nada: se borra también
  const { data: p } = await s.db.from("perfiles").select("agenda_id").eq("id", id).maybeSingle();
  if (!p?.agenda_id) await s.db.auth.admin.deleteUser(id);
  return NextResponse.json({ ok: true });
}
