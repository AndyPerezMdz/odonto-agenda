import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { estadoMi, type EstadoMi } from "@/lib/planMi";
import { categoriasIniciales, entregasPendientes, expandir, textoHora, type PEvento, type PerfilPersonal } from "@/lib/personal";
import { fechaLarga } from "@/lib/fechas";
import { pesos, sumarDias } from "@/lib/pagos";
import { CAMPOS_PAGO, pagosPorAtender, type PPagoFijo, type PPagoHecho } from "@/lib/viajesPagos";
import { semanaVacia, tuSemana, type TuSemana } from "@/lib/tuSemana";

type Db = ReturnType<typeof createAdminClient>;

export type PersonalAdmin = {
  user_id: string;
  email: string | null;
  nombre: string | null;
  activo: boolean;
  password: boolean; // ya puso contraseña
  enlace_at: string | null;
  ultimo_acceso: string | null;
  ultimoLogin: string | null;
  created_at: string;
  eventos: number;
  tieneClinica: boolean;
  perfil: PerfilPersonal;
  estado: EstadoMi; // 2.3 · su plan: cortesía, prueba, Pro, incluida con clínicas o Gratis
};

const normal = (e: string) => e.trim().toLowerCase();

/** Correo con la marca de la agenda personal (no la de clínicas). */
export const correoPersonal = (titulo: string, cuerpo: string, boton?: { texto: string; url: string }) => `<!doctype html><html lang="es"><body style="margin:0;background:#f3ede2;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#2b2520;">
    <div style="background:#fbf8f2;border:1px solid #e0d5c2;border-radius:16px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b4472e;font-weight:bold;">Mi agenda</p>
      <h2 style="margin:0 0 12px;font-size:24px;font-family:Georgia,serif;font-weight:normal;">${titulo}</h2>
      ${cuerpo}
      ${boton ? `<p style="margin:22px 0 0;"><a href="${boton.url}" style="display:inline-block;background:#b4472e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${boton.texto}</a></p>` : ""}
    </div>
  </div></body></html>`;

async function usuarioPorCorreo(db: Db, email: string) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? []).find((u) => normal(u.email ?? "") === normal(email)) ?? null;
}

/** Fila de agenda personal activa de alguien (o null). */
export async function personalDe(db: Db, userId: string) {
  // "*": si aún no corre el SQL de 2.3 (sin columna perfil), no truena
  const { data } = await db.from("personales").select("*").eq("user_id", userId).maybeSingle();
  return data && data.activo ? data : null;
}

/**
 * "¿Tienes agenda propia?": si el correo está dado de alta, le manda su link de entrada.
 * Si no, no hace nada (y la respuesta es la misma, para no revelar quién tiene agenda).
 */
export async function enviarEnlacePersonal(db: Db, email: string, sitio: string, opts: { forzar?: boolean } = {}): Promise<"enviado" | "nada" | "espera"> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "nada";
  const u = await usuarioPorCorreo(db, email);
  if (!u) return "nada";
  const { data: p } = await db.from("personales").select("activo,nombre,enlace_at,password_at").eq("user_id", u.id).maybeSingle();
  if (!p?.activo) return "nada";
  // Anti-spam: un link por minuto
  if (!opts.forzar && p.enlace_at && Date.now() - new Date(p.enlace_at).getTime() < 60000) return "espera";

  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email: u.email! });
  if (error || !link?.properties?.hashed_token) throw new Error(error?.message ?? "No se pudo generar el link.");
  const url = `${sitio}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=magiclink&next=/personal`;
  const nombre = (p.nombre ?? "").split(" ")[0];
  const sinPassword = !p.password_at;
  await enviarConResend({
    para: u.email!,
    nombreRemitente: "Mi agenda",
    asunto: "Tu link para entrar a tu agenda",
    html: correoPersonal(
      `${nombre ? `Hola, ${esc(nombre)}` : "Hola"}`,
      `<p style="margin:0 0 10px;color:#4a4d55;">Toca el botón para entrar a tu agenda personal. ${sinPassword ? "La primera vez te vamos a pedir que crees tu contraseña: <b>es importante</b>, con ella entras desde cualquier cel o compu." : ""}</p>
       <p style="margin:0;color:#4a4d55;">Tu agenda vive en <a href="${sitio}/personal" style="color:#b4472e;">${esc(sitio.replace(/^https?:\/\//, ""))}/personal</a>: guárdala en favoritos o instálala en tu cel. Este botón sirve una sola vez y caduca en 1 hora; si se te vence, pide otro en <a href="${sitio}/login?a=mi" style="color:#b4472e;">${esc(sitio.replace(/^https?:\/\//, ""))}/login?a=mi</a>.</p>`,
      { texto: "Entrar a mi agenda", url }
    ),
    texto: `Entra a tu agenda personal: ${url}\n\nTu agenda vive en ${sitio}/personal (guárdala). Este link sirve una vez y caduca en 1 hora.`,
  });
  await db.from("personales").update({ enlace_at: new Date().toISOString() }).eq("user_id", u.id);
  return "enviado";
}

