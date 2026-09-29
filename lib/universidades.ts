import type { TipoPeriodo } from "@/lib/cuatrimestre";

// Cada agenda es de UNA universidad: se elige al registrarse y nunca cambia.
// La UPP usa la agenda de siempre. La UADY tiene su propio calendario y funciones
// (ritmo, turnos, Mi material, duración por materia), pensadas con alumnos de allá.
export type Universidad = "upp" | "uady";

export type InfoUniversidad = {
  id: Universidad;
  nombre: string;
  detalle: string;
  periodos: TipoPeriodo;
  semana: number; // semana del periodo en que arrancan las clínicas
  materias: { nombre: string; duracion: number | null; color: string }[];
};

export const UNIVERSIDADES: InfoUniversidad[] = [
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
    detalle: "Semestres (ago–dic, ene–jul)",
    periodos: "semestre",
    semana: 2,
    materias: [
      { nombre: "Operatoria", duracion: 180, color: "#0891b2" },
      { nombre: "Periodoncia", duracion: 120, color: "#65a30d" },
      { nombre: "Prótesis removible", duracion: 120, color: "#9333ea" },
    ],
  },
];

export const universidad = (id?: string | null) => UNIVERSIDADES.find((u) => u.id === id) ?? UNIVERSIDADES[0];
export const esUniversidad = (id: unknown): id is Universidad => id === "upp" || id === "uady";
/** ¿Esta agenda tiene las funciones de la UADY? */
export const esUady = (id?: string | null) => id === "uady";
/** Cuatrimestres o semestres según la universidad. */
export const periodosDe = (id?: string | null): TipoPeriodo => universidad(id).periodos;

/** Duraciones que se ofrecen para una materia (UADY). */
export const DURACIONES = [60, 90, 120, 150, 180, 240];
export const textoDuracion = (min: number) => (min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60}`);
