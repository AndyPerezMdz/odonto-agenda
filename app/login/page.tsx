"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/AuthCard";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Si el enlace del correo caducó, /auth/confirm nos manda aquí con ?error=enlace
  // Supabase también puede mandar el error en el #hash (p. ej. #error_code=otp_expired)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    // Plantillas de fábrica de Supabase: la sesión viene en el #hash (invitaciones y recuperación)
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    if (access_token && refresh_token) {
      const destino = h.get("type") === "invite" ? "/bienvenida" : h.get("type") === "recovery" ? "/nueva-contrasena" : "/";
      createClient()
        .auth.setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error) setError("El enlace ya caducó o ya se usó. Pide uno nuevo.");
          else window.location.replace(destino);
        });
      return;
    }

    const err = q.get("error");
    if (err === "navegador") {
      setError("Abre el enlace del correo en el mismo navegador donde lo pediste, o pide uno nuevo desde este dispositivo.");
    } else if (err === "enlace" || h.get("error_code") || h.get("error")) {
      setError("El enlace ya caducó o ya se usó. Pide uno nuevo.");
    }
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("Correo o contraseña incorrectos.");
      setCargando(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthCard titulo="Agenda de clínicas" subtitulo="Inicia sesión para ver la agenda.">
      <form onSubmit={entrar}>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="campo mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="mb-1 flex items-baseline justify-between">
          <label className="block text-sm font-medium" htmlFor="password">Contraseña</label>
          <Link href="/recuperar" className="text-xs font-medium text-accent hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          className="campo mb-5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        <button type="submit" className="btn btn-primario w-full" disabled={cargando}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
        <p className="mt-5 text-center text-xs text-muted">
          <Link href="/privacidad" className="hover:text-ink">Aviso de privacidad</Link> ·{" "}
          <Link href="/terminos" className="hover:text-ink">Términos</Link>
        </p>
      </form>
    </AuthCard>
  );
}
