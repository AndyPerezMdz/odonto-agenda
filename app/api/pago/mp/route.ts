import { PAGO_EN_LINEA } from "@/lib/plan";
import { NextResponse, type NextRequest } from "next/server";
import { duenoEnSesion } from "@/lib/companero";
import { crearPreferencia, mpActivo } from "@/lib/mercadopago";
import { planesConfig } from "@/lib/universidadesServer";
import { planDe } from "@/lib/precios";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// POST { plan } → link de Mercado Pago para pagar ese plan (sólo el dueño)
export async function POST(request: NextRequest) {
  const s = await duenoEnSesion();
  if (!s) return NextResponse.json({ error: "Sólo el dueño de la agenda puede pagar." }, { status: 403 });
  if (!PAGO_EN_LINEA || !mpActivo()) return NextResponse.json({ error: "El pago en línea todavía no está disponible." }, { status: 503 });
  const { plan: id } = (await request.json().catch(() => ({}))) as { plan?: string };
  const { data: agenda } = await s.db.from("agendas").select("id,nombre,universidad").eq("id", s.agendaId).single();
  const plan = planDe(await planesConfig(s.db), agenda?.universidad, id);
  if (!agenda || !plan) return NextResponse.json({ error: "Ese plan no existe." }, { status: 400 });
  try {
    const url = await crearPreferencia({ agendaId: agenda.id, agendaNombre: agenda.nombre, plan, email: s.user.email, sitio: urlSitio(request.nextUrl.origin) });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[pago/mp]", e);
    return NextResponse.json({ error: "Mercado Pago no respondió. Intenta otra vez o paga por transferencia." }, { status: 502 });
  }
}
