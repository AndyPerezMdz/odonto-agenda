import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

export type Miembro = {
  id: string;
  nombre: string;
  email: string | null;
  rol: "owner" | "companero";
  pendiente: boolean;
  citas: number;
};

export type AgendaAdmin = {
  id: string;
  nombre: string;
  notas: string | null;
  created_at: string;
  miembros: Miembro[];
  citas: number;
};

export async function esSuperadmin(db: Db, userId: string) {
  const { data } = await db.from("superadmins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

/** El usuario en sesión, SÓLO si es superadmin. */
export async function superadminEnSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  return (await esSuperadmin(db, user.id)) ? { user, db } : null;
}

export async function listarAgendas(db: Db): Promise<AgendaAdmin[]> {
  const [{ data: agendas, error: e1 }, { data: perfiles, error: e2 }, { data: citas, error: e3 }, { data: usuarios, error: e4 }] =
    await Promise.all([
      db.from("agendas").select("id,nombre,notas,created_at").order("created_at"),
      db.from("perfiles").select("id,nombre,rol,agenda_id").not("agenda_id", "is", null),
      db.from("citas").select("owner_id,agenda_id"),
      db.auth.admin.listUsers({ perPage: 1000 }),
    ]);
  const err = e1 ?? e2 ?? e3 ?? e4;
  if (err) throw new Error(err.message);

  const usuarioPorId = new Map(usuarios.users.map((u) => [u.id, u]));
  const citasPorPersona = new Map<string, number>();
  const citasPorAgenda = new Map<string, number>();
  for (const c of citas ?? []) {
    citasPorPersona.set(c.owner_id, (citasPorPersona.get(c.owner_id) ?? 0) + 1);
    citasPorAgenda.set(c.agenda_id, (citasPorAgenda.get(c.agenda_id) ?? 0) + 1);
  }

  return (agendas ?? []).map((a) => ({
    ...a,
    citas: citasPorAgenda.get(a.id) ?? 0,
    miembros: (perfiles ?? [])
      .filter((p) => p.agenda_id === a.id)
      .map((p) => {
        const u = usuarioPorId.get(p.id);
        return {
          id: p.id,
          nombre: p.nombre,
          email: u?.email ?? null,
          rol: p.rol,
          pendiente: !u?.email_confirmed_at,
          citas: citasPorPersona.get(p.id) ?? 0,
        };
      })
      .sort((x, y) => (x.rol === "owner" ? -1 : y.rol === "owner" ? 1 : 0)),
  }));
}
