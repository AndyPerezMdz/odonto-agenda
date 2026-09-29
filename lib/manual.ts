import { SUPABASE_URL } from "@/lib/supabase/env";

// Manual de usuario en PDF.
// Por defecto: bucket PÚBLICO "manuales" de Supabase Storage con el archivo "Manual-Agenda-Clinicas.pdf".
// Si lo subes a otro lado, pon la URL completa en la variable NEXT_PUBLIC_MANUAL_URL.
export const MANUAL_URL =
  process.env.NEXT_PUBLIC_MANUAL_URL ||
  `${SUPABASE_URL}/storage/v1/object/public/manuales/Manual-Agenda-Clinicas.pdf`;

// La UADY tiene su propio manual (semestres, ritmo, turnos, Mi material): Manual-Agenda-Clinicas-UADY.pdf en el mismo bucket.
export const MANUAL_URL_UADY =
  process.env.NEXT_PUBLIC_MANUAL_URL_UADY ||
  `${SUPABASE_URL}/storage/v1/object/public/manuales/Manual-Agenda-Clinicas-UADY.pdf`;

export const manualDe = (universidad?: string | null) => (universidad === "uady" ? MANUAL_URL_UADY : MANUAL_URL);
