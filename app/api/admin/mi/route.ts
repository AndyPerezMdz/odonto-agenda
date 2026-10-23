import { NextResponse } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { resumenMiAdmin } from "@/lib/miAdmin";

export const dynamic = "force-dynamic";

// GET → números de Mi agenda para el panel (dinero, personas y uso; sólo conteos)
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  try {
    return NextResponse.json(await resumenMiAdmin(s.db));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