/**
 * Alta desde el panel: crea la cuenta si no existe (confirmada, sin contraseña) y le da agenda personal.
 * perfil (2.3): "odonto" o "general"; si no se dice, odonto si ya usa clínicas y general si no.
 */
export async function altaPersonal(db: Db, email: string, nombre: string | null, perfil?: PerfilPersonal | null): Promise<{ error?: string; user_id?: string; nueva?: boolean }> {
  const correo = normal(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "Ese correo no parece válido." };
  let u = await usuarioPorCorreo(db, correo);
  let nueva = false;
  if (!u) {
    const { data, error } = await db.auth.admin.createUser({ email: correo, email_confirm: true, user_metadata: { nombre: nombre ?? correo.split("@")[0], personal: true } });
    if (error || !data.user) return { error: error?.message ?? "No se pudo crear la cuenta." };
    u = data.user;
    nueva = true;
  }
  const { data: per } = await db.from("perfiles").select("agenda_id").eq("id", u.id).maybeSingle();
  const tipo: PerfilPersonal = perfil ?? (per?.agenda_id ? "odonto" : "general");
  const { data: ya } = await db.from("personales").select("user_id").eq("user_id", u.id).maybeSingle();
  const guardar = (conPerfil: boolean) =>
    ya
      ? db.from("personales").update({ activo: true, ...(nombre ? { nombre } : {}), ...(conPerfil && perfil ? { perfil } : {}) }).eq("user_id", u!.id)
      : db.from("personales").insert({ user_id: u!.id, activo: true, nombre: nombre ?? (u!.user_metadata as { nombre?: string })?.nombre ?? null, prefs: { correo: true }, ...(conPerfil ? { perfil: tipo } : {}) });
  let { error } = await guardar(true);
  // Si aún no se corre el SQL de 2.3 (sin columna perfil), se guarda sin él
  if (error && /perfil/.test(error.message)) ({ error } = await guardar(false));
  if (error) return { error: error.message };
  const { count } = await db.from("p_categorias").select("id", { count: "exact", head: true }).eq("user_id", u.id);
  if (!count) await db.from("p_categorias").insert(categoriasIniciales(tipo).map((c) => ({ ...c, user_id: u!.id })));
  return { user_id: u.id, nueva };
}

