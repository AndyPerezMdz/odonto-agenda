import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { envolver } from "@/lib/pagosServer";
import { esc } from "@/lib/recordatorios";

type Db = ReturnType<typeof createAdminClient>;
type Universidad = "upp" | "uady";

// Cuentas (para el embudo y "cuentas a medias"), buzón de sugerencias y anuncios del panel de staff.

export type CuentaAdmin = {
  id: string;
  email: string | null;
  nombre: string;
  created_at: string;
  confirmada: boolean; // metió el código / confirmó su correo
  agenda_id: string | null;
  rol: "owner" | "companero" | null;
  universidad: Universidad | null; // la de su agenda; si aún no tiene, la que eligió al registrarse
  recordadoAt: string | null; // última vez que le mandaste recordatorio desde el panel
  ultimoLogin: string | null;
};

export async function listarCuentas(db: Db): Promise<CuentaAdmin[]> {
  const [{ data: usuarios, error }, { data: perfiles }, { data: agendas }, { data: sa }] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("perfiles").select("id,nombre,agenda_id,rol"),
    db.from("agendas").select("id,universidad"),
    db.from("superadmins").select("user_id"),
  ]);
  if (error) throw new Error(error.message);
  const staff = new Set((sa ?? []).map((x) => x.user_id));
  const perfil = new Map((perfiles ?? []).map((p) => [p.id, p]));
  const uniAgenda = new Map((agendas ?? []).map((a) => [a.id, (a.universidad === "uady" ? "uady" : "upp") as Universidad]));
  return usuarios.users
    .filter((u) => !staff.has(u.id))
    .map((u) => {
      const p = perfil.get(u.id);
      const meta = (u.user_metadata ?? {}) as { nombre?: string; universidad?: string };
      const uniMeta = meta.universidad === "uady" || meta.universidad === "upp" ? (meta.universidad as Universidad) : null;
      return {
        id: u.id,
        email: u.email ?? null,
        nombre: p?.nombre ?? meta.nombre ?? (u.email ?? "").split("@")[0],
        created_at: u.created_at,
        confirmada: !!(u.email_confirmed_at || u.confirmed_at || u.last_sign_in_at),
        agenda_id: (p?.agenda_id as string | null) ?? null,
        rol: (p?.rol as CuentaAdmin["rol"]) ?? null,
        universidad: (p?.agenda_id ? uniAgenda.get(p.agenda_id) : null) ?? uniMeta,
        recordadoAt: ((u.app_metadata ?? {}) as { recordado_at?: string }).recordado_at ?? null,
        ultimoLogin: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * "Recordarle": si no metió su código, Supabase le reenvía el código de 6 dígitos;
 * si ya confirmó pero no tiene agenda, le mandamos un correo para que la termine de crear.
 */
export async function recordarCuenta(db: Db, id: string, sitio: string): Promise<{ error?: string; tipo?: "codigo" | "agenda" }> {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error || !data.user?.email) return { error: "No encontré esa cuenta." };
  const u = data.user;
  const { data: p } = await db.from("perfiles").select("nombre,agenda_id").eq("id", id).maybeSingle();
  if (p?.agenda_id) return { error: "Esa cuenta ya tiene agenda." };
  let tipo: "codigo" | "agenda";
  if (!(u.email_confirmed_at || u.confirmed_at || u.last_sign_in_at)) {
    const anon = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: e } = await anon.auth.resend({ type: "signup", email: u.email!, options: { emailRedirectTo: `${sitio}/auth/confirm?next=/` } });
    if (e) return { error: e.message.includes("seconds") ? "Supabase pide esperar un minuto entre reenvíos." : e.message };
    tipo = "codigo";
  } else {
    const nombre = (p?.nombre ?? "").split(" ")[0] || "¡Hola";
    const { enviarConResend } = await import("@/lib/recordatorios");
    await enviarConResend({
      para: u.email!,
      asunto: "Tu agenda de clínicas te está esperando",
      html: envolver(
        `${esc(nombre)}, te falta un paso`,
        `<p style="margin:0 0 8px;color:#4a4843;">Ya creaste tu cuenta pero todavía no tienes agenda. Entra, elige tu universidad y listo: empiezas con tu mes gratis.</p>
         <p style="margin:0;color:#4a4843;">Si tu compañero/a ya tiene agenda, pídele su link para unirte a la suya.</p>`,
        { texto: "Terminar mi agenda", url: `${sitio}/` }
      ),
      texto: `${nombre}, te falta un paso: ya creaste tu cuenta pero todavía no tienes agenda. Entra y termínala: ${sitio}/`,
    });
    tipo = "agenda";
  }
  await db.auth.admin.updateUserById(id, { app_metadata: { ...(u.app_metadata ?? {}), recordado_at: new Date().toISOString() } });
  return { tipo };
}

/* ---------------- buzón ---------------- */

export type SugerenciaAdmin = {
  id: string;
  texto: string;
  estado: "nueva" | "leida" | "hecha";
  created_at: string;
  nombre: string;
  email: string | null;
  agenda: string | null;
  universidad: Universidad | null;
};

export async function listarSugerencias(db: Db): Promise<SugerenciaAdmin[]> {
  const [{ data: sug, error }, { data: perfiles }, { data: agendas }, { data: usuarios }] = await Promise.all([
    db.from("sugerencias").select("id,user_id,agenda_id,texto,estado,created_at").order("created_at", { ascending: false }).limit(300),
    db.from("perfiles").select("id,nombre"),
    db.from("agendas").select("id,nombre,universidad"),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw new Error(error.message);
  const nombre = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string]));
  const agenda = new Map((agendas ?? []).map((a) => [a.id, a]));
  const correo = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? null]));
  return (sug ?? []).map((x) => {
    const a = x.agenda_id ? agenda.get(x.agenda_id) : null;
    return {
      id: x.id,
      texto: x.texto,
      estado: x.estado,
      created_at: x.created_at,
      nombre: nombre.get(x.user_id) ?? "—",
      email: correo.get(x.user_id) ?? null,
      agenda: a?.nombre ?? null,
      universidad: a ? ((a.universidad === "uady" ? "uady" : "upp") as Universidad) : null,
    };
  });
}

