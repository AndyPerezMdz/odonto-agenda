import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aceptarInvitacion, invitacionesPara } from "@/lib/invitaciones";
import { normalizar } from "@/lib/pruebas";

export const dynamic = "force-dynamic";

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ? { user, email: user.email, db: createAdminClient() } : null;
}

// GET → invitaciones de otras agendas para mí (con lo que pasaría si acepto)
export async function GET() {
  const s = await sesion();
  if (!s) return NextResponse.json({ invitaciones: [] });
  try {
    return NextResponse.json({ invitaciones: await invitacionesPara(s.db, s.user.id, s.email) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST { id, accion: "aceptar" | "rechazar" }
export async function POST(request: NextRequest) {
  const s = await sesion();
  if (!s) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const { id, accion } = (await request.json().catch(() => ({}))) as { id?: string; accion?: string };
  if (!id) return NextResponse.json({ error: "Falta la invitación." }, { status: 400 });

  if (accion === "rechazar") {
    await s.db.from("invitaciones").delete().eq("id", id).eq("email", normalizar(s.email));
    return NextResponse.json({ ok: true });
  }
  if (accion !== "aceptar") return NextResponse.json({ error: "Acción no válida." }, { status: 400 });

  const r = await aceptarInvitacion(s.db, s.user.id, s.email, id);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
