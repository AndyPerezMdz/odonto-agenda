import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET → tus datos bancarios
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { data } = await s.db.from("configuracion").select("valor").eq("clave", "pago").maybeSingle();
  return NextResponse.json({ pago: data?.valor ?? {} });
}

// PUT { banco, clabe, titular } → actualizarlos (se ven al instante en todas las agendas)
export async function PUT(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { banco?: string; clabe?: string; titular?: string };
  const clabe = (b.clabe ?? "").replace(/\D/g, "");
  if (clabe && clabe.length !== 18) return NextResponse.json({ error: "La CLABE debe tener 18 dígitos." }, { status: 400 });

  const valor = { banco: b.banco?.trim() ?? "", clabe, titular: b.titular?.trim() ?? "" };
  const { error } = await s.db.from("configuracion").upsert({ clave: "pago", valor });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
