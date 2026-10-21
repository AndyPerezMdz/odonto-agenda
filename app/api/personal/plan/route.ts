import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlSitio } from "@/lib/recordatorios";
import { avisarPagoMi, datosPlanMi } from "@/lib/planMiServer";
import { personalDe } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  if (!(await personalDe(db, user.id))) return null;
  return { user, db };
}
const sinAgenda = () => NextResponse.json({ error: "Esta cuenta no tiene Mi agenda." }, { status: 403 });

// 2.3 · GET → tu plan de Mi agenda: estado, planes, datos para transferir e historial
export async function GET() {
  const s = await sesion();
  if (!s) return sinAgenda();
  return NextResponse.json(await datosPlanMi(s.db, s.user.id));
}

// POST { plan, referencia? } → "Ya pagué"
export async function POST(request: NextRequest) {
  const s = await sesion();
  if (!s) return sinAgenda();
  const b = (await request.json().catch(() => ({}))) as { plan?: string; referencia?: string };
  const r = await avisarPagoMi(s.db, s.user, { plan: b.plan, referencia: b.referencia ?? null }, urlSitio(request.nextUrl.origin));
  if ("error" in r && r.error) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
