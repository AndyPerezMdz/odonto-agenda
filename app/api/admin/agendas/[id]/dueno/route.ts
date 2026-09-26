import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { correoValido, invitarUsuario } from "@/lib/invitar";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

/**
 * POST { userId }  → convierte a ese miembro en el dueño (el dueño anterior pasa a compañero)
 * POST { email }   → invita a un dueño nuevo, o reenvía la invitación si sigue pendiente
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { id: agendaId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { userId?: string; email?: string };

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

  // --- Invitar / reenviar al dueño por correo
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!correoValido(email)) return NextResponse.json({ error: "Correo no válido." }, { status: 400 });

  if (duenoActual) {
    const { data: u } = await s.db.auth.admin.getUserById(duenoActual.id);
    const pendiente = !u.user?.email_confirmed_at;
    if (!pendiente) {
      return NextResponse.json({ error: "Esta agenda ya tiene un dueño activo. Usa “Hacer dueño” para cambiarlo." }, { status: 409 });
    }
    // Reenviar: se borra la invitación vieja y se manda una nueva
    await s.db.auth.admin.deleteUser(duenoActual.id);
  }

  const r = await invitarUsuario(s.db, { email, agendaId, rol: "owner", sitio: urlSitio(request.nextUrl.origin) });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
