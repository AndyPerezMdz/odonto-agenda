import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esUniversidad } from "@/lib/universidades";
import { urlSitio } from "@/lib/recordatorios";
import { confirmarCodigoEscolar, enviarCodigoEscolar, estadoVerificacion, pedirRevisionEscolar, pendienteEscolar } from "@/lib/verificacionServer";

export const dynamic = "force-dynamic";

// 3.1 · Comprobar que es estudiante (correo institucional) antes de abrir una agenda de clínicas.
//   GET                                          → { estado, universidad, codigoEnviado, esperar }
//   GET ?agenda=1                                → { necesita, plazo, vencido… } (quien ya tiene agenda)
//   POST { accion: "enviar", universidad, correo } → manda el código de 6 dígitos
//   POST { accion: "confirmar", codigo }           → lo revisa
//   POST { accion: "staff", universidad, nota }    → plan B: lo pide al staff
async function sesion() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return data.user;
}

export async function GET(request: NextRequest) {
  const user = await sesion();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  try {
    // ?agenda=1 → para quien ya tiene agenda de clínicas: ¿le falta verificar? (aviso con plazo)
    if (request.nextUrl.searchParams.get("agenda")) return NextResponse.json(await pendienteEscolar(createAdminClient(), user));
    return NextResponse.json(await estadoVerificacion(createAdminClient(), user.id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await sesion();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró. Inicia sesión de nuevo." }, { status: 401 });
  if (!user.email_confirmed_at) return NextResponse.json({ error: "Primero confirma tu correo." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { accion?: string; universidad?: string; correo?: string; codigo?: string; nota?: string };
  const db = createAdminClient();
  try {
    if (b.accion === "enviar") {
      if (!esUniversidad(b.universidad) || typeof b.correo !== "string") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
      const r = await enviarCodigoEscolar(db, user, b.universidad, b.correo);
      return r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: 400 });
    }
    if (b.accion === "confirmar") {
      if (typeof b.codigo !== "string") return NextResponse.json({ error: "Escribe el código." }, { status: 400 });
      const r = await confirmarCodigoEscolar(db, user.id, b.codigo);
      return r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: 400 });
    }
    if (b.accion === "staff") {
      if (!esUniversidad(b.universidad) || typeof b.nota !== "string") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
      const { data: p } = await db.from("perfiles").select("nombre").eq("id", user.id).maybeSingle();
      const r = await pedirRevisionEscolar(db, { ...user, nombre: (p?.nombre as string | null) ?? null }, b.universidad, b.nota, urlSitio(request.nextUrl.origin));
      return r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: 400 });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
