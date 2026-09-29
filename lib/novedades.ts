// Versión de la app y lo nuevo de cada una. Al publicar una actualización:
// 1) sube APP_VERSION, 2) agrega su bloque ARRIBA de la lista. Cada quien la ve una vez.

export const APP_VERSION = "1.7";

export type Novedad = { titulo: string; texto: string; icono: keyof typeof ICONOS };
export type Version = { version: string; fecha: string; items: Novedad[] };

export const NOVEDADES: Version[] = [
  {
    version: "1.7",
    fecha: "septiembre 2026",
    items: [
      { icono: "enlace", titulo: "Invita con un link", texto: "¿Tu compañero/a no recibe correos? Copia tu link en Personalizar → Agenda y mándaselo por WhatsApp: se registra y entra directo." },
      { icono: "citas", titulo: "Tu link de citas (premium)", texto: "Tus pacientes eligen un horario libre desde tu link y la cita cae sola en tu agenda. Lo activas en Personalizar → Mi link." },
    ],
  },
  {
    version: "1.6",
    fecha: "septiembre 2026",
    items: [
      { icono: "whatsapp", titulo: "Confirma por WhatsApp", texto: "Guarda el teléfono del paciente y con un toque le mandas “¿me confirmas tu cita?”, ya escrito." },
      { icono: "pacientes", titulo: "Banco de pacientes", texto: "Anota a la gente que te recomiendan, por materia. Cuando te falte un caso, ahí tienes a quién escribirle." },
      { icono: "material", titulo: "Qué llevar", texto: "Cada materia puede tener su lista de material. Sale en la cita y en tu recordatorio de la mañana." },
      { icono: "cobro", titulo: "Cobros a pacientes", texto: "Anota cuánto le cobras de material y si ya te pagó. En Mi avance ves quién te debe." },
      { icono: "reloj", titulo: "Tu horario de clínica", texto: "Guarda tus bloques fijos (ej. martes 8 a 12). Se marcan en la agenda y te dice qué huecos te quedan libres." },
    ],
  },
  {
    version: "1.5",
    fecha: "septiembre 2026",
    items: [
      { icono: "avance", titulo: "Mi avance", texto: "Cuántos casos llevas por materia contra tu meta, y la lista de pacientes atendidos en PDF." },
      { icono: "check", titulo: "¿Llegó tu paciente?", texto: "Marca cada cita como Asistió, Faltó o Canceló con un toque. Sólo cuentan las que asistieron." },
      { icono: "buscar", titulo: "Buscar paciente", texto: "Con la lupa ves todo el historial de un paciente: fechas, clínica y si vino." },
      { icono: "repetir", titulo: "Citas que se repiten", texto: "Repite una cita cada semana, o crea la siguiente sesión con “+ Otra sesión”." },
      { icono: "lista", titulo: "Vista de lista", texto: "Tus próximas citas día por día. En el celular abre así; cámbiala con Mes / Lista." },
      { icono: "cel", titulo: "Tenla como app", texto: "Agrégala a la pantalla de inicio de tu cel. Abajo de la agenda está “Instalar como app”." },
    ],
  },
];

/** "1.10" > "1.9": compara por partes numéricas. */
export function versionMayor(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** Versiones que la persona no ha visto. Sin registro = cuenta de antes de 1.5: le tocan todas. */
export function pendientes(vista: string | null | undefined): Version[] {
  if (!vista) return NOVEDADES;
  return NOVEDADES.filter((v) => versionMayor(v.version, vista));
}

export const ICONOS = {
  avance: "M3 3v18h18M7 15l4-4 3 3 5-6",
  check: "m5 12 5 5 9-10",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  repetir: "M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5",
  lista: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  cel: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  whatsapp: "M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z",
  pacientes: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c.7-3.8 3.6-6 7-6s6.3 2.2 7 6M19 8v6M16 11h6",
  material: "M9 4h6M9 4a2 2 0 0 0 0 4h6a2 2 0 0 0 0-4M15 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2M9 13l2 2 4-4",
  cobro: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  enlace: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  citas: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 14v4M10 16h4",
  estrella: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
};
