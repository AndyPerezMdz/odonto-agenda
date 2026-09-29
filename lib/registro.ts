import "server-only";
import { preciosConfig, sembrarMaterias } from "@/lib/universidadesServer";
import { esUniversidad, universidad } from "@/lib/universidades";
import { randomBytes } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { APP_VERSION } from "@/lib/novedades";
import { DIAS_GRACIA, sumarDias } from "@/lib/pagos";
import { fechaEnZona } from "@/lib/recordatorios";
import { esSuperadmin } from "@/lib/admin";
import { crearInvitacion } from "@/lib/invitaciones";
import { agendaEnPrueba, finDePrueba, gastadaEnOtra, gastarPrueba, pruebaDe, MENSAJE_PRUEBA_USADA } from "@/lib/pruebas";

type Db = ReturnType<typeof createAdminClient>;

/*
  REGISTRO LIBRE (1.7)
  - Cualquiera se registra en /registro y confirma su correo con un código de 6 dígitos.
  - Al confirmar, se le crea SU agenda (dueño/a) con mes gratis, si no lo ha usado.
    Si ya lo usó, la agenda nace vencida: la ve, pero para agendar tiene que pagar.
  - Si llegó con el link de un dueño (?unir=TOKEN), entra a esa agenda como compañero/a.
*/

export const MENSAJE_SIN_PRUEBA =
  "Ya habías usado tu mes gratis, así que tu agenda empieza sin él: la puedes ver, pero para agendar primero hay que pagar el mes (Personalizar → Suscripción).";

export function nuevoToken() {
  return randomBytes(9).toString("base64url"); // 12 caracteres, imposible de adivinar
}

/** Agenda y dueño/a de un link de compañero. null si el link no existe. */
export async function infoEnlace(db: Db, token: string) {
  if (!token || token.length > 40) return null;
  const { data: e } = await db.from("enlaces_union").select("agenda_id").eq("token", token).maybeSingle();
  if (!e) return null;
  const [{ data: a }, { data: dueno }, { data: compa }, { data: inv }] = await Promise.all([
    db.from("agendas").select("id,nombre").eq("id", e.agenda_id).single(),
    db.from("perfiles").select("id,nombre").eq("agenda_id", e.agenda_id).eq("rol", "owner").maybeSingle(),
    db.from("perfiles").select("id").eq("agenda_id", e.agenda_id).eq("rol", "companero").limit(1),
    db.from("invitaciones").select("id").eq("agenda_id", e.agenda_id).eq("rol", "companero").limit(1),
  ]);
  if (!a) return null;
  return { agendaId: a.id as string, agenda: a.nombre as string, dueno: (dueno?.nombre as string) ?? null, duenoId: (dueno?.id as string) ?? null, ocupada: !!compa?.length || !!inv?.length };
}

type Resultado = { ok: true; agenda: "creada" | "unido" | "invitacion" | "ya"; aviso?: string } | { ok: false; error: string; motivo?: string };

/**
 * Se llama justo después de confirmar el correo (y también si alguien con sesión llega sin agenda).
 * Deja a la persona dentro de una agenda: la suya nueva, o la del link.
 */
export async function completarRegistro(
  db: Db,
  user: { id: string; email?: string | null },
  datos: { nombre?: string; codigo?: string; unir?: string; universidad?: string; sitio: string }
): Promise<Resultado> {
  const email = user.email ?? "";
  if (!email) return { ok: false, error: "Tu cuenta no tiene correo." };
  if (await esSuperadmin(db, user.id)) return { ok: false, error: "La cuenta de administrador no puede tener agenda." };

  const { data: perfil } = await db.from("perfiles").select("nombre,agenda_id").eq("id", user.id).single();
  const nombre = datos.nombre?.trim().slice(0, 60) || perfil?.nombre || email.split("@")[0];
  await db.from("perfiles").update({ nombre, acepto_terminos_at: new Date().toISOString(), version_vista: APP_VERSION }).eq("id", user.id);

  // --- Con link de compañero
  if (datos.unir) {
    const e = await infoEnlace(db, datos.unir);
    if (!e) return { ok: false, error: "Ese link ya no sirve: pídele a tu compañero/a uno nuevo.", motivo: "enlace" };
    if (e.duenoId === user.id || perfil?.agenda_id === e.agendaId) return { ok: true, agenda: "ya" };
    if (e.ocupada) return { ok: false, error: "Esa agenda ya tiene compañero/a.", motivo: "ocupada" };

    const enPrueba = await agendaEnPrueba(db, e.agendaId);
    if (enPrueba && gastadaEnOtra(await pruebaDe(db, email), e.agendaId)) {
      return { ok: false, error: MENSAJE_PRUEBA_USADA, motivo: "prueba_usada" };
    }

    if (perfil?.agenda_id) {
      // Ya tiene su agenda: le queda la invitación para aceptarla adentro (ahí ve qué pasa con la suya)
      await crearInvitacion(db, { agendaId: e.agendaId, email, rol: "companero", quien: e.dueno ?? "Tu compañero/a", sitio: datos.sitio, sinCorreo: true });
      return { ok: true, agenda: "invitacion" };
    }
    const { error } = await db.from("perfiles").update({ agenda_id: e.agendaId, rol: "companero" }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    if (enPrueba) await gastarPrueba(db, email, e.agendaId);
    await db.from("enlaces_union").delete().eq("agenda_id", e.agendaId); // un solo uso
    return { ok: true, agenda: "unido" };
  }

  if (perfil?.agenda_id) return { ok: true, agenda: "ya" };

  // --- Su propia agenda: la universidad es obligatoria y queda fija para siempre
  if (!esUniversidad(datos.universidad)) return { ok: false, error: "Elige tu universidad.", motivo: "universidad" };
  const uni = universidad(datos.universidad);
  const precio = (await preciosConfig(db))[uni.id].mensual; // el precio de su universidad
  const p = await pruebaDe(db, email);
  const usada = !!p?.usada_at;
  let codigo: string | null = null;
  let mesesExtra = 0;
  let aviso: string | undefined;
  if (datos.codigo?.trim()) {
    const { data: c } = await db.from("codigos").select("codigo,meses_extra,activo").eq("codigo", datos.codigo.trim().toUpperCase()).maybeSingle();
    if (c?.activo) {
      codigo = c.codigo;
      if (!usada) mesesExtra = c.meses_extra;
    } else aviso = "Ese código de creador no existe o ya no está activo; tu agenda se creó con el mes gratis normal.";
  }
  const hasta = usada ? sumarDias(fechaEnZona(0), -(DIAS_GRACIA + 1)) : finDePrueba(mesesExtra);
  const { data: agenda, error } = await db
    .from("agendas")
    .insert({ nombre: `Agenda de ${nombre.split(" ")[0]}`, precio_mensual: precio, pagado_hasta: hasta, prueba_hasta: usada ? null : hasta, codigo, universidad: uni.id, semana_clinicas: uni.semana })
    .select("id")
    .single();
  if (error || !agenda) return { ok: false, error: error?.message ?? "No se pudo crear tu agenda." };

  const { error: e2 } = await db.from("perfiles").update({ agenda_id: agenda.id, rol: "owner" }).eq("id", user.id);
  if (e2) {
    await db.from("agendas").delete().eq("id", agenda.id);
    return { ok: false, error: e2.message };
  }
  if (!usada) await gastarPrueba(db, email, agenda.id);
  await sembrarMaterias(db, agenda.id, uni.id); // las materias de su universidad (UADY), con su duración

  return { ok: true, agenda: "creada", aviso: usada ? MENSAJE_SIN_PRUEBA : aviso };
}
