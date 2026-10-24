// 3.0 · Buscador de Mi agenda: eventos, pendientes, hábitos, planes de viaje y pagos fijos. Todo en el cel (ya está cargado).

import { expandir, type PEvento, type PHabito, type PPendiente } from "@/lib/personal";
import { sumarDias } from "@/lib/pagos";
import type { PCosa, PPagoFijo } from "@/lib/viajesPagos";

export type ResultadoMi =
  | { clase: "evento"; id: string; titulo: string; detalle: string; fecha: string | null; e: PEvento }
  | { clase: "pendiente"; id: string; titulo: string; detalle: string; fecha: string | null; p: PPendiente }
  | { clase: "habito"; id: string; titulo: string; detalle: string; fecha: null; h: PHabito }
  | { clase: "cosa"; id: string; titulo: string; detalle: string; fecha: string | null; c: PCosa; viaje: PEvento | undefined }
  | { clase: "pago"; id: string; titulo: string; detalle: string; fecha: null; pago: PPagoFijo };

export const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** ¿Están todas las palabras de la búsqueda? */
const coincide = (terminos: string[], ...textos: (string | null | undefined)[]) => {
  const t = sinAcentos(textos.filter(Boolean).join(" "));
  return terminos.every((x) => t.includes(x));
};

export function buscarMi(
  q: string,
  d: { eventos: PEvento[]; pendientes: PPendiente[]; habitos: PHabito[]; cosas: PCosa[]; pagos: PPagoFijo[]; hoy: string },
  max = 40
): ResultadoMi[] {
  const terminos = sinAcentos(q).split(/\s+/).filter((x) => x.length >= 2);
  if (!terminos.length) return [];
  const out: ResultadoMi[] = [];
  const viajes = new Map(d.eventos.filter((e) => e.tipo === "viaje").map((e) => [e.id, e]));

  for (const e of d.eventos) {
    if (!coincide(terminos, e.titulo, e.lugar, e.notas)) continue;
    // Las series: la próxima vez que toca (o la última, si ya terminó)
    let fecha: string | null = e.fecha;
    if (e.repetir !== "nunca" && e.tipo !== "viaje" && e.tipo !== "entrega") {
      const prox = expandir([e], d.hoy, sumarDias(d.hoy, 400))[0];
      fecha = prox?.dia ?? e.repetir_hasta ?? e.fecha;
    }
    out.push({ clase: "evento", id: e.id, titulo: e.titulo, detalle: [e.lugar, e.notas].filter(Boolean).join(" · "), fecha, e });
  }
  for (const p of d.pendientes) {
    if (!coincide(terminos, p.titulo, p.notas, p.etiqueta)) continue;
    const padre = p.padre_id ? d.pendientes.find((x) => x.id === p.padre_id) : undefined;
    out.push({ clase: "pendiente", id: p.id, titulo: p.titulo, detalle: [padre ? `en “${padre.titulo}”` : null, p.etiqueta, p.notas].filter(Boolean).join(" · "), fecha: p.fecha, p });
  }
  for (const h of d.habitos) if (coincide(terminos, h.nombre)) out.push({ clase: "habito", id: h.id, titulo: h.nombre, detalle: h.archivado ? "archivado" : "hábito", fecha: null, h });
  for (const c of d.cosas) {
    if (!coincide(terminos, c.titulo, c.detalle)) continue;
    const viaje = viajes.get(c.viaje_id);
    out.push({ clase: "cosa", id: c.id, titulo: c.titulo, detalle: [viaje ? `viaje a ${viaje.titulo}` : null, c.detalle].filter(Boolean).join(" · "), fecha: c.fecha ?? viaje?.fecha ?? null, c, viaje });
  }
  for (const p of d.pagos) if (coincide(terminos, p.nombre, p.notas)) out.push({ clase: "pago", id: p.id, titulo: p.nombre, detalle: p.notas ?? "pago fijo", fecha: null, pago: p });

  // Primero lo que viene (más cercano arriba), luego lo pasado (más reciente arriba), al final lo que no tiene fecha
  const rango = (r: ResultadoMi) => (r.fecha == null ? 2 : r.fecha >= d.hoy ? 0 : 1);
  return out
    .sort((a, b) => rango(a) - rango(b) || (rango(a) === 0 ? a.fecha!.localeCompare(b.fecha!) : rango(a) === 1 ? b.fecha!.localeCompare(a.fecha!) : a.titulo.localeCompare(b.titulo)))
    .slice(0, max);
}
