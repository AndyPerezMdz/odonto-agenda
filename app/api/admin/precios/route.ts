import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { preciosConfig } from "@/lib/universidadesServer";

export const dynamic = "force-dynamic";

// POST { universidad } → aplica el precio mensual de esa universidad a TODAS sus agendas (menos las de cortesía)
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { universidad } = (await request.json().catch(() => ({}))) as { universidad?: string };
  if (universidad !== "upp" && universidad !== "uady") return NextResponse.json({ error: "Universidad inválida." }, { status: 400 });
  const precio = (await preciosConfig(s.db))[universidad].mensual;
  const { data, error } = await s.db
    .from("agendas")
    .update({ precio_mensual: precio })
    .eq("universidad", universidad)
    .not("pagado_hasta", "is", null) // cortesía (sin fecha) no se toca
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, agendas: data?.length ?? 0, precio });
}
