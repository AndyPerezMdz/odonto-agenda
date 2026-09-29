import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_DIA = 5; // para que nadie llene tu buzón

// POST { texto } → "¿Qué le falta a tu agenda?"
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { texto } = (await request.json().catch(() => ({}))) as { texto?: string };
  const t = texto?.trim().slice(0, 2000) ?? "";
  if (t.length < 3) return NextResponse.json({ error: "Escribe un poquito más." }, { status: 400 });

  const db = createAdminClient();
  const desde = new Date(Date.now() - 86400000).toISOString();
  const { count } = await db.from("sugerencias").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", desde);
  if ((count ?? 0) >= MAX_DIA) return NextResponse.json({ error: "Ya mandaste varias hoy. ¡Gracias! Mañana puedes mandar más." }, { status: 429 });

  const { data: p } = await db.from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle();
  const { error } = await db.from("sugerencias").insert({ user_id: user.id, agenda_id: p?.agenda_id ?? null, texto: t });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
