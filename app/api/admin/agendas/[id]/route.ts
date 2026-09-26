import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

// PATCH { nombre?, notas? } → renombrar la agenda o editar tus notas
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { nombre?: string; notas?: string };

  const cambios: Record<string, string | null> = {};
  if (typeof body.nombre === "string" && body.nombre.trim()) cambios.nombre = body.nombre.trim();
  if (typeof body.notas === "string") cambios.notas = body.notas.trim() || null;

  const { error } = await s.db.from("agendas").update(cambios).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE → borra la agenda COMPLETA: cuentas de sus miembros, citas, clínicas y materias
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { id } = await ctx.params;

  const { data: miembros, error } = await s.db.from("perfiles").select("id").eq("agenda_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Primero las cuentas (para no dejar usuarios que puedan iniciar sesión sin agenda)
  for (const m of miembros ?? []) {
    if (m.id === s.user.id) continue; // nunca te borres a ti mismo
    const { error: e } = await s.db.auth.admin.deleteUser(m.id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }
  // Luego la agenda: citas, clínicas y materias se van en cascada
  const { error: e2 } = await s.db.from("agendas").delete().eq("id", id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
