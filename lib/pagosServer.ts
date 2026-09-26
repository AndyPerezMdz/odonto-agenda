import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { codigoAgenda, DIAS_GRACIA, estadoPago, periodoDelPago, pesos } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Registra un pago y extiende "pagado_hasta". La usa tu panel (SPEI manual)
 * y, el día que conectes Stripe/Conekta, la usará su webhook.
 */
export async function registrarPago(
  db: Db,
  agendaId: string,
  p: { monto: number; meses: number; metodo: string; referencia?: string | null }
): Promise<{ hasta?: string; error?: string }> {
  const { data: agenda, error } = await db.from("agendas").select("pagado_hasta").eq("id", agendaId).single();
  if (error || !agenda) return { error: error?.message ?? "Agenda no encontrada." };

  const hoy = fechaEnZona(0);
  const meses = Math.min(Math.max(Math.round(p.meses || 1), 1), 24);
  const { desde, hasta } = periodoDelPago(agenda.pagado_hasta, hoy, meses);

  const { error: e1 } = await db.from("pagos").insert({
    agenda_id: agendaId,
    monto: p.monto,
    meses,
    metodo: p.metodo || "spei",
    referencia: p.referencia?.trim() || null,
    cubre_desde: desde,
    cubre_hasta: hasta,
  });
  if (e1) return { error: e1.message };

  const { error: e2 } = await db.from("agendas").update({ pagado_hasta: hasta }).eq("id", agendaId);
  if (e2) return { error: e2.message };
  return { hasta };
}

