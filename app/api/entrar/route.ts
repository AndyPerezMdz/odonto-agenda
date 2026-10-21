import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlSitio } from "@/lib/recordatorios";
import { enviarEnlaceEntrada } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// POST { email } → "Entrar con un link a mi correo". Siempre responde lo mismo (no revela qué correos existen).
export async function POST(request: NextRequest) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  if (!email || email.length > 200) return NextResponse.json({ error: "Escribe tu correo." }, { status: 400 });
  try {
    await enviarEnlaceEntrada(createAdminClient(), email, urlSitio(request.nextUrl.origin));
  } catch (e) {
    console.error("[entrar]", e);
  }
  return NextResponse.json({ ok: true });
}
