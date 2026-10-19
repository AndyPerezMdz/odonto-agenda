"use client";

import { useState } from "react";
import AuthCard from "@/components/AuthCard";

/** Primera entrada: la contraseña es obligatoria (con ella entra desde cualquier lado). */
export default function CrearPassword({ nombre, email }: { nombre: string; email: string }) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Que tenga al menos 8 caracteres.");
    if (password !== confirmar) return setError("No coinciden.");
    setCargando(true);
    const r = await fetch("/api/personal/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setCargando(false);
      return setError(d.error ?? "No se pudo guardar.");
    }
    window.location.replace("/personal");
  }

  return (
    <div className="mi-agenda">
      <AuthCard titulo={`¡Hola${nombre ? `, ${nombre}` : ""}!`} subtitulo="Antes de entrar, crea tu contraseña. Es importante: con ella entras desde cualquier cel o compu.">
        <form onSubmit={guardar}>
          <p className="mb-4 rounded-lg bg-panel-2 px-3 py-2 text-sm">Tu correo: <b>{email}</b></p>
          <label className="mb-1 block text-sm font-medium" htmlFor="np">Contraseña</label>
          <input id="np" type={ver ? "text" : "password"} autoComplete="new-password" required className="campo mb-3" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="mb-1 block text-sm font-medium" htmlFor="nc">Repítela</label>
          <input id="nc" type={ver ? "text" : "password"} autoComplete="new-password" required className="campo mb-3" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          <label className="mb-4 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Ver contraseña
          </label>
          {error && <p className="mb-4 text-sm text-danger">{error}</p>}
          <button className="btn btn-primario w-full" disabled={cargando}>{cargando ? "Guardando…" : "Guardar y entrar"}</button>
          <p className="mt-4 text-center text-xs text-muted">Tip: guarda esta página en favoritos o instálala en tu cel. Tu agenda vive en <b>/personal</b>.</p>
        </form>
      </AuthCard>
    </div>
  );
}
