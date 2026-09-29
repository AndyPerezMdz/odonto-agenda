import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarConResend, esc, fechaEnZona } from "@/lib/recordatorios";
import { envolver } from "@/lib/pagosServer";
import { estadoPago } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";
import { prefs, type Preferencias } from "@/lib/types";
import { DIAS_A_MOSTRAR, espaciosLibres, premiumActivo, PRECIO_PREMIUM_DEFAULT, type DiaLibre } from "@/lib/premium";

type Db = ReturnType<typeof createAdminClient>;

export async function precioPremium(db: Db) {
  const { data } = await db.from("configuracion").select("valor").eq("clave", "premium").maybeSingle();
  const p = Number((data?.valor as { precio?: number } | undefined)?.precio);
  return p > 0 ? p : PRECIO_PREMIUM_DEFAULT;
}

/** Hora actual en Mérida, "HH:MM". */
export function ahoraEnZona() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Merida", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

export type PaginaPublica =
  | { disponible: false }
  | {
      disponible: true;
      perfilId: string;
      agendaId: string;
      nombre: string;
      duracion: number;
      dias: DiaLibre[];
      clinicas: Record<string, string>;
    };

/** Todo lo que necesita la página pública /c/[slug]. Nunca devuelve datos de pacientes, sólo horas. */
export async function paginaPublica(db: Db, slug: string): Promise<PaginaPublica> {
  if (!slug || slug.length > 40) return { disponible: false };
  const { data: p } = await db
    .from("perfiles")
    .select("id,nombre,agenda_id,preferencias,premium_hasta,link_activo")
    .ilike("slug", slug)
    .maybeSingle();
  const hoy = fechaEnZona(0);
  if (!p || !p.agenda_id || !p.link_activo || !premiumActivo(p.premium_hasta, hoy)) return { disponible: false };

  const { data: agenda } = await db.from("agendas").select("pagado_hasta").eq("id", p.agenda_id).single();
  if (!agenda || estadoPago(agenda.pagado_hasta, hoy).tipo === "vencida") return { disponible: false };

  const hasta = new Date(Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10) + DIAS_A_MOSTRAR)).toISOString().slice(0, 10);
  const [{ data: bloques }, { data: citas }, { data: clinicas }] = await Promise.all([
    db.from("horarios").select("dia_semana,hora_inicio,hora_fin,clinica_id").eq("owner_id", p.id),
    db.from("citas").select("fecha,hora_inicio,hora_fin,estado").eq("owner_id", p.id).gte("fecha", hoy).lte("fecha", hasta),
    db.from("clinicas").select("id,numero").eq("agenda_id", p.agenda_id),
  ]);
  const duracion = prefs(p.preferencias as Preferencias).duracionMin;
  const dias = espaciosLibres(bloques ?? [], (citas ?? []).filter((c) => c.estado !== "cancelo"), { hoy, ahora: ahoraEnZona(), duracion });
  return {
    disponible: true,
    perfilId: p.id,
    agendaId: p.agenda_id,
    nombre: (p.nombre as string).split(" ")[0],
    duracion,
    dias,
    clinicas: Object.fromEntries((clinicas ?? []).map((c) => [c.id, c.numero])),
  };
}

/** Correo a la alumna: "te agendaron desde tu link". */
export async function avisarCitaPorLink(
  db: Db,
  perfilId: string,
  c: { paciente: string; telefono: string; fecha: string; hora: string; motivo: string | null; clinica: string | null; sitio: string }
) {
  const { data: u } = await db.auth.admin.getUserById(perfilId);
  if (!u.user?.email) return;
  const cuando = `${fechaLarga(c.fecha)} a las ${c.hora}`;
  await enviarConResend({
    para: u.user.email,
    asunto: `Nueva cita desde tu link: ${c.paciente}, ${cuando}`,
    html: envolver(
      "¡Te agendaron desde tu link!",
      `<p style="margin:0 0 10px;color:#4a4843;"><b>${esc(c.paciente)}</b> reservó el <b>${cuando}</b>${c.clinica ? ` en ${esc(c.clinica)}` : ""}.</p>
       ${c.motivo ? `<p style="margin:0 0 10px;color:#4a4843;">Lo que necesita: ${esc(c.motivo)}</p>` : ""}
       <p style="margin:0;color:#4a4843;">Teléfono: <b>${esc(c.telefono)}</b>. Ya está en tu agenda; confírmale por WhatsApp desde la cita.</p>`,
      c.sitio ? { texto: "Abrir la agenda", url: c.sitio } : undefined
    ),
    texto: `${c.paciente} reservó el ${cuando}${c.clinica ? ` en ${c.clinica}` : ""}. Tel: ${c.telefono}.${c.motivo ? ` Necesita: ${c.motivo}.` : ""}`,
  });
}
