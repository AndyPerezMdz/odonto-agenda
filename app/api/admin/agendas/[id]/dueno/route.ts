import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

/**
 * POST { userId }  → convierte a ese miembro en el dueño (el dueño anterior pasa a compañero)
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { id: agendaId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { userId?: string };

  const { data: miembros, error } = await s.db.from("perfiles").select("id,rol").eq("agenda_id", agendaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const duenoActual = miembros?.find((m) => m.rol === "owner");

  // --- Hacer dueño a un miembro existente
  if (body.userId) {
    if (!miembros?.some((m) => m.id === body.userId)) {
      return NextResponse.json({ error: "Esa persona no es de esta agenda." }, { status: 400 });
    }
    if (duenoActual && duenoActual.id !== body.userId) {
      const { error: e } = await s.db.from("perfiles").update({ rol: "companero" }).eq("id", duenoActual.id);
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const { error: e2 } = await s.db.from("perfiles").update({ rol: "owner" }).eq("id", body.userId);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Indica a quién hacer dueño." }, { status: 400 });
}
