import "server-only";
import webpush from "web-push";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

// Notificaciones en el celular (Web Push). Llaves en Vercel:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y (opcional) VAPID_SUBJECT = mailto:tu@correo
// Genera las llaves una vez con:  npx web-push generate-vapid-keys
export const pushActivo = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let listo = false;
function configurar() {
  if (listo) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:aperezmdz21@icloud.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  listo = true;
}

export type Aviso = { titulo: string; cuerpo: string; url?: string; etiqueta?: string };

/** Manda una notificación a todos los celulares/navegadores de esas personas. Borra suscripciones muertas. */
export async function enviarPush(db: Db, userIds: string[], a: Aviso) {
  if (!pushActivo() || !userIds.length) return 0;
  configurar();
  const { data: subs } = await db.from("push_subs").select("endpoint,p256dh,auth,user_id").in("user_id", userIds);
  let enviadas = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: a.titulo, body: a.cuerpo, url: a.url ?? "/", tag: a.etiqueta }),
          { TTL: 3600 }
        );
        enviadas++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); // ya no existe
        else console.error("[push]", code, (e as Error).message);
      }
    })
  );
  return enviadas;
}

/** ¿Esa agenda tiene Pro hoy? (en el servidor) */
export function proHoy(pagadoHasta: string | null | undefined, hoy: string) {
  return !pagadoHasta || pagadoHasta >= hoy;
}