export async function listarPersonales(db: Db): Promise<PersonalAdmin[]> {
  const [{ data: filas }, { data: usuarios }, { data: perfiles }, { data: eventos }] = await Promise.all([
    db.from("personales").select("*").order("created_at", { ascending: false }),
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("perfiles").select("id,agenda_id"),
    db.from("p_eventos").select("user_id"),
  ]);
  const { data: agendas } = await db.from("agendas").select("id,pagado_hasta");
  const pagoAgenda = new Map((agendas ?? []).map((a) => [a.id as string, a.pagado_hasta as string | null]));
  const hoy = fechaEnZona(0);
  const usr = new Map((usuarios?.users ?? []).map((u) => [u.id, u]));
  const agenda = new Map((perfiles ?? []).map((p) => [p.id, p.agenda_id]));
  const n = new Map<string, number>();
  for (const e of eventos ?? []) n.set(e.user_id, (n.get(e.user_id) ?? 0) + 1);
  return (filas ?? []).map((f) => {
    const u = usr.get(f.user_id);
    return {
      user_id: f.user_id,
      email: u?.email ?? null,
      nombre: f.nombre,
      activo: f.activo,
      password: !!f.password_at,
      enlace_at: f.enlace_at,
      ultimo_acceso: f.ultimo_acceso,
      ultimoLogin: u?.last_sign_in_at ?? null,
      created_at: f.created_at,
      eventos: n.get(f.user_id) ?? 0,
      tieneClinica: !!agenda.get(f.user_id),
      perfil: f.perfil === "general" ? "general" : "odonto",
      estado: estadoMi(
        { pagado_hasta: f.pagado_hasta ?? null, prueba_hasta: f.prueba_hasta ?? null },
        (() => {
          const ag = agenda.get(f.user_id) as string | null | undefined;
          return ag && pagoAgenda.has(ag) ? pagoAgenda.get(ag) : undefined;
        })(),
        hoy
      ),
    };
  });
}

/** Ids de quienes tienen agenda personal (para no contarlos como "registro a medias"). */
export async function idsPersonales(db: Db) {
  const { data } = await db.from("personales").select("user_id");
  return new Set((data ?? []).map((x) => x.user_id as string));
}

/* ---------------- avisos ---------------- */

type Fila = PEvento & { user_id: string };

async function eventosDe(db: Db, ids: string[]) {
  if (!ids.length) return [] as Fila[];
  const { data } = await db
    .from("p_eventos")
    .select("id,user_id,tipo,titulo,fecha,fecha_fin,hora_inicio,hora_fin,lugar,notas,categoria_id,hecho,hecho_at,repetir,repetir_hasta,excepciones")
    .in("user_id", ids);
  return (data ?? []) as Fila[];
}

/** 2.5 · Pagos fijos y "ya pagué" de esas personas (vacío si aún no existe la tabla). */
async function pagosDe(db: Db, ids: string[]) {
  if (!ids.length) return { pagos: [] as PPagoFijo[], hechos: [] as PPagoHecho[] };
  const desde = sumarDias(fechaEnZona(0), -70);
  const [{ data: pagos }, { data: hechos }] = await Promise.all([
    db.from("p_pagos_fijos").select(CAMPOS_PAGO).in("user_id", ids).eq("activo", true),
    db.from("p_pagos_fijos_hechos").select("pago_id,user_id,periodo,monto,pagado_at").in("user_id", ids).gte("periodo", desde),
  ]);
  return {
    pagos: ((pagos ?? []) as PPagoFijo[]).map((p) => ({ ...p, monto: Number(p.monto) })),
    hechos: (hechos ?? []) as (PPagoHecho & { user_id: string })[],
  };
}
/** Lo que toca pagar (vencido o dentro de sus días de aviso) de una persona. */
function pagosPorAtenderDe(todo: Awaited<ReturnType<typeof pagosDe>>, userId: string, hoy: string) {
  const mios = todo.pagos.filter((p) => p.user_id === userId);
  const ids = new Set(mios.map((p) => p.id));
  return pagosPorAtender(mios, todo.hechos.filter((h) => ids.has(h.pago_id)), hoy);
}

/** Lo de hoy para una persona: ocurrencias de hoy (sin entregas) y entregas pendientes. */
export function resumenDia(eventos: PEvento[], hoy: string) {
  const deHoy = expandir(eventos, hoy, hoy).filter((o) => o.tipo !== "entrega");
  const { vencidas, proximas } = entregasPendientes(eventos, hoy, 3);
  return { deHoy, vencidas, proximas };
}

