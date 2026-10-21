import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { urlSitio } from "@/lib/recordatorios";
import { enviarEnlacePersonal } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// PATCH { activo?, perfil? } → pausar / reactivar, o cambiar si es de odonto o general. POST → mandarle su link otra vez.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { activo?: boolean; perfil?: string; cortesia?: boolean };
  // 2.3 · { cortesia: true } = Pro sin fecha; false = la quita (queda en Gratis desde hoy)
  if (typeof b.cortesia === "boolean") {
    const { cambiarCortesiaMi } = await import("@/lib/planMiServer");
    const r = await cambiarCortesiaMi(s.db, id, b.cortesia);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const cambios: Record<string, unknown> = {};
  if (typeof b.activo === "boolean") cambios.activo = b.activo;
  if (b.perfil === "odonto" || b.perfil === "general") cambios.perfil = b.perfil;
  if (!Object.keys(cambios).length) return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
  const { error } = await s.db.from("personales").update(cambios).eq("user_id", id);
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

// PUT { meses, monto, referencia? } → 2.3 · registrar a mano un pago de Mi agenda (efectivo, varios meses…)
export async function PUT(request: NextRequest, { params }: Ctx) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { meses?: number; monto?: number; referencia?: string };
  const meses = Number(b.meses);
  const monto = Number(b.monto);
  if (!(meses >= 1 && meses <= 24) || !(monto >= 0)) return NextResponse.json({ error: "Revisa meses y monto." }, { status: 400 });
  const { registrarPagoMi } = await import("@/lib/planMiServer");
  const r = await registrarPagoMi(s.db, id, { meses, monto, metodo: "manual", referencia: b.referencia ?? null });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, hasta: r.hasta });
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
