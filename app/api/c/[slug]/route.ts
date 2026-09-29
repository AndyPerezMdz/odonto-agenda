import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCitaPorLink, paginaPublica } from "@/lib/premiumServer";
import { fechaEnZona, urlSitio } from "@/lib/recordatorios";
import { MOTIVOS } from "@/lib/premium";

export const dynamic = "force-dynamic";

// POST { fecha, hora, nombre, telefono, motivo?, acepto, sitio_web (trampa para bots) } → reserva desde el link público
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as {
    fecha?: string; hora?: string; nombre?: string; telefono?: string; motivo?: string; acepto?: boolean; sitio_web?: string;
  };
  if (b.sitio_web) return NextResponse.json({ ok: true }); // bot: fingimos que sí

  const nombre = (b.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const telefono = (b.telefono ?? "").replace(/\D/g, "");
  const motivo = MOTIVOS.includes(b.motivo ?? "") ? b.motivo! : null;
  if (nombre.length < 3) return NextResponse.json({ error: "Escribe tu nombre completo." }, { status: 400 });
  if (telefono.length < 10 || telefono.length > 13) return NextResponse.json({ error: "Escribe tu teléfono a 10 dígitos." }, { status: 400 });
  if (!b.acepto) return NextResponse.json({ error: "Acepta el aviso de privacidad para continuar." }, { status: 400 });

  const db = createAdminClient();
  const p = await paginaPublica(db, slug);
  if (!p.disponible) return NextResponse.json({ error: "Este link ya no está disponible." }, { status: 404 });
  const espacio = p.dias.find((d) => d.fecha === b.fecha)?.espacios.find((e) => e.hora === b.hora);
  if (!espacio) return NextResponse.json({ error: "Ese horario ya no está libre. Elige otro.", ocupado: true }, { status: 409 });

  // Freno anti-relajo: máximo 2 citas próximas por teléfono con la misma alumna
  const { count } = await db
    .from("citas")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", p.perfilId)
    .eq("telefono", telefono)
    .eq("origen", "link")
    .gte("fecha", fechaEnZona(0));
  if ((count ?? 0) >= 2) return NextResponse.json({ error: "Ya tienes citas reservadas con ella. Si necesitas cambiarla, escríbele directo." }, { status: 429 });

  const { error } = await db.from("citas").insert({
    owner_id: p.perfilId,
    agenda_id: p.agendaId,
    paciente: nombre,
    fecha: b.fecha,
    hora_inicio: espacio.hora,
    hora_fin: espacio.fin,
    clinica_id: espacio.clinica_id,
    telefono,
    notas: motivo ? `Reservó por tu link · ${motivo}` : "Reservó por tu link",
    origen: "link",
  });
  if (error) {
    // El candado de horarios encimados de la base ganó la carrera
    if (/citas_sin_traslape|exclusion/i.test(error.message)) return NextResponse.json({ error: "Alguien acaba de ganar ese horario. Elige otro.", ocupado: true }, { status: 409 });
    return NextResponse.json({ error: "No se pudo reservar. Intenta de nuevo." }, { status: 500 });
  }

  try {
    await avisarCitaPorLink(db, p.perfilId, {
      paciente: nombre, telefono, fecha: b.fecha!, hora: espacio.hora, motivo,
      clinica: espacio.clinica_id ? p.clinicas[espacio.clinica_id] ?? null : null,
      sitio: urlSitio(request.nextUrl.origin),
    });
  } catch (e) {
    console.error("[link de citas] correo", e); // la cita ya quedó; la verá en su agenda
  }
  return NextResponse.json({ ok: true, fecha: b.fecha, hora: espacio.hora, fin: espacio.fin, clinica: espacio.clinica_id ? p.clinicas[espacio.clinica_id] ?? null : null });
}
