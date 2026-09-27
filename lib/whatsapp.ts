import { fechaLarga, hhmm } from "@/lib/fechas";

/** Número en formato internacional para wa.me (México por defecto). null si no parece teléfono. */
export function numeroWhatsApp(tel: string | null | undefined): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10) return `52${d}`;
  if ((d.length === 12 && d.startsWith("52")) || (d.length === 13 && d.startsWith("521"))) return d;
  if (d.length >= 11 && d.length <= 15) return d; // otro país, ya con lada
  return null;
}

export function enlaceWhatsApp(tel: string | null | undefined, texto: string): string | null {
  const n = numeroWhatsApp(tel);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}

const primerNombre = (s: string) => s.trim().split(/\s+/)[0] ?? s;

/** "Hola Juan, te escribo para confirmar tu cita…" */
export function mensajeConfirmar(c: { paciente: string; fecha: string; hora_inicio: string }, clinica?: string | null) {
  return `Hola ${primerNombre(c.paciente)}, te escribo para confirmar tu cita del ${fechaLarga(c.fecha)} a las ${hhmm(c.hora_inicio)}${
    clinica ? ` en la ${clinica}` : ""
  }. ¿Me confirmas si puedes venir? Gracias.`;
}

/** Para el banco de pacientes: primer contacto. */
export function mensajeInvitarPaciente(p: { nombre: string }, yo?: string | null, materia?: string | null) {
  return `Hola ${primerNombre(p.nombre)}, ${yo ? `soy ${yo}, ` : ""}estudiante de Odontología. ${
    materia ? `Estoy buscando pacientes para ${materia}. ` : ""
  }¿Te interesaría agendar una cita en la clínica de la universidad?`;
}

export const IcoWhatsApp = "M20.5 3.5A11 11 0 0 0 3.2 17.3L2 22l4.8-1.2A11 11 0 1 0 20.5 3.5zM12 20a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.7.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1-.6.8-.8.9-.3.2-.5 0a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c1.5.7 2.1.7 2.9.6a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c0-.1-.2-.2-.4-.3z";
