import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aplicarPlantilla } from "@/lib/plantillasServer";
import { periodoDe } from "@/lib/cuatrimestre";
import { plantilla } from "@/lib/plantillas";

export const dynamic = "force-dynamic";

// PATCH → ajustes de la agenda compartida (calendario escolar y turnos). Los puede cambiar cualquiera de los dos.
// { plantilla } aplica una universidad; o { periodos?, semana_clinicas?, turnos?, turnos_inicia? }
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const db = createAdminClient();
  const { data: yo } = await db.from("perfiles").select("agenda_id").eq("id", user.id).single();
  const agendaId = yo?.agenda_id as string | undefined;
  if (!agendaId) return NextResponse.json({ error: "No tienes agenda." }, { status: 403 });

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.plantilla === "string") {
    const r = await aplicarPlantilla(db, agendaId, b.plantilla);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    await confirmarPeriodo(db, agendaId, plantilla(b.plantilla)?.periodos);
    return NextResponse.json({ ok: true });
  }

  const cambios: Record<string, unknown> = {};
  if (b.periodos === "cuatrimestre" || b.periodos === "semestre") cambios.periodos = b.periodos;
  if (typeof b.semana_clinicas === "number" && b.semana_clinicas >= 1 && b.semana_clinicas <= 8) cambios.semana_clinicas = Math.round(b.semana_clinicas);
  if (typeof b.turnos === "string" && ["ninguno", "hora", "clinica", "semana"].includes(b.turnos)) cambios.turnos = b.turnos;
  if ("turnos_inicia" in b) {
    if (b.turnos_inicia === null) cambios.turnos_inicia = null;
    else {
      // Sólo alguien de esta misma agenda
      const { data: p } = await db.from("perfiles").select("id").eq("id", String(b.turnos_inicia)).eq("agenda_id", agendaId).maybeSingle();
      if (!p) return NextResponse.json({ error: "Esa persona no es de tu agenda." }, { status: 400 });
      cambios.turnos_inicia = p.id;
    }
  }
  if (!Object.keys(cambios).length) return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
  const { error } = await db.from("agendas").update(cambios).eq("id", agendaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (cambios.periodos) await confirmarPeriodo(db, agendaId, cambios.periodos as string);
  return NextResponse.json({ ok: true });
}

// Al cambiar de cuatrimestres a semestres no hay que preguntarle al dueño "¿empezó un nuevo semestre?"
async function confirmarPeriodo(db: ReturnType<typeof createAdminClient>, agendaId: string, periodos?: string) {
  if (!periodos) return;
  await db.from("perfiles").update({ periodo_confirmado: periodoDe(new Date(), periodos).id }).eq("agenda_id", agendaId).eq("rol", "owner");
}