/** Correo de la mañana de la agenda personal (va en el mismo cron que el de clínicas). */
export async function correosPersonales(db: Db, sitio: string) {
  const hoy = fechaEnZona(0);
  const { data: filas } = await db.from("personales").select("user_id,nombre,prefs,activo").eq("activo", true);
  // 2.3 · El correo de la mañana es de Pro
  const { idsProMi } = await import("@/lib/planMiServer");
  const pro = await idsProMi(db, (filas ?? []).map((f) => f.user_id as string));
  const activos = (filas ?? []).filter((f) => pro.has(f.user_id) && (f.prefs as { correo?: boolean } | null)?.correo !== false);
  if (!activos.length) return [];
  const [eventos, { data: usuarios }, todoPagos] = await Promise.all([eventosDe(db, activos.map((f) => f.user_id)), db.auth.admin.listUsers({ perPage: 1000 }), pagosDe(db, activos.map((f) => f.user_id))]);
  const correo = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email]));
  const out: { persona: string; estado: string }[] = [];
  for (const f of activos) {
    const para = correo.get(f.user_id);
    const mios = eventos.filter((e) => e.user_id === f.user_id);
    const { deHoy, vencidas, proximas } = resumenDia(mios, hoy);
    const pagar = pagosPorAtenderDe(todoPagos, f.user_id, hoy);
    const persona = f.nombre ?? para ?? f.user_id;
    if (!para) { out.push({ persona, estado: "sin correo" }); continue; }
    if (!deHoy.length && !vencidas.length && !proximas.length && !pagar.length) { out.push({ persona, estado: "nada hoy" }); continue; }
    const li = (t: string) => `<li style="margin:0 0 6px;">${t}</li>`;
    const bloque = (titulo: string, items: string[]) =>
      items.length ? `<p style="margin:16px 0 6px;font-weight:bold;">${titulo}</p><ul style="margin:0;padding-left:18px;color:#4a4d55;">${items.join("")}</ul>` : "";
    const html = correoPersonal(
      `Tu día: ${esc(fechaLarga(hoy))}`,
      bloque("Hoy", deHoy.map((o) => li(`<b>${esc(textoHora(o))}</b> · ${esc(o.titulo)}${o.lugar ? ` · ${esc(o.lugar)}` : ""}${o.tipo === "viaje" ? " ✈" : ""}`))) +
        bloque("Se te pasó", vencidas.map((e) => li(`${esc(e.titulo)} <span style="color:#b4322b;">(era el ${esc(fechaLarga(e.fecha))})</span>`))) +
        bloque("Por entregar", proximas.map((e) => li(`${esc(e.titulo)} · ${e.fecha === hoy ? "<b>hoy</b>" : e.fecha === sumarDias(hoy, 1) ? "mañana" : esc(fechaLarga(e.fecha))}`))) +
        bloque("Toca pagar", pagar.map((v) => li(`${esc(v.pago.nombre)} · ${esc(pesos(v.pago.monto))} · ${v.fecha < hoy ? `<span style="color:#b4322b;">era el ${esc(fechaLarga(v.fecha))}</span>` : v.fecha === hoy ? "<b>hoy</b>" : esc(fechaLarga(v.fecha))}`))),
      { texto: "Abrir mi agenda", url: `${sitio}/personal` }
    );
    const texto = [
      ...deHoy.map((o) => `${textoHora(o)} · ${o.titulo}`),
      ...vencidas.map((e) => `Se te pasó: ${e.titulo}`),
      ...proximas.map((e) => `Por entregar: ${e.titulo} (${e.fecha})`),
      ...pagar.map((v) => `Toca pagar: ${v.pago.nombre} ${pesos(v.pago.monto)} (${v.fecha})`),
    ].join("\n");
    try {
      await enviarConResend({ para, nombreRemitente: "Mi agenda", asunto: deHoy.length ? `Hoy: ${deHoy.length} en tu agenda` : pagar.length && !vencidas.length && !proximas.length ? "Tienes pagos por hacer" : "Tienes entregas pendientes", html, texto, idempotencia: `personal-${f.user_id}-${hoy}` });
      out.push({ persona, estado: "enviado" });
    } catch (e) {
      out.push({ persona, estado: "error: " + (e as Error).message });
    }
  }
  return out;
}

