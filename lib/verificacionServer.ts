import "server-only";
import { createHash, randomInt } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { correosSuperadmin, envolver } from "@/lib/pagosServer";
import { universidad, type Universidad } from "@/lib/universidades";
import { DOMINIOS, dominioInstitucional, requiereVerificacion } from "@/lib/verificacionEscolar";

type Db = ReturnType<typeof createAdminClient>;
type Usuario = { id: string; email?: string | null; email_confirmed_at?: string | null };

// 3.1 · Verificación de estudiante para abrir una agenda de clínicas.
//   1) Código de 6 dígitos a su correo institucional (o en automático si su cuenta YA es ese correo).
//   2) Plan B: lo pide al staff y lo apruebas a mano.
// Del correo institucional sólo se guarda su huella: no se puede leer, pero sirve para que no verifique dos cuentas.

export const MINUTOS_CODIGO = 15;
export const ESPERA_SEG = 60;
export const ENVIOS_POR_DIA = 6;
export const INTENTOS = 5;

const huella = (correo: string) => createHash("sha256").update(`verif-escolar:${correo.trim().toLowerCase()}`).digest("hex");
const huellaCodigo = (userId: string, codigo: string) => createHash("sha256").update(`codigo:${userId}:${codigo}`).digest("hex");
const faltaSql = (m: string) => /does not exist|schema cache/i.test(m);

export type Verificacion = {
  estado: "ninguna" | "pendiente" | "verificado" | "manual" | "aprobado" | "rechazado";
  universidad: string | null;
  codigoEnviado: boolean;
  esperar: number; // segundos para poder pedir otro código
};

type Fila = {
  user_id: string; universidad: string; estado: Verificacion["estado"]; metodo: string | null; correo_hash: string | null; codigo_hash: string | null;
  codigo_expira: string | null; intentos: number; enviado_at: string | null; envios_dia: string | null; envios: number; nota: string | null; created_at: string;
};

async function filaDe(db: Db, userId: string) {
  const { data, error } = await db.from("verificaciones_escolares").select("*").eq("user_id", userId).maybeSingle();
  if (error && faltaSql(error.message)) throw new Error("Falta actualizar la base de datos (corre supabase/schema.sql).");
  return (data as Fila | null) ?? null;
}

export async function estadoVerificacion(db: Db, userId: string): Promise<Verificacion> {
  const f = await filaDe(db, userId);
  if (!f) return { estado: "ninguna", universidad: null, codigoEnviado: false, esperar: 0 };
  const pasaron = f.enviado_at ? (Date.now() - new Date(f.enviado_at).getTime()) / 1000 : Infinity;
  return {
    estado: f.estado,
    universidad: f.universidad,
    codigoEnviado: f.estado === "pendiente" && !!f.codigo_hash && !!f.codigo_expira && new Date(f.codigo_expira).getTime() > Date.now(),
    esperar: Math.max(0, Math.ceil(ESPERA_SEG - pasaron)),
  };
}

/** ¿Ya puede abrir una agenda de clínicas de esa universidad? (siempre con código, aunque su cuenta ya sea su correo institucional) */
export async function verificadoPara(db: Db, user: Usuario, uni: Universidad): Promise<boolean> {
  if (!requiereVerificacion(uni)) return true;
  const f = await filaDe(db, user.id).catch(() => null);
  return !!f && (f.estado === "verificado" || f.estado === "aprobado") && f.universidad === uni;
}

export const DIAS_PLAZO = 14;
export type PendienteEscolar =
  | { necesita: false }
  | { necesita: true; universidad: Universidad; plazo: string; vencido: boolean; enRevision: boolean; correoSugerido: string | null };

/**
 * Quien ya tiene agenda de clínicas (dueño/a o compañero/a) de una universidad que pide correo institucional
 * y no lo ha verificado: tiene un plazo (14 días desde la primera vez que ve el aviso). Al vencer, se bloquea hasta verificar.
 * Si pidió revisión al staff, no se bloquea mientras la revisan.
 */
