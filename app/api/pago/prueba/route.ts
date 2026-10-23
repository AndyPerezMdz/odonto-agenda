import { NextResponse } from "next/server";
import { duenoEnSesion } from "@/lib/companero";
import { activarPruebaAgenda, pruebaAgendaDisponible } from "@/lib/pruebas";

export const dynamic = "force-dynamic";

// 2.3 · GET → ¿puede activar la prueba? (para el candadito). Sólo el dueño la activa.
export async function GET() {
  const s = await duenoEnSesion();
  if (!s) return NextResponse.json({ disponible: false, dueno: false });
  const r = await pruebaAgendaDisponible(s.db, s.agendaId);
  return NextResponse.json({ disponible: r.ok, dueno: true });
}

// 2.3 · POST → el dueño activa la prueba de Pro de su agenda (15 días + los de su código de creador).
export async function POST() {
  const s = await duenoEnSesion();
  if (!s) return NextResponse.json({ error: "Sólo el dueño de la agenda puede activar la prueba." }, { status: 403 });
  const r = await activarPruebaAgenda(s.db, s.agendaId);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true, hasta: r.hasta });
}
