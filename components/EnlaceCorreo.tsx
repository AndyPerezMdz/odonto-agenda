"use client";

import { useState } from "react";

/** "Entrar con un link a mi correo": para quien no tiene (o no recuerda) su contraseña. */
export default function EnlaceCorreo({ correoInicial = "" }: { correoInicial?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState(correoInicial);
  const [estado, setEstado] = useState<"" | "enviando" | "listo" | string>("");

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const r = await fetch("/api/entrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }).catch(() => null);
    setEstado(r?.ok ? "listo" : "No se pudo. Revisa tu conexión e intenta otra vez.");
  }

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mt-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent">
        Entrar con un link a mi correo
      </button>
    );

  if (estado === "listo")
    return (
      <div className="mt-3 rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent">
        Si <b>{email.trim()}</b> tiene cuenta, ya te llegó un correo con tu link para entrar. Revisa también Spam.
      </div>
    );

  return (
    <form onSubmit={pedir} className="mt-3 rounded-xl border border-line p-3">
      <p className="mb-1 text-sm font-medium">Te mandamos un link para entrar</p>
      <p className="mb-3 text-xs text-muted">Sirve si olvidaste tu contraseña o si es tu primera vez en Mi agenda.</p>
      <input type="email" required autoComplete="email" className="campo mb-3" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {estado && estado !== "enviando" && <p className="mb-2 text-sm text-danger">{estado}</p>}
      <button className="btn btn-sec w-full" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Mándame el link"}</button>
    </form>
  );
}
