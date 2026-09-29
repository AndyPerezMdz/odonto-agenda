import { MESES } from "@/lib/fechas";

// Calendario escolar de cada agenda. Si una uni cambia sus fechas, se cambia sólo aquí.
export type TipoPeriodo = "cuatrimestre" | "semestre";

// Meses (1-12) en que INICIA cada periodo
export const INICIOS: Record<TipoPeriodo, number[]> = {
  cuatrimestre: [1, 5, 9], // ene–abr, may–ago, sep–dic
  semestre: [1, 8], // ene–jul, ago–dic (UADY)
};
/** Compatibilidad: los cuatrimestres de siempre. */
export const INICIOS_CUATRI = INICIOS.cuatrimestre;

export type Periodo = { id: string; nombre: string; palabra: TipoPeriodo };

const tipoValido = (t?: string | null): TipoPeriodo => (t === "semestre" ? "semestre" : "cuatrimestre");

function indice(mes: number, inicios: number[]) {
  let idx = inicios.length - 1;
  for (let i = 0; i < inicios.length; i++) if (mes >= inicios[i]) idx = i;
  return idx;
}

/** Periodo al que pertenece una fecha. id = "AAAA-n" (cuatrimestre) o "AAAA-sn" (semestre). */
export function periodoDe(fecha: Date = new Date(), tipo?: string | null): Periodo {
  const t = tipoValido(tipo);
  const inicios = INICIOS[t];
  const anio = fecha.getFullYear();
  const idx = indice(fecha.getMonth() + 1, inicios);
  const ini = inicios[idx];
  const fin = (inicios[idx + 1] ?? inicios[0] + 12) - 1; // mes anterior al siguiente inicio
  const nombre = `${MESES[ini - 1].toLowerCase()}–${MESES[(fin - 1) % 12].toLowerCase()} ${anio}`;
  return { id: `${anio}-${t === "semestre" ? "s" : ""}${idx + 1}`, nombre, palabra: t };
}

/** Primer y último día (YYYY-MM-DD) del periodo al que pertenece una fecha. */
export function rangoDe(fecha: Date = new Date(), tipo?: string | null): Periodo & { desde: string; hasta: string } {
  const t = tipoValido(tipo);
  const inicios = INICIOS[t];
  const anio = fecha.getFullYear();
  const idx = indice(fecha.getMonth() + 1, inicios);
  const ini = inicios[idx];
  const sig = inicios[idx + 1] ?? inicios[0] + 12;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { ...periodoDe(fecha, t), desde: iso(new Date(anio, ini - 1, 1)), hasta: iso(new Date(anio, sig - 1, 0)) };
}

/** "cuatrimestre" → "Cuatrimestre"; corta: "Cuatri" / "Semestre". */
export const palabraPeriodo = (t?: string | null, corta = false) =>
  tipoValido(t) === "semestre" ? "Semestre" : corta ? "Cuatri" : "Cuatrimestre";
