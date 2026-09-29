import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completarRegistro } from "@/lib/registro";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// POST { nombre?, codigo?, unir? } → ya con sesión (correo confirmado): crea su agenda o la une a la del link
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró. Inicia sesión de nuevo." }, { status: 401 });
  if (!user.email_confirmed_at) return NextResponse.json({ error: "Primero confirma tu correo con el código." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { nombre?: string; codigo?: string; unir?: string; universidad?: string };
  const r = await completarRegistro(createAdminClient(), user, {
    nombre: body.nombre,
    codigo: body.codigo,
    unir: body.unir,
    universidad: body.universidad,
    sitio: urlSitio(request.nextUrl.origin),
  });
  if (!r.ok) return NextResponse.json({ error: r.error, motivo: r.motivo ?? null }, { status: 409 });
  return NextResponse.json(r);
}
