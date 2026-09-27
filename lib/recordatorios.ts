import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { prefs, type Cita, type Clinica, type Materia, type Perfil } from "@/lib/types";
import { fechaLarga, hhmm } from "@/lib/fechas";

// Zona horaria para decidir qué es "hoy" (Mérida y Cancún coinciden en fecha a la hora del cron).
const ZONA = process.env.RECORDATORIOS_ZONA || "America/Merida";
const REMITENTE =
  process.env.RECORDATORIOS_REMITENTE || "Agenda de clínicas <agenda@tapiceriaautomotrizbynovo.com>";

type Resultado = { persona: string; estado: "enviado" | "sin citas" | "desactivado" | "ya enviado" | "sin correo" | "error"; detalle?: string };

/** "YYYY-MM-DD" de hoy + n días, según la zona horaria configurada. */
export function fechaEnZona(n = 0): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = hoy.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

export function urlSitio(origenPeticion?: string): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return origenPeticion ?? "";
}

/**
 * Manda el recordatorio del día.
 * - soloUsuario: limita a una persona (para el botón "Enviarme una prueba").
 * - prueba: ignora la bitácora, no la escribe, y manda aunque no haya citas.
 */
export async function enviarRecordatorios(opts: { soloUsuario?: string; prueba?: boolean; sitio: string }): Promise<Resultado[]> {
  const db = createAdminClient();
  const hoy = fechaEnZona(0);
  const dias = [0, 1, 2].map((n) => ({ n, fecha: fechaEnZona(n) }));

  // Datos base
  let qPerfiles = db.from("perfiles").select("id,nombre,color,preferencias");
  if (opts.soloUsuario) qPerfiles = qPerfiles.eq("id", opts.soloUsuario);
  const ayer = fechaEnZona(-1);
  const [{ data: perfiles, error: e1 }, { data: citas, error: e2 }, { data: clinicas }, { data: materias }, { data: usuarios, error: e3 }, { data: sinMarcar }] =
    await Promise.all([
      qPerfiles,
      db
        .from("citas")
        .select("id,owner_id,paciente,fecha,hora_inicio,hora_fin,clinica_id,materia_id,notas")
        .gte("fecha", dias[0].fecha)
        .lte("fecha", dias[2].fecha)
        .or("estado.is.null,estado.neq.cancelo") // las canceladas no se recuerdan
        .order("fecha")
        .order("hora_inicio"),
      db.from("clinicas").select("id,numero,descripcion,activo"),
      db.from("materias").select("id,nombre,color,activo,material"),
      db.auth.admin.listUsers({ perPage: 1000 }),
      // Citas de la última semana que nadie marcó (asistió / faltó): para "Mi avance"
      db
        .from("citas")
        .select("id,owner_id,paciente,fecha,hora_inicio,hora_fin,clinica_id,materia_id,notas")
        .gte("fecha", fechaEnZona(-7))
        .lte("fecha", ayer)
        .is("estado", null)
        .order("fecha")
        .order("hora_inicio"),
    ]);
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);

  const correoDe = new Map(usuarios.users.map((u) => [u.id, u.email]));
  const clinicaPorId = new Map((clinicas as Clinica[] | null ?? []).map((c) => [c.id, c]));
  const materiaPorId = new Map((materias as Materia[] | null ?? []).map((m) => [m.id, m]));

  const resultados: Resultado[] = [];

  // Doble candado: con soloUsuario jamás se le manda a otra persona
  const destinatarios = ((perfiles as Perfil[]) ?? []).filter((x) => !opts.soloUsuario || x.id === opts.soloUsuario);

  for (const perfil of destinatarios) {
    const p = prefs(perfil.preferencias);
    const correo = correoDe.get(perfil.id);
    if (!correo) { resultados.push({ persona: perfil.nombre, estado: "sin correo" }); continue; }
    if (!opts.prueba && !p.recordatorios) { resultados.push({ persona: perfil.nombre, estado: "desactivado" }); continue; }

    const diasActivos = opts.prueba ? [0, 1, 2] : p.recordatorioDias;
    const bloques = dias
      .filter((d) => diasActivos.includes(d.n))
      .map((d) => ({
        ...d,
        citas: ((citas as Cita[]) ?? []).filter((c) => c.owner_id === perfil.id && c.fecha === d.fecha),
      }))
      .filter((b) => b.citas.length > 0);
    const pendientes = ((sinMarcar as Cita[]) ?? []).filter((c) => c.owner_id === perfil.id);
    // Sólo por las pendientes no se manda correo, salvo que sean de ayer (para no insistir toda la semana)
    const hayDeAyer = pendientes.some((c) => c.fecha === ayer);

    if (bloques.length === 0 && !hayDeAyer && !opts.prueba) { resultados.push({ persona: perfil.nombre, estado: "sin citas" }); continue; }

    // Bitácora: si ya se mandó hoy, no repetir
    if (!opts.prueba) {
      const { error } = await db.from("recordatorios_enviados").insert({ owner_id: perfil.id, fecha: hoy });
      if (error) {
        resultados.push({ persona: perfil.nombre, estado: error.code === "23505" ? "ya enviado" : "error", detalle: error.message });
        continue;
      }
    }

    const { asunto, html, texto } = armarCorreo({ nombre: perfil.nombre, bloques, pendientes, ayer, clinicaPorId, materiaPorId, sitio: opts.sitio, prueba: !!opts.prueba });

    try {
      await enviarConResend({
        para: correo,
        asunto,
        html,
        texto,
        idempotencia: opts.prueba ? undefined : `recordatorio-${perfil.id}-${hoy}`,
      });
      resultados.push({ persona: perfil.nombre, estado: "enviado" });
    } catch (e) {
      // Si falló el envío, liberamos la bitácora para poder reintentar
      if (!opts.prueba) await db.from("recordatorios_enviados").delete().eq("owner_id", perfil.id).eq("fecha", hoy);
      resultados.push({ persona: perfil.nombre, estado: "error", detalle: e instanceof Error ? e.message : String(e) });
    }
  }

  return resultados;
}

