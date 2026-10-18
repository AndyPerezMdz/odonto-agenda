import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fechaEnZona } from "@/lib/recordatorios";

type Db = ReturnType<typeof createAdminClient>;

export type CitaPublica = {
  id: string;
  owner_id: string;
  paciente: string; // sólo el primer nombre
  fecha: string;
  hora: string;
  clinica: string | null;
  alumno: string; // primer nombre de quien atiende
  confirmacion: "confirmada" | "no_puede" | null;
  pasada: boolean;
};

/** Lo mínimo para la página del paciente (nada clínico). null si el link no sirve o la cita se canceló. */
export async function citaPorToken(db: Db, token: string): Promise<CitaPublica | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data: c } = await db
    .from("citas")
    .select("id,owner_id,paciente,fecha,hora_inicio,clinica_id,estado,confirmacion")
    .eq("token_confirmar", token)
    .maybeSingle();
  if (!c || c.estado === "cancelo") return null;
  const [{ data: cl }, { data: p }] = await Promise.all([
    c.clinica_id ? db.from("clinicas").select("numero").eq("id", c.clinica_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("perfiles").select("nombre").eq("id", c.owner_id).maybeSingle(),
  ]);
  return {
    id: c.id,
    owner_id: c.owner_id,
    paciente: String(c.paciente).trim().split(/\s+/)[0],
    fecha: c.fecha,
    hora: String(c.hora_inicio).slice(0, 5),
    clinica: (cl as { numero?: string } | null)?.numero ?? null,
    alumno: String(p?.nombre ?? "tu dentista").trim().split(/\s+/)[0],
    confirmacion: (c.confirmacion as CitaPublica["confirmacion"]) ?? null,
    pasada: c.fecha < fechaEnZona(0) || !!c.estado,
  };
}
