"use client";

import { useState } from "react";

/** "¿Tienes agenda propia?" → pide el link por correo. Siempre contesta lo mismo (no revela quién tiene agenda). */
export default function PideEnlace({ abierto: inicial = false, compacto = false }: { abierto?: boolean; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(inicial);
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "listo" | string>("");

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    const r = await fetch("/api/personal/enlace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }).catch(() => null);
    setEstado(r?.ok ? "listo" : "No se pudo. Revisa tu conexión e intenta otra vez.");
  }

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`w-full rounded-xl border border-dashed border-line px-3 py-2.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent ${compacto ? "" : "mt-4"}`}>
        ¿Tienes agenda propia?
      </button>
    );

  if (estado === "listo")
    return (
      <div className={`rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent ${compacto ? "" : "mt-4"}`}>
        Si <b>{email.trim()}</b> tiene agenda propia, ya te llegó un correo con tu link para entrar. Revisa también Spam. Si no te llega nada, es que ese correo no tiene agenda propia.
      </div>
    );

  return (
    <form onSubmit={pedir} className={`rounded-xl border border-line p-3 ${compacto ? "" : "mt-4"}`}>
      <p className="mb-2 text-sm font-medium">Tu agenda propia</p>
      <p className="mb-3 text-xs text-muted">Escribe el correo con el que te dieron de alta y te mandamos tu link para entrar.</p>
      <input type="email" required autoComplete="email" className="campo mb-3" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {estado && estado !== "enviando" && <p className="mb-2 text-sm text-danger">{estado}</p>}
      <button className="btn btn-sec w-full" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Mándame mi link"}</button>
    </form>
  );
}
