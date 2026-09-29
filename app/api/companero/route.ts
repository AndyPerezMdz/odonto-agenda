import { NextResponse, type NextRequest } from "next/server";
import { duenoEnSesion, estadoCompanero } from "@/lib/companero";
import { urlSitio } from "@/lib/recordatorios";
import { periodoDe } from "@/lib/cuatrimestre";
import { periodosDeAgenda } from "@/lib/universidadesServer";
import { correoValido, invitarUsuario } from "@/lib/invitar";
import { agendaEnPrueba, gastadaEnOtra, gastarPrueba, liberarPrueba, pruebaDe, usuarioPorCorreo, MENSAJE_PRUEBA_USADA } from "@/lib/pruebas";
import { crearInvitacion } from "@/lib/invitaciones";
import { esSuperadmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const soloDueno = () => NextResponse.json({ error: "Sólo el dueño de la agenda puede hacer esto." }, { status: 403 });

// GET → estado del compañero actual (para Personalizar y el aviso de cuatrimestre)
export async function GET() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  try {
    return NextResponse.json({ ...(await estadoCompanero(s.db, s.agendaId)), periodo: periodoDe(new Date(), await periodosDeAgenda(s.db, s.agendaId)) });
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
      if (companero.invitacion) await s.db.from("invitaciones").delete().eq("id", companero.id.slice(4));
      else await s.db.auth.admin.deleteUser(companero.id);
    } else {
      return NextResponse.json(
        { error: "Ya hay un compañero en la agenda. Quítalo primero para invitar a otra persona." },
        { status: 409 }
      );
    }
  }

  // Mes gratis: a una agenda en prueba no entra quien ya gastó la suya en otra agenda
  const enPrueba = await agendaEnPrueba(s.db, s.agendaId);
  if (enPrueba && gastadaEnOtra(await pruebaDe(s.db, correo), s.agendaId)) {
    return NextResponse.json({ error: MENSAJE_PRUEBA_USADA, motivo: "prueba_usada" }, { status: 409 });
  }

  const sitio = urlSitio(request.nextUrl.origin);
  const existente = await usuarioPorCorreo(s.db, correo);
  if (existente) {
    // Ya tiene cuenta (en otra agenda): le llega una invitación para cambiarse, que acepta desde su app
    if (await esSuperadmin(s.db, existente.id)) {
      return NextResponse.json({ error: "Ese correo no se puede invitar." }, { status: 400 });
    }
    const { data: yo } = await s.db.from("perfiles").select("nombre").eq("id", s.user.id).single();
    const r = await crearInvitacion(s.db, { agendaId: s.agendaId, email: correo, rol: "companero", quien: yo?.nombre ?? "Tu compañero/a", sitio });
    if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  } else {
    const r = await invitarUsuario(s.db, { email: correo, agendaId: s.agendaId, rol: "companero", sitio });
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    if (enPrueba) await gastarPrueba(s.db, correo, s.agendaId); // entra a una agenda en prueba: gasta la suya
  }

  // Invitar cuenta como "confirmado" el cuatrimestre actual
  await s.db.from("perfiles").update({ periodo_confirmado: periodoDe(new Date(), await periodosDeAgenda(s.db, s.agendaId)).id }).eq("id", s.user.id);
  return NextResponse.json({ ok: true });
}

// DELETE → quita al compañero: borra su cuenta y TODAS sus citas (o cancela una invitación pendiente)
export async function DELETE() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  const { companero } = await estadoCompanero(s.db, s.agendaId);
  if (!companero) return NextResponse.json({ ok: true, borradas: 0 });

  // Invitación a una cuenta existente que aún no acepta: sólo se cancela
  if (companero.invitacion) {
    await s.db.from("invitaciones").delete().eq("id", companero.id.slice(4));
    return NextResponse.json({ ok: true, borradas: 0 });
  }
  // Invitación nueva que nunca aceptó: su mes gratis no cuenta como usado
  if (companero.pendiente && companero.email) await liberarPrueba(s.db, companero.email, s.agendaId);

  // Las citas se borran en cascada al borrar la cuenta (auth.users → perfiles → citas)
  const { error } = await s.db.auth.admin.deleteUser(companero.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, borradas: companero.citas });
}

// PATCH → "sí, sigue el mismo compañero este cuatrimestre"
export async function PATCH() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  const { error } = await s.db.from("perfiles").update({ periodo_confirmado: periodoDe(new Date(), await periodosDeAgenda(s.db, s.agendaId)).id }).eq("id", s.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
