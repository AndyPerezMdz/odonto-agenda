// 2.3 · Planes de Mi agenda (Gratis / Pro), compartido entre cliente y servidor. Fechas "YYYY-MM-DD".
import { diasEntre, sumarDias } from "@/lib/pagos";

export const DIAS_PRUEBA_MI = 15; // la activa la persona cuando quiere (una vez por correo)
export const AVISAR_MI = 3; // "te quedan N días de Pro"

export type PlanMiId = "mes" | "tri" | "anual";
export type PlanMi = { id: PlanMiId; nombre: string; meses: number; precio: number; activo: boolean };

const BASE: PlanMi[] = [
  { id: "mes", nombre: "Mensual", meses: 1, precio: 99, activo: true },
  { id: "tri", nombre: "Trimestral", meses: 3, precio: 267, activo: true },
  { id: "anual", nombre: "Anual", meses: 12, precio: 950, activo: true },
];
export const PLANES_MI_DEFAULT = BASE;

/** Limpia lo guardado en configuracion.planes_mi: sólo cambian precio y activo; el mensual siempre existe. */
export function normalizarPlanesMi(v: unknown): PlanMi[] {
  const g = Array.isArray(v) ? (v as Partial<PlanMi>[]) : [];
  return BASE.map((p) => {
    const x = g.find((y) => y?.id === p.id);
    const precio = Number(x?.precio);
    return {
      ...p,
      precio: Number.isFinite(precio) && precio > 0 && precio <= 1000000 ? Math.round(precio) : p.precio,
      activo: p.id === "mes" ? true : x?.activo === undefined ? p.activo : !!x.activo,
    };
  });
}
export const planMiDe = (planes: PlanMi[], id: unknown) => planes.find((p) => p.id === id && p.activo) ?? null;

/** Lo que trae Pro en Mi agenda (para la página pública, los candados y la tarjeta del plan). */
export const BENEFICIOS_MI_PRO = [
  "Viajes con pase de abordar",
  "Tus categorías y colores",
  "Correo cada mañana con tu día",
  "Resumen diario en tu cel",
  "Tu agenda en el calendario de tu cel",
];
export const GRATIS_MI = ["Eventos, entregas y recordatorios", "Repetir: diario, cada semana, cada mes", "Hoy, Semana y Mes", "En tu cel y tu compu"];

/** Concepto de la transferencia de Mi agenda (distinto al AG- de clínicas). */
export const codigoMi = (userId: string) => "MI-" + userId.replace(/-/g, "").slice(0, 6).toUpperCase();

export type EstadoMi =
  | { tipo: "cortesia"; pro: true } // sin fecha: Pro siempre (las que das de alta tú)
  | { tipo: "clinicas"; pro: true; hasta: string | null } // incluida con el Pro de su agenda de clínicas
  | { tipo: "prueba" | "pro"; pro: true; hasta: string; dias: number }
  | { tipo: "gratis"; pro: false; hasta: string | null };

/**
 * ¿Es Pro? Por su propio plan (o cortesía) o porque su agenda de clínicas es Pro.
 * clinicas: undefined = no tiene agenda de clínicas; null = clínicas de cortesía; fecha = Pro de clínicas hasta.
 */
export function estadoMi(p: { pagado_hasta: string | null; prueba_hasta?: string | null }, clinicas: string | null | undefined, hoy: string): EstadoMi {
  if (!p.pagado_hasta) return { tipo: "cortesia", pro: true };
  if (p.pagado_hasta >= hoy) return { tipo: p.prueba_hasta && p.prueba_hasta === p.pagado_hasta ? "prueba" : "pro", pro: true, hasta: p.pagado_hasta, dias: diasEntre(hoy, p.pagado_hasta) };
  if (clinicas !== undefined && (clinicas === null || clinicas >= hoy)) return { tipo: "clinicas", pro: true, hasta: clinicas };
  return { tipo: "gratis", pro: false, hasta: p.pagado_hasta };
}

/** Ayer (para dejar a alguien en Gratis): Pro "venció" ayer. */
export const ayer = (hoy: string) => sumarDias(hoy, -1);
