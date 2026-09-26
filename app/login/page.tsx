"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

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
    <main className="grid min-h-dvh place-items-center px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-7 shadow-sm"
      >
        <div className="mb-6">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Agenda de clínicas</h1>
          <p className="mt-1 text-sm text-muted">Inicia sesión para ver la agenda.</p>
        </div>

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

        <label className="mb-1 block text-sm font-medium" htmlFor="password">Contraseña</label>
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
    </main>
  );
}
