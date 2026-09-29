import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { infoEnlace } from "@/lib/registro";

export const dynamic = "force-dynamic";

// GET ?t=TOKEN → a qué agenda invita un link (para mostrarlo antes de registrarse). Sin sesión.
export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const e = await infoEnlace(createAdminClient(), t);
  if (!e) return NextResponse.json({ error: "Ese link ya no sirve: pídele a tu compañero/a uno nuevo." }, { status: 404 });
  return NextResponse.json({ agenda: e.agenda, dueno: e.dueno, ocupada: e.ocupada });
}
