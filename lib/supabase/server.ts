import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
          }
        },
      },
    }
  );
}

/** 3.4 · getUser() con un par de reintentos si lo que falló fue la red (para no mandar al login por un tropiezo de señal). */
export async function usuarioConReintento(supabase: Awaited<ReturnType<typeof createClient>>) {
  let r = await supabase.auth.getUser();
  for (let i = 0; i < 2 && !r.data.user && r.error && (r.error.name === "AuthRetryableFetchError" || !r.error.status || r.error.status >= 500); i++) {
    await new Promise((ok) => setTimeout(ok, 400 * (i + 1)));
    r = await supabase.auth.getUser();
  }
  return r;
}
