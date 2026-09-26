import { MESES } from "@/lib/fechas";

// Meses (1-12) en que INICIA cada cuatrimestre. Si la uni cambia el calendario, cambia sólo esta línea.
export const INICIOS_CUATRI = [1, 5, 9];

export type Periodo = { id: string; nombre: string };

/** Cuatrimestre al que pertenece una fecha. id = "AAAA-n" (n = 1, 2, 3…). */
export function periodoDe(fecha: Date = new Date()): Periodo {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  let idx = INICIOS_CUATRI.length - 1;
  for (let i = 0; i < INICIOS_CUATRI.length; i++) if (mes >= INICIOS_CUATRI[i]) idx = i;
  const ini = INICIOS_CUATRI[idx];
  const fin = (INICIOS_CUATRI[idx + 1] ?? INICIOS_CUATRI[0] + 12) - 1; // mes anterior al siguiente inicio
  const nombre = `${MESES[ini - 1].toLowerCase()}–${MESES[(fin - 1) % 12].toLowerCase()} ${anio}`;
  return { id: `${anio}-${idx + 1}`, nombre };
}

/** Primer y último día (YYYY-MM-DD) del cuatrimestre al que pertenece una fecha. */
export function rangoDe(fecha: Date = new Date()): Periodo & { desde: string; hasta: string } {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  let idx = INICIOS_CUATRI.length - 1;
  for (let i = 0; i < INICIOS_CUATRI.length; i++) if (mes >= INICIOS_CUATRI[i]) idx = i;
  const ini = INICIOS_CUATRI[idx];
  const sig = INICIOS_CUATRI[idx + 1] ?? INICIOS_CUATRI[0] + 12;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { ...periodoDe(fecha), desde: iso(new Date(anio, ini - 1, 1)), hasta: iso(new Date(anio, sig - 1, 0)) };
}
