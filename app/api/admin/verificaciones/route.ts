import { NextResponse } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { urlSitio } from "@/lib/recordatorios";
import { resolverRevision, revisionesPendientes } from "@/lib/verificacionServer";

export const dynamic = "force-dynamic";

// 3.1 · Plan B de la verificación de estudiante: quién espera y aprobar / rechazar.
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ revisiones: await revisionesPendientes(s.db) });
}

export async function POST(request: Request) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { user_id?: string; aprobar?: boolean };
  if (typeof b.user_id !== "string" || typeof b.aprobar !== "boolean") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  const r = await resolverRevision(s.db, b.user_id, b.aprobar, urlSitio(new URL(request.url).origin));
  return r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: 400 });
}
