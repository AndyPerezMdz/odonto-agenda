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

export type PagoAdmin = { id: string; monto: number; meses: number; metodo: string; referencia: string | null; cubre_desde: string; cubre_hasta: string; created_at: string };

export type AvisoAdmin = { id: string; agenda_id: string; agenda: string; monto: number | null; referencia: string | null; quien: string | null; created_at: string };

export type AgendaAdmin = {
  id: string;
  nombre: string;
  notas: string | null;
  created_at: string;
  pagado_hasta: string | null;
  precio_mensual: number;
  miembros: Miembro[];
  citas: number;
  pagos: PagoAdmin[];
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

export async function listarAgendas(db: Db): Promise<{ agendas: AgendaAdmin[]; avisos: AvisoAdmin[] }> {
  const [
    { data: agendas, error: e1 },
    { data: perfiles, error: e2 },
    { data: citas, error: e3 },
    { data: usuarios, error: e4 },
    { data: pagos },
    { data: avisos },
  ] =
    await Promise.all([
      db.from("agendas").select("id,nombre,notas,created_at,pagado_hasta,precio_mensual").order("created_at"),
      db.from("perfiles").select("id,nombre,rol,agenda_id").not("agenda_id", "is", null),
      db.from("citas").select("owner_id,agenda_id"),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("pagos").select("id,agenda_id,monto,meses,metodo,referencia,cubre_desde,cubre_hasta,created_at").order("created_at", { ascending: false }).order("cubre_hasta", { ascending: false }),
      db.from("avisos_pago").select("id,agenda_id,monto,referencia,reportado_por,created_at").eq("estado", "pendiente").order("created_at"),
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

  const nombrePerfil = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));
  const nombreAgenda = new Map((agendas ?? []).map((a) => [a.id, a.nombre]));

  const lista = (agendas ?? []).map((a) => ({
    ...a,
    precio_mensual: Number(a.precio_mensual),
    citas: citasPorAgenda.get(a.id) ?? 0,
    pagos: (pagos ?? [])
      .filter((p) => p.agenda_id === a.id)
      // el más reciente primero (el único que se puede anular)
      .sort((x, y) => y.created_at.localeCompare(x.created_at) || y.cubre_hasta.localeCompare(x.cubre_hasta))
      .slice(0, 5)
      .map((p) => ({ ...p, monto: Number(p.monto) })),
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

  return {
    agendas: lista,
    avisos: (avisos ?? []).map((v) => ({
      id: v.id,
      agenda_id: v.agenda_id,
      agenda: nombreAgenda.get(v.agenda_id) ?? "—",
      monto: v.monto != null ? Number(v.monto) : null,
      referencia: v.referencia,
      quien: v.reportado_por ? nombrePerfil.get(v.reportado_por) ?? null : null,
      created_at: v.created_at,
    })),
  };
}
