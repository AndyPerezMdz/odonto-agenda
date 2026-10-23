// 2.8 · Anotar rápido una cita: "Juan Pérez martes 10 clínica 2 endo" → paciente, fecha, hora, clínica y materia.
// Reusa el de Mi agenda para fecha y hora; aquí sólo se reconocen clínica, materia y paciente (de los que ya tienes).

import { anotarRapido } from "@/lib/anotarRapido";
import { clavePaciente } from "@/lib/pacientes";
import type { Clinica, Materia } from "@/lib/types";

export type BorradorCita = { paciente: string; fecha: string | null; inicio: string | null; fin: string | null; clinicaId: string | null; materiaId: string | null; conocido: boolean; clinicaPedida: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const masUna = (h: string) => `${String(Number(h.slice(0, 2)) + 1).padStart(2, "0")}:${h.slice(3, 5)}`;
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function anotarCita(texto: string, hoy: string, clinicas: Clinica[], materias: Materia[], nombres: string[]): BorradorCita {
  let t = ` ${texto.replace(/\s+/g, " ").trim()} `;
  let clinicaId: string | null = null;
  let materiaId: string | null = null;

  // Clínica: "clínica 2", "cl 2", "C2" (si no existe esa clínica, igual se quita del nombre del paciente)
  const activas = clinicas.filter((c) => c.activo);
  const reCl = /\s(?:en\s+(?:la\s+)?)?(?:clinica|cl\.?|c(?=\d))\s*([a-z0-9-]+)(?=\s)/i;
  const mc = reCl.exec(norm(t));
  if (mc) {
    const pedido = mc[1].toLowerCase();
    const c = activas.find((x) => norm(x.numero).replace(/^clinica\s*/, "") === pedido);
    if (c) clinicaId = c.id;
    t = t.slice(0, mc.index) + " " + t.slice(mc.index + mc[0].length);
  }
  // Materia: su nombre completo o su primera palabra de 4+ letras ("endo" → Endodoncia)
  const candidatas = materias
    .filter((m) => m.activo)
    .flatMap((m) => {
      const n = norm(m.nombre);
      const pal = n.split(/\s+/).filter((w) => w.length >= 4);
      return [{ m, k: n }, ...pal.map((w) => ({ m, k: w })), ...pal.filter((w) => w.length >= 6).map((w) => ({ m, k: w.slice(0, 4) }))];
    })
    .sort((a, b) => b.k.length - a.k.length);
  for (const { m, k } of candidatas) {
    const re = new RegExp(`\\s(?:de\\s+|en\\s+)?${escRe(k)}\\w*(?=\\s)`, "i");
    const x = re.exec(norm(t));
    if (x) {
      materiaId = m.id;
      t = t.slice(0, x.index) + " " + t.slice(x.index + x[0].length);
      break;
    }
  }

  // Fecha y hora (lo que quede de título es el paciente)
  const b = anotarRapido(t.trim(), hoy);
  let paciente = b.titulo.replace(/^(?:cita\s+(?:con|de)\s+|paciente\s+)/i, "").trim();
  // Si ya existe (o empieza igual), se usa como lo tienes escrito
  const k = clavePaciente(paciente);
  const exacto = nombres.find((n) => clavePaciente(n) === k);
  const empieza = !exacto && k.length >= 3 ? nombres.filter((n) => clavePaciente(n).startsWith(k)) : [];
  if (exacto) paciente = exacto;
  else if (empieza.length === 1) paciente = empieza[0];
  else paciente = paciente.split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

  // (la hora de fin de +1 h la pone sola el de Mi agenda: mejor la duración de la materia)
  const fin = b.hora_fin && b.hora_inicio && b.hora_fin !== masUna(b.hora_inicio) ? b.hora_fin : null;
  return { paciente, fecha: b.fecha, inicio: b.hora_inicio, fin, clinicaId, materiaId, conocido: !!exacto || empieza.length === 1, clinicaPedida: mc ? mc[1] : null };
}
