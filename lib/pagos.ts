// Lógica de suscripción compartida entre cliente y servidor. Fechas como "YYYY-MM-DD".

export const DIAS_GRACIA = 3;   // días después del vencimiento en que la agenda sigue funcionando
export const AVISAR_DESDE = 5;  // cuántos días antes se muestra el aviso "por vencer"

export type EstadoPago =
  | { tipo: "cortesia" }
  | { tipo: "activa"; vence: string; dias: number }
  | { tipo: "por_vencer"; vence: string; dias: number }
  | { tipo: "gracia"; vence: string; bloqueo: string; dias: number }
  | { tipo: "vencida"; vence: string };

const pad = (n: number) => String(n).padStart(2, "0");
const aUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const deUTC = (t: number) => {
  const f = new Date(t);
  return `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`;
};

export function sumarDias(iso: string, n: number) {
  return deUTC(aUTC(iso) + n * 86400000);
}

export function diasEntre(desde: string, hasta: string) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86400000);
}

/** Suma meses de calendario (31 ene + 1 mes = 28/29 feb). */
export function sumarMeses(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return deUTC(Date.UTC(y, m - 1 + n, Math.min(d, ultimo)));
}

export function estadoPago(pagadoHasta: string | null | undefined, hoy: string): EstadoPago {
  if (!pagadoHasta) return { tipo: "cortesia" };
  const dias = diasEntre(hoy, pagadoHasta);
  if (dias > AVISAR_DESDE) return { tipo: "activa", vence: pagadoHasta, dias };
  if (dias >= 0) return { tipo: "por_vencer", vence: pagadoHasta, dias };
  if (dias >= -DIAS_GRACIA) return { tipo: "gracia", vence: pagadoHasta, bloqueo: sumarDias(pagadoHasta, DIAS_GRACIA + 1), dias };
  return { tipo: "vencida", vence: pagadoHasta };
}

/** Periodo que cubre un pago nuevo: empieza al día siguiente del vencimiento (o hoy, si ya venció). */
export function periodoDelPago(pagadoHasta: string | null, hoy: string, meses: number) {
  const desde = pagadoHasta && pagadoHasta >= hoy ? sumarDias(pagadoHasta, 1) : hoy;
  const hasta = sumarDias(sumarMeses(desde, meses), -1);
  return { desde, hasta };
}

/** Código corto de la agenda, para el concepto de la transferencia. */
export function codigoAgenda(id: string) {
  return "AG-" + id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export const pesos = (n: number) => `$${Number(n).toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;
