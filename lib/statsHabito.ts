// 3.0 · Estadísticas de un hábito: mapa de calor de 6 meses, % del mes, de 30 días, por día de la semana.

import { sumarDias } from "@/lib/pagos";
import { mejorRacha, rachaActual, tocaHabito, type PHabito } from "@/lib/personal";

export type CeldaHabito = { fecha: string; si: boolean; toca: boolean; futuro: boolean; antes: boolean; comodin?: boolean };
export type StatsHabito = {
  racha: number;
  mejor: number;
  total: number; // palomitas en los últimos ~400 días (lo que se carga)
  mes: { hechos: number; tocaban: number; pct: number };
  d30: { hechos: number; tocaban: number; pct: number };
  porDia: { dia: number; pct: number | null }[]; // 0 = domingo; null = ese día no toca
  semanas: CeldaHabito[][]; // columnas de lunes a domingo, la última es la de hoy
};

const diaSem = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Cuántas veces tocaba y cuántas se hizo entre dos fechas (sin contar antes de que existiera). */
function cuenta(h: PHabito, marcas: Set<string>, desde: string, hasta: string, comodines: Set<string>) {
  const inicio = h.created_at.slice(0, 10);
  let hechos = 0;
  let tocaban = 0;
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    if (comodines.has(d)) continue; // 3.2 · el día del comodín no cuenta ni a favor ni en contra
    const si = marcas.has(d);
    if (d < inicio && !si) continue;
    if (tocaHabito(h, d)) tocaban++;
    if (si) hechos++;
  }
  // Hoy, si toca y aún no se hace, no cuenta en contra
  if (tocaHabito(h, hasta) && !marcas.has(hasta) && tocaban) tocaban--;
  return { hechos, tocaban, pct: Math.min(100, pct(hechos, tocaban)) };
}

export function statsHabito(h: PHabito, marcas: Set<string>, hoy: string, semanas = 26, comodines: Set<string> = new Set()): StatsHabito {
  const inicio = h.created_at.slice(0, 10);
  const lunesHoy = sumarDias(hoy, -((diaSem(hoy) + 6) % 7));
  const primero = sumarDias(lunesHoy, -7 * (semanas - 1));
  const cols: CeldaHabito[][] = [];
  for (let s = 0; s < semanas; s++) {
    const col: CeldaHabito[] = [];
    for (let i = 0; i < 7; i++) {
      const f = sumarDias(primero, s * 7 + i);
      col.push({ fecha: f, si: marcas.has(f) && !comodines.has(f), toca: tocaHabito(h, f), futuro: f > hoy, antes: f < inicio && !marcas.has(f), comodin: comodines.has(f) });
    }
    cols.push(col);
  }
  const desde90 = sumarDias(hoy, -89);
  const porDia = [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    if (!h.dias.length ? false : !h.dias.includes(dia)) return { dia, pct: null };
    let t = 0;
    let si = 0;
    for (let d = desde90 < inicio ? inicio : desde90; d < hoy; d = sumarDias(d, 1)) {
      if (diaSem(d) !== dia || comodines.has(d)) continue;
      t++;
      if (marcas.has(d)) si++;
    }
    return { dia, pct: t ? pct(si, t) : null };
  });
  return {
    racha: rachaActual(h, marcas, hoy),
    mejor: mejorRacha(h, marcas, hoy),
    total: marcas.size - [...comodines].filter((f) => marcas.has(f)).length,
    mes: cuenta(h, marcas, `${hoy.slice(0, 8)}01`, hoy, comodines),
    d30: cuenta(h, marcas, sumarDias(hoy, -29), hoy, comodines),
    porDia,
    semanas: cols,
  };
}