/** Para el push de la mañana: { userId → texto } */
export async function resumenesPushPersonales(db: Db) {
  const hoy = fechaEnZona(0);
  const { data: filas } = await db.from("personales").select("user_id").eq("activo", true);
  // 2.3 · Las notificaciones son de Pro
  const { idsProMi } = await import("@/lib/planMiServer");
  const pro = await idsProMi(db, (filas ?? []).map((f) => f.user_id as string));
  const ids = (filas ?? []).map((f) => f.user_id as string).filter((id) => pro.has(id));
  const [eventos, todoPagos] = await Promise.all([eventosDe(db, ids), pagosDe(db, ids)]);
  const r = new Map<string, { titulo: string; cuerpo: string }>();
  for (const id of ids) {
    const { deHoy, vencidas, proximas } = resumenDia(eventos.filter((e) => e.user_id === id), hoy);
    const entHoy = proximas.filter((e) => e.fecha === hoy).length;
    // Pagos: los de hoy o atrasados (los "en 3 días" ya salen en la agenda)
    const pagosHoy = pagosPorAtenderDe(todoPagos, id, hoy).filter((v) => v.fecha <= hoy);
    if (!deHoy.length && !vencidas.length && !entHoy && !pagosHoy.length) continue;
    const partes = [
      deHoy.length ? `${deHoy.length} en tu agenda${deHoy[0].hora_inicio ? ` (la primera a las ${deHoy[0].hora_inicio.slice(0, 5)})` : ""}` : null,
      entHoy ? `${entHoy} entrega${entHoy === 1 ? "" : "s"} hoy` : null,
      vencidas.length ? `${vencidas.length} pendiente${vencidas.length === 1 ? "" : "s"} atrasada${vencidas.length === 1 ? "" : "s"}` : null,
      pagosHoy.length ? `pagar: ${pagosHoy.map((v) => v.pago.nombre).join(", ")}` : null,
    ].filter(Boolean);
    r.set(id, { titulo: "Tu día", cuerpo: partes.join(" · ") });
  }
  return r;
}

export { eventosDe as eventosPersonalesDe };

/* ---------------- 2.6 · Tu semana (domingo, Pro) ---------------- */

const esDomingo = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
};

/** De cada quien con Pro y "Tu semana" encendido: su resumen de lunes a domingo (los vacíos no). */
async function semanasDe(db: Db, hoy: string) {
  const { data: filas } = await db.from("personales").select("user_id,nombre,prefs").eq("activo", true);
  const { idsProMi } = await import("@/lib/planMiServer");
  const pro = await idsProMi(db, (filas ?? []).map((f) => f.user_id as string));
  const activos = (filas ?? []).filter((f) => pro.has(f.user_id) && (f.prefs as { semana?: boolean } | null)?.semana !== false);
  const ids = activos.map((f) => f.user_id as string);
  const [eventos, todoPagos] = await Promise.all([eventosDe(db, ids), pagosDe(db, ids)]);
  const lunes = sumarDias(hoy, 1);
  const out: { userId: string; nombre: string | null; s: TuSemana }[] = [];
  for (const f of activos) {
    const pagos = todoPagos.pagos.filter((p) => p.user_id === f.user_id);
    const idsPagos = new Set(pagos.map((p) => p.id));
    const s = tuSemana(eventos.filter((e) => e.user_id === f.user_id), pagos, todoPagos.hechos.filter((h) => idsPagos.has(h.pago_id)), lunes);
    if (!semanaVacia(s)) out.push({ userId: f.user_id, nombre: f.nombre ?? null, s });
  }
  return out;
}

