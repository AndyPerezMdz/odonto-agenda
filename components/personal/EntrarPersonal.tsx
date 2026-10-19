"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/AuthCard";
import PideEnlace from "@/components/personal/PideEnlace";

/** /personal sin sesión: correo + contraseña, o pedir el link otra vez. */
export default function EntrarPersonal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "enlace") setError("Ese link ya se usó o caducó. Pide otro aquí abajo.");
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setCargando(false);
      setError("Correo o contraseña incorrectos. Si todavía no creas tu contraseña, pide tu link aquí abajo.");
      return;
    }
    window.location.replace("/personal");
  }

  return (
    <div className="mi-agenda">
      <AuthCard titulo="Mi agenda" subtitulo="Tu agenda personal: viajes, cursos, entregas y lo que tengas.">
        <form onSubmit={entrar}>
          <label className="mb-1 block text-sm font-medium" htmlFor="pe">Correo</label>
          <input id="pe" type="email" autoComplete="email" required className="campo mb-4" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="mb-1 block text-sm font-medium" htmlFor="pp">Contraseña</label>
          <input id="pp" type="password" autoComplete="current-password" required className="campo mb-5" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="mb-4 text-sm text-danger">{error}</p>}
          <button className="btn btn-primario w-full" disabled={cargando}>{cargando ? "Entrando…" : "Entrar"}</button>
        </form>
        <p className="mt-5 mb-2 text-center text-xs text-muted">¿Primera vez, o se te olvidó la contraseña?</p>
        <PideEnlace compacto />
      </AuthCard>
    </div>
  );
}
