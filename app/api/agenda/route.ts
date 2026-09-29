import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// PATCH → ajustes de una agenda de la UADY (semana en que empiezan las clínicas y turnos).
// Los puede cambiar cualquiera de los dos. La universidad NO se cambia nunca.
// { semana_clinicas?, turnos?, turnos_inicia? }
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
  const { data: agenda } = await db.from("agendas").select("universidad").eq("id", agendaId).single();
  if (agenda?.universidad !== "uady") return NextResponse.json({ error: "Esto es sólo para agendas de la UADY." }, { status: 403 });

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const cambios: Record<string, unknown> = {};
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
  return NextResponse.json({ ok: true });
}