/** Correos de todos los superadmins (tú). */
export async function correosSuperadmin(db: Db) {
  const [{ data: sa }, { data: usuarios }] = await Promise.all([
    db.from("superadmins").select("user_id"),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const ids = new Set((sa ?? []).map((s) => s.user_id));
  return (usuarios?.users ?? []).filter((u) => ids.has(u.id) && u.email).map((u) => u.email!);
}

const envolver = (titulo: string, cuerpo: string, boton?: { texto: string; url: string }) => `<!doctype html><html lang="es"><body style="margin:0;background:#f6f5f2;">
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1b19;">
    <div style="background:#fff;border:1px solid #e4e2dc;border-radius:16px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#2f5d50;font-weight:bold;">Agenda de clínicas</p>
      <h2 style="margin:0 0 12px;font-size:21px;">${titulo}</h2>
      ${cuerpo}
      ${boton ? `<p style="margin:22px 0 0;"><a href="${boton.url}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${boton.texto}</a></p>` : ""}
    </div>
  </div></body></html>`;

/** Te avisa al instante cuando un dueño presiona "Ya pagué". */
export async function notificarAvisoPago(
  db: Db,
  a: { agendaNombre: string; agendaId: string; quien: string; monto: number | null; referencia: string | null; sitio: string }
) {
  const para = await correosSuperadmin(db);
  if (para.length === 0) return;
  const monto = a.monto != null ? pesos(a.monto) : "no indicado";
  const asunto = `Aviso de pago: ${a.agendaNombre} (${monto})`;
  const html = envolver(
    "Nuevo aviso de pago",
    `<p style="margin:0 0 8px;color:#4a4843;"><b>${esc(a.quien)}</b> dice que ya transfirió.</p>
     <table style="font-size:14px;color:#1c1b19;border-collapse:collapse;">
       <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Agenda</td><td><b>${esc(a.agendaNombre)}</b> · ${codigoAgenda(a.agendaId)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Monto</td><td>${monto}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Referencia</td><td>${esc(a.referencia || "—")}</td></tr>
     </table>
     <p style="margin:14px 0 0;color:#4a4843;">Revisa tu banco y confírmalo en tu panel.</p>`,
    a.sitio ? { texto: "Abrir mi panel", url: `${a.sitio}/admin` } : undefined
  );
  const texto = `Aviso de pago\n${a.quien} dice que ya transfirió.\nAgenda: ${a.agendaNombre} (${codigoAgenda(a.agendaId)})\nMonto: ${monto}\nReferencia: ${a.referencia || "—"}\n${a.sitio ? `${a.sitio}/admin` : ""}`;
  for (const correo of para) await enviarConResend({ para: correo, asunto, html, texto });
}

/**
 * Avisos de vencimiento para los dueños (los llama el cron diario):
 * 3 días antes, el día que vence, y el último día de gracia.
 */
export async function avisosVencimiento(db: Db, sitio: string) {
  const hoy = fechaEnZona(0);
  const { data: agendas, error } = await db.from("agendas").select("id,nombre,pagado_hasta,precio_mensual").not("pagado_hasta", "is", null);
  if (error) throw new Error(error.message);

  const resultados: { agenda: string; aviso: string }[] = [];
  for (const a of agendas ?? []) {
    const e = estadoPago(a.pagado_hasta, hoy);
    const dias = "dias" in e ? e.dias : null;
    let asunto: string | null = null;
    let cuerpo = "";
    if (dias === 3) {
      asunto = "Tu agenda vence en 3 días";
      cuerpo = `Tu suscripción está pagada hasta el <b>${fechaLarga(a.pagado_hasta!)}</b>.`;
    } else if (dias === 0) {
      asunto = "Tu agenda vence hoy";
      cuerpo = `Hoy vence tu suscripción. Tienes ${DIAS_GRACIA} días de gracia antes de que la agenda quede en sólo lectura.`;
    } else if (dias === -DIAS_GRACIA) {
      asunto = "Último día: mañana tu agenda queda en sólo lectura";
      cuerpo = `Tu suscripción venció el <b>${fechaLarga(a.pagado_hasta!)}</b>. A partir de mañana podrás ver tus citas, pero no agendar ni editar.`;
    }
    if (!asunto) continue;

    const { data: dueno } = await db.from("perfiles").select("id,nombre").eq("agenda_id", a.id).eq("rol", "owner").maybeSingle();
    if (!dueno) continue;
    const { data: u } = await db.auth.admin.getUserById(dueno.id);
    if (!u.user?.email) continue;

    const html = envolver(
      asunto,
      `<p style="margin:0 0 10px;color:#4a4843;">Hola, ${esc(dueno.nombre)}. ${cuerpo}</p>
       <p style="margin:0;color:#4a4843;">Para renovar, transfiere <b>${pesos(a.precio_mensual)}</b> con el concepto <b>${codigoAgenda(a.id)}</b>. Los datos bancarios están en <b>Personalizar → Suscripción</b>; al terminar, presiona <b>“Ya pagué”</b>.</p>`,
      sitio ? { texto: "Ver cómo pagar", url: `${sitio}/personalizar` } : undefined
    );
    const texto = `${asunto}\nHola, ${dueno.nombre}. ${cuerpo.replace(/<[^>]+>/g, "")}\nTransfiere ${pesos(a.precio_mensual)} con el concepto ${codigoAgenda(a.id)}. Datos en Personalizar → Suscripción.`;
    try {
      await enviarConResend({ para: u.user.email, asunto, html, texto, idempotencia: `vencimiento-${a.id}-${hoy}` });
      resultados.push({ agenda: a.nombre, aviso: asunto });
    } catch (err) {
      resultados.push({ agenda: a.nombre, aviso: "error: " + (err instanceof Error ? err.message : String(err)) });
    }
  }
  return resultados;
}

/* ------------------------------------------------------------------ */
/* Respuesta al cliente cuando confirmas o descartas su pago           */
/* ------------------------------------------------------------------ */

async function duenoDeAgenda(db: Db, agendaId: string) {
  const [{ data: agenda }, { data: dueno }] = await Promise.all([
    db.from("agendas").select("id,nombre,precio_mensual").eq("id", agendaId).single(),
    db.from("perfiles").select("id,nombre").eq("agenda_id", agendaId).eq("rol", "owner").maybeSingle(),
  ]);
  if (!agenda || !dueno) return null;
  const { data: u } = await db.auth.admin.getUserById(dueno.id);
  if (!u.user?.email) return null;
  return { agenda, nombre: dueno.nombre, email: u.user.email };
}

/** "¡Pago recibido!" — al confirmar un aviso o registrar un pago a mano. */
export async function notificarPagoConfirmado(
  db: Db,
  agendaId: string,
  p: { monto: number; meses: number; hasta: string; sitio: string }
) {
  const d = await duenoDeAgenda(db, agendaId);
  if (!d) return;
  const asunto = `¡Pago recibido! Tu agenda está activa hasta el ${fechaLarga(p.hasta)}`;
  const html = envolver(
    "¡Pago recibido, gracias!",
    `<p style="margin:0 0 12px;color:#4a4843;">Hola, ${esc(d.nombre)}. Confirmamos tu pago de <b>${pesos(p.monto)}</b> para <b>${esc(d.agenda.nombre)}</b>.</p>
     <table style="font-size:14px;color:#1c1b19;border-collapse:collapse;">
       <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Periodo pagado</td><td>${p.meses} mes${p.meses === 1 ? "" : "es"}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6d6a63;">Activa hasta</td><td><b>${fechaLarga(p.hasta)}</b></td></tr>
     </table>
     <p style="margin:14px 0 0;color:#4a4843;">Te avisaremos unos días antes del siguiente vencimiento. ¡Éxito en tus clínicas!</p>`,
    p.sitio ? { texto: "Abrir la agenda", url: p.sitio } : undefined
  );
  const texto = `¡Pago recibido!\nHola, ${d.nombre}. Confirmamos tu pago de ${pesos(p.monto)} para ${d.agenda.nombre}.\nActiva hasta: ${fechaLarga(p.hasta)}.`;
  await enviarConResend({ para: d.email, asunto, html, texto, responderA: await correosSuperadmin(db) });
}

/** "No hemos podido confirmar tu pago" — al marcar un aviso como "No llegó". */
export async function notificarPagoNoReflejado(
  db: Db,
  agendaId: string,
  a: { monto: number | null; referencia: string | null; sitio: string }
) {
  const d = await duenoDeAgenda(db, agendaId);
  if (!d) return;
  const monto = pesos(a.monto ?? Number(d.agenda.precio_mensual));
  const asunto = "No hemos podido confirmar tu pago";
  const html = envolver(
    "No hemos podido confirmar tu pago",
    `<p style="margin:0 0 12px;color:#4a4843;">Hola, ${esc(d.nombre)}. Revisamos y todavía no vemos reflejada tu transferencia de <b>${monto}</b>${
      a.referencia ? ` (rastreo <b>${esc(a.referencia)}</b>)` : ""
    } para <b>${esc(d.agenda.nombre)}</b>.</p>
     <p style="margin:0 0 6px;color:#4a4843;">Por favor revisa:</p>
     <ul style="margin:0 0 12px;padding-left:20px;color:#4a4843;">
       <li>Que la <b>CLABE</b> y el <b>beneficiario</b> sean los que aparecen en tu agenda.</li>
       <li>Que hayas escrito el concepto <b>${codigoAgenda(agendaId)}</b>.</li>
       <li>Que la transferencia no haya sido rechazada o devuelta por tu banco.</li>
     </ul>
     <p style="margin:0;color:#4a4843;">Si ya está todo bien, <b>responde a este correo con tu comprobante</b> y lo revisamos. También puedes volver a presionar <b>“Ya pagué”</b> en tu agenda.</p>`,
    p_sitio(a.sitio)
  );
  const texto = `No hemos podido confirmar tu pago\nHola, ${d.nombre}. Todavía no vemos tu transferencia de ${monto}${a.referencia ? ` (rastreo ${a.referencia})` : ""}.\nRevisa CLABE, beneficiario y el concepto ${codigoAgenda(agendaId)}. Si todo está bien, responde a este correo con tu comprobante.`;
  await enviarConResend({ para: d.email, asunto, html, texto, responderA: await correosSuperadmin(db) });
}

const p_sitio = (sitio: string) => (sitio ? { texto: "Ver datos de pago", url: `${sitio}/personalizar#suscripcion` } : undefined);
