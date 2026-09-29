import type { TipoPeriodo } from "@/lib/cuatrimestre";

// Plantillas por universidad: calendario, semana en que arrancan las clínicas y materias con su duración.
// Se aplican al crear la agenda (y se pueden volver a aplicar desde Personalizar → Agenda).
export type Plantilla = {
  id: string;
  nombre: string;
  detalle: string;
  periodos: TipoPeriodo;
  semana: number;
  materias: { nombre: string; duracion: number; color: string }[];
};

export const PLANTILLAS: Plantilla[] = [
  {
    id: "upp",
    nombre: "UPP",
    detalle: "Cuatrimestres (ene–abr, may–ago, sep–dic)",
    periodos: "cuatrimestre",
    semana: 1,
    materias: [],
  },
  {
    id: "uady",
    nombre: "UADY",
    detalle: "Semestres (ago–dic, ene–jul) · clínicas desde la 2ª semana",
    periodos: "semestre",
    semana: 2,
    materias: [
      { nombre: "Operatoria", duracion: 180, color: "#0891b2" },
      { nombre: "Periodoncia", duracion: 120, color: "#65a30d" },
      { nombre: "Prótesis removible", duracion: 120, color: "#9333ea" },
    ],
  },
  { id: "semestres", nombre: "Otra (semestres)", detalle: "Semestres (ene–jul, ago–dic)", periodos: "semestre", semana: 1, materias: [] },
  { id: "cuatris", nombre: "Otra (cuatrimestres)", detalle: "Cuatrimestres (ene–abr, may–ago, sep–dic)", periodos: "cuatrimestre", semana: 1, materias: [] },
];

export const plantilla = (id?: string | null) => PLANTILLAS.find((p) => p.id === id) ?? null;

/** Duraciones que se ofrecen para una materia. */
export const DURACIONES = [60, 90, 120, 150, 180, 240];
export const textoDuracion = (min: number) => (min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60}`);
