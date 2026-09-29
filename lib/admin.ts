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
  color: string | null;
  ultimoAcceso: string | null; // ISO: la más reciente entre abrir la agenda e iniciar sesión
};

export type PagoAdmin = { id: string; monto: number; meses: number; metodo: string; referencia: string | null; cubre_desde: string; cubre_hasta: string; created_at: string };

export type AvisoAdmin = { id: string; agenda_id: string; agenda: string; monto: number | null; referencia: string | null; quien: string | null; created_at: string; universidad: Universidad };

export type Universidad = "upp" | "uady";

/** ¿Una agenda de la UADY ya usa lo suyo? (para saber si esas funciones sirven de verdad) */
export type UsoUady = {
  horarioMateria: boolean; // algún bloque del horario tiene materia (sin eso no hay ritmo)
  metas: boolean; // alguien puso metas
  turnos: boolean; // configuraron cómo se turnan
  material: boolean; // registraron material
  pareja: boolean; // tiene compañero/a (los turnos sólo aplican así)
};

export type AgendaAdmin = {
  id: string;
  nombre: string;
  universidad: Universidad; // se elige al registrarse y nunca cambia
  uso: UsoUady;
  notas: string | null;
  created_at: string;
  pagado_hasta: string | null;
  precio_mensual: number;
  prueba_hasta: string | null;
  codigo: string | null;
  enPrueba: boolean;
  invitacionPendiente: string | null; // correo invitado que ya tenía cuenta y no ha aceptado
  miembros: Miembro[];
  citas: number;
  citasSemana: number; // citas creadas en los últimos 7 días
  ultimoAcceso: string | null;
  pagada: boolean; // tiene al menos un pago registrado
  pagos: PagoAdmin[];
};

export type MesResumen = { mes: string; cobrado: number; pagos: number; nuevas: number };
export type ResumenAdmin = {
  meses: MesResumen[]; // últimos 6, del más viejo al actual
  mesesUni: Record<Universidad, MesResumen[]>; // lo mismo, por universidad
  codigos: { codigo: string; creador: string }[];
};

const ZONA = "America/Merida";
const mesDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA }).slice(0, 7);
const masReciente = (...xs: (string | null | undefined)[]) =>
  xs.filter((x): x is string => !!x).map((x) => new Date(x).toISOString()).sort().at(-1) ?? null;

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

