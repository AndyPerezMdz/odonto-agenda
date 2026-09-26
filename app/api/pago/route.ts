import { NextResponse, type NextRequest } from "next/server";
import { duenoEnSesion } from "@/lib/companero";
import { notificarAvisoPago } from "@/lib/pagosServer";
import { urlSitio } from "@/lib/recordatorios";
import { codigoAgenda } from "@/lib/pagos";

export const dynamic = "force-dynamic";

const soloDueno = () => NextResponse.json({ error: "Sólo el dueño de la agenda puede ver la suscripción." }, { status: 403 });

// GET → estado de la suscripción, datos para transferir e historial (sólo el dueño)
export async function GET() {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();

  const [{ data: agenda }, { data: config }, { data: pagos }, { data: avisos }] = await Promise.all([
    s.db.from("agendas").select("id,nombre,pagado_hasta,precio_mensual").eq("id", s.agendaId).single(),
    s.db.from("configuracion").select("valor").eq("clave", "pago").maybeSingle(),
    s.db.from("pagos").select("id,monto,meses,metodo,cubre_desde,cubre_hasta,created_at").eq("agenda_id", s.agendaId).order("created_at", { ascending: false }).limit(6),
    s.db.from("avisos_pago").select("id,created_at,estado").eq("agenda_id", s.agendaId).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!agenda) return NextResponse.json({ error: "Agenda no encontrada." }, { status: 404 });

  return NextResponse.json({
    pagadoHasta: agenda.pagado_hasta,
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
  const body = (await request.json().catch(() => ({}))) as { referencia?: string; monto?: number };

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
    s.db.from("agendas").select("id,nombre,precio_mensual").eq("id", s.agendaId).single(),
    s.db.from("perfiles").select("nombre").eq("id", s.user.id).single(),
  ]);
  const monto = typeof body.monto === "number" && body.monto > 0 ? body.monto : Number(agenda?.precio_mensual ?? 0);
  const referencia = body.referencia?.trim().slice(0, 80) || null;

  const { error } = await s.db.from("avisos_pago").insert({ agenda_id: s.agendaId, reportado_por: s.user.id, monto, referencia });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await notificarAvisoPago(s.db, {
      agendaNombre: agenda?.nombre ?? "Agenda",
      agendaId: s.agendaId,
      quien: `${yo?.nombre ?? "El dueño"} (${s.user.email})`,
      monto,
      referencia,
      sitio: urlSitio(request.nextUrl.origin),
    });
  } catch (e) {
    console.error("[pago] no se pudo notificar", e); // el aviso ya quedó guardado; lo verás en tu panel
  }
  return NextResponse.json({ ok: true });
}
