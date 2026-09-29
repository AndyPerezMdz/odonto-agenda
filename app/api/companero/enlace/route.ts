import { NextResponse, type NextRequest } from "next/server";
import { duenoEnSesion } from "@/lib/companero";
import { nuevoToken } from "@/lib/registro";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

const soloDueno = () => NextResponse.json({ error: "Sólo el dueño de la agenda puede invitar." }, { status: 403 });
const url = (sitio: string, token: string) => `${sitio}/registro?unir=${token}`;

// GET → el link actual para invitar al compañero/a (lo crea si no hay)
export async function GET(request: NextRequest) {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  const { data } = await s.db.from("enlaces_union").select("token").eq("agenda_id", s.agendaId).maybeSingle();
  let token = data?.token as string | undefined;
  if (!token) {
    token = nuevoToken();
    const { error } = await s.db.from("enlaces_union").insert({ agenda_id: s.agendaId, token });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ url: url(urlSitio(request.nextUrl.origin), token) });
}

// POST → link nuevo (el anterior deja de servir)
export async function POST(request: NextRequest) {
  const s = await duenoEnSesion();
  if (!s) return soloDueno();
  const token = nuevoToken();
  const { error } = await s.db.from("enlaces_union").upsert({ agenda_id: s.agendaId, token, created_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: url(urlSitio(request.nextUrl.origin), token) });
}
