import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activarPruebaMi } from "@/lib/planMiServer";
import { personalDe } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// 2.3 · POST → activa los 15 días de Pro de Mi agenda (la persona decide cuándo; una vez por correo)
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const db = createAdminClient();
  if (!(await personalDe(db, user.id))) return NextResponse.json({ error: "Esta cuenta no tiene Mi agenda." }, { status: 403 });
  const r = await activarPruebaMi(db, user);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true, hasta: r.hasta });
}