export async function listarAgendas(db: Db): Promise<{ agendas: AgendaAdmin[]; avisos: AvisoAdmin[]; resumen: ResumenAdmin }> {
  const [
    { data: agendas, error: e1 },
    { data: perfiles, error: e2 },
    { data: citas, error: e3 },
    { data: usuarios, error: e4 },
    { data: pagos },
    { data: avisos },
  ] =
    await Promise.all([
      db.from("agendas").select("id,nombre,notas,created_at,pagado_hasta,precio_mensual,prueba_hasta,codigo,universidad,turnos").order("created_at"),
      db.from("perfiles").select("id,nombre,rol,agenda_id,color,ultimo_acceso").not("agenda_id", "is", null),
      db.from("citas").select("owner_id,agenda_id,created_at"),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("pagos").select("id,agenda_id,monto,meses,metodo,referencia,cubre_desde,cubre_hasta,created_at").order("created_at", { ascending: false }).order("cubre_hasta", { ascending: false }),
      db.from("avisos_pago").select("id,agenda_id,monto,referencia,reportado_por,created_at").eq("estado", "pendiente").order("created_at"),
    ]);
  const [{ data: invitaciones }, { data: codigos }, { data: horarios }, { data: metas }, { data: material }] = await Promise.all([
    db.from("invitaciones").select("agenda_id,email"),
    db.from("codigos").select("codigo,creador"),
    db.from("horarios").select("agenda_id,materia_id"),
    db.from("metas").select("perfil_id"),
    db.from("material").select("agenda_id"),
  ]);
  const agendaDePerfil = new Map((perfiles ?? []).map((p) => [p.id, p.agenda_id as string]));
  const conHorarioMateria = new Set((horarios ?? []).filter((h) => h.materia_id).map((h) => h.agenda_id));
  const conMetas = new Set((metas ?? []).map((m) => agendaDePerfil.get(m.perfil_id)).filter(Boolean));
  const conMaterial = new Set((material ?? []).map((m) => m.agenda_id));
  const err = e1 ?? e2 ?? e3 ?? e4;
  if (err) throw new Error(err.message);

  const usuarioPorId = new Map(usuarios.users.map((u) => [u.id, u]));
  const citasPorPersona = new Map<string, number>();
  const citasPorAgenda = new Map<string, number>();
  const semanaPorAgenda = new Map<string, number>();
  const haceUnaSemana = new Date(Date.now() - 7 * 86400000).toISOString();
  for (const c of citas ?? []) {
    citasPorPersona.set(c.owner_id, (citasPorPersona.get(c.owner_id) ?? 0) + 1);
    citasPorAgenda.set(c.agenda_id, (citasPorAgenda.get(c.agenda_id) ?? 0) + 1);
    if (c.created_at && c.created_at >= haceUnaSemana) semanaPorAgenda.set(c.agenda_id, (semanaPorAgenda.get(c.agenda_id) ?? 0) + 1);
  }

  const nombrePerfil = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));
  const nombreAgenda = new Map((agendas ?? []).map((a) => [a.id, a.nombre]));

  const lista = (agendas ?? []).map((a) => {
    const miembros = (perfiles ?? [])
      .filter((p) => p.agenda_id === a.id)
      .map((p) => {
        const u = usuarioPorId.get(p.id);
        return {
          id: p.id,
          nombre: p.nombre,
          email: u?.email ?? null,
          rol: p.rol,
          // Pendiente = nunca activó su cuenta. Si ya inició sesión alguna vez, ya no lo está
          // (aunque Supabase no le haya marcado el correo, p. ej. si entró por "Olvidé mi contraseña").
          pendiente: !(u?.email_confirmed_at || u?.confirmed_at || u?.last_sign_in_at || p.ultimo_acceso),
          citas: citasPorPersona.get(p.id) ?? 0,
          color: p.color ?? null,
          ultimoAcceso: masReciente(p.ultimo_acceso, u?.last_sign_in_at),
        };
      })
      .sort((x, y) => (x.rol === "owner" ? -1 : y.rol === "owner" ? 1 : 0));
    const { turnos, ...resto } = a;
    return {
    ...resto,
    universidad: (a.universidad === "uady" ? "uady" : "upp") as Universidad,
    uso: {
      horarioMateria: conHorarioMateria.has(a.id),
      metas: conMetas.has(a.id),
      turnos: !!turnos && turnos !== "ninguno",
      material: conMaterial.has(a.id),
      pareja: miembros.length >= 2,
    },
    miembros,
    ultimoAcceso: masReciente(...miembros.map((m) => m.ultimoAcceso)),
    citasSemana: semanaPorAgenda.get(a.id) ?? 0,
    pagada: (pagos ?? []).some((p) => p.agenda_id === a.id),
    precio_mensual: Number(a.precio_mensual),
    enPrueba: !!a.prueba_hasta && a.pagado_hasta !== null && !(pagos ?? []).some((p) => p.agenda_id === a.id),
    invitacionPendiente: (invitaciones ?? []).find((i) => i.agenda_id === a.id)?.email ?? null,
    citas: citasPorAgenda.get(a.id) ?? 0,
    pagos: (pagos ?? [])
      .filter((p) => p.agenda_id === a.id)
      // el más reciente primero (el único que se puede anular)
      .sort((x, y) => y.created_at.localeCompare(x.created_at) || y.cubre_hasta.localeCompare(x.cubre_hasta))
      .slice(0, 5)
      .map((p) => ({ ...p, monto: Number(p.monto) })),
    };
  });

  // Últimos 6 meses: lo cobrado (por fecha en que registraste el pago) y agendas nuevas
  // (también por universidad, para el filtro del panel)
  const uniDe = new Map((agendas ?? []).map((a) => [a.id, (a.universidad === "uady" ? "uady" : "upp") as Universidad]));
  const hoy = new Date();
  const mesesVacios = () => {
    const out: MesResumen[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 15));
      out.push({ mes: d.toISOString().slice(0, 7), cobrado: 0, pagos: 0, nuevas: 0 });
    }
    return out;
  };
  const meses = mesesVacios();
  const mesesUni: Record<Universidad, MesResumen[]> = { upp: mesesVacios(), uady: mesesVacios() };
  const sumar = (lista: MesResumen[], iso: string, fn: (m: MesResumen) => void) => {
    const m = lista.find((x) => x.mes === mesDe(iso));
    if (m) fn(m);
  };
  for (const p of pagos ?? []) {
    const cobro = (m: MesResumen) => { m.cobrado += Number(p.monto); m.pagos++; };
    sumar(meses, p.created_at, cobro);
    sumar(mesesUni[uniDe.get(p.agenda_id) ?? "upp"], p.created_at, cobro);
  }
  for (const a of agendas ?? []) {
    sumar(meses, a.created_at, (m) => m.nuevas++);
    sumar(mesesUni[uniDe.get(a.id) ?? "upp"], a.created_at, (m) => m.nuevas++);
  }

  return {
    agendas: lista,
    resumen: { meses, mesesUni, codigos: codigos ?? [] },
    avisos: (avisos ?? []).map((v) => ({
      id: v.id,
      agenda_id: v.agenda_id,
      agenda: nombreAgenda.get(v.agenda_id) ?? "—",
      monto: v.monto != null ? Number(v.monto) : null,
      referencia: v.referencia,
      quien: v.reportado_por ? nombrePerfil.get(v.reportado_por) ?? null : null,
      created_at: v.created_at,
      universidad: uniDe.get(v.agenda_id) ?? "upp",
    })),
  };
}
