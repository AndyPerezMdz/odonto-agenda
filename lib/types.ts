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
  fin_clinicas?: string | null; // hasta cuándo hay clínicas este periodo (vacío = fin del periodo)
};

/** Ajustes de la agenda compartida (calendario escolar y turnos). */
export type AjustesAgenda = {
  periodos: "cuatrimestre" | "semestre";
  semana_clinicas: number;
  turnos: "ninguno" | "hora" | "clinica" | "semana";
  turnos_inicia: string | null;
};

export const AJUSTES_DEFAULT: AjustesAgenda = { periodos: "cuatrimestre", semana_clinicas: 1, turnos: "ninguno", turnos_inicia: null };

export type EstadoMaterial = "listo" | "usado" | "ceye";
export type NivelMaterial = "hay" | "poco" | "nada";

export type Material = {
  id: string;
  owner_id: string;
  compartido: boolean;
  nombre: string;
  materia_id: string | null;
  estado: EstadoMaterial;
  en_ceye_desde: string | null;
  nivel: NivelMaterial;
  cambiado_por: string | null;
  updated_at: string;
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
  duracion_min?: number | null; // cuánto dura una cita de esta materia
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
  materia_id?: string | null; // qué materia es ese bloque
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
  folio?: string | null; // del ticket del tratamiento (se piden los últimos 5 dígitos)
  historia?: string | null; // No. de historia clínica del paciente
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
