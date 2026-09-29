import { NextResponse } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { listarSugerencias } from "@/lib/staff";

export const dynamic = "force-dynamic";

// GET → el buzón completo
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  try {
    return NextResponse.json({ sugerencias: await listarSugerencias(s.db) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
