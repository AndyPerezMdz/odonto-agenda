import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";

type Db = ReturnType<typeof createAdminClient>;

/** 3.5 · Último fallo de correo que vimos (para el panel de Salud). */
export type FalloCorreo = { at: string; origen: string; detalle: string; n: number; avisado_at?: string };

const CLAVE = "alerta:correo";
const CADA = 60 * 60 * 1000; // no más de un push por hora

/**
 * 3.5 · Algo no se pudo mandar por correo (Resend rebotó, o Supabase no pudo mandar el código).
 * Se apunta en configuración y a los superadmins les llega un push (máximo uno por hora). Nunca truena.
 */
export async function alertaCorreo(db: Db, origen: string, detalle: string) {
  try {
    const { data } = await db.from("configuracion").select("valor").eq("clave", CLAVE).maybeSingle();
    const antes = (data?.valor ?? null) as FalloCorreo | null;
    const ahora = new Date();
    const reciente = antes && ahora.getTime() - new Date(antes.at).getTime() < 24 * 3600000;
    const avisar = !antes?.avisado_at || ahora.getTime() - new Date(antes.avisado_at).getTime() > CADA;
    const nuevo: FalloCorreo = {
      at: ahora.toISOString(),
      origen: origen.slice(0, 60),
      detalle: detalle.replace(/\s+/g, " ").slice(0, 300),
      n: (reciente ? antes!.n : 0) + 1,
      avisado_at: avisar ? ahora.toISOString() : antes?.avisado_at,
    };
    await db.from("configuracion").upsert({ clave: CLAVE, valor: nuevo });
    if (!avisar) return;
    const { data: jefes } = await db.from("superadmins").select("user_id");
    const ids = (jefes ?? []).map((x) => x.user_id as string);
    if (ids.length)
      await enviarPush(db, ids, {
        titulo: "⚠️ Están fallando los correos",
        cuerpo: `${nuevo.origen}: ${nuevo.detalle.slice(0, 140)}`,
        url: "/admin",
        etiqueta: "alerta-correo",
      });
  } catch {}
}

export async function ultimoFalloCorreo(db: Db): Promise<FalloCorreo | null> {
  const { data } = await db.from("configuracion").select("valor").eq("clave", CLAVE).maybeSingle();
  return (data?.valor ?? null) as FalloCorreo | null;
}
