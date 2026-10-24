// 3.2 · "Tu cuatri en números": lo que hiciste en el periodo, para verlo y presumirlo (story).

import type { Cita } from "@/lib/types";
import { rangoDe, type Periodo } from "@/lib/cuatrimestre";
import { sumarDias } from "@/lib/pagos";

export type CitaNum = Pick<Cita, "fecha" | "hora_inicio" | "hora_fin" | "paciente" | "materia_id" | "estado" | "confirmacion">;
export type NumerosCuatri = {
  citas: number; // agendadas (sin las canceladas)
  atendidas: number; // marcadas como Asistió
  pacientes: number; // personas distintas que atendiste
  horas: number; // horas en clínica (de las atendidas)
  faltaron: number;
  confirmaron: number; // % de las agendadas que confirmaron con su link
  materiaTop: { nombre: string; n: number } | null;
  semanaPesada: { lunes: string; n: number } | null;
  diaFuerte: { dia: number; n: number } | null; // 0 = domingo
};

const clave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const minutos = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dow = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export function numerosCuatri(citas: CitaNum[], materias: Map<string, string>): NumerosCuatri {
  const vivas = citas.filter((c) => c.estado !== "cancelo");
  const atendidas = vivas.filter((c) => c.estado === "asistio");
  const contar = <K>(xs: K[]) => {
    const m = new Map<K, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const base = atendidas.length ? atendidas : vivas;
  const mat = contar(base.filter((c) => c.materia_id && materias.has(c.materia_id)).map((c) => c.materia_id!))[0];
  const sem = contar(vivas.map((c) => sumarDias(c.fecha, -((dow(c.fecha) + 6) % 7))))[0];
  const dia = contar(vivas.map((c) => dow(c.fecha)))[0];
  return {
    citas: vivas.length,
    atendidas: atendidas.length,
    pacientes: new Set(atendidas.map((c) => clave(c.paciente))).size,
    horas: Math.round(atendidas.reduce((n, c) => n + Math.max(0, minutos(c.hora_fin) - minutos(c.hora_inicio)), 0) / 60),
    faltaron: vivas.filter((c) => c.estado === "falto").length,
    confirmaron: vivas.length ? Math.round((vivas.filter((c) => c.confirmacion === "confirmada").length / vivas.length) * 100) : 0,
    materiaTop: mat ? { nombre: materias.get(mat[0])!, n: mat[1] } : null,
    semanaPesada: sem ? { lunes: sem[0], n: sem[1] } : null,
    diaFuerte: dia ? { dia: dia[0], n: dia[1] } : null,
  };
}

/**
 * ¿Qué periodo se presume hoy? Las últimas 2 semanas del periodo (el actual, "hasta hoy")
 * y las primeras 3 del siguiente (el que acaba de terminar). Fuera de eso: null.
 */
export function periodoParaPresumir(hoy: string, tipo?: string | null): (Periodo & { desde: string; hasta: string; cerrado: boolean }) | null {
  const d = (iso: string) => new Date(`${iso}T12:00:00`);
  const r = rangoDe(d(hoy), tipo);
  if (hoy >= sumarDias(r.hasta, -13)) return { ...r, cerrado: false };
  if (hoy <= sumarDias(r.desde, 20)) return { ...rangoDe(d(sumarDias(r.desde, -1)), tipo), cerrado: true };
  return null;
}

/** ¿Hay suficiente para presumir? */
export const vale = (n: NumerosCuatri) => n.atendidas >= 3;
