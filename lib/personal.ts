// Agenda personal (2.1): tipos y lógica compartida entre cliente y servidor. Fechas "YYYY-MM-DD".
import { sumarDias, sumarMeses, diasEntre } from "@/lib/pagos";

export type TipoEvento = "evento" | "viaje" | "entrega" | "recordatorio";
export type Repetir = "nunca" | "diario" | "semanal" | "quincenal" | "mensual";

export type PEvento = {
  id: string;
  user_id: string;
  tipo: TipoEvento;
  titulo: string;
  fecha: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  lugar: string | null;
  notas: string | null;
  categoria_id: string | null;
  hecho: boolean;
  hecho_at: string | null;
  repetir: Repetir;
  repetir_hasta: string | null;
  excepciones: string[];
};

export type PCategoria = { id: string; nombre: string; color: string; orden: number };

/** Una aparición concreta en el calendario (las series se "desdoblan"). */
export type Ocurrencia = PEvento & { dia: string; serie: boolean };

export const TIPOS: { id: TipoEvento; nombre: string; detalle: string }[] = [
  { id: "evento", nombre: "Evento", detalle: "Curso, cita, junta: algo con hora" },
  { id: "viaje", nombre: "Viaje", detalle: "Uno o varios días" },
  { id: "entrega", nombre: "Entrega", detalle: "Algo que entregar para tal fecha" },
  { id: "recordatorio", nombre: "Recordatorio", detalle: "Para que no se te olvide" },
];

export const REPETIR: { id: Repetir; nombre: string }[] = [
  { id: "nunca", nombre: "No se repite" },
  { id: "diario", nombre: "Cada día" },
  { id: "semanal", nombre: "Cada semana" },
  { id: "quincenal", nombre: "Cada 2 semanas" },
  { id: "mensual", nombre: "Cada mes" },
];

/** 2.3 · Para quién es la agenda: estudiante de odonto (lo de siempre) o cualquier persona. */
export type PerfilPersonal = "odonto" | "general";

export const CATEGORIAS_GENERALES = [
  { nombre: "Trabajo", color: "#2563eb", orden: 0 },
  { nombre: "Escuela", color: "#059669", orden: 1 },
  { nombre: "Viajes", color: "#ea580c", orden: 2 },
  { nombre: "Personal", color: "#9333ea", orden: 3 },
];
export const categoriasIniciales = (perfil: PerfilPersonal) => (perfil === "general" ? CATEGORIAS_GENERALES : CATEGORIAS_INICIALES);

export const CATEGORIAS_INICIALES = [
  { nombre: "Escuela", color: "#2563eb", orden: 0 },
  { nombre: "Consultorio", color: "#059669", orden: 1 },
  { nombre: "Viajes", color: "#ea580c", orden: 2 },
  { nombre: "Personal", color: "#9333ea", orden: 3 },
];

export const PALETA_P = ["#2563eb", "#059669", "#ea580c", "#9333ea", "#db2777", "#0891b2", "#ca8a04", "#64748b"];

const MAX_OCURRENCIAS = 400;

/** Días en que aparece un evento entre desde y hasta (incluidos). Viajes: cada día del rango. */
export function ocurrencias(e: PEvento, desde: string, hasta: string): Ocurrencia[] {
  const out: Ocurrencia[] = [];
  const quitar = new Set(e.excepciones ?? []);
  const empuja = (dia: string, serie: boolean) => {
    if (dia >= desde && dia <= hasta && !quitar.has(dia)) out.push({ ...e, dia, serie });
  };

  if (e.tipo === "viaje") {
    const fin = e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : e.fecha;
    const ini = e.fecha < desde ? desde : e.fecha;
    for (let d = ini, n = 0; d <= fin && d <= hasta && n < 120; d = sumarDias(d, 1), n++) empuja(d, false);
    return out;
  }

  if (e.repetir === "nunca" || e.tipo === "entrega") {
    empuja(e.fecha, false);
    return out;
  }

  const tope = e.repetir_hasta && e.repetir_hasta < hasta ? e.repetir_hasta : hasta;
  let d = e.fecha;
  // Salta rápido hasta "desde" en las series por días
  const paso = e.repetir === "diario" ? 1 : e.repetir === "semanal" ? 7 : e.repetir === "quincenal" ? 14 : 0;
  if (paso && d < desde) d = sumarDias(d, Math.floor(diasEntre(d, desde) / paso) * paso);
  for (let i = 0; d <= tope && out.length < MAX_OCURRENCIAS; i++) {
    empuja(d, true);
    if (paso) d = sumarDias(d, paso);
    else d = sumarMeses(e.fecha, i + 1);
  }
  return out;
}

/** Todas las ocurrencias, ordenadas por día y hora (todo el día primero). */
export function expandir(eventos: PEvento[], desde: string, hasta: string): Ocurrencia[] {
  return eventos
    .flatMap((e) => ocurrencias(e, desde, hasta))
    .sort((a, b) => a.dia.localeCompare(b.dia) || (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? "") || a.titulo.localeCompare(b.titulo));
}

