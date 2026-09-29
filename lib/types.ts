export type Preferencias = {
  duracionMin?: number;      // duración por defecto de una cita nueva
  horaInicio?: string;       // "07:00" — hora sugerida al crear cita
  semanaEmpiezaLunes?: boolean;
  ocultarFinDeSemana?: boolean;
  recordatorios?: boolean;   // recibir correo de recordatorio en la madrugada
  recordatorioDias?: number[]; // con cuántos días de anticipación: 2, 1 y/o 0 (el mismo día)
  tema?: string;             // ver lib/tema.ts
  marcadorHoy?: string;      // forma del día de hoy: circulo, muela, corazon, flor, cuadro
};

export type Perfil = {
  id: string;
  nombre: string;
  color: string;
  preferencias: Preferencias;
  rol: "owner" | "companero";
  periodo_confirmado: string | null;
  acepto_terminos_at?: string | null;
  version_vista?: string | null; // última versión de novedades leída
};

export type Clinica = {
  id: string;
  numero: string;
  descripcion: string | null;
  activo: boolean;
};

export type Materia = {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  material?: string | null; // qué llevar, una cosa por renglón
};

export type EstadoPaciente = "pendiente" | "contactado" | "agendado" | "descartado";

export type Paciente = {
  id: string;
  owner_id: string;
  nombre: string;
  telefono: string | null;
  materia_id: string | null;
  notas: string | null;
  estado: EstadoPaciente;
  created_at: string;
};

export type Horario = {
  id: string;
  owner_id: string;
  dia_semana: number; // 0 = domingo
  hora_inicio: string;
  hora_fin: string;
  clinica_id: string | null;
  etiqueta: string | null;
};

export type EstadoCita = "asistio" | "falto" | "cancelo";

export type Cita = {
  id: string;
  owner_id: string;
  paciente: string;
  fecha: string;       // "YYYY-MM-DD"
  hora_inicio: string; // "HH:MM:SS"
  hora_fin: string;
  clinica_id: string | null;
  materia_id: string | null;
  notas: string | null;
  estado?: EstadoCita | null; // null = pendiente
  telefono?: string | null;
  cobro?: number | null; // lo que se le cobra al paciente (material)
  cobrado?: boolean;
  origen?: "link" | null; // "link" = la reservó el paciente desde el link de citas
};

export const PREFERENCIAS_DEFAULT: Required<Preferencias> = {
  duracionMin: 60,
  horaInicio: "08:00",
  semanaEmpiezaLunes: true,
  ocultarFinDeSemana: false,
  recordatorios: true,
  recordatorioDias: [2, 1, 0],
  tema: "verde",
  marcadorHoy: "circulo",
};

export function prefs(p?: Preferencias): Required<Preferencias> {
  return { ...PREFERENCIAS_DEFAULT, ...(p ?? {}) };
}
