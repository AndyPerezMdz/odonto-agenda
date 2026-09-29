import { NextResponse } from "next/server";
import { superadminEnSesion, listarAgendas } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Para cualquiera que no sea superadmin, esta API "no existe"
const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

// GET → todas las agendas con sus miembros
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  try {
    return NextResponse.json(await listarAgendas(s.db));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// (1.7) Ya no se crean agendas desde el panel: cada quien se registra en /registro.
