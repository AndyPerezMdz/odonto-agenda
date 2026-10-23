// 2.6 · "Tu semana" (Pro): lo que viene de lunes a domingo — entregas, pagos, cumpleaños y viajes.
// Compartido entre la agenda (tarjeta en Semana) y el correo/push del domingo.

import { sumarDias } from "@/lib/pagos";
import { expandir, type Ocurrencia, type PEvento } from "@/lib/personal";
import { vencimientosEntre, type PPagoFijo, type PPagoHecho, type Vencimiento } from "@/lib/viajesPagos";

export type TuSemana = {
  desde: string;
  hasta: string;
  eventos: number; // eventos y recordatorios (las apariciones)
  entregas: Ocurrencia[]; // sin entregar
  pagos: Vencimiento[]; // sin pagar
  totalPagos: number;
  fechas: Ocurrencia[]; // cumpleaños y lo de "cada año"
  viajes: PEvento[]; // que empiezan o siguen esa semana
  diaPesado: { dia: string; n: number } | null; // el día con más cosas (si tiene 3 o más)
};

const diaSemana = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
/** El lunes de "la semana que viene" vista desde hoy: en domingo, mañana; entre semana, el de esta semana. */
export const lunesDeTuSemana = (hoy: string) => (diaSemana(hoy) === 0 ? sumarDias(hoy, 1) : sumarDias(hoy, -((diaSemana(hoy) + 6) % 7)));

export function tuSemana(eventos: PEvento[], pagos: PPagoFijo[], hechos: PPagoHecho[], lunes: string): TuSemana {
  const domingo = sumarDias(lunes, 6);
  const os = expandir(eventos, lunes, domingo);
  const entregas = os.filter((o) => o.tipo === "entrega" && !o.hecho);
  const fechas = os.filter((o) => o.repetir === "anual");
  const viajes = eventos.filter((e) => e.tipo === "viaje" && e.fecha <= domingo && (e.fecha_fin ?? e.fecha) >= lunes).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const normales = os.filter((o) => (o.tipo === "evento" || o.tipo === "recordatorio") && o.repetir !== "anual");
  const vs = vencimientosEntre(pagos, hechos, lunes, domingo).filter((v) => !v.pagado);
  const porDia = new Map<string, number>();
  for (const o of [...normales, ...entregas]) porDia.set(o.dia, (porDia.get(o.dia) ?? 0) + 1);
  const pesado = [...porDia.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    desde: lunes,
    hasta: domingo,
    eventos: normales.length,
    entregas,
    pagos: vs,
    totalPagos: vs.reduce((n, v) => n + Number(v.pago.monto), 0),
    fechas,
    viajes,
    diaPesado: pesado && pesado[1] >= 3 ? { dia: pesado[0], n: pesado[1] } : null,
  };
}

export const semanaVacia = (s: TuSemana) => !s.eventos && !s.entregas.length && !s.pagos.length && !s.fechas.length && !s.viajes.length;
