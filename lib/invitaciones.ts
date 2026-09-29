import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc } from "@/lib/recordatorios";
import { envolver } from "@/lib/pagosServer";
import { periodoDe } from "@/lib/cuatrimestre";
import {
  agendaEnPrueba, devolucionAplica, devolverSiAplica, gastadaEnOtra, gastarPrueba, normalizar, pruebaDe, DIAS_DEVOLUCION,
} from "@/lib/pruebas";

type Db = ReturnType<typeof createAdminClient>;

/*
  Invitaciones a personas que YA tienen cuenta (en otra agenda).
  No se les puede "reinvitar" con Supabase, así que la invitación queda aquí y la
  persona la acepta desde su propia agenda, sabiendo qué pasará con la que tiene.
*/

export async function crearInvitacion(
  db: Db,
  i: { agendaId: string; email: string; rol: "owner" | "companero"; quien: string; sitio: string; sinCorreo?: boolean }
) {
  const email = normalizar(i.email);
  await db.from("invitaciones").delete().eq("agenda_id", i.agendaId).eq("rol", i.rol);
  const { error } = await db.from("invitaciones").insert({ agenda_id: i.agendaId, email, rol: i.rol });
  if (error) return { error: error.message };

  if (i.sinCorreo) return { ok: true }; // llegó por link: la verá al entrar
  const { data: a } = await db.from("agendas").select("nombre").eq("id", i.agendaId).single();
  try {
    await enviarConResend({
      para: email,
      asunto: `${i.quien} te invitó a su agenda`,
      html: envolver(
        "Te invitaron a otra agenda",
        `<p style="margin:0 0 8px;color:#4a4843;"><b>${esc(i.quien)}</b> te invitó a <b>${esc(a?.nombre ?? "su agenda")}</b>${i.rol === "owner" ? " como dueño/a" : ""}.</p>
         <p style="margin:0;color:#4a4843;">Entra a tu agenda: ahí verás la invitación y qué pasará con tu agenda actual antes de aceptar.</p>`,
        i.sitio ? { texto: "Ver invitación", url: i.sitio } : undefined
      ),
      texto: `${i.quien} te invitó a ${a?.nombre ?? "su agenda"}. Entra a tu agenda para verla: ${i.sitio}`,
    });
  } catch {
    /* si el correo falla, la invitación igual aparece al entrar */
  }
  return { ok: true };
}

export type InvitacionParaMi = {
  id: string;
  rol: "owner" | "companero";
  agenda: string;
  quien: string | null;
  destinoEnPrueba: boolean;
  puede: boolean; // false si la regla del mes gratis lo impide
  motivo: string | null;
  // qué pasa con lo que tiene ahora
  soyDueno: boolean;
  misCitas: number;
  companero: string | null; // si soy dueño y tengo compañero, perderá su lugar
  pagadaHasta: string | null; // si mi agenda actual está pagada
  devolucion: "devuelve" | "gastada" | "no_aplica";
};

/** Invitaciones pendientes para la persona en sesión, con todo lo que necesita saber para decidir. */
export async function invitacionesPara(db: Db, userId: string, email: string): Promise<InvitacionParaMi[]> {
  const { data: invs } = await db.from("invitaciones").select("id,agenda_id,rol").eq("email", normalizar(email));
  if (!invs?.length) return [];

  const [{ data: yo }, prueba] = await Promise.all([
    db.from("perfiles").select("rol,agenda_id").eq("id", userId).single(),
    pruebaDe(db, email),
  ]);
  const actual = yo?.agenda_id as string | null;

  let misCitas = 0, companero: string | null = null, pagadaHasta: string | null = null, actualEnPrueba = false;
  if (actual) {
    const [{ count }, { data: otros }, { data: ag }, enP] = await Promise.all([
      db.from("citas").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("agenda_id", actual),
      db.from("perfiles").select("nombre").eq("agenda_id", actual).neq("id", userId),
      db.from("agendas").select("pagado_hasta").eq("id", actual).single(),
      agendaEnPrueba(db, actual),
    ]);
    misCitas = count ?? 0;
    companero = yo?.rol === "owner" ? otros?.[0]?.nombre ?? null : null;
    actualEnPrueba = enP;
    pagadaHasta = !enP ? ag?.pagado_hasta ?? null : null;
  }

  const salida: InvitacionParaMi[] = [];
  for (const inv of invs) {
    if (inv.agenda_id === actual) continue;
    const [{ data: ag }, { data: dueno }, destP] = await Promise.all([
      db.from("agendas").select("nombre").eq("id", inv.agenda_id).single(),
      db.from("perfiles").select("nombre").eq("agenda_id", inv.agenda_id).eq("rol", "owner").maybeSingle(),
      agendaEnPrueba(db, inv.agenda_id),
    ]);
    const bloqueada = destP && gastadaEnOtra(prueba, inv.agenda_id);
    salida.push({
      id: inv.id,
      rol: inv.rol,
      agenda: ag?.nombre ?? "Agenda",
      quien: dueno?.nombre ?? null,
      destinoEnPrueba: destP,
      puede: !bloqueada,
      motivo: bloqueada
        ? "Ya usaste tu mes gratis y esta agenda sigue en su mes gratis. Podrás entrar cuando esté pagada, o invita tú a esa persona a tu agenda."
        : null,
      soyDueno: yo?.rol === "owner",
      misCitas,
      companero,
      pagadaHasta,
      devolucion: !actual || !actualEnPrueba
        ? "no_aplica"
        : !destP && devolucionAplica(prueba, actual)
          ? "devuelve"
          : "gastada",
    });
  }
  return salida;
}

