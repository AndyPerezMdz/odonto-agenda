import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { codigoPremium, premiumActivo, SLUG_VALIDO, slugSugerido } from "@/lib/premium";
import { precioPremium } from "@/lib/premiumServer";
import { correosSuperadmin, envolver } from "@/lib/pagosServer";
import { enviarConResend, esc, fechaEnZona, urlSitio } from "@/lib/recordatorios";
import { pesos } from "@/lib/pagos";

export const dynamic = "force-dynamic";

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { user, db: createAdminClient() };
}
const sinSesion = () => NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

// GET → estado de "Tu link de citas" de quien está en sesión
export async function GET(request: NextRequest) {
  const s = await sesion();
  if (!s) return sinSesion();
  const [{ data: p }, { data: banco }, { data: avisos }, { count: bloques }, precio] = await Promise.all([
    s.db.from("perfiles").select("nombre,slug,link_activo,premium_hasta").eq("id", s.user.id).single(),
    s.db.from("configuracion").select("valor").eq("clave", "pago").maybeSingle(),
    s.db.from("avisos_premium").select("estado,created_at").eq("perfil_id", s.user.id).order("created_at", { ascending: false }).limit(1),
    s.db.from("horarios").select("id", { count: "exact", head: true }).eq("owner_id", s.user.id),
    precioPremium(s.db),
  ]);
  const hoy = fechaEnZona(0);
  return NextResponse.json({
    activo: premiumActivo(p?.premium_hasta, hoy),
    premiumHasta: p?.premium_hasta ?? null,
    slug: p?.slug ?? null,
    slugSugerido: slugSugerido(p?.nombre ?? ""),
    linkActivo: !!p?.link_activo,
    sitio: urlSitio(request.nextUrl.origin),
    precio,
    concepto: codigoPremium(s.user.id),
    banco: banco?.valor ?? {},
    ultimoAviso: avisos?.[0] ?? null,
    tieneHorario: (bloques ?? 0) > 0,
  });
}

// PATCH { slug?, linkActivo? } → elegir tu link y prenderlo/apagarlo
export async function PATCH(request: NextRequest) {
  const s = await sesion();
  if (!s) return sinSesion();
  const b = (await request.json().catch(() => ({}))) as { slug?: string; linkActivo?: boolean };
  const cambios: Record<string, string | boolean> = {};

  if (typeof b.slug === "string") {
    const slug = b.slug.trim().toLowerCase();
    if (!SLUG_VALIDO.test(slug)) return NextResponse.json({ error: "Usa de 3 a 30 letras sin acentos, números o guiones (ej. mariana-lopez)." }, { status: 400 });
    const { data: otro } = await s.db.from("perfiles").select("id").ilike("slug", slug).neq("id", s.user.id).maybeSingle();
    if (otro) return NextResponse.json({ error: "Ese link ya lo tiene alguien más. Prueba otro." }, { status: 409 });
    cambios.slug = slug;
  }
  if (typeof b.linkActivo === "boolean") {
    const { data: p } = await s.db.from("perfiles").select("premium_hasta,slug").eq("id", s.user.id).single();
    if (b.linkActivo && !premiumActivo(p?.premium_hasta, fechaEnZona(0))) return NextResponse.json({ error: "Tu premium no está activo." }, { status: 403 });
    if (b.linkActivo && !(cambios.slug || p?.slug)) return NextResponse.json({ error: "Primero elige tu link." }, { status: 400 });
    cambios.link_activo = b.linkActivo;
  }
  if (!Object.keys(cambios).length) return NextResponse.json({ ok: true });
  const { error } = await s.db.from("perfiles").update(cambios).eq("id", s.user.id);
  if (error) return NextResponse.json({ error: /perfiles_slug_idx|duplicate/i.test(error.message) ? "Ese link ya lo tiene alguien más." : error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST { referencia? } → "Ya pagué" el premium: aviso para que lo confirmes en tu panel
export async function POST(request: NextRequest) {
  const s = await sesion();
  if (!s) return sinSesion();
  const b = (await request.json().catch(() => ({}))) as { referencia?: string };
  const { data: pendiente } = await s.db.from("avisos_premium").select("id").eq("perfil_id", s.user.id).eq("estado", "pendiente").limit(1);
  if (pendiente?.length) return NextResponse.json({ error: "Ya avisaste de un pago. En cuanto se confirme, se activa tu link." }, { status: 409 });

  const precio = await precioPremium(s.db);
  const referencia = b.referencia?.trim().slice(0, 80) || null;
  const { error } = await s.db.from("avisos_premium").insert({ perfil_id: s.user.id, monto: precio, referencia });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { data: yo } = await s.db.from("perfiles").select("nombre").eq("id", s.user.id).single();
    const sitio = urlSitio(request.nextUrl.origin);
    for (const para of await correosSuperadmin(s.db)) {
      await enviarConResend({
        para,
        asunto: `Pago de premium: ${yo?.nombre ?? s.user.email}`,
        html: envolver(
          "Avisaron un pago de premium",
          `<p style="margin:0 0 8px;color:#4a4843;"><b>${esc(yo?.nombre ?? "")}</b> (${esc(s.user.email ?? "")}) dice que transfirió <b>${pesos(precio)}</b> con el concepto <b>${codigoPremium(s.user.id)}</b>${referencia ? ` · rastreo ${esc(referencia)}` : ""}.</p>
           <p style="margin:0;color:#4a4843;">Revisa tu banco y confírmalo en tu panel.</p>`,
          sitio ? { texto: "Abrir el panel", url: `${sitio}/admin` } : undefined
        ),
        texto: `${yo?.nombre ?? s.user.email} avisó pago de premium ${pesos(precio)} (${codigoPremium(s.user.id)}).`,
      });
    }
  } catch (e) {
    console.error("[premium] aviso", e);
  }
  return NextResponse.json({ ok: true });
}