export async function pendienteEscolar(db: Db, user: Usuario): Promise<PendienteEscolar> {
  const { data: perfil } = await db.from("perfiles").select("agenda_id").eq("id", user.id).maybeSingle();
  if (!perfil?.agenda_id) return { necesita: false };
  const { data: agenda } = await db.from("agendas").select("universidad").eq("id", perfil.agenda_id).maybeSingle();
  const uni = (agenda?.universidad ?? "upp") as Universidad;
  if (!requiereVerificacion(uni)) return { necesita: false };
  let f: Fila | null;
  try {
    f = await filaDe(db, user.id);
  } catch {
    return { necesita: false }; // sin el SQL 3.1 todavía: nada
  }
  if (f && (f.estado === "verificado" || f.estado === "aprobado") && f.universidad === uni) return { necesita: false };
  const hoy = fechaEnZona(0);
  let plazo = (f as (Fila & { plazo?: string | null }) | null)?.plazo ?? null;
  if (!plazo) {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + DIAS_PLAZO);
    plazo = d.toISOString().slice(0, 10);
    if (f) await db.from("verificaciones_escolares").update({ plazo }).eq("user_id", user.id);
    else await db.from("verificaciones_escolares").upsert({ user_id: user.id, universidad: uni, estado: "pendiente", plazo }, { onConflict: "user_id" });
  }
  const enRevision = f?.estado === "manual";
  return {
    necesita: true,
    universidad: uni,
    plazo,
    vencido: hoy > plazo && !enRevision,
    enRevision,
    correoSugerido: user.email && dominioInstitucional(uni, user.email) ? user.email.toLowerCase() : null,
  };
}

