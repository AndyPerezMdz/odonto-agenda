import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { correoPersonal, personalDe, usuarioPorCorreo } from "@/lib/personalServer";
import { codigoInvitacion } from "@/lib/invitarMi";
import { enviarPush } from "@/lib/push";
import { fechaLarga } from "@/lib/fechas";
import { sumarDias } from "@/lib/pagos";
import { rachaActual, textoHora, type PEvento, type PHabito, type PPendiente } from "@/lib/personal";

type Db = ReturnType<typeof createAdminClient>;

// 3.0 · Compartir un evento (o viaje) o un pendiente con otra persona, por su correo.
// Quien lo recibe lo ve en su Mi agenda: eventos sólo para ver; pendientes los puede palomear.
// Nunca se ve nada más de la agenda de quien comparte. Todo pasa por aquí (la tabla no tiene acceso directo).

export type TipoCompartido = "evento" | "pendiente" | "habito";
const columna = (t: TipoCompartido) => (t === "evento" ? "evento_id" : t === "pendiente" ? "pendiente_id" : "habito_id");
export const MAX_POR_DIA = 30;
export const MAX_POR_COSA = 10;
const normal = (e: string) => e.trim().toLowerCase();
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function nombreDe(db: Db, userId: string) {
  const { data } = await db.from("personales").select("nombre").eq("user_id", userId).maybeSingle();
  if (data?.nombre) return (data.nombre as string).split(" ")[0];
  const { data: p } = await db.from("perfiles").select("nombre").eq("id", userId).maybeSingle();
  return ((p?.nombre as string | undefined) ?? "").split(" ")[0] || "Alguien";
}

async function cosaPropia(db: Db, dueno: string, tipo: TipoCompartido, id: string) {
  if (tipo === "evento") {
    const { data } = await db.from("p_eventos").select("*").eq("id", id).eq("user_id", dueno).maybeSingle();
    return data as PEvento | null;
  }
  if (tipo === "habito") {
    const { data } = await db.from("p_habitos").select("*").eq("id", id).eq("user_id", dueno).maybeSingle();
    return data as PHabito | null;
  }
  const { data } = await db.from("p_pendientes").select("*").eq("id", id).eq("user_id", dueno).is("padre_id", null).maybeSingle();
  return data as PPendiente | null;
}

/** Con quién compartiste algo tuyo. */
export async function compartidosDe(db: Db, dueno: string, tipo: TipoCompartido, id: string) {
  const { data, error } = await db.from("p_compartidos").select("id,correo,invitado,oculto,created_at").eq("dueno", dueno).eq(columna(tipo), id).order("created_at");
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? "Falta actualizar la base de datos (corre supabase/schema.sql)." : error.message);
  return (data ?? []).map((r) => ({ id: r.id as string, correo: r.correo as string, quito: !!r.oculto }));
}