const resumenCorto = (s: TuSemana) =>
  [
    s.entregas.length ? `${s.entregas.length} entrega${s.entregas.length === 1 ? "" : "s"}` : "",
    s.pagos.length ? `${pesos(s.totalPagos)} en pagos` : "",
    s.fechas.length ? `${s.fechas.length} cumple${s.fechas.length === 1 ? "" : "s"}` : "",
    s.viajes.length ? `${s.viajes.length} viaje${s.viajes.length === 1 ? "" : "s"}` : "",
    s.eventos ? `${s.eventos} evento${s.eventos === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");

/** Correo "Tu semana" (va en el cron diario; sólo hace algo en domingo, hora de Mérida). */
export async function correosSemanaPersonales(db: Db, sitio: string) {
  const hoy = fechaEnZona(0);
  if (!esDomingo(hoy)) return [];
  const semanas = await semanasDe(db, hoy);
  if (!semanas.length) return [];
  const { data: usuarios } = await db.auth.admin.listUsers({ perPage: 1000 });
  const correo = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email]));
  const dia = (f: string) => esc(fechaLarga(f));
  const li = (t: string) => `<li style="margin:0 0 6px;">${t}</li>`;
  const bloque = (titulo: string, items: string[]) =>
    items.length ? `<p style="margin:16px 0 6px;font-weight:bold;">${titulo}</p><ul style="margin:0;padding-left:18px;color:#4a4d55;">${items.join("")}</ul>` : "";
  const out: { persona: string; estado: string }[] = [];
  for (const { userId, nombre, s } of semanas) {
    const para = correo.get(userId);
    const persona = nombre ?? para ?? userId;
    if (!para) { out.push({ persona, estado: "sin correo" }); continue; }
    const html = correoPersonal(
      `Tu semana: ${dia(s.desde)} al ${dia(s.hasta)}`,
      `<p style="margin:0;color:#4a4d55;">${nombre ? `Hola, ${esc(nombre)}. ` : ""}Esto es lo que viene: ${esc(resumenCorto(s))}.${s.diaPesado ? ` El día más cargado es el ${dia(s.diaPesado.dia)}.` : ""}</p>` +
        bloque("Por entregar", s.entregas.map((o) => li(`${esc(o.titulo)} · ${dia(o.dia)}`))) +
        bloque("Pagos", s.pagos.map((v) => li(`${esc(v.pago.nombre)} · ${esc(pesos(v.pago.monto))} · ${dia(v.fecha)}`))) +
        bloque("Fechas especiales", s.fechas.map((o) => li(`🎂 ${esc(o.titulo)} · ${dia(o.dia)}`))) +
        bloque("Viajes", s.viajes.map((v) => li(`✈ ${esc(v.titulo)} · ${dia(v.fecha)}${v.fecha_fin && v.fecha_fin !== v.fecha ? ` al ${dia(v.fecha_fin)}` : ""}`))),
      { texto: "Ver mi semana", url: `${sitio}/personal` }
    );
    const texto = [
      `Tu semana: ${resumenCorto(s)}`,
      ...s.entregas.map((o) => `Entrega: ${o.titulo} (${o.dia})`),
      ...s.pagos.map((v) => `Pago: ${v.pago.nombre} ${pesos(v.pago.monto)} (${v.fecha})`),
      ...s.fechas.map((o) => `Fecha: ${o.titulo} (${o.dia})`),
      ...s.viajes.map((v) => `Viaje: ${v.titulo} (${v.fecha})`),
    ].join("\n");
    try {
      await enviarConResend({ para, nombreRemitente: "Mi agenda", asunto: `Tu semana: ${resumenCorto(s)}`.slice(0, 120), html, texto, idempotencia: `semana-${userId}-${hoy}` });
      out.push({ persona, estado: "enviado" });
    } catch (e) {
      out.push({ persona, estado: "error: " + (e as Error).message });
    }
  }
  return out;
}

/** Push "Tu semana" del domingo: { userId → texto } */
export async function pushSemanaPersonales(db: Db) {
  const hoy = fechaEnZona(0);
  const r = new Map<string, { titulo: string; cuerpo: string }>();
  if (!esDomingo(hoy)) return r;
  for (const { userId, s } of await semanasDe(db, hoy)) r.set(userId, { titulo: "Tu semana", cuerpo: resumenCorto(s) });
  return r;
}

/* ---------------- 2.2 · Link de entrada (para cualquier cuenta) ---------------- */

/**
 * "Entrar con un link a mi correo": sirve para quien olvidó su contraseña, para quien entra por
 * primera vez a Mi agenda y para quien no la quiere teclear. Lleva a "/", que decide a cuál agenda.
 * No revela si el correo existe. Un link por minuto por cuenta.
 */
export async function enviarEnlaceEntrada(db: Db, email: string, sitio: string): Promise<"enviado" | "nada" | "espera"> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "nada";
  const u = await usuarioPorCorreo(db, email);
  if (!u?.email) return "nada";
  const meta = (u.app_metadata ?? {}) as { enlace_at?: string };
  if (meta.enlace_at && Date.now() - new Date(meta.enlace_at).getTime() < 60000) return "espera";

  const [{ data: perfil }, { data: pers }] = await Promise.all([
    db.from("perfiles").select("nombre,agenda_id").eq("id", u.id).maybeSingle(),
    db.from("personales").select("activo,nombre,password_at").eq("user_id", u.id).maybeSingle(),
  ]);
  const soloPersonal = !perfil?.agenda_id && !!pers?.activo;
  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email: u.email });
  if (error || !link?.properties?.hashed_token) throw new Error(error?.message ?? "No se pudo generar el link.");
  const url = `${sitio}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=magiclink&next=/`;
  const nombre = ((soloPersonal ? pers?.nombre : null) ?? perfil?.nombre ?? "").split(" ")[0];
  const cuerpo = `<p style="margin:0 0 10px;color:#4a4d55;">Toca el botón para entrar a tu agenda, sin contraseña.${soloPersonal && !pers?.password_at ? " La primera vez te vamos a pedir que crees tu contraseña: <b>es importante</b>, con ella entras desde cualquier cel o compu." : ""}</p>
     <p style="margin:0;color:#4a4d55;">El botón sirve una sola vez y caduca en 1 hora. Si no pediste este correo, ignóralo: nadie entra sin abrirlo.</p>`;
  const titulo = nombre ? `Hola, ${esc(nombre)}` : "Hola";
  const boton = { texto: "Entrar a mi agenda", url };
  let html: string;
  if (soloPersonal) html = correoPersonal(titulo, cuerpo, boton);
  else {
    const { envolver } = await import("@/lib/pagosServer");
    html = envolver(titulo, cuerpo, boton);
  }
  await enviarConResend({
    para: u.email,
    ...(soloPersonal ? { nombreRemitente: "Mi agenda" } : {}),
    asunto: "Tu link para entrar",
    html,
    texto: `Entra a tu agenda: ${url}\n\nSirve una vez y caduca en 1 hora.`,
  });
  await db.auth.admin.updateUserById(u.id, { app_metadata: { ...meta, enlace_at: new Date().toISOString() } });
  return "enviado";
}

/* ---------------- 2.2 · Solicitudes "La quiero" ---------------- */

export type SolicitudAdmin = { user_id: string; email: string | null; nombre: string | null; created_at: string; tieneClinica: boolean };

/** Alguien de clínicas pide su agenda personal: queda pendiente y te llega un correo. */
export async function solicitarPersonal(db: Db, userId: string, sitio: string): Promise<"ya-tiene" | "pendiente" | "creada"> {
  if (await personalDe(db, userId)) return "ya-tiene";
  const { data: ya } = await db.from("p_solicitudes").select("estado").eq("user_id", userId).maybeSingle();
  if (ya?.estado === "pendiente") return "pendiente";
  if (ya) await db.from("p_solicitudes").update({ estado: "pendiente", created_at: new Date().toISOString(), resuelta_at: null }).eq("user_id", userId);
  else await db.from("p_solicitudes").insert({ user_id: userId, estado: "pendiente" });
  try {
    const [{ data: u }, { data: p }] = await Promise.all([db.auth.admin.getUserById(userId), db.from("perfiles").select("nombre").eq("id", userId).maybeSingle()]);
    const { correosSuperadmin, envolver } = await import("@/lib/pagosServer");
    const para = await correosSuperadmin(db);
    for (const c of para) {
      await enviarConResend({
        para: c,
        asunto: `Quieren Mi agenda: ${p?.nombre ?? u.user?.email ?? ""}`,
        html: envolver("Nueva solicitud de Mi agenda", `<p style="margin:0;color:#4a4843;"><b>${esc(p?.nombre ?? "")}</b> (${esc(u.user?.email ?? "")}) pidió su agenda personal desde la de clínicas.</p>`, { texto: "Revisar en el panel", url: `${sitio}/admin#personales` }),
        texto: `${p?.nombre ?? ""} (${u.user?.email ?? ""}) pidió su agenda personal. ${sitio}/admin#personales`,
      });
    }
  } catch (e) {
    console.error("[solicitud personal]", e);
  }
  return "creada";
}

