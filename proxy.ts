import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase/env";

// Rutas que se pueden ver SIN sesión
const PUBLICAS = ["/login", "/recuperar", "/auth"];
// Rutas que un usuario YA logueado no necesita ver
const SOLO_INVITADOS = ["/login", "/recuperar"];

const empiezaCon = (path: string, lista: string[]) =>
  lista.some((p) => path === p || path.startsWith(p + "/"));

// Refresca la sesión en cada request y saca a quien no esté logueado.
export async function proxy(request: NextRequest) {
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
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !empiezaCon(path, PUBLICAS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && empiezaCon(path, SOLO_INVITADOS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)"],
};
