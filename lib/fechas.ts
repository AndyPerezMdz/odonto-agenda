// Utilidades de fecha SIN zonas horarias: todo se maneja como "YYYY-MM-DD" local.

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const DIAS_CORTOS_LUNES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DIAS_CORTOS_DOMINGO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const pad = (n: number) => String(n).padStart(2, "0");

export function aISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function deISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function hoyISO(): string {
  return aISO(new Date());
}

/** Días a pintar en la cuadrícula del mes (incluye relleno de meses vecinos). */
export function diasDelMes(anio: number, mes: number, empiezaLunes: boolean): Date[] {
  const primero = new Date(anio, mes, 1);
  const offset = empiezaLunes ? (primero.getDay() + 6) % 7 : primero.getDay();
  const inicio = new Date(anio, mes, 1 - offset);
  const ultimo = new Date(anio, mes + 1, 0);
  const totalCeldas = Math.ceil((offset + ultimo.getDate()) / 7) * 7;
  return Array.from({ length: totalCeldas }, (_, i) =>
    new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
  );
}

export function esFinDeSemana(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

export function fechaLarga(iso: string): string {
  const d = deISO(iso);
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
}

export function hhmm(t: string): string {
  return t.slice(0, 5);
}

export function sumarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = Math.min(h * 60 + m + min, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
