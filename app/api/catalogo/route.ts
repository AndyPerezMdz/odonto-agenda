import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 2.3 · Borrar una clínica o materia SIN dejar citas huérfanas.
// GET  ?tipo=clinica|materia&id=…           → { citas } cuántas citas (de los dos) la usan
// POST { tipo, id, pasarA?: id | null }     → pasa sus citas (y horario, banco, material, metas) a otra y la borra
// Se hace con el cliente admin porque las citas del compa no las puede tocar uno desde el navegador.

type Tipo = "clinica" | "materia";
const TABLA = { clinica: "clinicas", materia: "materias" } as const;
const COL = { clinica: "clinica_id", materia: "materia_id" } as const;

async function contexto() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 }) };
  const db = createAdminClient();
  const { data: yo } = await db.from("perfiles").select("agenda_id").eq("id", user.id).single();
  const agendaId = yo?.agenda_id as string | undefined;
  if (!agendaId) return { error: NextResponse.json({ error: "No tienes agenda." }, { status: 403 }) };
  return { db, agendaId };
}

const esTipo = (t: unknown): t is Tipo => t === "clinica" || t === "materia";
const deMiAgenda = async (db: ReturnType<typeof createAdminClient>, tipo: Tipo, id: string, agendaId: string) =>
  !!(await db.from(TABLA[tipo]).select("id").eq("id", id).eq("agenda_id", agendaId).maybeSingle()).data;

export async function GET(request: NextRequest) {
  const c = await contexto();
  if ("error" in c) return c.error;
  const tipo = request.nextUrl.searchParams.get("tipo");
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!esTipo(tipo) || !(await deMiAgenda(c.db, tipo, id, c.agendaId))) return NextResponse.json({ error: "No existe." }, { status: 404 });
  const { count } = await c.db.from("citas").select("id", { count: "exact", head: true }).eq("agenda_id", c.agendaId).eq(COL[tipo], id);
  return NextResponse.json({ citas: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const c = await contexto();
  if ("error" in c) return c.error;
  const { db, agendaId } = c;
  const b = (await request.json().catch(() => ({}))) as { tipo?: unknown; id?: unknown; pasarA?: unknown };
  const tipo = b.tipo;
  const id = String(b.id ?? "");
  const pasarA = b.pasarA ? String(b.pasarA) : null;
  if (!esTipo(tipo) || !(await deMiAgenda(db, tipo, id, agendaId))) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (pasarA && (pasarA === id || !(await deMiAgenda(db, tipo, pasarA, agendaId)))) return NextResponse.json({ error: "Elige otra de tu agenda." }, { status: 400 });

  if (pasarA) {
    const col = COL[tipo];
    const r = await db.from("citas").update({ [col]: pasarA }).eq("agenda_id", agendaId).eq(col, id);
    if (r.error) return NextResponse.json({ error: "No se pudieron pasar las citas." }, { status: 500 });
    await db.from("horarios").update({ [col]: pasarA }).eq("agenda_id", agendaId).eq(col, id);
    if (tipo === "materia") {
      await db.from("pacientes").update({ materia_id: pasarA }).eq("agenda_id", agendaId).eq("materia_id", id);
      await db.from("material").update({ materia_id: pasarA }).eq("agenda_id", agendaId).eq("materia_id", id);
      // Metas: si alguien no tenía meta en la nueva, se le pasa la de la vieja
      const { data: metas } = await db.from("metas").select("perfil_id,meta").eq("materia_id", id);
      for (const m of metas ?? []) {
        const { data: ya } = await db.from("metas").select("perfil_id").eq("materia_id", pasarA).eq("perfil_id", m.perfil_id).maybeSingle();
        if (!ya) await db.from("metas").insert({ perfil_id: m.perfil_id, materia_id: pasarA, meta: m.meta });
      }
    }
  }
  const { error } = await db.from(TABLA[tipo]).delete().eq("id", id).eq("agenda_id", agendaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