export async function listarSolicitudes(db: Db): Promise<SolicitudAdmin[]> {
  const { data } = await db.from("p_solicitudes").select("user_id,created_at").eq("estado", "pendiente").order("created_at");
  if (!data?.length) return [];
  const [{ data: usuarios }, { data: perfiles }] = await Promise.all([db.auth.admin.listUsers({ perPage: 1000 }), db.from("perfiles").select("id,nombre,agenda_id").in("id", data.map((d) => d.user_id))]);
  const usr = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const per = new Map((perfiles ?? []).map((p) => [p.id, p]));
  return data.map((d) => ({ user_id: d.user_id, email: usr.get(d.user_id) ?? null, nombre: per.get(d.user_id)?.nombre ?? null, created_at: d.created_at, tieneClinica: !!per.get(d.user_id)?.agenda_id }));
}

/** Aprobar = dar de alta y mandarle su link. Descartar = sólo cerrarla. */
export async function resolverSolicitud(db: Db, userId: string, accion: "aprobar" | "descartar", sitio: string) {
  if (accion === "aprobar") {
    const { data: u } = await db.auth.admin.getUserById(userId);
    if (!u.user?.email) return { error: "No encontré esa cuenta." };
    const { data: p } = await db.from("perfiles").select("nombre").eq("id", userId).maybeSingle();
    const r = await altaPersonal(db, u.user.email, p?.nombre ?? null);
    if (r.error) return { error: r.error };
    await enviarEnlacePersonal(db, u.user.email, sitio, { forzar: true }).catch((e) => console.error("[aprobar]", e));
  }
  await db.from("p_solicitudes").update({ estado: accion === "aprobar" ? "aprobada" : "descartada", resuelta_at: new Date().toISOString() }).eq("user_id", userId);
  return { ok: true };
}


