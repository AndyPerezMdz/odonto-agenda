import { NextResponse } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { saludSistema } from "@/lib/salud";

export const dynamic = "force-dynamic";

// GET → llaves, crons y SQL (sólo si están o no; nunca los valores)
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(await saludSistema(s.db));
}

// POST { accion: "semana" } → mandarte ya el correo de "Tu semana" (para probarlo)
export async function POST(request: Request) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { accion?: string };
  // 3.5 · Probar los correos que manda Supabase (registro, recuperar): usan OTRA llave de Resend (la del SMTP),
  // así que "Tu semana" no los prueba. Te llega un "restablecer contraseña": ignóralo.
  if (b.accion === "smtp") {
    if (!s.user.email) return NextResponse.json({ error: "Tu cuenta no tiene correo." }, { status: 400 });
    const { urlSitio } = await import("@/lib/recordatorios");
    const { error } = await s.db.auth.resetPasswordForEmail(s.user.email, { redirectTo: `${urlSitio(new URL(request.url).origin)}/auth/confirm?next=/nueva-contrasena` });
    if (error) {
      const { alertaCorreo } = await import("@/lib/alertas");
      await alertaCorreo(s.db, "Supabase (prueba)", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ enviado: true });
  }
  if (b.accion !== "semana") return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  const { correoSemanaStaff } = await import("@/lib/staffSemana");
  const { urlSitio } = await import("@/lib/recordatorios");
  try {
    const r = await correoSemanaStaff(s.db, urlSitio(new URL(request.url).origin), true);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
