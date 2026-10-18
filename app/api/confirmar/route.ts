import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { citaPorToken } from "@/lib/confirmar";
import { enviarPush } from "@/lib/push";
import { fechaLarga } from "@/lib/fechas";

export const dynamic = "force-dynamic";

// POST { token, respuesta: confirmada | no_puede } → lo responde el PACIENTE (sin sesión) desde su link
export async function POST(request: NextRequest) {
  const { token, respuesta } = (await request.json().catch(() => ({}))) as { token?: string; respuesta?: string };
  if (respuesta !== "confirmada" && respuesta !== "no_puede") return NextResponse.json({ error: "Respuesta inválida." }, { status: 400 });
  const db = createAdminClient();
  const c = await citaPorToken(db, token ?? "");
  if (!c) return NextResponse.json({ error: "Este link ya no sirve." }, { status: 404 });
  if (c.pasada) return NextResponse.json({ error: "Esta cita ya pasó." }, { status: 409 });
  const cambio = c.confirmacion !== respuesta;
  const { error } = await db.from("citas").update({ confirmacion: respuesta, confirmacion_at: new Date().toISOString() }).eq("id", c.id);
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });

  // Aviso al celular de quien atiende
  if (cambio) {
    await enviarPush(db, [c.owner_id], {
      titulo: respuesta === "confirmada" ? `${c.paciente} confirmó ✓` : `${c.paciente} no puede ir`,
      cuerpo: `${fechaLarga(c.fecha)} a las ${c.hora}${c.clinica ? ` · ${c.clinica}` : ""}`,
      url: `/?dia=${c.fecha}`,
      etiqueta: `confirmacion-${c.id}`,
    }).catch((e) => console.error("[confirmar] push", e));
  }
  return NextResponse.json({ ok: true });
}
