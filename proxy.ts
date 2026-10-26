import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase/env";

// Rutas que se pueden ver SIN sesión
const PUBLICAS = ["/login", "/recuperar", "/registro", "/api/registro", "/api/alerta-correo", "/auth", "/api/recordatorios", "/privacidad", "/terminos", "/novedades", "/confirmar", "/api/confirmar", "/api/mp", "/api/cal", "/api/push/citas", "/api/push/resumen", "/api/push/recordatorios", "/api/entrar", "/sw.js", "/mi-agenda"]; // la API valida su propio acceso
// Rutas que un usuario YA logueado no necesita ver
const SOLO_INVITADOS = ["/login", "/recuperar"];

const empiezaCon = (path: string, lista: string[]) =>
  lista.some((p) => path === p || path.startsWith(p + "/"));

/** Si la visita llega a *.vercel.app en producción y ya hay dominio propio (NEXT_PUBLIC_SITE_URL), a dónde mandarla. */
function aDondeMudar(request: NextRequest): string | null {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL;
  if (!sitio || process.env.VERCEL_ENV !== "production") return null;
  let canon: URL;
  try { canon = new URL(sitio); } catch { return null; }
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host.endsWith(".vercel.app") || canon.host.endsWith(".vercel.app")) return null;
  const path = request.nextUrl.pathname;
  if (empiezaCon(path, ["/api", "/sw.js", "/.well-known"])) return null;
  return `${canon.origin}${path}${request.nextUrl.search}`;
}

// Refresca la sesión en cada request y saca a quien no esté logueado.
export async function proxy(request: NextRequest) {
  // 3.3 · Mudanza a laagendita.app: la dirección vieja (*.vercel.app) manda a la nueva.
  // Menos /api (calendarios ya suscritos, crons, webhooks), /sw.js (avisos ya activados) y /.well-known.
  const mudanza = aDondeMudar(request);
  if (mudanza) return NextResponse.redirect(mudanza, 308);

  // Diagnóstico: si faltan variables, dilo claro en vez de tronar con un 500 mudo
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const faltan = [
      !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
      !SUPABASE_KEY && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].filter(Boolean);
    return new NextResponse(
      `Faltan variables de entorno en Vercel: ${faltan.join(", ")}. Agrégalas y haz Redeploy.`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  try {
    return await sesion(request);
  } catch (e) {
    console.error("[proxy]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Error en proxy: ${msg}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function sesion(request: NextRequest) {
  // Si un link de correo cae en otra ruta (p. ej. la raíz porque Supabase
  // redirigió al Site URL), lo mandamos a /auth/confirm con sus parámetros.
  const q = request.nextUrl.searchParams;
  if (!request.nextUrl.pathname.startsWith("/auth/") && (q.get("code") || q.get("token_hash"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    if (!url.searchParams.get("next")) url.searchParams.set("next", "/nueva-contrasena");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // 3.4 · Que no te saque nomás porque la señal falló: si trae su sesión y Supabase no contestó
  // (red o servidor caído), se deja pasar en vez de mandarla al login. Sólo se saca si la sesión de veras no sirve.
  const llaves = request.cookies.getAll().filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
  const fallaDeRed = !user && !!error && llaves.length > 0 && (error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500);

  // 3.4 · Safari (sobre todo instalada en inicio) borra a los 7 días las cookies que escribe JavaScript.
  // Cada vez que abres la agenda, el servidor vuelve a poner las de la sesión con vigencia larga.
  if (user) {
    for (const c of llaves) {
      if (response.cookies.get(c.name)) continue; // ya se renovó arriba
      response.cookies.set(c.name, c.value, { path: "/", maxAge: 400 * 24 * 60 * 60, sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
    }
  }

  if (!user && !fallaDeRed && !empiezaCon(path, PUBLICAS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/personal" || path.startsWith("/personal/") ? "?a=mi" : path === "/clinicas/nueva" ? "?next=/clinicas/nueva" : ""; // Mi agenda: su propio login · 3.1: volver a abrir su agenda de clínicas
    return NextResponse.redirect(url);
  }

  if (user && empiezaCon(path, SOLO_INVITADOS)) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.searchParams.get("a") === "mi" ? "/personal" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|webmanifest)$).*)"],
};
