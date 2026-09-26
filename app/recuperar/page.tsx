"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/AuthCard";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/nueva-contrasena`,
    });
    setCargando(false);
    if (error) {
      setError(
        error.status === 429
          ? "Se pidieron demasiados correos. Espera unos minutos e inténtalo de nuevo."
          : "No se pudo enviar el correo. Inténtalo más tarde."
      );
      return;
    }
    // Por seguridad no decimos si el correo existe o no
    setEnviado(true);
  }

  if (enviado) {
    return (
      <AuthCard titulo="Revisa tu correo" subtitulo={`Si ${email.trim()} tiene cuenta, te llegará un enlace para elegir una nueva contraseña.`}>
        <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Puede tardar un par de minutos.</li>
          <li>Revisa también la carpeta de spam.</li>
          <li>El enlace sólo sirve una vez y caduca en 1 hora.</li>
        </ul>
        <Link href="/login" className="btn btn-sec w-full">Volver a iniciar sesión</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard titulo="¿Olvidaste tu contraseña?" subtitulo="Escribe tu correo y te mandamos un enlace para crear una nueva.">
      <form onSubmit={enviar}>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          className="campo mb-5"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primario w-full" disabled={cargando}>
          {cargando ? "Enviando…" : "Enviar enlace"}
        </button>
        <Link href="/login" className="mt-4 block text-center text-sm text-muted hover:text-ink">
          ‹ Volver a iniciar sesión
        </Link>
      </form>
    </AuthCard>
  );
}
