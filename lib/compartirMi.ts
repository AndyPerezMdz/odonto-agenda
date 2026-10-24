import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { correoPersonal, personalDe, usuarioPorCorreo } from "@/lib/personalServer";
import { codigoInvitacion } from "@/lib/invitarMi";
import { enviarPush } from "@/lib/push";
import { fechaLarga } from "@/lib/fechas";
import { sumarDias } from "@/lib/pagos";
import { textoHora, type PEvento, type PPendiente } from "@/lib/personal";

type Db = ReturnType<typeof createAdminClient>;

// 3.0 · Compartir un evento (o viaje) o un pendiente con otra persona, por su correo.
// Quien lo recibe lo ve en su Mi agenda: eventos sólo para ver; pendientes los puede palomear.
// Nunca se ve nada más de la agenda de quien comparte. Todo pasa por aquí (la tabla no tiene acceso directo).

export type TipoCompartido = "evento" | "pendiente";
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
  const { data } = await db.from("p_pendientes").select("*").eq("id", id).eq("user_id", dueno).is("padre_id", null).maybeSingle();
  return data as PPendiente | null;
}

/** Con quién compartiste algo tuyo. */
export async function compartidosDe(db: Db, dueno: string, tipo: TipoCompartido, id: string) {
  const { data, error } = await db.from("p_compartidos").select("id,correo,invitado,oculto,created_at").eq("dueno", dueno).eq(tipo === "evento" ? "evento_id" : "pendiente_id", id).order("created_at");
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
  const { error } = await db.from("p_compartidos").insert({ dueno, correo, invitado: u?.id ?? null, ...(tipo === "evento" ? { evento_id: id } : { pendiente_id: id }) });
  if (error && !/duplicate|23505/i.test(error.message)) return { error: error.message };

  // Aviso a quien lo recibe (si falla el correo, igual queda compartido)
  const de = await nombreDe(db, dueno);
  const tieneMi = u ? !!(await personalDe(db, u.id)) : false;
  const titulo = tipo === "evento" ? (cosa as PEvento).titulo : (cosa as PPendiente).titulo;
  const detalle = tipo === "evento" ? detalleEvento(cosa as PEvento) : (cosa as PPendiente).fecha ? `Para el ${fechaLarga((cosa as PPendiente).fecha!)}` : "Sin fecha";
  const url = tieneMi ? `${sitio}/personal` : `${sitio}/registro?inv=${codigoInvitacion(dueno)}`;
  try {
    await enviarConResend({
      para: correo,
      nombreRemitente: "Mi agenda",
      asunto: tipo === "evento" ? `${de} te compartió “${titulo}”` : `${de} te pasó un pendiente: “${titulo}”`,
      html: correoPersonal(
        `${esc(de)} te compartió ${tipo === "evento" ? "algo de su agenda" : "un pendiente"}`,
        `<p style="margin:0 0 6px;font-size:18px;font-weight:bold;">${esc(titulo)}</p>
         <p style="margin:0 0 14px;color:#4a4d55;">${esc(detalle)}</p>
         <p style="margin:0;color:#4a4d55;">${tieneMi ? "Ya está en tu Mi agenda." : "Para verlo en tu agenda, crea tu Mi agenda gratis con este correo. Con el link de tu amigo, los dos ganan un mes de Pro."} Si no conoces a quien lo mandó, ignora este correo.</p>`,
        { texto: tieneMi ? "Verlo en mi agenda" : "Crear mi agenda gratis", url }
      ),
      texto: `${de} te compartió: ${titulo}\n${detalle}\n${url}`,
      idempotencia: `compartir-${tipo}-${id}-${correo}`,
    });
  } catch (e) {
    console.error("[compartir] correo", (e as Error).message);
  }
  if (u && tieneMi) await enviarPush(db, [u.id], { titulo: `👥 ${de} te compartió algo`, cuerpo: `${titulo} · ${detalle}`, url: "/personal", etiqueta: `comp-${id}` }).catch(() => 0);
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

export type Recibidos = { eventos: PEvento[]; pendientes: PPendiente[] };

/** Lo que te compartieron (y no quitaste). Los eventos vienen como si fueran tuyos, con `compartido`. */
export async function compartidosConmigo(db: Db, userId: string, email: string): Promise<Recibidos> {
  const correo = normal(email);
  const campos = "id,dueno,evento_id,pendiente_id,invitado,oculto,created_at";
  const [a, b] = await Promise.all([db.from("p_compartidos").select(campos).eq("invitado", userId), db.from("p_compartidos").select(campos).eq("correo", correo)]);
  if (a.error || b.error) return { eventos: [], pendientes: [] };
  const filas = [...new Map([...(a.data ?? []), ...(b.data ?? [])].map((f) => [f.id as string, f])).values()];
  if (!filas.length) return { eventos: [], pendientes: [] };
  // Si se registró después de que se lo compartieron, ya queda ligado a su cuenta
  const sinLigar = filas.filter((f) => !f.invitado).map((f) => f.id as string);
  if (sinLigar.length) await db.from("p_compartidos").update({ invitado: userId }).in("id", sinLigar);
  const vivos = filas.filter((f) => !f.oculto && f.dueno !== userId);
  if (!vivos.length) return { eventos: [], pendientes: [] };
  const evIds = vivos.filter((f) => f.evento_id).map((f) => f.evento_id as string);
  const peIds = vivos.filter((f) => f.pendiente_id).map((f) => f.pendiente_id as string);
  const duenos = [...new Set(vivos.map((f) => f.dueno as string))];
  const [{ data: evs }, { data: pes }, nombres] = await Promise.all([
    evIds.length ? db.from("p_eventos").select("*").in("id", evIds) : Promise.resolve({ data: [] }),
    peIds.length ? db.from("p_pendientes").select("*").in("id", peIds) : Promise.resolve({ data: [] }),
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
