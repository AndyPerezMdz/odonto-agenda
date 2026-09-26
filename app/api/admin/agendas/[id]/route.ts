import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

// PATCH { nombre?, notas?, pagado_hasta?, precio_mensual? } → editar la agenda
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { nombre?: string; notas?: string; pagado_hasta?: string | null; precio_mensual?: number };

  const cambios: Record<string, string | number | null> = {};
  if (typeof body.nombre === "string" && body.nombre.trim()) cambios.nombre = body.nombre.trim();
  if (typeof body.notas === "string") cambios.notas = body.notas.trim() || null;
  // null = cortesía (sin vencimiento); "YYYY-MM-DD" = ajustar a mano la fecha
  if (body.pagado_hasta === null || (typeof body.pagado_hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.pagado_hasta)))
    cambios.pagado_hasta = body.pagado_hasta;
  if (typeof body.precio_mensual === "number" && body.precio_mensual >= 0) cambios.precio_mensual = body.precio_mensual;

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
