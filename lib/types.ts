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
};

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
