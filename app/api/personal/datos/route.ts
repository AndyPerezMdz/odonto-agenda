import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { personalDe } from "@/lib/personalServer";
import { borrarMiAgenda, exportarMiAgenda } from "@/lib/miDatos";
import { libroXlsx } from "@/lib/xlsx";
import { fechaEnZona } from "@/lib/recordatorios";
import { paginaMiAgenda, tablasMiAgenda, type DatosExportados } from "@/lib/miExport";

export const dynamic = "force-dynamic";

async function sesion() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const db = createAdminClient();
  if (!(await personalDe(db, data.user.id))) return null;
  return { user: data.user, db, supabase };
}

// GET ?formato=xlsx | html | json → descargar todos tus datos de Mi agenda
//   xlsx: Excel, una hoja por cosa · html: para leer o guardar como PDF · json: respaldo técnico completo
export async function GET(request: NextRequest) {
  const s = await sesion();
  if (!s) return NextResponse.json({ error: "Esta cuenta no tiene Mi agenda." }, { status: 403 });
  const datos = await exportarMiAgenda(s.db, s.user.id, s.user.email ?? null);
  const formato = request.nextUrl.searchParams.get("formato") ?? "json";
  const dia = fechaEnZona(0); // el día en Mérida (no en UTC)
  if (formato === "xlsx") {
    const libro = libroXlsx(tablasMiAgenda(datos as unknown as DatosExportados, dia));
    return new NextResponse(libro as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mi-agenda-${dia}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (formato === "html") {
    return new NextResponse(paginaMiAgenda(datos as unknown as DatosExportados, dia), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  }
  return new NextResponse(JSON.stringify(datos, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mi-agenda-${dia}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

// DELETE { confirmar: "BORRAR" } → borra tu Mi agenda (y tu cuenta, si no usas la de clínicas)
export async function DELETE(request: NextRequest) {
  const s = await sesion();
  if (!s) return NextResponse.json({ error: "Esta cuenta no tiene Mi agenda." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { confirmar?: string };
  if (b.confirmar !== "BORRAR") return NextResponse.json({ error: "Escribe BORRAR para confirmar." }, { status: 400 });
  const r = await borrarMiAgenda(s.db, s.user.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  if (r.cuentaBorrada) await s.supabase.auth.signOut().catch(() => {});
  const res = NextResponse.json({ ok: true, cuentaBorrada: r.cuentaBorrada });
  res.cookies.set("ultima_agenda", "clinicas", { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
