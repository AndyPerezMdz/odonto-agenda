"use client";

import { useEffect, useState } from "react";

// "¿Qué le falta a tu agenda?": le llega directo al staff (con tu nombre y tu agenda).
export default function Sugerencia({ onClose }: { onClose: () => void }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await fetch("/api/sugerencias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setError(d.error ?? "No se pudo enviar.");
    setListo(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-line bg-panel p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">¿Qué le falta a tu agenda?</h2>
            <p className="text-sm text-muted">Una idea, algo que te estorba o algo que no funciona. Lo leemos todo.</p>
          </div>
          <button className="btn btn-sec px-2.5" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {listo ? (
          <>
            <p className="mb-4 rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent">¡Gracias! Ya nos llegó. Si lo hacemos, sale en las Novedades.</p>
            <button className="btn btn-primario w-full" onClick={onClose}>Listo</button>
          </>
        ) : (
          <form onSubmit={enviar}>
            <textarea
              className="campo mb-1 min-h-[120px]"
              autoFocus
              maxLength={2000}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej. Que me avise cuando mi compa agende en mi horario…"
            />
            <p className="mb-3 text-xs text-muted">No escribas datos de pacientes.</p>
            {error && <p className="mb-2 text-sm text-danger">{error}</p>}
            <button className="btn btn-primario w-full" disabled={enviando || texto.trim().length < 3}>{enviando ? "Enviando…" : "Enviar"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
