import { NextResponse, type NextRequest } from "next/server";
import { superadminEnSesion } from "@/lib/admin";
import { correoAnuncio } from "@/lib/staff";
import { urlSitio } from "@/lib/recordatorios";

export const dynamic = "force-dynamic";

// GET → tus anuncios
export async function GET() {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { data, error } = await s.db.from("anuncios").select("id,titulo,texto,universidad,hasta,activo,correos,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ anuncios: data ?? [] });
}

// POST { titulo, texto, universidad, hasta?, correo? } → publica (y si quieres, manda correo a todos)
export async function POST(request: NextRequest) {
  const s = await superadminEnSesion();
  if (!s) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { titulo?: string; texto?: string; universidad?: string; hasta?: string | null; correo?: boolean };
  const titulo = b.titulo?.trim().slice(0, 80) ?? "";
  const texto = b.texto?.trim().slice(0, 600) ?? "";
  const universidad = ["todas", "upp", "uady"].includes(b.universidad ?? "") ? b.universidad! : "todas";
  const hasta = b.hasta && /^\d{4}-\d{2}-\d{2}$/.test(b.hasta) ? b.hasta : null;
  if (!titulo || !texto) return NextResponse.json({ error: "Falta título o texto." }, { status: 400 });

  const { data, error } = await s.db.from("anuncios").insert({ titulo, texto, universidad, hasta }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let correos = 0;
  let errorCorreo: string | null = null;
  if (b.correo) {
    try {
      correos = await correoAnuncio(s.db, { titulo, texto, universidad }, urlSitio(request.nextUrl.origin));
      await s.db.from("anuncios").update({ correos }).eq("id", data.id);
    } catch (e) {
      errorCorreo = e instanceof Error ? e.message : String(e);
    }
  }
  return NextResponse.json({ ok: true, correos, errorCorreo });
}