/** Manda el código de 6 dígitos al correo institucional. */
export async function enviarCodigoEscolar(db: Db, user: Usuario, uni: Universidad, correo: string): Promise<{ ok: true; esperar: number } | { ok: false; error: string; esperar?: number }> {
  const u = universidad(uni);
  if (!requiereVerificacion(uni)) return { ok: false, error: `La ${u.nombre} todavía no pide correo institucional.` };
  const dom = dominioInstitucional(uni, correo);
  if (!dom) return { ok: false, error: `Usa tu correo de alumno de la ${u.nombre}: el que termina en @${DOMINIOS[uni][0]}.` };
  const h = huella(correo);
  const { data: otra } = await db.from("verificaciones_escolares").select("user_id").eq("correo_hash", h).eq("estado", "verificado").neq("user_id", user.id).limit(1);
  if (otra?.length) return { ok: false, error: "Ese correo institucional ya se usó para otra cuenta. Si es tuyo, usa “No tengo acceso a mi correo” y te ayudamos." };

  const f = await filaDe(db, user.id);
  if (f && (f.estado === "verificado" || f.estado === "aprobado") && f.universidad === uni) return { ok: true, esperar: 0 };
  const pasaron = f?.enviado_at ? (Date.now() - new Date(f.enviado_at).getTime()) / 1000 : Infinity;
  if (pasaron < ESPERA_SEG) return { ok: false, error: "Espera un momento antes de pedir otro código.", esperar: Math.ceil(ESPERA_SEG - pasaron) };
  const hoy = fechaEnZona(0);
  const envios = f?.envios_dia === hoy ? f.envios : 0;
  if (envios >= ENVIOS_POR_DIA) return { ok: false, error: "Ya pediste muchos códigos hoy. Inténtalo mañana o usa “No tengo acceso a mi correo”." };

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await db.from("verificaciones_escolares").upsert(
    {
      user_id: user.id, universidad: uni, estado: "pendiente", metodo: null, correo_hash: h, dominio: dom,
      codigo_hash: huellaCodigo(user.id, codigo), codigo_expira: new Date(Date.now() + MINUTOS_CODIGO * 60000).toISOString(),
      intentos: 0, enviado_at: new Date().toISOString(), envios_dia: hoy, envios: envios + 1,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: faltaSql(error.message) ? "Falta actualizar la base de datos (corre supabase/schema.sql)." : error.message };
  await enviarConResend({
    para: correo.trim().toLowerCase(),
    asunto: `${codigo} es tu código de estudiante`,
    html: envolver(
      "Confirma que eres estudiante",
      `<p style="margin:0 0 12px;color:#4a4d55;">Alguien (seguro tú) quiere abrir una agenda de clínicas de la ${esc(u.nombre)} con este correo. Escribe este código en la página:</p>
       <p style="margin:0 0 12px;font-size:32px;font-weight:bold;letter-spacing:.3em;color:#1c1b19;">${codigo}</p>
       <p style="margin:0;color:#4a4d55;font-size:13px;">Caduca en ${MINUTOS_CODIGO} minutos. Este correo sólo sirve para comprobar que eres estudiante: tu cuenta sigue con tu correo de siempre. Si no fuiste tú, ignóralo.</p>`
    ),
    texto: `Tu código de estudiante: ${codigo}\nCaduca en ${MINUTOS_CODIGO} minutos. Si no fuiste tú, ignora este correo.`,
  });
  return { ok: true, esperar: ESPERA_SEG };
}

/** Revisa el código. */
export async function confirmarCodigoEscolar(db: Db, userId: string, codigo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const f = await filaDe(db, userId);
  if (f && (f.estado === "verificado" || f.estado === "aprobado")) return { ok: true };
  if (!f || f.estado !== "pendiente" || !f.codigo_hash || !f.codigo_expira) return { ok: false, error: "Primero pide tu código." };
  if (new Date(f.codigo_expira).getTime() < Date.now()) return { ok: false, error: "Ese código ya caducó. Pide otro." };
  if (f.intentos >= INTENTOS) return { ok: false, error: "Demasiados intentos. Pide otro código." };
  if (huellaCodigo(userId, codigo.replace(/\D/g, "")) !== f.codigo_hash) {
    await db.from("verificaciones_escolares").update({ intentos: f.intentos + 1 }).eq("user_id", userId);
    const quedan = INTENTOS - f.intentos - 1;
    return { ok: false, error: quedan > 0 ? `Ese código no es. Te quedan ${quedan} intento${quedan === 1 ? "" : "s"}.` : "Demasiados intentos. Pide otro código." };
  }
  const { error } = await db
    .from("verificaciones_escolares")
    .update({ estado: "verificado", metodo: "codigo", verificado_at: new Date().toISOString(), codigo_hash: null, codigo_expira: null })
    .eq("user_id", userId);
  if (error) return { ok: false, error: /duplicate|23505/.test(error.message) ? "Ese correo institucional ya se usó para otra cuenta." : error.message };
  return { ok: true };
}

/** Plan B: no tiene acceso a su correo institucional. Te llega para aprobarlo a mano. */
export async function pedirRevisionEscolar(db: Db, user: Usuario & { nombre?: string | null }, uni: Universidad, nota: string, sitio: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = nota.trim().slice(0, 500);
  if (n.length < 8) return { ok: false, error: "Cuéntanos un poco: tu matrícula o semestre, y por qué no tienes tu correo." };
  const f = await filaDe(db, user.id);
  if (f && (f.estado === "verificado" || f.estado === "aprobado") && f.universidad === uni) return { ok: true };
  const { error } = await db.from("verificaciones_escolares").upsert(
    { user_id: user.id, universidad: uni, estado: "manual", metodo: null, nota: n, codigo_hash: null, codigo_expira: null },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };
  const staff = await correosSuperadmin(db).catch(() => [] as string[]);
  for (const para of staff) {
    await enviarConResend({
      para,
      asunto: `Alguien pide abrir agenda de la ${universidad(uni).nombre} sin correo institucional`,
      html: envolver(
        "Revisión de estudiante",
        `<p style="margin:0 0 8px;color:#4a4d55;"><b>${esc(user.nombre ?? "")}</b> (${esc(user.email ?? "")}) quiere abrir una agenda de la ${esc(universidad(uni).nombre)} y no tiene acceso a su correo institucional. Escribió:</p>
         <p style="margin:0;padding:10px 12px;background:#f6f5f2;border-radius:8px;color:#1c1b19;">${esc(n)}</p>`,
        { texto: "Revisar en mi panel", url: `${sitio}/admin#hoy` }
      ),
      texto: `${user.nombre ?? ""} (${user.email ?? ""}) pide abrir agenda de la ${universidad(uni).nombre} sin correo institucional: ${n}\n${sitio}/admin#hoy`,
    }).catch((e) => console.error("[verificar] staff", (e as Error).message));
  }
  return { ok: true };
}

export type RevisionEscolar = { user_id: string; nombre: string | null; email: string | null; universidad: string; nota: string | null; created_at: string };

/** Para tu panel: quiénes esperan que los apruebes. */
export async function revisionesPendientes(db: Db): Promise<RevisionEscolar[]> {
  const { data, error } = await db.from("verificaciones_escolares").select("user_id,universidad,nota,created_at").eq("estado", "manual").order("created_at");
  if (error || !data?.length) return [];
  const ids = data.map((d) => d.user_id as string);
  const [{ data: perfiles }, { data: usuarios }] = await Promise.all([
    db.from("perfiles").select("id,nombre").in("id", ids),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const nombre = new Map((perfiles ?? []).map((p) => [p.id as string, p.nombre as string | null]));
  const correo = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? null]));
  return data.map((d) => ({ user_id: d.user_id as string, nombre: nombre.get(d.user_id as string) ?? null, email: correo.get(d.user_id as string) ?? null, universidad: d.universidad as string, nota: d.nota as string | null, created_at: d.created_at as string }));
}

