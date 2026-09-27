import type { Cita, Horario } from "@/lib/types";
import { deISO, hhmm } from "@/lib/fechas";

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Bloques fijos que caen en esa fecha (según el día de la semana). */
export function bloquesDelDia(horarios: Horario[], fecha: string, dueno?: string) {
  const dia = deISO(fecha).getDay();
  return horarios.filter((h) => h.dia_semana === dia && (!dueno || h.owner_id === dueno));
}

const min = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const hora = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** Huecos libres (de al menos 30 min) dentro de un bloque, descontando las citas de su dueño ese día. */
export function huecos(b: Horario, citas: Cita[], fecha: string) {
  const ocupado = citas
    .filter((c) => c.owner_id === b.owner_id && c.fecha === fecha && c.estado !== "cancelo")
    .map((c) => [min(hhmm(c.hora_inicio)), min(hhmm(c.hora_fin))] as const)
    .sort((a, z) => a[0] - z[0]);
  const libres: { inicio: string; fin: string }[] = [];
  let cursor = min(hhmm(b.hora_inicio));
  const fin = min(hhmm(b.hora_fin));
  for (const [i, f] of ocupado) {
    if (f <= cursor || i >= fin) continue;
    if (i - cursor >= 30) libres.push({ inicio: hora(cursor), fin: hora(i) });
    cursor = Math.max(cursor, f);
  }
  if (fin - cursor >= 30) libres.push({ inicio: hora(cursor), fin: hora(fin) });
  return libres;
}
