import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlSitio } from "@/lib/recordatorios";
import { enviarEnlacePersonal } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// POST { email } → "¿Tienes agenda propia?". Siempre responde lo mismo: no revela quién tiene agenda.
export async function POST(request: NextRequest) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  if (!email || email.length > 200) return NextResponse.json({ error: "Escribe tu correo." }, { status: 400 });
  try {
    await enviarEnlacePersonal(createAdminClient(), email, urlSitio(request.nextUrl.origin));
  } catch (e) {
    console.error("[personal/enlace]", e);
  }
  return NextResponse.json({ ok: true });
}
