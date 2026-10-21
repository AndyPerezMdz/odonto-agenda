import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlSitio } from "@/lib/recordatorios";
import { personalDe, solicitarPersonal } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

async function quien() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// GET → ¿ya tiene Mi agenda? ¿ya la pidió?
export async function GET() {
  const u = await quien();
  if (!u) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const db = createAdminClient();
  if (await personalDe(db, u.id)) return NextResponse.json({ estado: "tiene" });
  const { data } = await db.from("p_solicitudes").select("estado").eq("user_id", u.id).maybeSingle();
  return NextResponse.json({ estado: data?.estado === "pendiente" ? "pendiente" : "nada" });
}

// POST → "La quiero"
export async function POST(request: NextRequest) {
  const u = await quien();
  if (!u) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const r = await solicitarPersonal(createAdminClient(), u.id, urlSitio(request.nextUrl.origin));
  return NextResponse.json({ estado: r === "ya-tiene" ? "tiene" : "pendiente" });
}
