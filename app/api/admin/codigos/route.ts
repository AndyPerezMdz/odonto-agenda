import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

export type CodigoAdmin = { codigo: string; creador: string; meses_extra: number; activo: boolean; created_at: string; agendas: number; pagando: number };

// GET → códigos con cuántas agendas llegaron por cada uno y cuántas ya pagan
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const [{ data: codigos, error }, { data: agendas }, { data: pagos }] = await Promise.all([
    s.db.from("codigos").select("codigo,creador,meses_extra,activo,created_at").order("created_at", { ascending: false }),
    s.db.from("agendas").select("id,codigo").not("codigo", "is", null),
    s.db.from("pagos").select("agenda_id"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pagaron = new Set((pagos ?? []).map((p) => p.agenda_id));
  const lista: CodigoAdmin[] = (codigos ?? []).map((c) => {
    const suyas = (agendas ?? []).filter((a) => a.codigo === c.codigo);
    return { ...c, agendas: suyas.length, pagando: suyas.filter((a) => pagaron.has(a.id)).length };
  });
  return NextResponse.json({ codigos: lista });
}

// POST { codigo, creador, meses_extra? } → nuevo código
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const b = (await request.json().catch(() => ({}))) as { codigo?: string; creador?: string; meses_extra?: number };
  const codigo = (b.codigo ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) {
    return NextResponse.json({ error: "El código debe tener de 3 a 30 letras o números, sin espacios." }, { status: 400 });
  }
  if (!b.creador?.trim()) return NextResponse.json({ error: "Escribe de quién es el código." }, { status: 400 });
  const meses = Math.min(12, Math.max(1, Math.round(b.meses_extra ?? 1)));
  const { error } = await s.db.from("codigos").insert({ codigo, creador: b.creador.trim(), meses_extra: meses });
  if (error) {
    return NextResponse.json({ error: error.code === "23505" ? "Ese código ya existe." : error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, codigo });
}

// PATCH { codigo, activo } → activar / desactivar
export async function PATCH(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const b = (await request.json().catch(() => ({}))) as { codigo?: string; activo?: boolean };
  if (!b.codigo || typeof b.activo !== "boolean") return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  const { error } = await s.db.from("codigos").update({ activo: b.activo }).eq("codigo", b.codigo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