/** Comparte y le avisa (correo y, si tiene, notificación). La respuesta no dice si esa persona tiene cuenta. */
export async function compartir(db: Db, dueno: string, emailDueno: string, tipo: TipoCompartido, id: string, correoCrudo: string, sitio: string) {
  const correo = normal(correoCrudo);
  if (!CORREO.test(correo) || correo.length > 200) return { error: "Ese correo no se ve bien." };
  if (correo === normal(emailDueno)) return { error: "Ese es tu correo 🙃" };
  const cosa = await cosaPropia(db, dueno, tipo, id);
  if (!cosa) return { error: "No encontramos eso en tu agenda." };
  const desde = new Date(Date.now() - 86400000).toISOString();
  const [{ count: hoyN }, ya] = await Promise.all([
    db.from("p_compartidos").select("id", { count: "exact", head: true }).eq("dueno", dueno).gte("created_at", desde),
    compartidosDe(db, dueno, tipo, id),
  ]);
  if (ya.some((x) => x.correo === correo)) return { lista: ya, nuevo: false };
  if (ya.length >= MAX_POR_COSA) return { error: `Máximo ${MAX_POR_COSA} personas por cosa.` };
  if ((hoyN ?? 0) >= MAX_POR_DIA) return { error: "Ya compartiste mucho hoy. Mañana sigues." };

  const u = await usuarioPorCorreo(db, correo);
  const { error } = await db.from("p_compartidos").insert({ dueno, correo, invitado: u?.id ?? null, [columna(tipo)]: id });
  if (error && !/duplicate|23505/i.test(error.message)) return { error: error.message };

  // Aviso a quien lo recibe (si falla el correo, igual queda compartido)
  const de = await nombreDe(db, dueno);
  const tieneMi = u ? !!(await personalDe(db, u.id)) : false;
  const titulo = tipo === "evento" ? (cosa as PEvento).titulo : tipo === "habito" ? (cosa as PHabito).nombre : (cosa as PPendiente).titulo;
  const detalle =
    tipo === "evento" ? detalleEvento(cosa as PEvento)
    : tipo === "habito" ? `Hábito · ${diasHabito((cosa as PHabito).dias)}. Cada quien palomea el suyo y ven la racha del otro.`
    : (cosa as PPendiente).fecha ? `Para el ${fechaLarga((cosa as PPendiente).fecha!)}` : "Sin fecha";
  const url = tieneMi ? `${sitio}/personal` : `${sitio}/registro?inv=${codigoInvitacion(dueno)}`;
  try {
    await enviarConResend({
      para: correo,
      nombreRemitente: "Mi agenda",
      asunto: tipo === "evento" ? `${de} te compartió “${titulo}”` : tipo === "habito" ? `${de} te reta: “${titulo}” juntos 🔥` : `${de} te pasó un pendiente: “${titulo}”`,
      html: correoPersonal(
        tipo === "habito" ? `${esc(de)} quiere hacer un hábito contigo` : `${esc(de)} te compartió ${tipo === "evento" ? "algo de su agenda" : "un pendiente"}`,
        `<p style="margin:0 0 6px;font-size:18px;font-weight:bold;">${esc(titulo)}</p>
         <p style="margin:0 0 14px;color:#4a4d55;">${esc(detalle)}</p>
         <p style="margin:0;color:#4a4d55;">${tieneMi ? (tipo === "habito" ? "Acéptalo en tu Mi agenda → Hábitos." : "Ya está en tu Mi agenda.") : "Para verlo en tu agenda, crea tu Mi agenda gratis con este correo. Con el link de tu amigo, los dos ganan un mes de Pro."} Si no conoces a quien lo mandó, ignora este correo.</p>`,
        { texto: tieneMi ? (tipo === "habito" ? "Ver la invitación" : "Verlo en mi agenda") : "Crear mi agenda gratis", url: tieneMi && tipo === "habito" ? `${sitio}/personal?ver=habitos` : url }
      ),
      texto: `${de} te compartió: ${titulo}\n${detalle}\n${url}`,
      idempotencia: `compartir-${tipo}-${id}-${correo}`,
    });
  } catch (e) {
    console.error("[compartir] correo", (e as Error).message);
  }
  if (u && tieneMi) await enviarPush(db, [u.id], { titulo: tipo === "habito" ? `🔥 ${de} te invita a “${titulo}” juntos` : `👥 ${de} te compartió algo`, cuerpo: `${titulo} · ${detalle}`, url: "/personal", etiqueta: `comp-${id}` }).catch(() => 0);
  return { lista: await compartidosDe(db, dueno, tipo, id), nuevo: true };
}

function detalleEvento(e: PEvento) {
  if (e.tipo === "viaje") return `Viaje del ${fechaLarga(e.fecha)} al ${fechaLarga(e.fecha_fin ?? e.fecha)}${e.lugar ? ` · ${e.lugar}` : ""}`;
  return `${fechaLarga(e.fecha)} · ${textoHora(e)}${e.lugar ? ` · ${e.lugar}` : ""}${e.repetir !== "nunca" ? " · se repite" : ""}`;
}

