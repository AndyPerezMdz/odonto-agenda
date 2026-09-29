import type { Horario, Material } from "@/lib/types";
import { aISO, hhmm } from "@/lib/fechas";

// La CEyE tarda ~3.5–4 h en esterilizar, pero con tanto material lo regresan como en 8 h
// (si lo metes a las 7 am, te lo dan hasta las 3 pm… si bien te va).
export const HORAS_CEYE = 8;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export type Aviso = { id: string; nivel: "urgente" | "atencion" | "info"; texto: string };

function inicioDe(fecha: Date, b: Horario) {
  const [h, m] = hhmm(b.hora_inicio).split(":").map(Number);
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, m);
  return d;
}

/** Tu próxima clínica (de esa materia si el material es de una materia; si no, cualquiera). */
export function proximaClinica(misHorarios: Horario[], materiaId: string | null, ahora: Date) {
  const deMateria = materiaId ? misHorarios.filter((h) => h.materia_id === materiaId) : [];
  const bloques = deMateria.length ? deMateria : misHorarios;
  for (let i = 0; i < 15; i++) {
    const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
    const hoyBloques = bloques
      .filter((b) => b.dia_semana === dia.getDay())
      .map((b) => ({ b, inicio: inicioDe(dia, b) }))
      .filter((x) => x.inicio > ahora)
      .sort((a, z) => a.inicio.getTime() - z.inicio.getTime());
    if (hoyBloques.length) return hoyBloques[0];
  }
  return null;
}

export const hora = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "hoy a las 7:00", "mañana a las 7:00", "el martes a las 7:00" */
export function cuando(d: Date, ahora: Date) {
  const dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime()) / 86400000);
  const dia = dias === 0 ? "hoy" : dias === 1 ? "mañana" : `el ${DIAS[d.getDay()]}`;
  return `${dia} a las ${hora(d)}`;
}

const lista = (n: string[]) => (n.length <= 1 ? n[0] ?? "" : `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`);

/** Qué hay que hacer con tu material antes de tu próxima clínica. */
export function avisosMaterial(items: Material[], userId: string, misHorarios: Horario[], nombreDe: (id: string | null) => string, ahora = new Date()): Aviso[] {
  const out: Aviso[] = [];
  const mios = items.filter((m) => !m.compartido && m.owner_id === userId);
  const H = 3600000;

  // Agrupa por la clínica que les toca (para decir "tu kit y tus sondas" en un solo aviso)
  const grupos = new Map<string, { inicio: Date; usados: Material[]; tarde: Material[] }>();
  for (const m of mios) {
    if (m.estado === "listo") continue;
    const px = proximaClinica(misHorarios, m.materia_id, ahora);
    if (!px) continue;
    const k = `${aISO(px.inicio)}|${px.b.id}`;
    const g = grupos.get(k) ?? { inicio: px.inicio, usados: [], tarde: [] };
    if (m.estado === "usado" && px.inicio.getTime() - ahora.getTime() <= 48 * H) g.usados.push(m);
    if (m.estado === "ceye" && m.en_ceye_desde) {
      const sale = new Date(new Date(m.en_ceye_desde).getTime() + HORAS_CEYE * H);
      if (sale > px.inicio && sale > ahora) g.tarde.push(m);
    }
    grupos.set(k, g);
  }
  for (const [k, g] of grupos) {
    const horas = (g.inicio.getTime() - ahora.getTime()) / H;
    if (g.usados.length) {
      out.push({
        id: `usado-${k}`,
        nivel: horas <= 24 ? "urgente" : "atencion",
        texto: `${lista(g.usados.map((m) => m.nombre))} ${g.usados.length === 1 ? "está usado" : "están usados"} y tu clínica es ${cuando(g.inicio, ahora)}. ${horas <= HORAS_CEYE + 1 ? "Ya no alcanza a salir de la CEyE a tiempo: consigue prestado o lleva otro." : "Lávalo y mételo a la CEyE: tardan como 8 horas y no siempre lo regresan el mismo día."}`,
      });
    }
    if (g.tarde.length) {
      out.push({
        id: `tarde-${k}`,
        nivel: "urgente",
        texto: `${lista(g.tarde.map((m) => m.nombre))} sigue${g.tarde.length === 1 ? "" : "n"} en la CEyE y tu clínica es ${cuando(g.inicio, ahora)}. Normalmente sale como 8 h después de entregarlo: puede que no llegue a tiempo.`,
      });
    }
  }

  // Ya debería estar listo
  const listos = mios.filter((m) => m.estado === "ceye" && m.en_ceye_desde && ahora.getTime() - new Date(m.en_ceye_desde).getTime() >= HORAS_CEYE * H);
  if (listos.length) {
    out.push({ id: "recoger", nivel: "info", texto: `${lista(listos.map((m) => m.nombre))} ya debería estar listo en la CEyE. Pásalo a recoger y márcalo como listo.` });
  }

  // Consumibles de los dos
  for (const m of items.filter((x) => x.compartido && x.nivel !== "hay")) {
    const quien = m.cambiado_por && m.cambiado_por !== userId ? ` (lo marcó ${nombreDe(m.cambiado_por)})` : "";
    out.push({
      id: `nivel-${m.id}`,
      nivel: m.nivel === "nada" ? "urgente" : "atencion",
      texto: m.nivel === "nada" ? `Se acabó: ${m.nombre}${quien}. Pónganse de acuerdo quién compra.` : `Se está acabando: ${m.nombre}${quien}.`,
    });
  }
  const orden = { urgente: 0, atencion: 1, info: 2 };
  return out.sort((a, z) => orden[a.nivel] - orden[z.nivel]);
}

export const SUGERENCIAS_MIAS = ["Kit básico", "Sondas", "Espejos", "Pinzas de curación", "Jeringa carpule", "Fresas"];
export const SUGERENCIAS_COMPARTIDAS = ["Alginato", "Yeso", "Silicona", "Guantes", "Cubrebocas", "Eyectores"];
