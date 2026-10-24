import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";
import { urlSitio } from "@/lib/recordatorios";
import { aceptarHabito, avisarPalomita, compartidosConmigo, compartidosDe, compartir, marcarCompartido, parejasDeHabitos, quitarCompartido, type TipoCompartido } from "@/lib/compartirMi";

export const dynamic = "force-dynamic";

// 3.0 · Compartir en Mi agenda.
//   GET                       → lo que te compartieron { eventos, pendientes }
//   GET ?tipo=evento&id=…     → con quién compartiste algo tuyo
//   POST  { tipo, id, correo } → compartir (tipo: evento | pendiente | habito)
//   POST  { accion: "aceptar", id } → 3.2: aceptar hacer un hábito juntos (se crea tu copia)
//   POST  { accion: "palomee", habito_id } → 3.2: avisarle a tu pareja de hábito que ya lo hiciste
//   GET   ?parejas=1           → 3.2: tus hábitos con amigos
//   PATCH { id, hecho }        → palomear un pendiente que te compartieron
//   DELETE { id }              → dejar de compartir (tuyo) o quitarlo de tu agenda (de otro)
type Quien = { r: NextResponse } | { r?: undefined; db: ReturnType<typeof createAdminClient>; id: string; email: string };
async function quien(): Promise<Quien> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { r: NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 }) };
  const db = createAdminClient();
  if (!(await personalDe(db, data.user.id))) return { r: NextResponse.json({ error: "Esta cuenta no tiene Mi agenda." }, { status: 403 }) };
  return { db, id: data.user.id, email: data.user.email ?? "" };
}
const tipoOk = (t: unknown): t is TipoCompartido => t === "evento" || t === "pendiente" || t === "habito";
const uuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);

export async function GET(request: NextRequest) {
  const q = await quien();
  if (q.r) return q.r;
  // 3.2 · ?parejas=1 → tus hábitos con amigos (con quién, su racha y si ya lo hizo hoy)
  if (request.nextUrl.searchParams.get("parejas")) return NextResponse.json({ parejas: await parejasDeHabitos(q.db, q.id).catch(() => []) });
  const tipo = request.nextUrl.searchParams.get("tipo");
  const id = request.nextUrl.searchParams.get("id");
  try {
    if (tipo || id) {
      if (!tipoOk(tipo) || !uuid(id)) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
      return NextResponse.json({ lista: await compartidosDe(q.db, q.id, tipo, id) });
    }
    return NextResponse.json(await compartidosConmigo(q.db, q.id, q.email));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const q = await quien();
  if (q.r) return q.r;
  const b = (await request.json().catch(() => ({}))) as { tipo?: unknown; id?: unknown; correo?: unknown; accion?: unknown; habito_id?: unknown };
  // 3.2 · Hábitos con amigos: aceptar la invitación, o avisarle a tu pareja que ya lo hiciste
  if (b.accion === "aceptar") {
    if (!uuid(b.id)) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    const r = await aceptarHabito(q.db, q.id, q.email, b.id);
    return r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: 400 });
  }
  if (b.accion === "palomee") {
    if (!uuid(b.habito_id)) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    return NextResponse.json({ avisos: await avisarPalomita(q.db, q.id, b.habito_id).catch(() => 0) });
  }
  if (!tipoOk(b.tipo) || !uuid(b.id) || typeof b.correo !== "string") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  try {
    const r = await compartir(q.db, q.id, q.email, b.tipo, b.id, b.correo, urlSitio(request.nextUrl.origin));
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const q = await quien();
  if (q.r) return q.r;
  const b = (await request.json().catch(() => ({}))) as { id?: unknown; hecho?: unknown };
  if (!uuid(b.id) || typeof b.hecho !== "boolean") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  if (!(await marcarCompartido(q.db, q.id, q.email, b.id, b.hecho))) return NextResponse.json({ error: "Ya no está compartido contigo." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const q = await quien();
  if (q.r) return q.r;
  const b = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (!uuid(b.id)) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  if (!(await quitarCompartido(q.db, q.id, q.email, b.id))) return NextResponse.json({ error: "No se encontró." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
