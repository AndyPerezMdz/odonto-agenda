import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

// 2.8 · Salud del sistema para tu panel: llaves puestas, cuándo corrió cada cron y si ya corriste cada SQL.

export const CRONES = [
  { id: "recordatorios", nombre: "Correos de la madrugada", cada: "diario", maxHoras: 26 },
  { id: "resumen", nombre: "Push de la mañana", cada: "diario", maxHoras: 26 },
  { id: "push-recordatorios", nombre: "Avisos a la hora (Mi agenda)", cada: "cada 5 min", maxHoras: 1 },
  { id: "push-citas", nombre: "“En 1 hora” (clínicas)", cada: "cada 15 min", maxHoras: 1 },
] as const;
export type CronId = (typeof CRONES)[number]["id"];

/** Apunta que un cron corrió (no truena nunca: si falla, el cron sigue). */
export async function marcarCron(db: Db, id: CronId) {
  try {
    await db.from("configuracion").upsert({ clave: `cron:${id}`, valor: { at: new Date().toISOString() } });
  } catch {}
}

export type Salud = {
  llaves: { id: string; nombre: string; ok: boolean; detalle: string }[];
  crones: { id: string; nombre: string; cada: string; at: string | null; ok: boolean }[];
  sql: { id: string; nombre: string; ok: boolean }[];
  problemas: number;
};

export async function saludSistema(db: Db): Promise<Salud> {
  const e = process.env;
  const llaves = [
    { id: "secret", nombre: "Llave secreta de Supabase", ok: !!e.SUPABASE_SECRET_KEY, detalle: "SUPABASE_SECRET_KEY" },
    { id: "resend", nombre: "Correos (Resend)", ok: !!e.RESEND_API_KEY, detalle: "RESEND_API_KEY" },
    { id: "cron", nombre: "Secreto de los crons", ok: !!e.CRON_SECRET, detalle: "CRON_SECRET" },
    { id: "vapid", nombre: "Notificaciones en el cel", ok: !!(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY), detalle: "NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY" },
    { id: "sitio", nombre: "Dirección del sitio", ok: !!e.NEXT_PUBLIC_SITE_URL, detalle: "NEXT_PUBLIC_SITE_URL (para los links de los correos)" },
  ];
  const { data } = await db.from("configuracion").select("clave,valor").like("clave", "cron:%");
  const at = new Map((data ?? []).map((x) => [String(x.clave).slice(5), (x.valor as { at?: string } | null)?.at ?? null]));
  const ahora = Date.now();
  const crones = CRONES.map((c) => {
    const t = at.get(c.id) ?? null;
    return { id: c.id, nombre: c.nombre, cada: c.cada, at: t, ok: !!t && ahora - new Date(t).getTime() < c.maxHoras * 3600000 };
  });
  // ¿Ya se corrió cada parte del SQL? (si la tabla no existe, la consulta truena)
  const existe = async (tabla: string) => !(await db.from(tabla).select("*", { count: "exact", head: true })).error;
  const sql = [
    { id: "2.4", nombre: "Pendientes y hábitos (2.4)", ok: await existe("p_pendientes") },
    { id: "2.5", nombre: "Viajes y pagos fijos (2.5)", ok: await existe("p_viaje_cosas") },
    { id: "2.7", nombre: "Avisos antes y hábitos con hora (2.7)", ok: await existe("p_habitos_avisados") },
    { id: "2.9", nombre: "Invita a un amigo (2.9)", ok: await existe("p_invitaciones") },
    { id: "3.0", nombre: "Compartir y bloques de tiempo (3.0)", ok: await existe("p_compartidos") },
    { id: "3.1", nombre: "Correo institucional (3.1)", ok: await existe("verificaciones_escolares") },
  ];
  const problemas = llaves.filter((x) => !x.ok).length + crones.filter((x) => !x.ok).length + sql.filter((x) => !x.ok).length;
  return { llaves, crones, sql, problemas };
}