/**
 * 2.4 · Recordatorios con hora que tocan "ahora" (de hace 20 min a dentro de 2 min, por si el cron se atrasa).
 * Gratis: le llega a cualquiera con Mi agenda y notificaciones encendidas. Uno por recordatorio y día (p_push_enviados).
 */
export async function recordatoriosPorAvisar(db: Db, hoy: string, minutoAhora: number) {
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const desde = hhmm(Math.max(0, minutoAhora - 20));
  const hasta = hhmm(Math.min(23 * 60 + 59, minutoAhora + 2));
  const { data } = await db
    .from("p_eventos")
    .select("id,user_id,tipo,titulo,fecha,fecha_fin,hora_inicio,hora_fin,lugar,notas,categoria_id,hecho,hecho_at,repetir,repetir_hasta,excepciones")
    .eq("tipo", "recordatorio")
    .lte("fecha", hoy)
    .not("hora_inicio", "is", null)
    .gte("hora_inicio", desde)
    .lte("hora_inicio", `${hasta}:59`);
  const filas = ((data ?? []) as Fila[]).filter((e) => e.fecha === hoy || e.repetir !== "nunca");
  const tocan = filas.filter((e) => expandir([{ ...e, excepciones: e.excepciones ?? [] }], hoy, hoy).length > 0);
  if (!tocan.length) return [];
  // Sólo quien tiene Mi agenda activa
  const { data: activos } = await db.from("personales").select("user_id").eq("activo", true).in("user_id", [...new Set(tocan.map((e) => e.user_id))]);
  const ok = new Set((activos ?? []).map((a) => a.user_id as string));
  const { data: ya } = await db.from("p_push_enviados").select("evento_id").eq("dia", hoy).in("evento_id", tocan.map((e) => e.id));
  const enviados = new Set((ya ?? []).map((x) => x.evento_id as string));
  return tocan.filter((e) => ok.has(e.user_id) && !enviados.has(e.id));
}
