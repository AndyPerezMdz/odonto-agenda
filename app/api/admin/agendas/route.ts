import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion, listarAgendas } from "@/lib/admin";
import { correoValido, invitarUsuario } from "@/lib/invitar";
import { fechaEnZona, urlSitio } from "@/lib/recordatorios";
import { registrarPago } from "@/lib/pagosServer";
import { esSuperadmin } from "@/lib/admin";
import { finDePrueba, gastarPrueba, pruebaDe, usuarioPorCorreo } from "@/lib/pruebas";
import { crearInvitacion } from "@/lib/invitaciones";

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

// POST { nombre, emailDueno, notas?, inicio?: "prueba" (predeterminado) | "pagado" | "cortesia", precio?, codigo? }
// → crea una agenda nueva e invita a su dueño
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return noExiste();

  const body = (await request.json().catch(() => ({}))) as { nombre?: string; emailDueno?: string; notas?: string; inicio?: string; precio?: number; codigo?: string };
  const precio = typeof body.precio === "number" && body.precio >= 0 ? body.precio : 200;
  const nombre = body.nombre?.trim() || "Agenda de clínicas";
  const email = body.emailDueno?.trim().toLowerCase() ?? "";
  const inicio = body.inicio === "pagado" || body.inicio === "cortesia" ? body.inicio : "prueba";
  if (!correoValido(email)) return NextResponse.json({ error: "Escribe un correo válido para el dueño." }, { status: 400 });

  // Mes gratis: uno por persona
  if (inicio === "prueba") {
    const p = await pruebaDe(s.db, email);
    if (p?.usada_at) {
      return NextResponse.json(
        { error: `Este correo ya usó su mes gratis (${new Date(p.usada_at).toLocaleDateString("es-MX")}). Elige “Ya pagó” o “Cortesía”.` },
        { status: 409 }
      );
    }
  }

  // Código de creador (opcional): se guarda siempre; los meses extra sólo aplican con mes gratis
  let codigo: string | null = null;
  let mesesExtra = 0;
  if (body.codigo?.trim()) {
    const { data: c } = await s.db.from("codigos").select("codigo,meses_extra,activo").eq("codigo", body.codigo.trim().toUpperCase()).maybeSingle();
    if (!c || !c.activo) return NextResponse.json({ error: "Ese código no existe o está desactivado." }, { status: 400 });
    codigo = c.codigo;
    if (inicio === "prueba") mesesExtra = c.meses_extra;
  }

  const existente = await usuarioPorCorreo(s.db, email);
  if (existente && (await esSuperadmin(s.db, existente.id))) {
    return NextResponse.json({ error: "Ese correo no puede ser dueño de una agenda." }, { status: 400 });
  }

  const hasta = inicio === "prueba" ? finDePrueba(mesesExtra) : null;
  const { data: agenda, error } = await s.db
    .from("agendas")
    .insert({ nombre, notas: body.notas?.trim() || null, precio_mensual: precio, pagado_hasta: hasta, prueba_hasta: hasta, codigo })
    .select("id")
    .single();
  if (error || !agenda) return NextResponse.json({ error: error?.message ?? "No se pudo crear." }, { status: 500 });

  const sitio = urlSitio(request.nextUrl.origin);
  if (existente) {
    // Ya tiene cuenta en otra agenda: le llega una invitación para cambiarse a ésta como dueño/a
    const r = await crearInvitacion(s.db, { agendaId: agenda.id, email, rol: "owner", quien: "Agenda de clínicas", sitio });
    if (r.error) {
      await s.db.from("agendas").delete().eq("id", agenda.id);
      return NextResponse.json({ error: r.error }, { status: 500 });
    }
  } else {
    const r = await invitarUsuario(s.db, { email, agendaId: agenda.id, rol: "owner", sitio });
    if (r.error) {
      await s.db.from("agendas").delete().eq("id", agenda.id); // deshacer
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
    if (inicio === "prueba") await gastarPrueba(s.db, email, agenda.id);
  }
  if (inicio === "pagado") {
    await registrarPago(s.db, agenda.id, { monto: precio, meses: 1, metodo: "spei", referencia: "Primer mes" });
  }
  return NextResponse.json({ ok: true, id: agenda.id, existente: !!existente });
}
