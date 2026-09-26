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
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "enlace") {
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
      </form>
    </AuthCard>
  );
}
