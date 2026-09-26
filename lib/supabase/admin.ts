import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Cliente con la SECRET key: se salta RLS. SÓLO se usa en el servidor
// (cron de recordatorios). Nunca lo importes desde un componente "use client".
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Falta la variable SUPABASE_SECRET_KEY en Vercel.");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
