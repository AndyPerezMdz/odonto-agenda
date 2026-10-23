import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";
import { datosInvitacion } from "@/lib/invitarMi";

export const dynamic = "force-dynamic";

// 2.9 · GET → tu código para invitar y cuántos llevas
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const db = createAdminClient();
  if (!(await personalDe(db, data.user.id))) return NextResponse.json({ error: "Esta cuenta no tiene Mi agenda." }, { status: 403 });
  return NextResponse.json(await datosInvitacion(db, data.user.id));
}
