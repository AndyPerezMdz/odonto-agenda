import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertaCorreo } from "@/lib/alertas";

export const dynamic = "force-dynamic";

// 3.5 · El navegador avisa cuando Supabase no pudo mandar un correo de registro / recuperar contraseña.
// Público (pasa antes de tener cuenta): sólo acepta errores que sí parecen de correo, y el push va máximo uno por hora.
export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { donde?: unknown; mensaje?: unknown };
  const donde = ["registro", "registro-mi", "recuperar", "reenviar"].includes(String(b.donde)) ? String(b.donde) : "otro";
  const mensaje = String(b.mensaje ?? "").slice(0, 200);
  if (!/email|correo|smtp|sending/i.test(mensaje)) return NextResponse.json({ ok: true, ignorado: true });
  await alertaCorreo(createAdminClient(), `Supabase (${donde})`, mensaje);
  return NextResponse.json({ ok: true });
}
