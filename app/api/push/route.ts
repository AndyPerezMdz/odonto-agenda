import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushActivo } from "@/lib/push";

export const dynamic = "force-dynamic";

async function usuario() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// POST { endpoint, keys: { p256dh, auth } } → guardar este celular para notificaciones
export async function POST(request: NextRequest) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  if (!pushActivo()) return NextResponse.json({ error: "Las notificaciones todavía no están configuradas." }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!b.endpoint?.startsWith("https://") || !b.keys?.p256dh || !b.keys?.auth) return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  const { error } = await createAdminClient().from("push_subs").upsert({ endpoint: b.endpoint, user_id: u.id, p256dh: b.keys.p256dh, auth: b.keys.auth });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE { endpoint } → ya no avisar a este celular
export async function DELETE(request: NextRequest) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await createAdminClient().from("push_subs").delete().eq("endpoint", endpoint).eq("user_id", u.id);
  return NextResponse.json({ ok: true });
}
