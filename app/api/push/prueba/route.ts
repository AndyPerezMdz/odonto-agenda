import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST → "Mándame una de prueba"
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const n = await enviarPush(createAdminClient(), [data.user.id], { titulo: "¡Así te van a llegar!", cuerpo: "Cuando tu paciente confirme o falte una hora para tu cita, te avisamos aquí.", url: "/" });
  if (!n) return NextResponse.json({ error: "No encontramos este celular. Vuelve a activar las notificaciones." }, { status: 404 });
  return NextResponse.json({ ok: true, enviadas: n });
}
