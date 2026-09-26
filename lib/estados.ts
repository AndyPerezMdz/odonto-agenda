import type { EstadoCita } from "@/lib/types";

// Cómo se ve y se llama cada estado de una cita. null = pendiente.
export const ESTADOS: { id: EstadoCita | null; nombre: string; corto: string; clase: string }[] = [
  { id: null, nombre: "Pendiente", corto: "Pendiente", clase: "bg-panel-2 text-muted" },
  { id: "asistio", nombre: "Asistió", corto: "Asistió", clase: "bg-[#e6f4ea] text-[#1e6b3a] dark:bg-[#1a3324] dark:text-[#9fdcb3]" },
  { id: "falto", nombre: "Faltó", corto: "Faltó", clase: "bg-[#fbecea] text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]" },
  { id: "cancelo", nombre: "Canceló", corto: "Cancelada", clase: "bg-panel-2 text-muted line-through" },
];

export const estadoDe = (e: EstadoCita | null | undefined) => ESTADOS.find((x) => x.id === (e ?? null)) ?? ESTADOS[0];
