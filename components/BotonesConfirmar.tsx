"use client";

import { useState } from "react";

// Botones del paciente: "Sí voy" / "No puedo ir". Se puede cambiar de opinión.
export default function BotonesConfirmar({ token, inicial, alumno }: { token: string; inicial: "confirmada" | "no_puede" | null; alumno: string }) {
  const [estado, setEstado] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function responder(r: "confirmada" | "no_puede") {
    setEnviando(true);
    setError(null);
    const res = await fetch("/api/confirmar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, respuesta: r }) });
    setEnviando(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "No se pudo guardar. Intenta otra vez.");
    setEstado(r);
  }

  if (estado) {
    return (
      <div>
        <p className={`mb-3 rounded-xl px-4 py-3 text-sm ${estado === "confirmada" ? "bg-[#e6f4ea] text-[#1e6b3a]" : "bg-[#fbecea] text-[#7a1f1a]"}`}>
          {estado === "confirmada" ? <>¡Listo! Ya le avisamos a {alumno} que <b>sí vas</b>. Te esperamos.</> : <>Le avisamos a {alumno} que <b>no puedes ir</b>. Te escribirá para buscar otra fecha.</>}
        </p>
        <button className="w-full text-center text-sm text-muted hover:text-ink" disabled={enviando} onClick={() => responder(estado === "confirmada" ? "no_puede" : "confirmada")}>
          {estado === "confirmada" ? "Me equivoqué, no puedo ir" : "Siempre sí puedo ir"}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <button className="btn btn-primario w-full py-3 text-base" disabled={enviando} onClick={() => responder("confirmada")}>Sí voy</button>
      <button className="btn btn-sec w-full py-3 text-base" disabled={enviando} onClick={() => responder("no_puede")}>No puedo ir</button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
