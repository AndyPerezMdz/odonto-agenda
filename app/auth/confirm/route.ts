import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Aquí llega el link del correo de "Restablecer contraseña".
// Verifica el token, abre sesión y manda a elegir la nueva contraseña.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/nueva-contrasena";
  // Sólo rutas internas, nada de redirigir a otros sitios
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("[auth/confirm]", error.message);
  }

  return NextResponse.redirect(new URL("/login?error=enlace", origin));
}
