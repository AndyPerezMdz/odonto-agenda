// 3.0 · Bloques de tiempo: un pendiente con fecha + hora ocupa su lugar en el día, como un evento.
// Aquí se calculan los huecos libres para "Agéndalo".

import type { Ocurrencia, PPendiente } from "@/lib/personal";

export const aMin = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};
export const deMin = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const DURACION_BLOQUE = 60;
export const DURACIONES = [15, 30, 45, 60, 90, 120, 180];
export const textoDuracion = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);

/** ¿Es un bloque? (pendiente sin terminar o terminado, con fecha y hora) */
export const esBloque = (p: PPendiente) => !!(p.fecha && p.hora && !p.padre_id);
export const finBloque = (p: Pick<PPendiente, "hora" | "duracion">) => deMin(Math.min(24 * 60 - 1, aMin(p.hora!) + (p.duracion ?? DURACION_BLOQUE)));

export type Ocupado = { ini: number; fin: number };

/** Lo ocupado de un día: eventos con hora (sin hora de fin = 1 h; recordatorios = 15 min) y bloques. */
export function ocupadoDe(ocurrencias: Ocurrencia[], pendientes: PPendiente[], dia: string, sinId?: string): Ocupado[] {
  const out: Ocupado[] = [];
  for (const o of ocurrencias) {
    if (o.dia !== dia || !o.hora_inicio || o.tipo === "viaje" || o.tipo === "entrega") continue;
    const ini = aMin(o.hora_inicio);
    out.push({ ini, fin: o.hora_fin ? aMin(o.hora_fin) : ini + (o.tipo === "recordatorio" ? 15 : 60) });
  }
  for (const p of pendientes) {
    if (p.id === sinId || p.hecho || p.fecha !== dia || !p.hora) continue;
    const ini = aMin(p.hora);
    out.push({ ini, fin: ini + (p.duracion ?? DURACION_BLOQUE) });
  }
  return out.sort((a, b) => a.ini - b.ini);
}

/**
 * Hasta `max` horas de inicio libres (cada media hora) para un bloque de `duracion` minutos,
 * desde `desde` (minutos del día) hasta las `hasta`. Las opciones no se enciman entre sí.
 */
export function huecosLibres(ocupado: Ocupado[], duracion: number, desde: number, { hasta = 22 * 60, max = 4, paso = 30 } = {}): number[] {
  const out: number[] = [];
  let t = Math.ceil(Math.max(desde, 7 * 60) / paso) * paso;
  while (t + duracion <= hasta && out.length < max) {
    const choca = ocupado.find((o) => t < o.fin && t + duracion > o.ini);
    if (choca) {
      t = Math.ceil(choca.fin / paso) * paso;
      continue;
    }
    out.push(t);
    t += Math.max(duracion, paso);
    t = Math.ceil(t / paso) * paso;
  }
  return out;
}
