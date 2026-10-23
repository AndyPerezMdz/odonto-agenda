import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// 2.9 · POST { perfil: "odonto" | "general" } → para quién es tu Mi agenda (cambia ejemplos y textos). Lo elige cada quien.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { perfil?: string };
  if (b.perfil !== "odonto" && b.perfil !== "general") return NextResponse.json({ error: "Tipo no válido." }, { status: 400 });
  const db = createAdminClient();
  if (!(await personalDe(db, data.user.id))) return NextResponse.json({ error: "Esta cuenta no tiene Mi agenda." }, { status: 403 });
  const { error } = await db.from("personales").update({ perfil: b.perfil }).eq("user_id", data.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