export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function textoHora(e: Pick<PEvento, "hora_inicio" | "hora_fin">) {
  if (!e.hora_inicio) return "Todo el día";
  return e.hora_fin ? `${hm(e.hora_inicio)}–${hm(e.hora_fin)}` : hm(e.hora_inicio);
}

/** Entregas sin hacer: vencidas y las de los próximos `dias`. */
export function entregasPendientes(eventos: PEvento[], hoy: string, dias = 7) {
  const lim = sumarDias(hoy, dias);
  const p = eventos.filter((e) => e.tipo === "entrega" && !e.hecho && e.fecha <= lim).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { vencidas: p.filter((e) => e.fecha < hoy), proximas: p.filter((e) => e.fecha >= hoy) };
}

export const ICONO_TIPO: Record<TipoEvento, string> = {
  evento: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  viaje: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  entrega: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  recordatorio: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
};

/** 2.2 · Datos de ejemplo para la demo de Mi agenda (no se guardan en ningún lado). */
export function ejemploPersonal(hoy: string, perfil: PerfilPersonal = "odonto"): { eventos: PEvento[]; categorias: PCategoria[] } {
  const categorias: PCategoria[] = categoriasIniciales(perfil).map((c, i) => ({ id: `demo-c${i}`, ...c }));
  const [esc, cons, viaj, pers] = categorias.map((c) => c.id);
  const base = (id: string, o: Partial<PEvento>): PEvento => ({
    id, user_id: "demo", tipo: "evento", titulo: "", fecha: hoy, fecha_fin: null, hora_inicio: null, hora_fin: null, lugar: null, notas: null,
    categoria_id: null, hecho: false, hecho_at: null, repetir: "nunca", repetir_hasta: null, excepciones: [], ...o,
  });
  const d = (n: number) => sumarDias(hoy, n);
  if (perfil === "general") {
    const [trab, escu, viaj2, pers2] = categorias.map((c) => c.id);
    return {
      categorias,
      eventos: [
        base("demo-1", { titulo: "Gym", hora_inicio: "07:00:00", hora_fin: "08:00:00", categoria_id: pers2, repetir: "diario", fecha: d(-20) }),
        base("demo-2", { titulo: "Junta de equipo", hora_inicio: "16:00:00", hora_fin: "17:00:00", lugar: "Oficina · sala 2", categoria_id: trab, repetir: "semanal", fecha: d(-7) }),
        base("demo-3", { titulo: "Clase de inglés", fecha: d(2), hora_inicio: "18:00:00", hora_fin: "20:00:00", lugar: "Centro de idiomas", categoria_id: escu, repetir: "semanal" }),
        base("demo-4", { tipo: "viaje", titulo: "Cancún", fecha: d(9), fecha_fin: d(12), lugar: "Hotel Riviera · vuelo VB1234", categoria_id: viaj2 }),
        base("demo-5", { tipo: "entrega", titulo: "Reporte mensual", fecha: d(1), categoria_id: trab }),
        base("demo-6", { tipo: "entrega", titulo: "Tarea de inglés", fecha: d(-1), categoria_id: escu }),
        base("demo-7", { tipo: "recordatorio", titulo: "Pagar la tarjeta", fecha: hoy, hora_inicio: "10:00:00", categoria_id: pers2 }),
        base("demo-8", { tipo: "entrega", titulo: "Presentación para el cliente", fecha: d(4), categoria_id: trab, hecho: true }),
        base("demo-9", { titulo: "Cena con amigos", fecha: d(3), hora_inicio: "21:00:00", lugar: "La Chaya Maya", categoria_id: pers2 }),
      ],
    };
  }
  return {
    categorias,
    eventos: [
      base("demo-1", { titulo: "Gym", hora_inicio: "07:00:00", hora_fin: "08:00:00", categoria_id: pers, repetir: "diario", fecha: d(-20) }),
      base("demo-2", { titulo: "Pacientes en consultorio Dr. Pech", hora_inicio: "16:00:00", hora_fin: "19:00:00", lugar: "Consultorio Dr. Pech", categoria_id: cons, repetir: "semanal", fecha: d(-7) }),
      base("demo-3", { titulo: "Curso de fotografía clínica", fecha: d(2), hora_inicio: "09:00:00", hora_fin: "13:00:00", lugar: "Colegio de Cirujanos Dentistas", categoria_id: esc }),
      base("demo-4", { tipo: "viaje", titulo: "Cancún", fecha: d(9), fecha_fin: d(12), lugar: "Hotel Riviera · vuelo VB1234", categoria_id: viaj }),
      base("demo-5", { tipo: "entrega", titulo: "Caso clínico de Endodoncia", fecha: d(1), categoria_id: esc }),
      base("demo-6", { tipo: "entrega", titulo: "Reporte de prácticas", fecha: d(-1), categoria_id: esc }),
      base("demo-7", { tipo: "recordatorio", titulo: "Pagar inscripción", fecha: hoy, hora_inicio: "10:00:00", categoria_id: pers }),
      base("demo-8", { tipo: "entrega", titulo: "Historia clínica firmada", fecha: d(4), categoria_id: esc, hecho: true }),
    ],
  };
}