/** Quitar: si es tuyo, dejas de compartirlo; si te lo compartieron, lo quitas de tu agenda. */
export async function quitarCompartido(db: Db, userId: string, email: string, id: string) {
  const { data: r } = await db.from("p_compartidos").select("id,dueno,invitado,correo").eq("id", id).maybeSingle();
  if (!r) return false;
  if (r.dueno === userId) return !(await db.from("p_compartidos").delete().eq("id", id)).error;
  if (r.invitado === userId || r.correo === normal(email)) return !(await db.from("p_compartidos").update({ oculto: true }).eq("id", id)).error;
  return false;
}

export type InvitacionHabito = { id: string; de: string; nombre: string; color: string; dias: number[] };
export type Recibidos = { eventos: PEvento[]; pendientes: PPendiente[]; habitos: InvitacionHabito[] };

/** Lo que te compartieron (y no quitaste). Los eventos vienen como si fueran tuyos, con `compartido`. */
export async function compartidosConmigo(db: Db, userId: string, email: string): Promise<Recibidos> {
  const correo = normal(email);
  const campos = "*"; // (con "*": funciona antes y después del SQL 3.2)
  const [a, b] = await Promise.all([db.from("p_compartidos").select(campos).eq("invitado", userId), db.from("p_compartidos").select(campos).eq("correo", correo)]);
  if (a.error || b.error) return { eventos: [], pendientes: [], habitos: [] };
  const filas = [...new Map([...(a.data ?? []), ...(b.data ?? [])].map((f) => [f.id as string, f])).values()];
  if (!filas.length) return { eventos: [], pendientes: [], habitos: [] };
  // Si se registró después de que se lo compartieron, ya queda ligado a su cuenta
  const sinLigar = filas.filter((f) => !f.invitado).map((f) => f.id as string);
  if (sinLigar.length) await db.from("p_compartidos").update({ invitado: userId }).in("id", sinLigar);
  const vivos = filas.filter((f) => !f.oculto && f.dueno !== userId);
  if (!vivos.length) return { eventos: [], pendientes: [], habitos: [] };
  const evIds = vivos.filter((f) => f.evento_id).map((f) => f.evento_id as string);
  const peIds = vivos.filter((f) => f.pendiente_id).map((f) => f.pendiente_id as string);
  const invHab = vivos.filter((f) => f.habito_id && !f.aceptado_at);
  const duenos = [...new Set(vivos.map((f) => f.dueno as string))];
  const [{ data: evs }, { data: pes }, { data: habs }, nombres] = await Promise.all([
    evIds.length ? db.from("p_eventos").select("*").in("id", evIds) : Promise.resolve({ data: [] }),
    peIds.length ? db.from("p_pendientes").select("*").in("id", peIds) : Promise.resolve({ data: [] }),
    invHab.length ? db.from("p_habitos").select("id,nombre,color,dias").in("id", invHab.map((f) => f.habito_id as string)) : Promise.resolve({ data: [] }),
    Promise.all(duenos.map(async (d) => [d, await nombreDe(db, d)] as const)),
  ]);
  const nombre = new Map(nombres);
  const hace3 = new Date(Date.now() - 3 * 86400000).toISOString();
  const de = (f: (typeof vivos)[number]) => ({ id: f.id as string, de: nombre.get(f.dueno as string) ?? "Alguien", nuevo: (f.created_at as string) >= hace3 });
  const porEv = new Map(vivos.filter((f) => f.evento_id).map((f) => [f.evento_id as string, f]));
  const porPe = new Map(vivos.filter((f) => f.pendiente_id).map((f) => [f.pendiente_id as string, f]));
  return {
    // Sin categoría (es de otra agenda) ni aviso (eso es de quien lo creó)
    eventos: ((evs ?? []) as PEvento[]).map((e) => ({ ...e, excepciones: e.excepciones ?? [], categoria_id: null, aviso_min: null, compartido: de(porEv.get(e.id)!) })),
    pendientes: ((pes ?? []) as PPendiente[]).map((p) => ({ ...p, padre_id: null, lista: "hacer" as const, etiqueta: null, compartido: de(porPe.get(p.id)!) })),
    habitos: invHab.flatMap((f) => {
      const h = ((habs ?? []) as { id: string; nombre: string; color: string; dias: number[] }[]).find((x) => x.id === f.habito_id);
      return h ? [{ id: f.id as string, de: nombre.get(f.dueno as string) ?? "Alguien", nombre: h.nombre, color: h.color, dias: h.dias }] : [];
    }),
  };
}

