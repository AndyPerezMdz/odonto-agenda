import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// POST { password } → crea/cambia la contraseña de quien tiene agenda personal (la primera vez es obligatoria)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró. Pide tu link otra vez." }, { status: 401 });
  const db = createAdminClient();
  if (!(await personalDe(db, data.user.id))) return NextResponse.json({ error: "Esta cuenta no tiene agenda personal." }, { status: 403 });
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || password.length < 8) return NextResponse.json({ error: "Que tenga al menos 8 caracteres." }, { status: 400 });
  if (password.length > 72) return NextResponse.json({ error: "Máximo 72 caracteres." }, { status: 400 });
  const { error } = await db.auth.admin.updateUserById(data.user.id, { password });
  if (error) return NextResponse.json({ error: error.message.includes("weak") ? "Esa contraseña es muy fácil; prueba otra." : error.message }, { status: 400 });
  await db.from("personales").update({ password_at: new Date().toISOString() }).eq("user_id", data.user.id);
  return NextResponse.json({ ok: true });
}
