import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// GET → ¿ya tiene Mi agenda? (2.9: ya no hay solicitudes con aprobación; "La quiero" la activa al instante)
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  return NextResponse.json({ estado: (await personalDe(createAdminClient(), data.user.id)) ? "tiene" : "nada" });
}
