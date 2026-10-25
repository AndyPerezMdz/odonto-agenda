// 3.1 · Comprobar que alguien es estudiante antes de abrir una agenda de clínicas: con su correo institucional.
// Los dominios viven aquí. Si una universidad no tiene, sus alumnos se registran sin verificar (como antes).

import type { Universidad } from "@/lib/universidades";

export const DOMINIOS: Record<Universidad, string[]> = {
  upp: ["universidadupp.edu.mx"],
  uady: ["alumnos.uady.mx"],
};

export const requiereVerificacion = (uni: Universidad) => DOMINIOS[uni]?.length > 0;

/** El dominio, si el correo es institucional de esa universidad (sólo el dominio exacto, sin subdominios raros). */
export function dominioInstitucional(uni: Universidad, correo: string): string | null {
  const c = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return null;
  const dom = c.slice(c.lastIndexOf("@") + 1);
  return (DOMINIOS[uni] ?? []).includes(dom) ? dom : null;
}

/** Ejemplo para el campo: "tu.correo@universidadupp.edu.mx". */
export const ejemploCorreo = (uni: Universidad) => (DOMINIOS[uni]?.[0] ? `tucorreo@${DOMINIOS[uni][0]}` : "");
