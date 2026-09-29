// "Tu link de citas" (premium, por persona). Lógica compartida entre servidor y navegador.

export const PRECIO_PREMIUM_DEFAULT = 49;
export const DIAS_A_MOSTRAR = 14; // cuántos días hacia adelante ve el paciente
export const ANTICIPACION_MIN = 120; // no se puede reservar con menos de 2 h de anticipación
export const PASO_MIN = 30; // cada cuánto empieza un horario posible

export const SLUG_VALIDO = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function premiumActivo(premiumHasta: string | null | undefined, hoy: string) {
  return !!premiumHasta && premiumHasta >= hoy;
}

/** Concepto para transferir el premium: distinto al de la agenda. */
export function codigoPremium(userId: string) {
  return "PR-" + userId.replace(/-/g, "").slice(0, 6).toUpperCase();
}

/** "María José López" → "maria-jose" */
export function slugSugerido(nombre: string) {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 2)
    .join("-");
  return base.length >= 3 ? base.slice(0, 30) : `${base || "cita"}-${Math.floor(100 + Math.random() * 900)}`;
}

const min = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export type Bloque = { dia_semana: number; hora_inicio: string; hora_fin: string; clinica_id: string | null };
export type Ocupada = { fecha: string; hora_inicio: string; hora_fin: string };
export type Espacio = { hora: string; fin: string; clinica_id: string | null };
export type DiaLibre = { fecha: string; espacios: Espacio[] };

const sumar = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const diaSemana = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/**
 * Horarios que un paciente puede elegir: dentro de los bloques fijos de la alumna,
 * sin encimarse con sus citas (las canceladas ya vienen fuera) y con anticipación mínima.
 */
export function espaciosLibres(
  bloques: Bloque[],
  ocupadas: Ocupada[],
  opts: { hoy: string; ahora: string; duracion: number; dias?: number }
): DiaLibre[] {
  const dur = Math.max(15, Math.min(240, opts.duracion || 60));
  const limiteHoy = min(opts.ahora) + ANTICIPACION_MIN;
  const salida: DiaLibre[] = [];
  for (let i = 0; i < (opts.dias ?? DIAS_A_MOSTRAR); i++) {
    const fecha = sumar(opts.hoy, i);
    const dia = diaSemana(fecha);
    const citas = ocupadas.filter((c) => c.fecha === fecha).map((c) => [min(c.hora_inicio), min(c.hora_fin)] as const);
    const espacios: Espacio[] = [];
    for (const b of bloques.filter((x) => x.dia_semana === dia).sort((a, z) => min(a.hora_inicio) - min(z.hora_inicio))) {
      for (let t = min(b.hora_inicio); t + dur <= min(b.hora_fin); t += PASO_MIN) {
        if (i === 0 && t < limiteHoy) continue;
        if (citas.some(([ci, cf]) => t < cf && t + dur > ci)) continue;
        if (espacios.some((e) => e.hora === hhmm(t))) continue;
        espacios.push({ hora: hhmm(t), fin: hhmm(t + dur), clinica_id: b.clinica_id });
      }
    }
    if (espacios.length) salida.push({ fecha, espacios });
  }
  return salida;
}

/** Lo que el paciente puede decir que busca (sin texto libre: nada de síntomas ni diagnósticos). */
export const MOTIVOS = ["Revisión o limpieza", "Caries o resina", "Extracción", "Endodoncia (conducto)", "Prótesis o corona", "Encías", "No sé, que me revisen"];
