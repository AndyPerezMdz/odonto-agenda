"use client";

import { useState } from "react";

/** 2.3 · "Activar mi agenda": crea la Mi agenda de quien ya tiene sesión y lo lleva a ella. */
export default function BotonActivar({ texto = "Activar mi agenda", className = "btn btn-primario w-full" }: { texto?: string; className?: string }) {
  const [estado, setEstado] = useState<"" | "activando">("");
  const [error, setError] = useState<string | null>(null);
  async function activar() {
    setEstado("activando");
    setError(null);
    const r = await fetch("/api/personal/activar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setEstado("");
      return setError(d.error ?? "No se pudo activar. Intenta otra vez.");
    }
    window.location.href = "/personal";
  }
  return (
    <>
      <button onClick={activar} disabled={estado === "activando"} className={className}>{estado === "activando" ? "Activando…" : texto}</button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}
