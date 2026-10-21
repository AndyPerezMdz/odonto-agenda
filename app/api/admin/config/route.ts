import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { normalizarPlanes } from "@/lib/precios";
import { normalizarPlanesMi } from "@/lib/planMi";

export const dynamic = "force-dynamic";

// GET → tus datos bancarios y los precios por universidad
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const [{ data }, { data: precios }, { data: preciosMi }] = await Promise.all([
    s.db.from("configuracion").select("valor").eq("clave", "pago").maybeSingle(),
    s.db.from("configuracion").select("valor").eq("clave", "planes").maybeSingle(),
    s.db.from("configuracion").select("valor").eq("clave", "planes_mi").maybeSingle(),
  ]);
  return NextResponse.json({ pago: data?.valor ?? {}, planes: normalizarPlanes(precios?.valor), planesMi: normalizarPlanesMi(preciosMi?.valor) });
}

// PUT { banco, clabe, titular } → actualizarlos (se ven al instante en todas las agendas)
export async function PUT(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { banco?: string; clabe?: string; titular?: string; planes?: unknown; planesMi?: unknown };

  // 2.3 · { planesMi } → planes y precios de Mi agenda
  if (b.planesMi !== undefined) {
    const { error } = await s.db.from("configuracion").upsert({ clave: "planes_mi", valor: normalizarPlanesMi(b.planesMi) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // { planes } → planes y precios por universidad (el mensual también es el de las agendas NUEVAS)
  if (b.planes !== undefined) {
    const { error } = await s.db.from("configuracion").upsert({ clave: "planes", valor: normalizarPlanes(b.planes) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const clabe = (b.clabe ?? "").replace(/\D/g, "");
  if (clabe && clabe.length !== 18) return NextResponse.json({ error: "La CLABE debe tener 18 dígitos." }, { status: 400 });

  const valor = { banco: b.banco?.trim() ?? "", clabe, titular: b.titular?.trim() ?? "" };
  const { error } = await s.db.from("configuracion").upsert({ clave: "pago", valor });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
