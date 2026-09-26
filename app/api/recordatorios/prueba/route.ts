import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarRecordatorios, urlSitio } from "@/lib/recordatorios";

// Botón "Enviarme una prueba" de Personalizar: manda el recordatorio SÓLO a quien lo pide.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  try {
    const [r] = await enviarRecordatorios({
      soloUsuario: user.id,
      prueba: true,
      sitio: urlSitio(request.nextUrl.origin),
    });
    if (r?.estado !== "enviado") {
      return NextResponse.json({ error: r?.detalle ?? "No se pudo enviar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, correo: user.email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
