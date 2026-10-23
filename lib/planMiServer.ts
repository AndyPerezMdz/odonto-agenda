import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { fechaLarga } from "@/lib/fechas";
import { pesos, sumarDias } from "@/lib/pagos";
import { categoriasIniciales, type PerfilPersonal } from "@/lib/personal";
import { AVISAR_MI, DIAS_PRUEBA_MI, ayer, codigoMi, estadoMi, normalizarPlanesMi, planMiDe, type EstadoMi } from "@/lib/planMi";
import { clavePrueba } from "@/lib/pruebas";
import { correoPersonal } from "@/lib/personalServer";

type Db = ReturnType<typeof createAdminClient>;

/*
  MI AGENDA · GRATIS / PRO (2.3)
  - Registro abierto en /mi-agenda/registro: nace en Gratis; 15 días de Pro de prueba cuando la persona quiera (una vez por correo).
  - Quien también es de odonto: si su agenda de clínicas es Pro, su Mi agenda también (sin pagar extra).
  - Las que das de alta tú desde el panel nacen de cortesía (Pro sin fecha); se la puedes quitar.
  - Se paga por transferencia (concepto MI-XXXXXX) y tú confirmas en el panel, igual que en clínicas.
*/

export async function planesMiConfig(db: Db) {
  const { data } = await db.from("configuracion").select("valor").eq("clave", "planes_mi").maybeSingle();
  return normalizarPlanesMi(data?.valor);
}

/** Pro de su agenda de clínicas: undefined = no tiene; null = cortesía; fecha = Pro hasta. */
async function clinicasDe(db: Db, userId: string): Promise<string | null | undefined> {
  const { data: p } = await db.from("perfiles").select("agenda_id").eq("id", userId).maybeSingle();
  if (!p?.agenda_id) return undefined;
  const { data: a } = await db.from("agendas").select("pagado_hasta").eq("id", p.agenda_id).maybeSingle();
  return a ? (a.pagado_hasta as string | null) : undefined;
}

/** Estado del plan de Mi agenda de una persona (null si no tiene Mi agenda activa). */
export async function estadoMiDe(db: Db, userId: string): Promise<EstadoMi | null> {
  const { data: p } = await db.from("personales").select("*").eq("user_id", userId).maybeSingle();
  if (!p?.activo) return null;
  return estadoMi({ pagado_hasta: p.pagado_hasta ?? null, prueba_hasta: p.prueba_hasta ?? null }, await clinicasDe(db, userId), fechaEnZona(0));
}

/** Para los avisos automáticos (correo, push, calendario): ¿quiénes de esta lista son Pro hoy? */
export async function idsProMi(db: Db, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const hoy = fechaEnZona(0);
  const [{ data: filas }, { data: perfiles }] = await Promise.all([
    db.from("personales").select("*").in("user_id", ids),
    db.from("perfiles").select("id,agenda_id").in("id", ids),
  ]);
  const agendaIds = [...new Set((perfiles ?? []).map((p) => p.agenda_id).filter(Boolean))] as string[];
  const { data: agendas } = agendaIds.length ? await db.from("agendas").select("id,pagado_hasta").in("id", agendaIds) : { data: [] as { id: string; pagado_hasta: string | null }[] };
  const pagoAgenda = new Map((agendas ?? []).map((a) => [a.id, a.pagado_hasta as string | null]));
  const agendaDe = new Map((perfiles ?? []).map((p) => [p.id, p.agenda_id as string | null]));
  const pro = new Set<string>();
  for (const f of filas ?? []) {
    const ag = agendaDe.get(f.user_id);
    const clin = ag && pagoAgenda.has(ag) ? pagoAgenda.get(ag)! : undefined;
    if (estadoMi({ pagado_hasta: f.pagado_hasta ?? null, prueba_hasta: f.prueba_hasta ?? null }, clin, hoy).pro) pro.add(f.user_id);
  }
  return pro;
}

