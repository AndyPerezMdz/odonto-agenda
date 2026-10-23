// 2.5 · Viajes completos (itinerario, maleta, reservas, gastos) y pagos fijos de Mi agenda. Pro.
// Compartido entre cliente y servidor. Fechas "YYYY-MM-DD".

import { sumarDias } from "@/lib/pagos";
import type { PerfilPersonal } from "@/lib/personal";

/* ------------------------------ Viajes ------------------------------ */

export type TipoCosa = "itinerario" | "maleta" | "reserva" | "gasto";
export type SubtipoReserva = "vuelo" | "hotel" | "auto" | "actividad" | "otro";

export type PCosa = {
  id: string;
  user_id: string;
  viaje_id: string;
  tipo: TipoCosa;
  subtipo: SubtipoReserva | null; // reservas
  titulo: string;
  fecha: string | null; // itinerario, reservas y gastos
  hora: string | null;
  detalle: string | null; // reservas: número de confirmación
  monto: number | null; // reservas y gastos
  hecho: boolean; // maleta
  orden: number;
  created_at: string;
};
export const CAMPOS_COSA = "id,user_id,viaje_id,tipo,subtipo,titulo,fecha,hora,detalle,monto,hecho,orden,created_at";

export const RESERVAS: { id: SubtipoReserva; nombre: string; emoji: string }[] = [
  { id: "vuelo", nombre: "Vuelo", emoji: "✈️" },
  { id: "hotel", nombre: "Hospedaje", emoji: "🏨" },
  { id: "auto", nombre: "Transporte", emoji: "🚗" },
  { id: "actividad", nombre: "Actividad", emoji: "🎟️" },
  { id: "otro", nombre: "Otra", emoji: "📌" },
];
export const emojiReserva = (s: SubtipoReserva | null) => RESERVAS.find((r) => r.id === s)?.emoji ?? "📌";

/** Lo básico para la maleta (botón "Lo básico"). */
export const MALETA_BASICA = [
  "Identificación / pasaporte", "Cargador del cel", "Audífonos", "Cepillo y pasta de dientes", "Desodorante", "Ropa interior",
  "Pijama", "Medicinas", "Bloqueador", "Lentes de sol", "Traje de baño", "Tenis cómodos", "Efectivo y tarjeta",
];

/** Lo que cuesta un viaje: reservas y gastos. */
export function gastadoViaje(cosas: PCosa[]) {
  return cosas.filter((c) => (c.tipo === "gasto" || c.tipo === "reserva") && c.monto).reduce((n, c) => n + Number(c.monto), 0);
}
/** "5/13" de la maleta. */
export function maletaViaje(cosas: PCosa[]) {
  const m = cosas.filter((c) => c.tipo === "maleta");
  return { listas: m.filter((c) => c.hecho).length, total: m.length };
}

/* ------------------------------ Pagos fijos ------------------------------ */

export type Frecuencia = "mensual" | "anual";
export type PPagoFijo = {
  id: string;
  user_id: string;
  nombre: string;
  monto: number;
  frecuencia: Frecuencia;
  dia: number; // 1..31 (si el mes es más corto, el último día)
  mes: number | null; // 1..12, sólo anual
  avisar_dias: number; // aparece en Hoy esos días antes
  desde: string; // no cuenta vencimientos anteriores a esta fecha
  activo: boolean;
  notas: string | null;
  created_at: string;
};
export type PPagoHecho = { pago_id: string; periodo: string; monto: number | null; pagado_at: string };
export const CAMPOS_PAGO = "id,user_id,nombre,monto,frecuencia,dia,mes,avisar_dias,desde,activo,notas,created_at";

