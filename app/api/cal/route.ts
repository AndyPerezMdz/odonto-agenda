import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

const nuevo = () => randomBytes(18).toString("hex"); // 36 caracteres

async function usuario() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

function respuesta(request: NextRequest, token: string) {
  const https = `${urlSitio(request.nextUrl.origin)}/api/cal/${token}`;
  return NextResponse.json({ url: https, webcal: https.replace(/^https?:/, "webcal:") });
}

// GET → link de "Tu agenda en tu calendario" (lo crea la primera vez)
export async function GET(request: NextRequest) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const db = createAdminClient();
  const { data: p } = await db.from("perfiles").select("cal_token").eq("id", u.id).single();
  let token = p?.cal_token as string | null;
  if (!token) {
    token = nuevo();
    await db.from("perfiles").update({ cal_token: token }).eq("id", u.id);
  }
  return respuesta(request, token);
}

// POST → link nuevo (el anterior deja de servir)
export async function POST(request: NextRequest) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const token = nuevo();
  await createAdminClient().from("perfiles").update({ cal_token: token }).eq("id", u.id);
  return respuesta(request, token);
}
