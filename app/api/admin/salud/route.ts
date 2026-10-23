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