/** Aceptar: me cambio a la agenda nueva. Si era dueño de la mía, esa se borra. */
export async function aceptarInvitacion(db: Db, userId: string, email: string, invitacionId: string) {
  const correo = normalizar(email);
  const { data: inv } = await db.from("invitaciones").select("id,agenda_id,rol,email").eq("id", invitacionId).maybeSingle();
  if (!inv || inv.email !== correo) return { error: "Esta invitación ya no existe." };
  const destino = inv.agenda_id as string;

  const [{ data: yo }, destP, prueba] = await Promise.all([
    db.from("perfiles").select("rol,agenda_id").eq("id", userId).single(),
    agendaEnPrueba(db, destino),
    pruebaDe(db, correo),
  ]);
  const actual = (yo?.agenda_id as string | null) ?? null;
  if (actual === destino) {
    await db.from("invitaciones").delete().eq("id", inv.id);
    return { ok: true };
  }

  // Regla 3: a una agenda en prueba no entra quien ya gastó la suya
  if (destP && gastadaEnOtra(prueba, destino)) {
    return { error: "Ya usaste tu mes gratis y esta agenda sigue en su mes gratis. Podrás entrar cuando esté pagada." };
  }

  // ¿Hay lugar? (un dueño y un compañero por agenda)
  const { data: ocupantes } = await db.from("perfiles").select("id,rol").eq("agenda_id", destino);
  if (ocupantes?.some((p) => p.rol === inv.rol)) {
    return { error: inv.rol === "owner" ? "Esa agenda ya tiene dueño." : "Esa agenda ya tiene compañero/a." };
  }

  // Regla 4: devolución (si voy a una PAGADA y dejé una en prueba hace menos de 7 días, una vez en la vida)
  if (actual && !destP) await devolverSiAplica(db, correo, actual);

  // 1) Me muevo primero (si borrara mi agenda antes, se llevaría mi perfil en cascada)
  const { error: e1 } = await db
    .from("perfiles")
    .update({ agenda_id: destino, rol: inv.rol, periodo_confirmado: inv.rol === "owner" ? periodoDe().id : null })
    .eq("id", userId);
  if (e1) return { error: e1.message };

  // 2) Regla 1: si la nueva está en prueba, gasto la mía ahí
  if (destP) await gastarPrueba(db, correo, destino);

  // 3) Lo que dejo atrás
  if (actual) {
    if (yo?.rol === "owner") {
      // Mi agenda se borra; si tenía compañero/a, pierde su lugar (y le aplica la misma devolución)
      const { data: resto } = await db.from("perfiles").select("id").eq("agenda_id", actual);
      for (const p of resto ?? []) {
        const { data: u } = await db.auth.admin.getUserById(p.id);
        if (u.user?.email) await devolverSiAplica(db, u.user.email, actual);
        await db.auth.admin.deleteUser(p.id);
      }
      await db.from("agendas").delete().eq("id", actual);
    } else {
      // Era compañero/a: mis citas de allá se van; la agenda sigue siendo de su dueño
      await db.from("citas").delete().eq("owner_id", userId).eq("agenda_id", actual);
    }
  }

  await db.from("invitaciones").delete().eq("email", correo);
  return { ok: true };
}

export { DIAS_DEVOLUCION };
