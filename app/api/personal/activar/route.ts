import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activarPersonal } from "@/lib/planMiServer";
import { esSuperadmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// 2.3 · POST { nombre? } → crea la Mi agenda de quien ya tiene sesión (correo confirmado):
// al terminar el registro en /mi-agenda/registro, o con "Activarla" desde su agenda de clínicas.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró. Entra de nuevo." }, { status: 401 });
  if (!user.email_confirmed_at) return NextResponse.json({ error: "Primero confirma tu correo con el código." }, { status: 403 });
  const db = createAdminClient();
  if (await esSuperadmin(db, user.id)) return NextResponse.json({ error: "La cuenta de administrador no puede tener agenda." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { nombre?: string; inv?: string };
  // Quien llega aquí ya tiene contraseña (se registró con una, o ya entraba a clínicas)
  const r = await activarPersonal(db, user, { nombre: b.nombre ?? null, conPassword: true, invitacion: b.inv ?? null });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  const res = NextResponse.json(r);
  res.cookies.set("ultima_agenda", "personal", { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
