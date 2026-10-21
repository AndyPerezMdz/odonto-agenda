import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { urlSitio } from "@/lib/recordatorios";
import { listarAvisosMi, resolverAvisoMi } from "@/lib/planMiServer";

export const dynamic = "force-dynamic";

// 2.3 · Avisos de pago de Mi agenda ("Ya pagué") para confirmar o rechazar
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ avisos: await listarAvisosMi(s.db) });
}

// POST { id, accion: "confirmar" | "rechazar" }
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { id?: string; accion?: string };
  if (!b.id || (b.accion !== "confirmar" && b.accion !== "rechazar")) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const r = await resolverAvisoMi(s.db, b.id, b.accion, urlSitio(request.nextUrl.origin));
  if ("error" in r && r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r);
}
