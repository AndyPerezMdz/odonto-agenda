import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { urlSitio } from "@/lib/recordatorios";
import { listarSolicitudes, resolverSolicitud } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ solicitudes: await listarSolicitudes(s.db) });
}

// POST { user_id, accion: "aprobar" | "descartar" }
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { user_id?: string; accion?: string };
  if (!b.user_id || (b.accion !== "aprobar" && b.accion !== "descartar")) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const r = await resolverSolicitud(s.db, b.user_id, b.accion, urlSitio(request.nextUrl.origin));
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
