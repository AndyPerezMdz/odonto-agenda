import type { Cita, Horario } from "@/lib/types";
import { aISO, deISO, hhmm } from "@/lib/fechas";

// Clínicas que te quedan, a quién le toca operar y si vas a tiempo con tus casos.
// Todo es cálculo puro (sin base de datos) para poder usarlo en la agenda y en Mi avance.

export type ModoTurnos = "ninguno" | "hora" | "clinica" | "semana";
export type Turnos = { modo: ModoTurnos; inicia: string | null }; // inicia = quién opera primero
export type Rol = "opera" | "asiste" | "mitad";
export type Ocurrencia = { fecha: string; bloque: Horario };

const masDias = (iso: string, n: number) => {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
};
const diasEntre = (a: string, b: string) => Math.round((deISO(b).getTime() - deISO(a).getTime()) / 86400000);
export const lunesDe = (iso: string) => masDias(iso, -((deISO(iso).getDay() + 6) % 7));

/**
 * Primer día de clínicas: el lunes de la semana N del periodo.
 * La semana 1 es la primera con días hábiles (si el periodo arranca en sábado o domingo, empieza el lunes siguiente).
 */
export function inicioClinicas(desdePeriodo: string, semana: number) {
  const dia = deISO(desdePeriodo).getDay();
  const primera = dia === 0 || dia === 6 ? masDias(desdePeriodo, dia === 6 ? 2 : 1) : lunesDe(desdePeriodo);
  if (semana <= 1) return desdePeriodo;
  return masDias(primera, 7 * (semana - 1));
}

/** Fin de clínicas de una persona: lo que puso (si cae dentro del periodo) o el último día del periodo. */
export function finClinicas(finPersona: string | null | undefined, desde: string, hasta: string) {
  return finPersona && finPersona >= desde && finPersona <= hasta ? finPersona : hasta;
}

/** Cada clínica (día + bloque) de esos horarios entre dos fechas, en orden. */
export function ocurrencias(horarios: Horario[], desde: string, hasta: string): Ocurrencia[] {
  const out: Ocurrencia[] = [];
  if (!horarios.length || desde > hasta) return out;
  const porDia = new Map<number, Horario[]>();
  for (const h of horarios) porDia.set(h.dia_semana, [...(porDia.get(h.dia_semana) ?? []), h]);
  for (const l of porDia.values()) l.sort((a, z) => a.hora_inicio.localeCompare(z.hora_inicio));
  for (let f = desde, i = 0; f <= hasta && i < 800; f = masDias(f, 1), i++) {
    for (const b of porDia.get(deISO(f).getDay()) ?? []) out.push({ fecha: f, bloque: b });
  }
  return out;
}

/**
 * ¿Operas o asistes en esa clínica? null = no hay turnos (cada quien opera lo suyo).
 * `previas` = cuántas clínicas tuyas hubo desde que empezaron hasta antes de ésta (sólo para modo "clinica").
 */
export function rolEn(t: Turnos, persona: string, fecha: string, inicio: string, previas: number): Rol | null {
  if (t.modo === "ninguno" || !t.inicia) return null;
  if (t.modo === "hora") return "mitad";
  const empiezoYo = t.inicia === persona;
  const idx = t.modo === "semana" ? Math.floor(diasEntre(lunesDe(inicio), lunesDe(fecha)) / 7) : previas;
  const par = ((idx % 2) + 2) % 2 === 0;
  return par === empiezoYo ? "opera" : "asiste";
}

/** Roles de todas tus clínicas en un rango (cuenta desde el inicio de clínicas para que el orden no se mueva). */
export function rolesDe(t: Turnos, persona: string, misHorarios: Horario[], inicio: string, hasta: string) {
  const roles = new Map<string, Rol | null>();
  ocurrencias(misHorarios, inicio, hasta).forEach((o, i) =>
    roles.set(`${o.fecha}|${o.bloque.id}`, rolEn(t, persona, o.fecha, inicio, i))
  );
  return roles;
}

/** Rol en una fecha suelta (para la agenda). Antes de que empiecen las clínicas no hay turnos. */
export function rolDelBloque(t: Turnos, persona: string, misHorarios: Horario[], inicio: string, fecha: string, bloque: Horario) {
  if (t.modo === "ninguno" || !t.inicia || fecha < inicio) return null;
  if (t.modo !== "clinica") return rolEn(t, persona, fecha, inicio, 0);
  return rolesDe(t, persona, misHorarios, inicio, fecha).get(`${fecha}|${bloque.id}`) ?? null;
}

