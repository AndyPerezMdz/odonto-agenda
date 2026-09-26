"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/AuthCard";

// Sirve para dos cosas: terminar el "olvidé mi contraseña"
// y cambiarla estando dentro (desde Personalizar).
export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Usa al menos 8 caracteres.");
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");

    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setCargando(false);

    if (error) {
      if (error.code === "same_password") setError("Es la misma contraseña que ya tenías. Elige otra.");
      else if (error.code === "weak_password") setError("Esa contraseña es muy débil. Prueba una más larga.");
      else if (error.status === 401 || error.code === "session_not_found")
        setError("Tu enlace ya caducó. Pide uno nuevo desde “¿Olvidaste tu contraseña?”.");
      else setError("No se pudo cambiar: " + error.message);
      return;
    }
    setListo(true);
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1500);
  }

  if (listo) {
    return (
      <AuthCard titulo="¡Contraseña actualizada!" subtitulo="Te llevamos a la agenda…">
        <Link href="/" className="btn btn-primario w-full">Ir a la agenda</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard titulo="Nueva contraseña" subtitulo="Elige una contraseña de al menos 8 caracteres.">
      <form onSubmit={guardar}>
        <label className="mb-1 block text-sm font-medium" htmlFor="pw">Nueva contraseña</label>
        <input
          id="pw"
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          required
          autoFocus
          className="campo mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="mb-1 block text-sm font-medium" htmlFor="pw2">Repítela</label>
        <input
          id="pw2"
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          required
          className="campo mb-3"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
        <label className="mb-5 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
          Mostrar contraseña
        </label>
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primario w-full" disabled={cargando}>
          {cargando ? "Guardando…" : "Guardar contraseña"}
        </button>
        <Link href="/" className="mt-4 block text-center text-sm text-muted hover:text-ink">Cancelar</Link>
      </form>
    </AuthCard>
  );
}
