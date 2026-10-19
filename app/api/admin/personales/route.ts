import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { urlSitio } from "@/lib/recordatorios";
import { altaPersonal, enviarEnlacePersonal, listarPersonales } from "@/lib/personalServer";

export const dynamic = "force-dynamic";

// GET → quiénes tienen agenda personal
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  try {
    return NextResponse.json({ personales: await listarPersonales(s.db) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST { email, nombre?, enviar? } → dar de alta (y, si enviar, mandarle su link de una vez)
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { email?: string; nombre?: string; enviar?: boolean };
  const r = await altaPersonal(s.db, b.email ?? "", b.nombre?.trim().slice(0, 60) || null);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  let enviado = false;
  if (b.enviar) {
    try {
      enviado = (await enviarEnlacePersonal(s.db, b.email!, urlSitio(request.nextUrl.origin), { forzar: true })) === "enviado";
    } catch (e) {
      return NextResponse.json({ ok: true, enviado: false, error: "Quedó dada de alta, pero el correo falló: " + (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, nueva: r.nueva, enviado });
}
