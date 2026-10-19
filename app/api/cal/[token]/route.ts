import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fechaEnZona } from "@/lib/recordatorios";
import { sumarDias } from "@/lib/pagos";
import { expandir } from "@/lib/personal";
import { eventosPersonalesDe, personalDe } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// Feed .ics que el calendario del cel (Google / Apple) consulta solo cada ciertas horas.
// Sólo TUS citas, sólo con Pro. Mérida es UTC-6 todo el año → se manda en UTC (+6 h).
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function utc(fecha: string, hora: string) {
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h + 6, mi));
  return t.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}
// Las líneas de un .ics no deben pasar de 75 bytes
function doblar(l: string) {
  const out: string[] = [];
  let resto = l;
  while (Buffer.byteLength(resto) > 74) {
    let i = 74;
    while (Buffer.byteLength(resto.slice(0, i)) > 74) i--;
    out.push(resto.slice(0, i));
    resto = " " + resto.slice(i);
  }
  out.push(resto);
  return out.join("\r\n");
}

function ics(lineas: string[]) {
  return new Response(lineas.map(doblar).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": 'inline; filename="agenda.ics"' },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const limpio = token.replace(/\.ics$/, "");
  if (!/^[a-f0-9]{36}$/.test(limpio)) return new Response("No encontrado", { status: 404 });
  const db = createAdminClient();
  const { data: p } = await db.from("perfiles").select("id,agenda_id").eq("cal_token", limpio).maybeSingle();
  if (!p) return new Response("No encontrado", { status: 404 });
  const personal = await personalDe(db, p.id);
  if (!p.agenda_id && !personal) return new Response("No encontrado", { status: 404 });

  const hoy = fechaEnZona(0);
  const nombreCal = p.agenda_id ? "Agenda de clínicas" : "Mi agenda";
  const cabeza = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Agenda de clinicas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${nombreCal}`, "X-WR-TIMEZONE:America/Merida", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const personales = personal ? await eventosPersonales(db, p.id, hoy, ahora) : [];
  const { data: a } = p.agenda_id ? await db.from("agendas").select("pagado_hasta").eq("id", p.agenda_id).single() : { data: null };
  if (!p.agenda_id || (a?.pagado_hasta && a.pagado_hasta < hoy)) {
    // Sin agenda de clínicas, o sin Pro: sólo lo personal (no tronamos la suscripción del cel; vuelve sola al renovar)
    return ics([...cabeza, ...personales, "END:VCALENDAR"]);
  }

  const [{ data: citas }, { data: clinicas }, { data: materias }] = await Promise.all([
    db
      .from("citas")
      .select("id,paciente,fecha,hora_inicio,hora_fin,clinica_id,materia_id,estado,confirmacion")
      .eq("owner_id", p.id)
      .gte("fecha", sumarDias(hoy, -30))
      .lte("fecha", sumarDias(hoy, 120))
      .or("estado.is.null,estado.neq.cancelo"),
    db.from("clinicas").select("id,numero,descripcion"),
    db.from("materias").select("id,nombre"),
  ]);
  const cli = new Map((clinicas ?? []).map((c) => [c.id, c.numero as string]));
  const mat = new Map((materias ?? []).map((m) => [m.id, m.nombre as string]));
  const eventos = (citas ?? []).flatMap((c) => {
    const ini = String(c.hora_inicio).slice(0, 5);
    const fin = c.hora_fin ? String(c.hora_fin).slice(0, 5) : `${String(Number(ini.slice(0, 2)) + 1).padStart(2, "0")}:${ini.slice(3)}`;
    const extra = [c.materia_id ? mat.get(c.materia_id) : null, c.confirmacion === "confirmada" ? "Confirmó" : c.confirmacion === "no_puede" ? "Dijo que no puede" : null].filter(Boolean).join(" · ");
    return [
      "BEGIN:VEVENT",
      `UID:${c.id}@agenda-clinicas`,
      `DTSTAMP:${ahora}`,
      `DTSTART:${utc(c.fecha, ini)}`,
      `DTEND:${utc(c.fecha, fin)}`,
      `SUMMARY:${esc(`🦷 ${c.paciente}`)}`,
      ...(c.clinica_id && cli.get(c.clinica_id) ? [`LOCATION:${esc(cli.get(c.clinica_id)!)}`] : []),
      ...(extra ? [`DESCRIPTION:${esc(extra)}`] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Cita en 1 hora",
      "TRIGGER:-PT1H",
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  return ics([...cabeza, ...eventos, ...personales, "END:VCALENDAR"]);
}

const fechaIcs = (iso: string) => iso.replace(/-/g, "");

/** Agenda personal: cada aparición como su propio evento (las series ya vienen desdobladas). */
async function eventosPersonales(db: ReturnType<typeof createAdminClient>, userId: string, hoy: string, ahora: string) {
  const filas = await eventosPersonalesDe(db, [userId]);
  const desde = sumarDias(hoy, -30);
  const hasta = sumarDias(hoy, 180);
  // Los viajes van en un solo bloque de varios días, no día por día
  const viajes = filas.filter((e) => e.tipo === "viaje" && (e.fecha_fin ?? e.fecha) >= desde && e.fecha <= hasta);
  const otros = expandir(filas.filter((e) => e.tipo !== "viaje"), desde, hasta);
  const alarma = (desc: string, trigger: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(desc)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  const salida: string[] = [];
  for (const v of viajes) {
    salida.push(
      "BEGIN:VEVENT", `UID:${v.id}@mi-agenda`, `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${fechaIcs(v.fecha)}`, `DTEND;VALUE=DATE:${fechaIcs(sumarDias(v.fecha_fin ?? v.fecha, 1))}`,
      `SUMMARY:${esc(`✈ ${v.titulo}`)}`, ...(v.lugar ? [`LOCATION:${esc(v.lugar)}`] : []), ...(v.notas ? [`DESCRIPTION:${esc(v.notas)}`] : []),
      "END:VEVENT"
    );
  }
  for (const o of otros) {
    const titulo = o.tipo === "entrega" ? `${o.hecho ? "✓ " : "📌 "}Entregar: ${o.titulo}` : o.tipo === "recordatorio" ? `🔔 ${o.titulo}` : o.titulo;
    const cuando = o.hora_inicio
      ? [`DTSTART:${utc(o.dia, o.hora_inicio.slice(0, 5))}`, `DTEND:${utc(o.dia, (o.hora_fin ?? o.hora_inicio).slice(0, 5))}`]
      : [`DTSTART;VALUE=DATE:${fechaIcs(o.dia)}`, `DTEND;VALUE=DATE:${fechaIcs(sumarDias(o.dia, 1))}`];
    const aviso = o.tipo === "entrega" && !o.hecho
      ? alarma(`Mañana: ${o.titulo}`, "-PT15H")
      : o.hora_inicio
        ? alarma(o.titulo, o.tipo === "recordatorio" ? "PT0M" : "-PT1H")
        : [];
    salida.push(
      "BEGIN:VEVENT", `UID:${o.id}-${o.dia}@mi-agenda`, `DTSTAMP:${ahora}`, ...cuando,
      `SUMMARY:${esc(titulo)}`, ...(o.lugar ? [`LOCATION:${esc(o.lugar)}`] : []), ...(o.notas ? [`DESCRIPTION:${esc(o.notas)}`] : []),
      ...aviso, "END:VEVENT"
    );
  }
  return salida;
}
