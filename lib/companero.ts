import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoCompanero = {
  companero: {
    id: string;
    nombre: string;
    email: string | null;
    pendiente: boolean; // invitado pero aún no acepta
    citas: number;
  } | null;
};

/** Devuelve el usuario en sesión SÓLO si es el dueño de su agenda; si no, null. */
export async function duenoEnSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data } = await db.from("perfiles").select("id,rol,agenda_id").eq("id", user.id).single();
  return data?.rol === "owner" && data.agenda_id ? { user, db, agendaId: data.agenda_id as string } : null;
}

/** El compañero de ESA agenda (máximo uno). */
export async function estadoCompanero(db: ReturnType<typeof createAdminClient>, agendaId: string): Promise<EstadoCompanero> {
  const { data: perfiles, error } = await db
    .from("perfiles")
    .select("id,nombre")
    .eq("agenda_id", agendaId)
    .eq("rol", "companero")
    .limit(1);
  if (error) throw new Error(error.message);
  const p = perfiles?.[0];
  if (!p) return { companero: null };

  const [{ data: u }, { count }] = await Promise.all([
    db.auth.admin.getUserById(p.id),
    db.from("citas").select("id", { count: "exact", head: true }).eq("owner_id", p.id),
  ]);
  return {
    companero: {
      id: p.id,
      nombre: p.nombre,
      email: u.user?.email ?? null,
      pendiente: !u.user?.email_confirmed_at,
      citas: count ?? 0,
    },
  };
}