/** Palomear un pendiente que te compartieron (se palomea en la agenda de quien lo compartió). */
export async function marcarCompartido(db: Db, userId: string, email: string, id: string, hecho: boolean) {
  const { data: r } = await db.from("p_compartidos").select("id,dueno,pendiente_id,invitado,correo,oculto").eq("id", id).maybeSingle();
  if (!r?.pendiente_id || r.oculto || !(r.invitado === userId || r.correo === normal(email))) return false;
  return !(await db.from("p_pendientes").update({ hecho, hecho_at: hecho ? new Date().toISOString() : null }).eq("id", r.pendiente_id).eq("user_id", r.dueno)).error;
}

/** Para el feed del calendario: los eventos que te compartieron (de los próximos meses). */
export async function eventosCompartidosConmigo(db: Db, userId: string, email: string) {
  const r = await compartidosConmigo(db, userId, email);
  const hasta = sumarDias(fechaEnZona(0), 200);
  return r.eventos.filter((e) => e.fecha <= hasta);
}

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const diasHabito = (dias: number[]) => (!dias?.length || dias.length === 7 ? "diario" : [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d)).map((d) => DIAS_CORTOS[d]).join(", "));

/* ---------------- 3.2 · Hábitos con amigos ---------------- */

/** Aceptar la invitación: se crea TU copia del hábito, ligada a la de tu amigo/a. */
export async function aceptarHabito(db: Db, userId: string, email: string, id: string): Promise<{ ok: true; habito_id: string } | { ok: false; error: string }> {
  const { data: r } = await db.from("p_compartidos").select("*").eq("id", id).maybeSingle();
  if (!r?.habito_id || r.oculto || !(r.invitado === userId || r.correo === normal(email))) return { ok: false, error: "Esa invitación ya no está." };
  if (r.aceptado_at) {
    const { data: ya } = await db.from("p_habitos").select("id").eq("compartido_id", id).eq("user_id", userId).maybeSingle();
    if (ya) return { ok: true, habito_id: ya.id as string };
  }
  const { data: h } = await db.from("p_habitos").select("nombre,color,dias,hora").eq("id", r.habito_id).maybeSingle();
  if (!h) return { ok: false, error: "Ese hábito ya no existe." };
  const { data: nuevo, error } = await db
    .from("p_habitos")
    .insert({ user_id: userId, nombre: h.nombre, color: h.color, dias: h.dias, hora: h.hora ?? null, orden: Date.now() / 1000, compartido_id: id })
    .select("id")
    .single();
  if (error || !nuevo) return { ok: false, error: error?.message ?? "No se pudo." };
  await db.from("p_compartidos").update({ aceptado_at: new Date().toISOString(), invitado: userId }).eq("id", id);
  const yo = await nombreDe(db, userId);
  await enviarPush(db, [r.dueno as string], { titulo: `🔥 ${yo} aceptó: “${h.nombre}” juntos`, cuerpo: "Ahora ven la racha del otro. A ver quién aguanta más.", url: "/personal?ver=habitos", etiqueta: `hab-acepto-${id}` }).catch(() => 0);
  return { ok: true, habito_id: nuevo.id as string };
}

export type Pareja = { habito_id: string; compartido_id: string; con: string; racha: number; hoy: boolean; dueno: boolean };

