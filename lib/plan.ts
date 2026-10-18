import { diasEntre } from "@/lib/pagos";

// Gratis + Pro (2.0). Pro = prueba o pago vigente (sin fecha = cortesía = Pro).
// Al vencer NO se bloquea la agenda: baja a Gratis y lo de Pro se apaga (los datos se quedan).
export const DIAS_PRUEBA = 15; // registro nuevo
export const DIAS_CODIGO = 15; // extra con código de creador (por defecto)
export const AVISAR_PRO = 3; // "te quedan N días de Pro"

export function esPro(pagadoHasta: string | null | undefined, hoy: string) {
  return !pagadoHasta || pagadoHasta >= hoy;
}

/** Días que le quedan de Pro (0 = hoy es el último). null = cortesía (no vence). */
export function diasPro(pagadoHasta: string | null | undefined, hoy: string): number | null {
  if (!pagadoHasta) return null;
  return diasEntre(hoy, pagadoHasta);
}

/** Lo que trae Pro (para la página de planes y los candados). */
export const BENEFICIOS_PRO = [
  "El paciente confirma solo con un link",
  "Notificaciones en tu celular",
  "Tu agenda en el calendario de tu cel",
  "Recordatorios por correo y confirmar por WhatsApp",
  "PDF de casos para tus doctores",
  "Mis pacientes con folio e historia, y tu banco de pacientes",
  "Historial de todos tus periodos",
  "Repetir citas, otra sesión y cobros",
];
export const BENEFICIOS_PRO_UADY = ["Ritmo y semáforo por materia", "Mi material y la CEyE", "Turnos con tu compa"];

/**
 * Interruptor del pago en línea (Mercado Pago: tarjeta / OXXO).
 * En false sólo queda la transferencia. Para abrirlo: cámbialo a true (y pon MP_ACCESS_TOKEN en Vercel).
 */
export const PAGO_EN_LINEA = false;

/**
 * Aviso push "tu paciente llega en 1 hora": necesita el cron cada 15 min (sólo Vercel Pro).
 * En Hobby va en false. Al pasarte a Pro: ponlo en true y agrega a vercel.json
 *   un cron para /api/push/citas que corra cada 15 minutos.
 */
export const AVISO_1H = false;