/** "Una hora y una hora": tramos del bloque y quién opera cada uno. */
export function tramosPorHora(b: Horario, empiezoYo: boolean) {
  const m = (x: string) => { const [h, mm] = hhmm(x).split(":").map(Number); return h * 60 + mm; };
  const h = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const out: { inicio: string; fin: string; yo: boolean }[] = [];
  for (let t = m(b.hora_inicio), i = 0; t < m(b.hora_fin); t += 60, i++) {
    out.push({ inicio: h(t), fin: h(Math.min(t + 60, m(b.hora_fin))), yo: (i % 2 === 0) === empiezoYo });
  }
  return out;
}

export type Semaforo = "cumplida" | "verde" | "amarillo" | "rojo" | "sinmeta" | "sinhorario";

export type Ritmo = {
  semaforo: Semaforo;
  mensaje: string;
  faltan: number;
  porConseguir: number; // faltan menos lo que ya tienes agendado
  restantes: number; // clínicas de esa materia que te quedan (donde operas)
  libres: string[]; // fechas de esas clínicas sin paciente todavía
};

/**
 * El semáforo de una materia.
 * - restantes: tus clínicas de esa materia de hoy al fin (sin contar donde te toca asistir).
 * - libres: de ésas, las que aún no tienen paciente tuyo.
 */
export function ritmoDe({
  meta, asistio, agendadas, persona, materiaId, horarios, citas, turnos, inicio, fin, hoy,
}: {
  meta: number | null;
  asistio: number;
  agendadas: number;
  persona: string;
  materiaId: string;
  horarios: Horario[]; // todos los de la agenda
  citas: Cita[]; // del periodo
  turnos: Turnos;
  inicio: string;
  fin: string;
  hoy: string;
}): Ritmo {
  const faltan = meta ? Math.max(0, meta - asistio) : 0;
  const porConseguir = Math.max(0, faltan - agendadas);
  const misHorarios = horarios.filter((h) => h.owner_id === persona);
  const deMateria = misHorarios.filter((h) => h.materia_id === materiaId);
  const base = { faltan, porConseguir, restantes: 0, libres: [] as string[] };

  if (!deMateria.length) {
    return { ...base, semaforo: meta ? "sinhorario" : "sinmeta", mensaje: "Dile a Mi horario qué días tienes esta clínica y te calculo cuántas te quedan." };
  }

  const roles = rolesDe(turnos, persona, misHorarios, inicio, fin);
  const desde = hoy > inicio ? hoy : inicio;
  const mias = ocurrencias(misHorarios, desde, fin).filter(
    (o) => o.bloque.materia_id === materiaId && roles.get(`${o.fecha}|${o.bloque.id}`) !== "asiste"
  );
  const conCita = (o: Ocurrencia) =>
    citas.some(
      (c) => c.owner_id === persona && c.fecha === o.fecha && c.estado !== "cancelo" &&
        hhmm(c.hora_inicio) < hhmm(o.bloque.hora_fin) && hhmm(c.hora_fin) > hhmm(o.bloque.hora_inicio)
    );
  const libres = mias.filter((o) => !conCita(o)).map((o) => o.fecha);
  const r = { ...base, restantes: mias.length, libres };
  const n = (x: number, s: string, p = `${s}s`) => `${x} ${x === 1 ? s : p}`;

  if (!meta) return { ...r, semaforo: "sinmeta", mensaje: `Te ${mias.length === 1 ? "queda" : "quedan"} ${n(mias.length, "clínica")}. Pon tu meta para saber si vas a tiempo.` };
  if (faltan === 0) return { ...r, semaforo: "cumplida", mensaje: "Meta cumplida. Lo que atiendas de aquí en adelante es extra." };
  if (porConseguir === 0) return { ...r, semaforo: "verde", mensaje: "Con lo que ya tienes agendado completas la meta. Que no te fallen." };
  if (libres.length === 0) {
    return { ...r, semaforo: "rojo", mensaje: `Te faltan ${n(porConseguir, "paciente")} por conseguir y ya no te quedan clínicas libres. Habla con tu doctor/a.` };
  }
  const ratio = porConseguir / libres.length;
  const detalle = `${n(porConseguir, "paciente")} por conseguir y ${n(libres.length, "clínica libre", "clínicas libres")}`;
  if (ratio <= 0.6) return { ...r, semaforo: "verde", mensaje: `Vas bien: ${detalle}.` };
  if (ratio <= 1) return { ...r, semaforo: "amarillo", mensaje: `Vas justo: ${detalle}. Consigue pacientes ya.` };
  return { ...r, semaforo: "rojo", mensaje: `Vas atrasado/a: ${detalle}. Necesitas más de un paciente por clínica.` };
}