/** Para cada hábito tuyo que haces con alguien: con quién, su racha y si ya lo hizo hoy. */
export async function parejasDeHabitos(db: Db, userId: string): Promise<Pareja[]> {
  const [comoDueno, comoInvitado] = await Promise.all([
    db.from("p_compartidos").select("*").eq("dueno", userId).not("habito_id", "is", null).not("aceptado_at", "is", null),
    db.from("p_habitos").select("id,compartido_id").eq("user_id", userId).not("compartido_id", "is", null),
  ]);
  if (comoDueno.error && comoInvitado.error) return [];
  // [mi hábito, hábito del otro, id del otro, id de la invitación]
  const pares: { mio: string; suyo: string | null; otro: string; cid: string; dueno: boolean }[] = [];
  const filasD = (comoDueno.data ?? []).filter((f) => !f.oculto && f.invitado);
  if (filasD.length) {
    const { data: copias } = await db.from("p_habitos").select("id,compartido_id,user_id").in("compartido_id", filasD.map((f) => f.id as string));
    for (const f of filasD) {
      const c = (copias ?? []).find((x) => x.compartido_id === f.id);
      if (c) pares.push({ mio: f.habito_id as string, suyo: c.id as string, otro: c.user_id as string, cid: f.id as string, dueno: true });
    }
  }
  const mias = comoInvitado.data ?? [];
  if (mias.length) {
    const { data: filas } = await db.from("p_compartidos").select("*").in("id", mias.map((m) => m.compartido_id as string));
    for (const m of mias) {
      const f = (filas ?? []).find((x) => x.id === m.compartido_id);
      if (f && !f.oculto) pares.push({ mio: m.id as string, suyo: f.habito_id as string, otro: f.dueno as string, cid: f.id as string, dueno: false });
    }
  }
  if (!pares.length) return [];
  const hoy = fechaEnZona(0);
  const suyos = pares.map((p) => p.suyo!).filter(Boolean);
  const [{ data: habs }, { data: marcas }, nombres] = await Promise.all([
    db.from("p_habitos").select("*").in("id", suyos),
    db.from("p_habito_marcas").select("habito_id,fecha").in("habito_id", suyos).gte("fecha", sumarDias(hoy, -400)),
    Promise.all([...new Set(pares.map((p) => p.otro))].map(async (o) => [o, await nombreDe(db, o)] as const)),
  ]);
  const nombre = new Map(nombres);
  return pares.flatMap((p) => {
    const h = ((habs ?? []) as PHabito[]).find((x) => x.id === p.suyo);
    if (!h) return [];
    const set = new Set(((marcas ?? []) as { habito_id: string; fecha: string }[]).filter((m) => m.habito_id === p.suyo).map((m) => m.fecha));
    return [{ habito_id: p.mio, compartido_id: p.cid, con: nombre.get(p.otro) ?? "Alguien", racha: rachaActual(h, set, hoy), hoy: set.has(hoy), dueno: p.dueno }];
  });
}

/** "Ya lo hice": le avisa a tu pareja de hábito (sólo si él/ella todavía no lo hace hoy). */
export async function avisarPalomita(db: Db, userId: string, habitoId: string) {
  const pares = (await parejasDeHabitos(db, userId)).filter((p) => p.habito_id === habitoId && !p.hoy);
  if (!pares.length) return 0;
  const yo = await nombreDe(db, userId);
  const { data: h } = await db.from("p_habitos").select("nombre").eq("id", habitoId).maybeSingle();
  // ¿A quién? (el otro de cada pareja)
  let n = 0;
  for (const p of pares) {
    const { data: f } = await db.from("p_compartidos").select("dueno,invitado").eq("id", p.compartido_id).maybeSingle();
    const otro = f ? (f.dueno === userId ? f.invitado : f.dueno) : null;
    if (otro) n += await enviarPush(db, [otro as string], { titulo: `💪 ${yo} ya hizo “${h?.nombre ?? "su hábito"}”`, cuerpo: "Te toca. No dejes que te gane la racha.", url: "/personal?ver=habitos", etiqueta: `hab-${p.compartido_id}-${fechaEnZona(0)}` }).catch(() => 0);
  }
  return n;
}
