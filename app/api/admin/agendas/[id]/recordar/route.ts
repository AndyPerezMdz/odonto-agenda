import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { recordatorioManual, type TipoRecordatorio } from "@/lib/pagosServer";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

const TIPOS: TipoRecordatorio[] = ["pago", "prueba", "inactiva"];

// POST { tipo } → le manda un correo al dueño/a (pago pendiente, fin del mes gratis o "¿todo bien?")
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await ctx.params;
  const { tipo } = (await request.json().catch(() => ({}))) as { tipo?: TipoRecordatorio };
  if (!tipo || !TIPOS.includes(tipo)) return NextResponse.json({ error: "Tipo de recordatorio no válido." }, { status: 400 });
  try {
    const err = await recordatorioManual(s.db, id, tipo, urlSitio(request.nextUrl.origin));
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
