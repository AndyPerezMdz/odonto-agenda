import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Aquí llegan los links de los correos de Supabase (p. ej. "Restablecer contraseña").
// Acepta los dos formatos que puede mandar Supabase:
//   1) ?token_hash=...&type=recovery   (plantilla de supabase/email-restablecer.html)
//   2) ?code=...                        (plantilla de fábrica, flujo PKCE)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/nueva-contrasena";
  // Sólo rutas internas, nada de redirigir a otros sitios
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/confirm] verifyOtp:", error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/confirm] exchangeCode:", error.message);
    // El code sólo sirve en el MISMO navegador donde se pidió el correo
    return NextResponse.redirect(new URL("/login?error=navegador", origin));
  }

  return NextResponse.redirect(new URL("/login?error=enlace", origin));
}
