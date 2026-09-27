import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { correoValido } from "@/lib/invitar";
import { pruebaDe, usuarioPorCorreo } from "@/lib/pruebas";

export const dynamic = "force-dynamic";

// GET ?email= → ¿ya usó su mes gratis? ¿ya tiene cuenta? (para avisarte al crear una agenda)
export async function GET(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!correoValido(email)) return NextResponse.json({ valido: false });

  const [p, u] = await Promise.all([pruebaDe(s.db, email), usuarioPorCorreo(s.db, email)]);
  let agenda: string | null = null;
  if (p?.agenda_id) {
    const { data } = await s.db.from("agendas").select("nombre").eq("id", p.agenda_id).maybeSingle();
    agenda = data?.nombre ?? "una agenda ya borrada";
  }
  return NextResponse.json({
    valido: true,
    pruebaUsada: !!p?.usada_at,
    usadaEl: p?.usada_at ?? null,
    agenda,
    tieneCuenta: !!u,
  });
}