export const IDEAS_PAGOS = ["Renta", "Tarjeta", "Celular", "Internet", "Luz", "Netflix", "Spotify", "Gym"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate(); // m: 0..11
const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Fechas en que toca pagar, entre desde y hasta (incluidas). */
export function vencimientos(p: Pick<PPagoFijo, "frecuencia" | "dia" | "mes" | "desde">, desde: string, hasta: string): string[] {
  const out: string[] = [];
  const ini = desde > p.desde ? desde : p.desde;
  if (ini > hasta) return out;
  let a = Number(ini.slice(0, 4));
  let m = Number(ini.slice(5, 7)) - 1;
  const fa = Number(hasta.slice(0, 4));
  const fm = Number(hasta.slice(5, 7)) - 1;
  for (let i = 0; i < 400 && (a < fa || (a === fa && m <= fm)); i++) {
    if (p.frecuencia === "mensual" || (p.mes && p.mes - 1 === m)) {
      const f = iso(a, m, Math.min(p.dia, ultimoDia(a, m)));
      if (f >= ini && f <= hasta) out.push(f);
    }
    if (++m > 11) { m = 0; a++; }
  }
  return out;
}

/** El siguiente vencimiento a partir de "desde" (dentro de un año). */
export const siguienteVencimiento = (p: PPagoFijo, desde: string) => vencimientos(p, desde, sumarDias(desde, 370))[0] ?? null;

export type Vencimiento = { pago: PPagoFijo; fecha: string; pagado: boolean };

/**
 * Lo que hay que pagar ya: sin pagar, que venció (hasta 60 días atrás) o vence dentro de sus días de aviso.
 * Ordenado por fecha.
 */
export function pagosPorAtender(pagos: PPagoFijo[], hechos: PPagoHecho[], hoy: string): Vencimiento[] {
  const pagado = new Set(hechos.map((h) => `${h.pago_id}|${h.periodo}`));
  const out: Vencimiento[] = [];
  for (const p of pagos) {
    if (!p.activo) continue;
    for (const f of vencimientos(p, sumarDias(hoy, -60), sumarDias(hoy, p.avisar_dias))) {
      if (!pagado.has(`${p.id}|${f}`)) out.push({ pago: p, fecha: f, pagado: false });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Los vencimientos de un rango (para la Semana y el total del mes), con si ya se pagaron. */
export function vencimientosEntre(pagos: PPagoFijo[], hechos: PPagoHecho[], desde: string, hasta: string): Vencimiento[] {
  const pagado = new Set(hechos.map((h) => `${h.pago_id}|${h.periodo}`));
  const out: Vencimiento[] = [];
  for (const p of pagos) {
    if (!p.activo) continue;
    for (const f of vencimientos(p, desde, hasta)) out.push({ pago: p, fecha: f, pagado: pagado.has(`${p.id}|${f}`) });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Total de un mes (a: año, m: 0..11): cuánto toca, cuánto ya y cuánto falta. */
export function totalMes(pagos: PPagoFijo[], hechos: PPagoHecho[], a: number, m: number) {
  const vs = vencimientosEntre(pagos, hechos, iso(a, m, 1), iso(a, m, ultimoDia(a, m)));
  const montoDe = (v: Vencimiento) => Number(hechos.find((h) => h.pago_id === v.pago.id && h.periodo === v.fecha)?.monto ?? v.pago.monto);
  const total = vs.reduce((n, v) => n + montoDe(v), 0);
  const pagado = vs.filter((v) => v.pagado).reduce((n, v) => n + montoDe(v), 0);
  return { vencimientos: vs, total, pagado, falta: total - pagado };
}

/** "cada mes, el 5" / "cada año, 12 mar" */
export const textoFrecuencia = (p: Pick<PPagoFijo, "frecuencia" | "dia" | "mes">) =>
  p.frecuencia === "anual" && p.mes ? `cada año, ${p.dia} ${MESES_CORTOS[p.mes - 1]}` : `cada mes, el ${p.dia}`;

/* ------------------------------ Demo ------------------------------ */

/** Itinerario, maleta, reservas y gastos del viaje de ejemplo (demo-4), y pagos fijos de ejemplo. */
export function ejemploViajesPagos(hoy: string, perfil: PerfilPersonal = "odonto"): { cosas: PCosa[]; pagos: PPagoFijo[]; hechos: PPagoHecho[] } {
  const ida = sumarDias(hoy, 9);
  const c = (id: string, o: Partial<PCosa>): PCosa => ({ id, user_id: "demo", viaje_id: "demo-4", tipo: "maleta", subtipo: null, titulo: "", fecha: null, hora: null, detalle: null, monto: null, hecho: false, orden: 0, created_at: hoy, ...o });
  const cosas: PCosa[] = [
    c("vc-1", { tipo: "reserva", subtipo: "vuelo", titulo: "Vuelo MID → CUN", fecha: ida, hora: "07:40:00", detalle: "VB1234 · conf. XK7P2Q", monto: 1890 }),
    c("vc-2", { tipo: "reserva", subtipo: "hotel", titulo: "Hotel Riviera", fecha: ida, hora: "15:00:00", detalle: "Reserva 88231", monto: 5400 }),
    c("vc-3", { tipo: "reserva", subtipo: "actividad", titulo: "Tour a Isla Mujeres", fecha: sumarDias(ida, 2), hora: "09:00:00", detalle: "Cupón 5531", monto: 1200 }),
    c("vc-4", { tipo: "itinerario", titulo: "Playa Delfines", fecha: sumarDias(ida, 1), hora: "10:00:00" }),
    c("vc-5", { tipo: "itinerario", titulo: "Cena en el centro", fecha: sumarDias(ida, 1), hora: "20:30:00" }),
    c("vc-6", { tipo: "itinerario", titulo: "Check-out y regreso", fecha: sumarDias(ida, 3), hora: "12:00:00" }),
    c("vc-7", { tipo: "gasto", titulo: "Gasolina al aeropuerto", monto: 350, fecha: hoy }),
    ...["Identificación / pasaporte", "Cargador del cel", "Traje de baño", "Bloqueador", "Lentes de sol", "Tenis cómodos"].map((t, i) => c(`vm-${i}`, { titulo: t, hecho: i < 2, orden: i })),
  ];
  const p = (id: string, o: Partial<PPagoFijo>): PPagoFijo => ({ id, user_id: "demo", nombre: "", monto: 0, frecuencia: "mensual", dia: 1, mes: null, avisar_dias: 3, desde: sumarDias(hoy, -90), activo: true, notas: null, created_at: hoy, ...o });
  const d = (n: number) => Number(sumarDias(hoy, n).slice(8, 10));
  const general = perfil === "general";
  const pagos = [
    p("pf-1", { nombre: general ? "Renta" : "Cuota de la clínica", monto: general ? 6500 : 1200, dia: d(2) }),
    p("pf-2", { nombre: "Celular", monto: 299, dia: d(-3) }),
    p("pf-3", { nombre: "Spotify", monto: 129, dia: d(6), avisar_dias: 1 }),
    p("pf-4", { nombre: "Gym", monto: 450, dia: d(15) }),
    p("pf-5", { nombre: "Licencia de manejo", monto: 980, frecuencia: "anual", dia: 12, mes: 3, avisar_dias: 7 }),
  ];
  // El celular de este mes ya está pagado; los meses pasados, todo pagado
  const hechos: PPagoHecho[] = [];
  for (const x of pagos) for (const f of vencimientos(x, x.desde, sumarDias(hoy, -1))) if (x.id !== "pf-2" || f < sumarDias(hoy, -3)) hechos.push({ pago_id: x.id, periodo: f, monto: x.monto, pagado_at: f });
  hechos.push({ pago_id: "pf-2", periodo: sumarDias(hoy, -3), monto: 299, pagado_at: hoy });
  return { cosas, pagos, hechos };
}
