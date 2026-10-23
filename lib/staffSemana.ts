import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { correosSuperadmin, envolver } from "@/lib/pagosServer";
import { pesos, sumarDias } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";
import { resumenMiAdmin } from "@/lib/miAdmin";
import { saludSistema } from "@/lib/salud";

type Db = ReturnType<typeof createAdminClient>;

// 2.8 · "Tu semana" para ti (staff): cada lunes, lo cobrado, quién llegó, quién vence y lo que te espera en el panel.

const esLunes = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
};

export async function correoSemanaStaff(db: Db, sitio: string, forzar = false) {
  const hoy = fechaEnZona(0);
  if (!forzar && !esLunes(hoy)) return { enviado: false, motivo: "no es lunes" };
  const para = await correosSuperadmin(db);
  if (!para.length) return { enviado: false, motivo: "sin superadmins" };
  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const en7 = sumarDias(hoy, 7);

  const [{ data: pagos }, { data: agendas }, { data: avisos }, { data: sugerencias }, mi, salud] = await Promise.all([
    db.from("pagos").select("monto,created_at").gte("created_at", hace7),
    db.from("agendas").select("id,nombre,pagado_hasta,prueba_hasta,created_at"),
    db.from("avisos_pago").select("id").eq("estado", "pendiente"),
    db.from("sugerencias").select("id").eq("estado", "nueva"),
    resumenMiAdmin(db).catch(() => null),
    saludSistema(db).catch(() => null),
  ]);
  const cobradoCl = (pagos ?? []).reduce((n, p) => n + Number(p.monto), 0);
  const miPagosSemana = mi ? (await db.from("p_pagos").select("monto").gte("created_at", hace7)).data ?? [] : [];
  const cobradoMi = miPagosSemana.reduce((n, p) => n + Number(p.monto), 0);
  const nuevasAg = (agendas ?? []).filter((a) => a.created_at >= hace7).length;
  const vencenAg = (agendas ?? []).filter((a) => a.pagado_hasta && a.pagado_hasta >= hoy && a.pagado_hasta <= en7).sort((a, b) => String(a.pagado_hasta).localeCompare(String(b.pagado_hasta)));
  const vencenMi = (mi?.renovaciones ?? []).filter((r) => r.hasta <= en7);
  const pendientes = (avisos?.length ?? 0) + (mi?.pendientes.avisos ?? 0);

  const li = (t: string) => `<li style="margin:0 0 6px;">${t}</li>`;
  const bloque = (titulo: string, items: string[]) =>
    items.length ? `<p style="margin:18px 0 6px;font-weight:bold;">${titulo}</p><ul style="margin:0;padding-left:18px;color:#4a4843;">${items.join("")}</ul>` : "";
  const numeros = `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:4px;">
    <tr><td style="padding:6px 0;color:#6b6a65;">Cobrado (7 días)</td><td style="text-align:right;"><b>${esc(pesos(cobradoCl + cobradoMi))}</b> <span style="color:#6b6a65;">(clínicas ${esc(pesos(cobradoCl))} · Mi agenda ${esc(pesos(cobradoMi))})</span></td></tr>
    <tr><td style="padding:6px 0;color:#6b6a65;">Llegaron</td><td style="text-align:right;">${nuevasAg} agenda${nuevasAg === 1 ? "" : "s"} · ${mi?.personas.nuevas7 ?? 0} en Mi agenda</td></tr>
    <tr><td style="padding:6px 0;color:#6b6a65;">Recurrente</td><td style="text-align:right;">Mi agenda ${esc(pesos(mi?.recurrente ?? 0))}/mes</td></tr>
  </table>`;
  const html = envolver(
    `Tu semana · ${esc(fechaLarga(hoy))}`,
    numeros +
      bloque("Te espera en el panel", [
        pendientes ? li(`<b>${pendientes}</b> pago${pendientes === 1 ? "" : "s"} por confirmar`) : "",
        sugerencias?.length ? li(`<b>${sugerencias.length}</b> sugerencia${sugerencias.length === 1 ? "" : "s"} nueva${sugerencias.length === 1 ? "" : "s"} en el buzón`) : "",
        salud?.problemas ? li(`<b style="color:#b4322b;">${salud.problemas}</b> cosa${salud.problemas === 1 ? "" : "s"} por revisar en Salud (llaves, crons o SQL)`) : "",
      ].filter(Boolean)) +
      bloque("Vencen esta semana", [
        ...vencenAg.map((a) => li(`${esc(a.nombre)} (clínicas) · ${esc(fechaLarga(String(a.pagado_hasta)))}${a.prueba_hasta === a.pagado_hasta ? " · termina su prueba" : ""}`)),
        ...vencenMi.map((r) => li(`${esc(r.nombre || r.email || "")} (Mi agenda) · ${esc(fechaLarga(r.hasta))}${r.tipo === "prueba" ? " · termina su prueba" : ""}`)),
      ]),
    { texto: "Abrir mi panel", url: `${sitio}/admin#hoy` }
  );
  const texto = `Tu semana: cobrado ${pesos(cobradoCl + cobradoMi)}, ${nuevasAg} agendas nuevas, ${mi?.personas.nuevas7 ?? 0} en Mi agenda, ${pendientes} pagos por confirmar. ${sitio}/admin`;
  for (const correo of para) {
    await enviarConResend({ para: correo, asunto: `Tu semana: ${pesos(cobradoCl + cobradoMi)} cobrado · ${nuevasAg + (mi?.personas.nuevas7 ?? 0)} ${nuevasAg + (mi?.personas.nuevas7 ?? 0) === 1 ? "nuevo" : "nuevos"}`, html, texto, idempotencia: `staff-semana-${correo}-${hoy}` });
  }
  return { enviado: true, para: para.length };
}