/**
 * Se crea (o activa) la Mi agenda de quien ya tiene sesión: al registrarse en /mi-agenda/registro,
 * o desde su agenda de clínicas ("Activarla"). Nace en Gratis; los de odonto con Pro de clínicas ya son Pro.
 */
export async function activarPersonal(
  db: Db,
  user: { id: string; email?: string | null },
  opts: { nombre?: string | null; conPassword: boolean }
): Promise<{ ok: true; prueba: boolean; ya?: boolean } | { ok: false; error: string }> {
  const email = user.email ?? "";
  const { data: ya } = await db.from("personales").select("activo").eq("user_id", user.id).maybeSingle();
  if (ya?.activo) return { ok: true, prueba: false, ya: true };
  if (ya && !ya.activo) return { ok: false, error: "Tu Mi agenda está pausada. Escríbenos para reactivarla." };

  const { data: perfil } = await db.from("perfiles").select("nombre,agenda_id").eq("id", user.id).maybeSingle();
  const odonto = !!perfil?.agenda_id;
  const tipo: PerfilPersonal = odonto ? "odonto" : "general";
  const hoy = fechaEnZona(0);
  const nombre = opts.nombre?.trim().slice(0, 60) || perfil?.nombre || email.split("@")[0] || null;

  // 2.3 · Nace en Gratis: la prueba de Pro la activa la persona cuando quiera (pruebaMiDisponible / activarPruebaMi)
  const pagado = ayer(hoy);
  const { error } = await db.from("personales").insert({
    user_id: user.id,
    activo: true,
    nombre,
    prefs: { correo: true },
    perfil: tipo,
    pagado_hasta: pagado,
    prueba_hasta: null,
    password_at: opts.conPassword ? new Date().toISOString() : null,
  });
  if (error) return { ok: false, error: error.message };
  if (nombre && !perfil?.nombre) await db.from("perfiles").update({ nombre }).eq("id", user.id);
  const { count } = await db.from("p_categorias").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!count) await db.from("p_categorias").insert(categoriasIniciales(tipo).map((c) => ({ ...c, user_id: user.id })));
  return { ok: true, prueba: false };
}

