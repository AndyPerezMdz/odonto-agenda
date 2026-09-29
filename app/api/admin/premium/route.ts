import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { periodoDelPago, pesos } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";
import { enviarConResend, esc, fechaEnZona, urlSitio } from "@/lib/recordatorios";
import { envolver } from "@/lib/pagosServer";
import { codigoPremium } from "@/lib/premium";

export const dynamic = "force-dynamic";
const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

export type AvisoPremium = { id: string; perfilId: string; nombre: string; email: string | null; agenda: string | null; monto: number | null; referencia: string | null; concepto: string; created_at: string };

// GET → avisos de pago de premium por confirmar
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const { data: avisos } = await s.db.from("avisos_premium").select("id,perfil_id,monto,referencia,created_at").eq("estado", "pendiente").order("created_at");
  const lista: AvisoPremium[] = [];
  for (const a of avisos ?? []) {
    const [{ data: p }, { data: u }] = await Promise.all([
      s.db.from("perfiles").select("nombre,agenda_id").eq("id", a.perfil_id).single(),
      s.db.auth.admin.getUserById(a.perfil_id),
    ]);
    const { data: ag } = p?.agenda_id ? await s.db.from("agendas").select("nombre").eq("id", p.agenda_id).single() : { data: null };
    lista.push({
      id: a.id, perfilId: a.perfil_id, nombre: p?.nombre ?? "—", email: u.user?.email ?? null, agenda: ag?.nombre ?? null,
      monto: a.monto != null ? Number(a.monto) : null, referencia: a.referencia, concepto: codigoPremium(a.perfil_id), created_at: a.created_at,
    });
  }
  return NextResponse.json({ avisos: lista });
}

/** Suma meses de premium (desde su vencimiento si sigue vigente; si no, desde hoy) y le avisa por correo. */
async function extender(s: NonNullable<Awaited<ReturnType<typeof superadminEnSesion>>>, perfilId: string, meses: number, sitio: string) {
  const { data: p } = await s.db.from("perfiles").select("nombre,premium_hasta").eq("id", perfilId).single();
  if (!p) throw new Error("Perfil no encontrado.");
  const { hasta } = periodoDelPago(p.premium_hasta, fechaEnZona(0), meses);
  const { error } = await s.db.from("perfiles").update({ premium_hasta: hasta }).eq("id", perfilId);
  if (error) throw new Error(error.message);
  try {
    const { data: u } = await s.db.auth.admin.getUserById(perfilId);
    if (u.user?.email) {
      await enviarConResend({
        para: u.user.email,
        asunto: `¡Tu link de citas está activo hasta el ${fechaLarga(hasta)}!`,
        html: envolver(
          "¡Tu link de citas está activo!",
          `<p style="margin:0 0 10px;color:#4a4843;">Hola, ${esc(p.nombre)}. Confirmamos tu pago: tu link de citas funciona hasta el <b>${fechaLarga(hasta)}</b>.</p>
           <p style="margin:0;color:#4a4843;">Entra a <b>Personalizar → Mi link</b>, préndelo y compártelo en tu Instagram o WhatsApp.</p>`,
          sitio ? { texto: "Ir a Mi link", url: `${sitio}/personalizar#link` } : undefined
        ),
        texto: `Tu link de citas está activo hasta el ${fechaLarga(hasta)}. Entra a Personalizar → Mi link.`,
      });
    }
  } catch (e) {
    console.error("[premium] correo", e);
  }
  return hasta;
}

// POST { avisoId } → confirmar un "Ya pagué" (+1 mes) · POST { perfilId, meses } → dar premium a mano (efectivo, cortesía)
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const b = (await request.json().catch(() => ({}))) as { avisoId?: string; perfilId?: string; meses?: number };
  const sitio = urlSitio(request.nextUrl.origin);
  try {
    if (b.avisoId) {
      const { data: tomado } = await s.db.from("avisos_premium").update({ estado: "confirmado" }).eq("id", b.avisoId).eq("estado", "pendiente").select("perfil_id,monto");
      if (!tomado?.length) return NextResponse.json({ error: "Este aviso ya se había procesado." }, { status: 409 });
      const hasta = await extender(s, tomado[0].perfil_id, 1, sitio);
      return NextResponse.json({ ok: true, hasta, mensaje: `Premium confirmado (${pesos(Number(tomado[0].monto ?? 0))}) hasta el ${fechaLarga(hasta)}.` });
    }
    if (b.perfilId) {
      const meses = Math.min(12, Math.max(1, Math.round(b.meses ?? 1)));
      const hasta = await extender(s, b.perfilId, meses, sitio);
      return NextResponse.json({ ok: true, hasta, mensaje: `Premium activo hasta el ${fechaLarga(hasta)}.` });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return NextResponse.json({ error: "Falta el aviso o la persona." }, { status: 400 });
}

// PATCH { avisoId } → "No llegó"
export async function PATCH(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  const b = (await request.json().catch(() => ({}))) as { avisoId?: string };
  const { data } = await s.db.from("avisos_premium").update({ estado: "descartado" }).eq("id", b.avisoId ?? "").eq("estado", "pendiente").select("id");
  if (!data?.length) return NextResponse.json({ error: "Este aviso ya se había procesado." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
