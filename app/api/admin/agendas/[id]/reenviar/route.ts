import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { invitarUsuario } from "@/lib/invitar";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// POST { userId } → reenvía la invitación a un miembro (dueño o compañero) que nunca activó su cuenta.
// Se borra la cuenta sin activar y se manda una invitación nueva al mismo correo, con el mismo rol.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id: agendaId } = await ctx.params;
  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };

  const { data: perfil } = await s.db.from("perfiles").select("id,rol,agenda_id,ultimo_acceso").eq("id", userId ?? "").maybeSingle();
  if (!perfil || perfil.agenda_id !== agendaId) return NextResponse.json({ error: "Esa persona no es de esta agenda." }, { status: 400 });

  const { data: u } = await s.db.auth.admin.getUserById(perfil.id);
  const user = u.user;
  if (!user?.email) return NextResponse.json({ error: "No encontré su correo." }, { status: 400 });
  if (user.email_confirmed_at || user.last_sign_in_at || perfil.ultimo_acceso) {
    return NextResponse.json({ error: "Esta persona ya activó su cuenta; no hace falta reenviar." }, { status: 409 });
  }

  const { error: e } = await s.db.auth.admin.deleteUser(perfil.id);
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });

  const r = await invitarUsuario(s.db, { email: user.email, agendaId, rol: perfil.rol, sitio: urlSitio(request.nextUrl.origin) });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
