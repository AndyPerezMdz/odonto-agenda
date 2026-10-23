"use client";

import { deISO, MESES } from "@/lib/fechas";
import { sumarDias, diasEntre } from "@/lib/pagos";
import { ICONO_TIPO, type PCategoria } from "@/lib/personal";
import { ICONO_LISTAS } from "@/components/personal/Listas";

// Mi agenda · piezas compartidas: íconos, fechas cortas y colores.

export const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const MES_CORTO = (iso: string) => MESES[deISO(iso).getMonth()].slice(0, 3).toLowerCase();
export const corta = (iso: string) => `${deISO(iso).getDate()} ${MES_CORTO(iso)}`;
export const lunesDe = (iso: string) => sumarDias(iso, -((deISO(iso).getDay() + 6) % 7));
export const ahoraHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const cuando = (hoy: string, f: string) => {
  const n = diasEntre(hoy, f);
  return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n < 0 ? `hace ${-n} días` : `en ${n} días`;
};

export function Ico({ d, size = 18, w = 1.9 }: { d: string; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
export const I = {
  hoy: "M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  semana: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2",
  viajes: ICONO_TIPO.viaje,
  pendientes: ICONO_LISTAS.pendiente,
  habitos: ICONO_LISTAS.habito,
  pagos: "M3 7h18v12H3zM3 11h18M7 15h3",
  mas: "M5 12h.01M12 12h.01M19 12h.01",
  mas1: "M12 5v14M5 12h14",
  clinicas: "M7 16 3 12l4-4M3 12h13M17 8l4 4-4 4",
  ajustes: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  salir: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  lugar: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  repite: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  estrella: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
  candado: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  nuevo: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
};

export const colorDe = (o: { categoria_id: string | null }, catPorId: Map<string, PCategoria>) => (o.categoria_id ? catPorId.get(o.categoria_id)?.color : undefined) ?? "#8a7f70";