/** ¿Puede activar su prueba de Mi agenda? No la ha usado (por correo), nunca ha pagado y hoy no es Pro. */
export async function pruebaMiDisponible(db: Db, user: { id: string; email?: string | null }) {
  if (!user.email) return false;
  const [estado, { data: pr }, { count }] = await Promise.all([
    estadoMiDe(db, user.id),
    db.from("pruebas").select("mi_usada_at").eq("email", clavePrueba(user.email)).maybeSingle(),
    db.from("p_pagos").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (!estado || estado.pro || pr?.mi_usada_at || (count ?? 0) > 0) return false;
  const { data: p } = await db.from("personales").select("prueba_hasta").eq("user_id", user.id).maybeSingle();
  return !p?.prueba_hasta;
}

/** La persona activa sus 15 días de Pro (sólo una vez por correo). */
export async function activarPruebaMi(db: Db, user: { id: string; email?: string | null }): Promise<{ hasta?: string; error?: string }> {
  if (!(await pruebaMiDisponible(db, user))) return { error: "Ya usaste tu prueba de Pro (o ya tienes Pro). Para tener Pro, elige un plan." };
  const hasta = sumarDias(fechaEnZona(0), DIAS_PRUEBA_MI - 1);
  const { error } = await db.from("personales").update({ pagado_hasta: hasta, prueba_hasta: hasta }).eq("user_id", user.id);
  if (error) return { error: error.message };
  const clave = clavePrueba(user.email!);
  const { data: pr } = await db.from("pruebas").select("email").eq("email", clave).maybeSingle();
  if (pr) await db.from("pruebas").update({ mi_usada_at: new Date().toISOString() }).eq("email", clave);
  else await db.from("pruebas").insert({ email: clave, mi_usada_at: new Date().toISOString() });
  return { hasta };
}

/* ---------------- Pagos ---------------- */

export async function registrarPagoMi(db: Db, userId: string, p: { monto: number; meses: number; metodo?: string; referencia?: string | null }): Promise<{ hasta?: string; error?: string }> {
  const meses = Math.min(Math.max(Math.round(p.meses || 1), 1), 24);
  const { data, error } = await db.rpc("registrar_pago_personal", {
    p_user: userId,
    p_monto: p.monto,
    p_meses: meses,
    p_metodo: p.metodo || "spei",
    p_referencia: p.referencia ?? null,
    p_hoy: fechaEnZona(0),
  });
  if (error) return { error: error.message };
  return { hasta: data as string };
}

/** Lo que ve la persona en "Tu plan": estado, planes, datos para transferir e historial. */
export async function datosPlanMi(db: Db, userId: string, email?: string | null) {
  const [estado, planes, { data: banco }, { data: pagos }, { data: avisos }, prueba] = await Promise.all([
    estadoMiDe(db, userId),
    planesMiConfig(db),
    db.from("configuracion").select("valor").eq("clave", "pago").maybeSingle(),
    db.from("p_pagos").select("id,monto,meses,cubre_desde,cubre_hasta,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
    db.from("p_avisos").select("id,estado,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    pruebaMiDisponible(db, { id: userId, email }),
  ]);
  return {
    estado,
    pruebaDisponible: prueba,
    planes: planes.filter((p) => p.activo),
    codigo: codigoMi(userId),
    banco: banco?.valor ?? {},
    pagos: pagos ?? [],
    ultimoAviso: avisos?.[0] ? { estado: avisos[0].estado as string, fecha: avisos[0].created_at as string } : null,
  };
}

/** "Ya pagué": guarda el aviso (el monto lo pone el servidor según el plan) y te llega un correo. */
export async function avisarPagoMi(db: Db, user: { id: string; email?: string | null }, datos: { plan?: string; referencia?: string | null }, sitio: string) {
  const { data: pendiente } = await db.from("p_avisos").select("id").eq("user_id", user.id).eq("estado", "pendiente").limit(1);
  if (pendiente?.length) return { error: "Ya avisaste de un pago. En cuanto se confirme se activa tu Pro." };
  const planes = await planesMiConfig(db);
  const plan = planMiDe(planes, datos.plan) ?? planes[0];
  const referencia = datos.referencia?.trim().slice(0, 80) || null;
  const { error } = await db.from("p_avisos").insert({ user_id: user.id, monto: plan.precio, meses: plan.meses, referencia });
  if (error) return { error: error.message };
  try {
    const { correosSuperadmin, envolver } = await import("@/lib/pagosServer");
    const { data: p } = await db.from("personales").select("nombre").eq("user_id", user.id).maybeSingle();
    const quien = `${p?.nombre ?? "Alguien"} (${user.email ?? ""})`;
    const monto = `${pesos(plan.precio)} · ${plan.nombre.toLowerCase()}`;
    for (const c of await correosSuperadmin(db)) {
      await enviarConResend({
        para: c,
        asunto: `Aviso de pago · Mi agenda: ${p?.nombre ?? user.email} (${pesos(plan.precio)})`,
        html: envolver(
          "Nuevo aviso de pago de Mi agenda",
          `<p style="margin:0 0 8px;color:#4a4843;"><b>${esc(quien)}</b> dice que ya transfirió.</p>
           <table style="font-size:14px;color:#1c1b19;border-collapse:collapse;">
             <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Concepto</td><td><b>${codigoMi(user.id)}</b></td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Monto</td><td>${esc(monto)}</td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Referencia</td><td>${esc(referencia || "—")}</td></tr>
           </table>
           <p style="margin:14px 0 0;color:#4a4843;">Revisa tu banco y confírmalo en tu panel → Personales.</p>`,
          { texto: "Abrir mi panel", url: `${sitio}/admin#personales` }
        ),
        texto: `${quien} avisó un pago de Mi agenda: ${monto}. Concepto ${codigoMi(user.id)}. Referencia: ${referencia || "—"}. ${sitio}/admin#personales`,
      });
    }
  } catch (e) {
    console.error("[aviso pago Mi agenda]", e); // el aviso ya quedó guardado; lo ves en tu panel
  }
  return { ok: true };
}

export type AvisoMiAdmin = { id: string; user_id: string; email: string | null; nombre: string | null; monto: number; meses: number; referencia: string | null; created_at: string; codigo: string };

export async function listarAvisosMi(db: Db): Promise<AvisoMiAdmin[]> {
  const { data, error } = await db.from("p_avisos").select("id,user_id,monto,meses,referencia,created_at").eq("estado", "pendiente").order("created_at");
  if (error || !data?.length) return [];
  const [{ data: usuarios }, { data: per }] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("personales").select("user_id,nombre").in("user_id", data.map((d) => d.user_id)),
  ]);
  const correo = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const nombre = new Map((per ?? []).map((p) => [p.user_id, p.nombre as string | null]));
  return data.map((d) => ({ ...d, monto: Number(d.monto), email: correo.get(d.user_id) ?? null, nombre: nombre.get(d.user_id) ?? null, codigo: codigoMi(d.user_id) }));
}

async function correoDe(db: Db, userId: string) {
  const [{ data: u }, { data: p }] = await Promise.all([db.auth.admin.getUserById(userId), db.from("personales").select("nombre").eq("user_id", userId).maybeSingle()]);
  return { email: u.user?.email ?? null, nombre: ((p?.nombre as string | null) ?? "").split(" ")[0] };
}

/** Confirmar (registra el pago y le llega "¡Pago recibido!") o "No llegó" (le llega qué revisar). */
export async function resolverAvisoMi(db: Db, id: string, accion: "confirmar" | "rechazar", sitio: string) {
  const { data: a } = await db.from("p_avisos").select("id,user_id,monto,meses,referencia,estado").eq("id", id).maybeSingle();
  if (!a || a.estado !== "pendiente") return { error: "Ese aviso ya se resolvió." };
  const { correosSuperadmin } = await import("@/lib/pagosServer");
  const d = await correoDe(db, a.user_id);
  if (accion === "confirmar") {
    const r = await registrarPagoMi(db, a.user_id, { monto: Number(a.monto), meses: a.meses, referencia: a.referencia });
    if (r.error) return { error: r.error };
    await db.from("p_avisos").update({ estado: "confirmado", resuelto_at: new Date().toISOString() }).eq("id", id);
    if (d.email)
      await enviarConResend({
        para: d.email,
        nombreRemitente: "Mi agenda",
        asunto: `¡Pago recibido! Tu Pro va hasta el ${fechaLarga(r.hasta!)}`,
        html: correoPersonal(
          "¡Pago recibido, gracias!",
          `<p style="margin:0;color:#4a4d55;">${d.nombre ? `Hola, ${esc(d.nombre)}. ` : ""}Confirmamos tu pago de <b>${pesos(Number(a.monto))}</b>. Tu <b>Pro</b> de Mi agenda está activo hasta el <b>${fechaLarga(r.hasta!)}</b>. Te avisamos unos días antes de que termine.</p>`,
          { texto: "Abrir mi agenda", url: `${sitio}/personal` }
        ),
        texto: `¡Pago recibido! Tu Pro de Mi agenda va hasta el ${fechaLarga(r.hasta!)}.`,
        responderA: await correosSuperadmin(db),
      }).catch((e) => console.error("[pago Mi agenda]", e));
    return { ok: true, hasta: r.hasta };
  }
  await db.from("p_avisos").update({ estado: "rechazado", resuelto_at: new Date().toISOString() }).eq("id", id);
  if (d.email)
    await enviarConResend({
      para: d.email,
      nombreRemitente: "Mi agenda",
      asunto: "No hemos podido confirmar tu pago",
      html: correoPersonal(
        "No hemos podido confirmar tu pago",
        `<p style="margin:0 0 10px;color:#4a4d55;">${d.nombre ? `Hola, ${esc(d.nombre)}. ` : ""}Todavía no vemos tu transferencia de <b>${pesos(Number(a.monto))}</b>${a.referencia ? ` (rastreo <b>${esc(a.referencia)}</b>)` : ""}.</p>
         <p style="margin:0;color:#4a4d55;">Revisa la <b>CLABE</b>, el <b>beneficiario</b> y que el concepto sea <b>${codigoMi(a.user_id)}</b>. Si todo está bien, <b>responde a este correo con tu comprobante</b>.</p>`,
        { texto: "Ver datos de pago", url: `${sitio}/personal/ajustes#plan` }
      ),
      texto: `No hemos podido confirmar tu pago de ${pesos(Number(a.monto))}. Revisa CLABE, beneficiario y el concepto ${codigoMi(a.user_id)}. Si todo está bien, responde con tu comprobante.`,
      responderA: await correosSuperadmin(db),
    }).catch((e) => console.error("[pago Mi agenda]", e));
  return { ok: true };
}

/** Avisos automáticos (cron de la mañana): 3 días antes y el último día de su Pro propio. */
export async function avisosPlanMi(db: Db, sitio: string) {
  const hoy = fechaEnZona(0);
  const { data: filas } = await db.from("personales").select("*").eq("activo", true).not("pagado_hasta", "is", null);
  const salida: { persona: string; aviso: string }[] = [];
  for (const f of filas ?? []) {
    const dias = f.pagado_hasta >= hoy ? Math.round((Date.parse(f.pagado_hasta) - Date.parse(hoy)) / 864e5) : -1;
    if (dias !== AVISAR_MI && dias !== 0) continue;
    // Si su agenda de clínicas lo cubre, no le avisamos nada
    const e = estadoMi({ pagado_hasta: sumarDias(hoy, -1), prueba_hasta: null }, await clinicasDe(db, f.user_id), hoy);
    if (e.pro) continue;
    const d = await correoDe(db, f.user_id);
    if (!d.email) continue;
    const prueba = f.prueba_hasta && f.prueba_hasta === f.pagado_hasta;
    const asunto = dias === 0 ? `Hoy es tu último día de Pro` : `Te quedan ${AVISAR_MI} días de Pro`;
    const cuerpo = `${d.nombre ? `Hola, ${esc(d.nombre)}. ` : ""}Tu ${prueba ? "prueba de " : ""}Pro de Mi agenda ${dias === 0 ? "termina hoy" : `termina el <b>${fechaLarga(f.pagado_hasta)}</b>`}. Después tu agenda sigue en <b>Gratis</b> (eventos, pendientes, hábitos y recordatorios) y no pierdes nada; sólo no puedes crear viajes ni pagos fijos nuevos, y se apagan tus colores, el correo y el resumen de la mañana.`;
    try {
      await enviarConResend({
        para: d.email,
        nombreRemitente: "Mi agenda",
        asunto,
        html: correoPersonal(asunto, `<p style="margin:0;color:#4a4d55;">${cuerpo}</p>`, { texto: "Elegir mi plan", url: `${sitio}/personal/ajustes#plan` }),
        texto: `${asunto}. ${cuerpo.replace(/<[^>]+>/g, "")} Elige tu plan en ${sitio}/personal/ajustes`,
        idempotencia: `plan-mi-${f.user_id}-${hoy}`,
      });
      salida.push({ persona: f.nombre ?? d.email, aviso: asunto });
    } catch (err) {
      salida.push({ persona: f.nombre ?? d.email, aviso: "error: " + (err as Error).message });
    }
  }
  return salida;
}

/** Desde tu panel: dar cortesía (Pro sin fecha) o quitarla (queda en Gratis desde hoy). */
export async function cambiarCortesiaMi(db: Db, userId: string, cortesia: boolean) {
  const { error } = await db.from("personales").update({ pagado_hasta: cortesia ? null : ayer(fechaEnZona(0)), prueba_hasta: null }).eq("user_id", userId);
  return error ? { error: error.message } : { ok: true };
}
