"use client";

import { useEffect, useRef, useState } from "react";

// 3.0 · Dictar por voz (el reconocimiento del navegador, en español de México). Si el navegador no puede, no aparece.

type Reconocimiento = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};
type Ctor = new () => Reconocimiento;
const ctor = (): Ctor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export default function BotonVoz({ valor, onCambio, onListo, className = "" }: { valor: string; onCambio: (t: string) => void; onListo?: (t: string) => void; className?: string }) {
  const [puede, setPuede] = useState(false);
  const [oyendo, setOyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocimiento | null>(null);
  const ultimo = useRef("");
  useEffect(() => setPuede(!!ctor()), []);
  useEffect(() => () => rec.current?.abort(), []);
  if (!puede) return null;

  function empezar() {
    const C = ctor();
    if (!C) return;
    if (oyendo) return rec.current?.stop();
    setError(null);
    const r = new C();
    r.lang = "es-MX";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    const base = valor.trim() ? `${valor.trim()} ` : "";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      ultimo.current = (base + t.trim()).replace(/\s+/g, " ");
      onCambio(ultimo.current);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Dale permiso al micrófono." : e.error === "no-speech" ? "No te oí. Otra vez." : null);
    r.onend = () => {
      setOyendo(false);
      if (ultimo.current) onListo?.(ultimo.current);
    };
    ultimo.current = "";
    rec.current = r;
    try {
      r.start();
      setOyendo(true);
    } catch {
      setOyendo(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={empezar}
        aria-label={oyendo ? "Dejar de escuchar" : "Dictar por voz"}
        aria-pressed={oyendo}
        title={oyendo ? "Te escucho… toca para terminar" : "Dictar por voz"}
        className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border transition ${oyendo ? "animate-pulse border-transparent bg-danger text-white" : "border-line bg-panel text-muted hover:text-ink"} ${className}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3" />
        </svg>
      </button>
      {error && <span role="status" className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-panel">{error}</span>}
    </span>
  );
}
