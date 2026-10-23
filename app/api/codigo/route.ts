import { NextResponse, type NextRequest } from "next/server";
import { duenoEnSesion } from "@/lib/companero";
import { agendaEnPrueba, pruebaAgendaDisponible } from "@/lib/pruebas";
import { sumarDias } from "@/lib/pagos";

export const dynamic = "force-dynamic";

// POST { codigo } → el dueño canjea un código de creador: días extra de Pro durante su prueba
export async function POST(request: NextRequest) {
  const s = await duenoEnSesion();
  if (!s) return NextResponse.json({ error: "Sólo el dueño de la agenda puede usar un código." }, { status: 403 });
  const { codigo } = (await request.json().catch(() => ({}))) as { codigo?: string };
  const limpio = codigo?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
  if (!limpio) return NextResponse.json({ error: "Escribe el código." }, { status: 400 });

  const [{ data: c }, { data: agenda }] = await Promise.all([
    s.db.from("codigos").select("codigo,dias_extra,activo,creador").eq("codigo", limpio).maybeSingle(),
    s.db.from("agendas").select("codigo,prueba_hasta,pagado_hasta").eq("id", s.agendaId).single(),
  ]);
  if (!c || !c.activo) return NextResponse.json({ error: "Ese código no existe o ya no está activo." }, { status: 404 });
  if (agenda?.codigo) return NextResponse.json({ error: "Tu agenda ya tiene un código aplicado." }, { status: 409 });
  // 2.3 · Antes de activar la prueba: el código se guarda y sus días se suman al activarla
  if (!agenda?.prueba_hasta) {
    const disp = await pruebaAgendaDisponible(s.db, s.agendaId);
    if (!disp.ok) return NextResponse.json({ error: "Los códigos sólo aplican a la prueba de Pro, y esta agenda ya no la tiene." }, { status: 409 });
    const { error } = await s.db.from("agendas").update({ codigo: c.codigo }).eq("id", s.agendaId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pendiente: true, dias: c.dias_extra ?? 15, creador: c.creador });
  }
  if (!(await agendaEnPrueba(s.db, s.agendaId))) {
    return NextResponse.json({ error: "Los códigos sólo aplican durante la prueba de Pro de una agenda nueva." }, { status: 409 });
  }

  // Se suma a partir del fin de la prueba (o de hoy, si ya se había vencido)
  const hoy = new Date().toISOString().slice(0, 10);
  const base = agenda.prueba_hasta >= hoy ? agenda.prueba_hasta : sumarDias(hoy, -1);
  const dias = c.dias_extra ?? 15;
  const nueva = sumarDias(base, dias);
  const { error } = await s.db.from("agendas").update({ codigo: c.codigo, prueba_hasta: nueva, pagado_hasta: nueva }).eq("id", s.agendaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, hasta: nueva, dias, creador: c.creador });
}
