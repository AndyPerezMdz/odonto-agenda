import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cerrar sesión desde un formulario (sin JavaScript). Desde Mi agenda (a=mi) regresa a su login, sin muelas.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const form = await request.formData().catch(() => null);
  const destino = form?.get("a") === "mi" ? "/login?a=mi" : "/login";
  return NextResponse.redirect(new URL(destino, request.nextUrl.origin), { status: 303 });
}
