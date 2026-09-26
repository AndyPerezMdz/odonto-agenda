import { NextResponse, type NextRequest } from "next/server";
import { duenoEnSesion, estadoCompanero } from "@/lib/companero";
import { urlSitio } from "@/lib/recordatorios";
import { periodoDe } from "@/lib/cuatrimestre";
import { correoValido, invitarUsuario } from "@/lib/invitar";

export const dynamic = "force-dynamic";

const soloDueno = () => NextResponse.json({ error: "Sólo el dueño de la agenda puede hacer esto." }, { status: 403 });

// GET → estado del compañero actual (para Personalizar y el aviso de cuatrimestre)
export async function GET() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  try {
    return NextResponse.json({ ...(await estadoCompanero(s.db, s.agendaId)), periodo: periodoDe() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST { email } → invita a un compañero (máximo uno a la vez)
export async function POST(request: NextRequest) {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();

  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  const correo = email?.trim().toLowerCase();
  if (!correo || !correoValido(correo)) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }
  if (correo === s.user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Ése es tu propio correo." }, { status: 400 });
  }

  const { companero } = await estadoCompanero(s.db, s.agendaId);
  if (companero) {
    // Reenviar a la misma persona que no ha aceptado: se borra la invitación vieja y se manda otra
    if (companero.pendiente && companero.email?.toLowerCase() === correo) {
      await s.db.auth.admin.deleteUser(companero.id);
    } else {
      return NextResponse.json(
        { error: "Ya hay un compañero en la agenda. Quítalo primero para invitar a otra persona." },
        { status: 409 }
      );
    }
  }

  const r = await invitarUsuario(s.db, {
    email: correo,
    agendaId: s.agendaId,
    rol: "companero",
    sitio: urlSitio(request.nextUrl.origin),
  });
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });

  // Invitar cuenta como "confirmado" el cuatrimestre actual
  await s.db.from("perfiles").update({ periodo_confirmado: periodoDe().id }).eq("id", s.user.id);
  return NextResponse.json({ ok: true });
}

// DELETE → quita al compañero: borra su cuenta y TODAS sus citas (o cancela una invitación pendiente)
export async function DELETE() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  const { companero } = await estadoCompanero(s.db, s.agendaId);
  if (!companero) return NextResponse.json({ ok: true, borradas: 0 });

  // Las citas se borran en cascada al borrar la cuenta (auth.users → perfiles → citas)
  const { error } = await s.db.auth.admin.deleteUser(companero.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, borradas: companero.citas });
}

// PATCH → "sí, sigue el mismo compañero este cuatrimestre"
export async function PATCH() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  const { error } = await s.db.from("perfiles").update({ periodo_confirmado: periodoDe().id }).eq("id", s.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