/* ------------------------------------------------------------------ */

export async function enviarConResend(m: { para: string; asunto: string; html: string; texto: string; idempotencia?: string; responderA?: string[] }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Falta la variable RESEND_API_KEY en Vercel.");
  const res = await fetch(`${process.env.RESEND_API_URL || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(m.idempotencia ? { "Idempotency-Key": m.idempotencia } : {}),
    },
    body: JSON.stringify({ from: REMITENTE, to: [m.para], subject: m.asunto, html: m.html, text: m.texto, ...(m.responderA?.length ? { reply_to: m.responderA } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const TITULO_DIA = ["Hoy", "Mañana", "En 2 días"];
const plural = (n: number) => `${n} cita${n === 1 ? "" : "s"}`;

function armarCorreo({
  nombre, bloques, pendientes, ayer, clinicaPorId, materiaPorId, sitio, prueba,
}: {
  nombre: string;
  bloques: { n: number; fecha: string; citas: Cita[] }[];
  pendientes: Cita[];
  ayer: string;
  clinicaPorId: Map<string, Clinica>;
  materiaPorId: Map<string, Materia>;
  sitio: string;
  prueba: boolean;
}) {
  const primero = bloques[0];
  const deAyer = pendientes.filter((c) => c.fecha === ayer).length;
  const asunto = prueba
    ? "Prueba de recordatorio — Agenda de clínicas"
    : !primero
      ? `¿Llegaron tus ${deAyer === 1 ? "paciente" : `${deAyer} pacientes`} de ayer?`
      : primero.n === 0
      ? `Hoy tienes ${plural(primero.citas.length)}`
      : primero.n === 1
        ? `Mañana tienes ${plural(primero.citas.length)}`
        : `En 2 días tienes ${plural(primero.citas.length)}`;

  const filaHtml = (c: Cita) => {
    const clinica = c.clinica_id ? clinicaPorId.get(c.clinica_id)?.numero : null;
    const materia = c.materia_id ? materiaPorId.get(c.materia_id) : null;
    const etiquetas = [
      clinica ? `<span style="background:#f1f0ec;border-radius:6px;padding:2px 8px;margin-right:6px;">${esc(clinica)}</span>` : "",
      materia ? `<span style="background:${materia.color}22;color:${materia.color};border-radius:6px;padding:2px 8px;">${esc(materia.nombre)}</span>` : "",
    ].join("");
    return `
      <tr><td style="padding:12px 14px;border:1px solid #e4e2dc;border-left:4px solid #2f5d50;border-radius:10px;">
        <div style="font-size:15px;"><b>${esc(c.paciente)}</b>
          <span style="float:right;color:#6d6a63;">${hhmm(c.hora_inicio)}–${hhmm(c.hora_fin)}</span></div>
        ${etiquetas ? `<div style="margin-top:8px;font-size:12px;">${etiquetas}</div>` : ""}
        ${c.notas ? `<div style="margin-top:6px;font-size:13px;color:#6d6a63;">${esc(c.notas)}</div>` : ""}
        ${materia?.material?.trim() ? `<div style="margin-top:6px;font-size:13px;color:#4a4843;"><b>Lleva:</b> ${esc(materia.material.split("\n").map((x) => x.trim()).filter(Boolean).join(" · "))}</div>` : ""}
      </td></tr><tr><td style="height:8px;"></td></tr>`;
  };

  const bloquesHtml = bloques.length
    ? bloques
        .map(
          (b) => `
      <h3 style="margin:22px 0 4px;font-size:16px;">${TITULO_DIA[b.n]} <span style="font-weight:normal;color:#6d6a63;">· ${esc(fechaLarga(b.fecha))}</span></h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;">${b.citas.map(filaHtml).join("")}</table>`
        )
        .join("")
    : prueba
      ? `<p style="color:#6d6a63;">No tienes citas en los próximos 3 días. Así se verán tus recordatorios cuando tengas.</p>`
      : "";

  const diaCorto = (iso: string) => (iso === ayer ? "Ayer" : fechaLarga(iso).replace(/^./, (x) => x.toUpperCase()));
  const pendientesHtml = pendientes.length
    ? `
      <div style="margin-top:24px;background:#fdf6e3;border-radius:12px;padding:16px;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#5c4712;">¿Llegaron? Tienes ${plural(pendientes.length)} sin marcar</p>
        <p style="margin:0 0 10px;font-size:13px;color:#5c4712;">En <b>Mi avance</b> sólo cuentan las que marques como <b>Asistió</b>.</p>
        ${pendientes
          .map((c) => `<div style="font-size:13px;padding:3px 0;color:#1c1b19;">${esc(diaCorto(c.fecha))} · ${hhmm(c.hora_inicio)} · <b>${esc(c.paciente)}</b></div>`)
          .join("")}
        ${sitio ? `<p style="margin:12px 0 0;"><a href="${sitio}/avance" style="display:inline-block;background:#5c4712;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold;font-size:13px;">Marcar asistencia</a></p>` : ""}
      </div>`
    : "";

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f5f2;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1b19;">
    <div style="background:#ffffff;border:1px solid #e4e2dc;border-radius:16px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#2f5d50;font-weight:bold;">Agenda de clínicas</p>
      <h2 style="margin:0 0 6px;font-size:22px;">${prueba ? "Así se ven tus recordatorios" : esc(asunto)}</h2>
      <p style="margin:0;color:#4a4843;">Buen día, ${esc(nombre)}. ${prueba ? "Este es un correo de prueba." : bloques.length ? "Esto es lo que viene:" : "Te falta marcar cómo te fue:"}</p>
      ${bloquesHtml}
      ${pendientesHtml}
      ${sitio ? `<p style="margin:24px 0 0;"><a href="${sitio}" style="display:inline-block;background:#2f5d50;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">Abrir la agenda</a></p>` : ""}
    </div>
    <p style="font-size:12px;color:#8a877f;margin:14px 4px 0;">Recibes esto porque tienes activados los recordatorios. Puedes cambiarlos en <b>Personalizar</b>.</p>
  </div></body></html>`;

  const texto = [
    prueba ? "Prueba de recordatorio — Agenda de clínicas" : asunto,
    `Buen día, ${nombre}.`,
    ...bloques.flatMap((b) => [
      "",
      `${TITULO_DIA[b.n]} · ${fechaLarga(b.fecha)}`,
      ...b.citas.map((c) => {
        const extra = [c.clinica_id && clinicaPorId.get(c.clinica_id)?.numero, c.materia_id && materiaPorId.get(c.materia_id)?.nombre]
          .filter(Boolean)
          .join(" · ");
        const m = c.materia_id ? materiaPorId.get(c.materia_id) : null;
        const lleva = m?.material?.trim() ? `\n    Lleva: ${m.material.split("\n").map((x) => x.trim()).filter(Boolean).join(", ")}` : "";
        return `- ${hhmm(c.hora_inicio)}–${hhmm(c.hora_fin)} ${c.paciente}${extra ? ` (${extra})` : ""}${lleva}`;
      }),
    ]),
    ...(pendientes.length
      ? ["", `Sin marcar (${pendientes.length}):`, ...pendientes.map((c) => `- ${diaCorto(c.fecha)} ${hhmm(c.hora_inicio)} ${c.paciente}`), sitio ? `Marcar asistencia: ${sitio}/avance` : ""]
      : []),
    "",
    sitio ? `Abrir la agenda: ${sitio}` : "",
  ].join("\n");

  return { asunto, html, texto };
}
