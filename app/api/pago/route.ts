import { PAGO_EN_LINEA } from "@/lib/plan";
import { NextResponse, type NextRequest } from "next/server";
import { duenoEnSesion } from "@/lib/companero";
import { notificarAvisoPago } from "@/lib/pagosServer";
import { urlSitio } from "@/lib/recordatorios";
import { codigoAgenda } from "@/lib/pagos";
import { agendaEnPrueba, pruebaAgendaDisponible } from "@/lib/pruebas";
import { planesConfig } from "@/lib/universidadesServer";
import { mensualDe, planDe } from "@/lib/precios";
import { mpActivo } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

const soloDueno = () => NextResponse.json({ error: "Sólo el dueño de la agenda puede ver la suscripción." }, { status: 403 });

// GET → estado de la suscripción, datos para transferir e historial (sólo el dueño)
export async function GET() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();

  const [{ data: agenda }, { data: config }, { data: pagos }, { data: avisos }, enPrueba, prueba] = await Promise.all([
    s.db.from("agendas").select("id,nombre,pagado_hasta,precio_mensual,prueba_hasta,codigo,universidad").eq("id", s.agendaId).single(),
    s.db.from("configuracion").select("valor").eq("clave", "pago").maybeSingle(),
    s.db.from("pagos").select("id,monto,meses,metodo,cubre_desde,cubre_hasta,created_at").eq("agenda_id", s.agendaId).order("created_at", { ascending: false }).limit(6),
    s.db.from("avisos_pago").select("id,created_at,estado").eq("agenda_id", s.agendaId).order("created_at", { ascending: false }).limit(1),
    agendaEnPrueba(s.db, s.agendaId),
    pruebaAgendaDisponible(s.db, s.agendaId),
  ]);
  if (!agenda) return NextResponse.json({ error: "Agenda no encontrada." }, { status: 404 });
  const planes = await planesConfig(s.db);
  const uni = agenda.universidad === "uady" ? "uady" : "upp";

  return NextResponse.json({
    planes: planes[uni].filter((p) => p.activo), // mensual, trimestral, por periodo, anual
    mensual: mensualDe(planes, uni),
    mp: PAGO_EN_LINEA && mpActivo(), // ¿se puede pagar con tarjeta / OXXO?
    pagadoHasta: agenda.pagado_hasta,
    enPrueba,
    pruebaDisponible: prueba.ok, // 2.3 · puede activar sus 15 días cuando quiera
    codigoCreador: agenda.codigo ?? null,
    precio: Number(agenda.precio_mensual),
    codigo: codigoAgenda(agenda.id),
    banco: config?.valor ?? {},
    pagos: pagos ?? [],
    avisoPendiente: avisos?.[0]?.estado === "pendiente" ? avisos[0].created_at : null,
    ultimoAviso: avisos?.[0] ? { estado: avisos[0].estado, fecha: avisos[0].created_at } : null,
  });
}

// POST { referencia?, monto? } → "Ya pagué": se guarda el aviso y te llega un correo al instante
export async function POST(request: NextRequest) {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  const body = (await request.json().catch(() => ({}))) as { referencia?: string; plan?: string };

  const { data: pendiente } = await s.db
    .from("avisos_pago")
    .select("id")
    .eq("agenda_id", s.agendaId)
    .eq("estado", "pendiente")
    .limit(1);
  if (pendiente?.length) {
    return NextResponse.json({ error: "Ya avisaste de un pago. En cuanto se confirme, se actualizará tu suscripción." }, { status: 409 });
  }

  const [{ data: agenda }, { data: yo }] = await Promise.all([
    s.db.from("agendas").select("id,nombre,precio_mensual,universidad").eq("id", s.agendaId).single(),
    s.db.from("perfiles").select("nombre").eq("id", s.user.id).single(),
  ]);
  // El monto lo pone el servidor (no el navegador), según el plan elegido de su universidad
  const plan = planDe(await planesConfig(s.db), agenda?.universidad, body.plan ?? "mes");
  const monto = plan ? plan.precio : Number(agenda?.precio_mensual ?? 0);
  const meses = plan ? plan.meses : 1;
  const referencia = body.referencia?.trim().slice(0, 80) || null;

  const { error } = await s.db.from("avisos_pago").insert({ agenda_id: s.agendaId, reportado_por: s.user.id, monto, referencia, meses });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await notificarAvisoPago(s.db, {
      agendaNombre: agenda?.nombre ?? "Agenda",
      agendaId: s.agendaId,
      quien: `${yo?.nombre ?? "El dueño"} (${s.user.email})`,
      monto,
      meses,
      referencia,
      sitio: urlSitio(request.nextUrl.origin),
    });
  } catch (e) {
    console.error("[pago] no se pudo notificar", e); // el aviso ya quedó guardado; lo verás en tu panel
  }
  return NextResponse.json({ ok: true });
}
