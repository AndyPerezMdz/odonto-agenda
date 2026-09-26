import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion, listarAgendas } from "@/lib/admin";
import { correoValido, invitarUsuario } from "@/lib/invitar";
import { fechaEnZona, urlSitio } from "@/lib/recordatorios";
import { registrarPago } from "@/lib/pagosServer";
import { sumarDias } from "@/lib/pagos";

export const dynamic = "force-dynamic";

// Para cualquiera que no sea superadmin, esta API "no existe"
const noExiste = () => NextResponse.json({ error: "No encontrado" }, { status: 404 });

// GET → todas las agendas con sus miembros
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return noExiste();
  try {
    return NextResponse.json(await listarAgendas(s.db));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST { nombre, emailDueno, notas?, inicio?: "pagado" | "prueba" | "cortesia", precio? }
// → crea una agenda nueva e invita a su dueño
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();

  const body = (await request.json().catch(() => ({}))) as { nombre?: string; emailDueno?: string; notas?: string; inicio?: string; precio?: number };
  const precio = typeof body.precio === "number" && body.precio >= 0 ? body.precio : 200;
  const nombre = body.nombre?.trim() || "Agenda de clínicas";
  const email = body.emailDueno?.trim().toLowerCase() ?? "";
  if (!correoValido(email)) return NextResponse.json({ error: "Escribe un correo válido para el dueño." }, { status: 400 });

  const { data: agenda, error } = await s.db
    .from("agendas")
    .insert({
      nombre,
      notas: body.notas?.trim() || null,
      precio_mensual: precio,
      // prueba: 7 días; pagado: se registra abajo; cortesía: sin vencimiento
      pagado_hasta: body.inicio === "prueba" ? sumarDias(fechaEnZona(0), 7) : null,
    })
    .select("id")
    .single();
  if (error || !agenda) return NextResponse.json({ error: error?.message ?? "No se pudo crear." }, { status: 500 });

  const r = await invitarUsuario(s.db, { email, agendaId: agenda.id, rol: "owner", sitio: urlSitio(request.nextUrl.origin) });
  if (r.error) {
    await s.db.from("agendas").delete().eq("id", agenda.id); // deshacer
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (body.inicio !== "prueba" && body.inicio !== "cortesia") {
    await registrarPago(s.db, agenda.id, { monto: precio, meses: 1, metodo: "spei", referencia: "Primer mes" });
  }
  return NextResponse.json({ ok: true, id: agenda.id });
}