/* ---------------- anuncios ---------------- */

export type AnuncioAdmin = { id: string; titulo: string; texto: string; universidad: "todas" | Universidad; hasta: string | null; activo: boolean; correos: number; created_at: string };

/** Manda el anuncio por correo a todas las personas (con cuenta activa) de esa universidad. Devuelve a cuántas. */
export async function correoAnuncio(db: Db, a: { titulo: string; texto: string; universidad: string }, sitio: string) {
  const [{ data: agendas }, { data: perfiles }, { data: usuarios }] = await Promise.all([
    db.from("agendas").select("id,universidad"),
    db.from("perfiles").select("id,nombre,agenda_id").not("agenda_id", "is", null),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const ids = new Set((agendas ?? []).filter((x) => a.universidad === "todas" || x.universidad === a.universidad).map((x) => x.id));
  const correo = new Map((usuarios?.users ?? []).filter((u) => u.email && (u.email_confirmed_at || u.last_sign_in_at)).map((u) => [u.id, u.email!]));
  const destinos = (perfiles ?? []).filter((p) => ids.has(p.agenda_id) && correo.has(p.id)).map((p) => ({ para: correo.get(p.id)!, nombre: String(p.nombre ?? "").split(" ")[0] }));
  const parrafos = esc(a.texto).split(/\n+/).map((t) => `<p style="margin:0 0 8px;color:#4a4843;">${t}</p>`).join("");
  const html = envolver(esc(a.titulo), parrafos, { texto: "Abrir mi agenda", url: `${sitio}/` });
  const texto = `${a.titulo}\n\n${a.texto}\n\n${sitio}/`;
  // Resend en lotes de hasta 100 (una sola llamada por lote)
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Falta la variable RESEND_API_KEY en Vercel.");
  const { REMITENTE } = await import("@/lib/recordatorios");
  let enviados = 0;
  for (let i = 0; i < destinos.length; i += 100) {
    const lote = destinos.slice(i, i + 100).map((d) => ({ from: REMITENTE, to: [d.para], subject: a.titulo, html, text: texto }));
    const res = await fetch(`${process.env.RESEND_API_URL || "https://api.resend.com"}/emails/batch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(lote),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    enviados += lote.length;
  }
  return enviados;
}