/** Aprobar o rechazar a mano (y avisarle por correo). */
export async function resolverRevision(db: Db, userId: string, aprobar: boolean, sitio: string) {
  const f = await filaDe(db, userId);
  if (!f || f.estado !== "manual") return { ok: false as const, error: "Ya no está pendiente." };
  const { error } = await db
    .from("verificaciones_escolares")
    .update({ estado: aprobar ? "aprobado" : "rechazado", metodo: "staff", verificado_at: aprobar ? new Date().toISOString() : null })
    .eq("user_id", userId);
  if (error) return { ok: false as const, error: error.message };
  const { data: u } = await db.auth.admin.getUserById(userId);
  if (u?.user?.email) {
    const nombre = universidad(f.universidad).nombre;
    await enviarConResend({
      para: u.user.email,
      asunto: aprobar ? "Listo: ya puedes abrir tu agenda de clínicas" : "No pudimos comprobar que eres estudiante",
      html: envolver(
        aprobar ? "¡Listo, ya quedaste!" : "No pudimos comprobarlo",
        aprobar
          ? `<p style="margin:0;color:#4a4d55;">Revisamos tu solicitud: ya estás confirmado/a como estudiante de la ${esc(nombre)}. Si todavía no tienes tu agenda de clínicas, ábrela con el botón.</p>`
          : `<p style="margin:0;color:#4a4d55;">Con lo que nos mandaste no pudimos comprobar que estudias en la ${esc(nombre)}. Puedes intentarlo con tu correo institucional, o responder este correo con más datos.</p>`,
        aprobar ? { texto: "Ir a mi agenda", url: `${sitio}/clinicas/nueva` } : undefined
      ),
      texto: aprobar ? `Ya puedes abrir tu agenda de clínicas: ${sitio}/clinicas/nueva` : `No pudimos comprobar que estudias en la ${nombre}. Inténtalo con tu correo institucional.`,
      responderA: await correosSuperadmin(db).catch(() => []),
    }).catch((e) => console.error("[verificar] aviso", (e as Error).message));
  }
  return { ok: true as const };
}
