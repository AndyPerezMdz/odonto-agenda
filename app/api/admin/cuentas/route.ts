import { NextResponse } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { listarCuentas } from "@/lib/staff";

export const dynamic = "force-dynamic";

// GET → todas las cuentas (para el embudo y las cuentas a medias)
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  try {
    return NextResponse.json({ cuentas: await listarCuentas(s.db) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
