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

/** Brave y Opera traen el botón de dictado del navegador, pero no funciona (Google no les presta el reconocimiento). */
const sinDictado = () => {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { brave?: unknown };
  return !!n.brave || /\bOPR\/|\bOpera\b|OPX\//.test(navigator.userAgent);
};
/** El dictado del sistema, que funciona en cualquier campo y cualquier navegador. */
const atajoSistema = () => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Android|iPhone|iPad/.test(ua)) return "Usa el micrófono de tu teclado: toca el campo y luego el 🎤 del teclado.";
  if (/Mac/.test(ua)) return "Usa el dictado de tu Mac: toca el campo y presiona dos veces la tecla Fn (🌐).";
  if (/Windows/.test(ua)) return "Usa el dictado de Windows: toca el campo y presiona Windows + H. Funciona en cualquier navegador.";
  return "Usa el dictado de tu sistema o del teclado.";
};

export default function BotonVoz({ valor, onCambio, onListo, className = "" }: { valor: string; onCambio: (t: string) => void; onListo?: (t: string) => void; className?: string }) {
  const [puede, setPuede] = useState(false);
  const [oyendo, setOyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocimiento | null>(null);
  const ultimo = useRef("");
  const oyo = useRef(false); // ¿llegó algo de texto?
  useEffect(() => setPuede(!!ctor()), []);
  useEffect(() => () => rec.current?.abort(), []);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(t);
  }, [error]);
  if (!puede) return null;

  function empezar() {
    const C = ctor();
    if (!C) return;
    if (oyendo) return rec.current?.stop();
    setError(null);
    // En Brave / Opera el micro se prende pero nunca llega texto: mejor decirlo de una vez
    if (sinDictado()) return setError(`Este navegador no trae dictado. ${atajoSistema()} O abre tu agenda en Chrome o Edge.`);
    const r = new C();
    r.lang = "es-MX";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    const base = valor.trim() ? `${valor.trim()} ` : "";
    r.onresult = (e) => {
      oyo.current = true;
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      ultimo.current = (base + t.trim()).replace(/\s+/g, " ");
      onCambio(ultimo.current);
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        // Pide el permiso del micro de forma explícita (sale el aviso del navegador) y que lo vuelva a tocar
        navigator.mediaDevices
          ?.getUserMedia({ audio: true })
          .then((m) => { m.getTracks().forEach((t) => t.stop()); setError("Listo, ya hay permiso. Toca el micro otra vez."); })
          .catch(() => setError("El micro está bloqueado para esta página: toca el candadito junto a la dirección → Micrófono → Permitir."));
        return;
      }
      setError(
        e.error === "no-speech" ? "No te oí. Toca y habla otra vez."
        : e.error === "audio-capture" ? "No encuentro tu micrófono. Revisa que esté conectado."
        : e.error === "network" ? `Este navegador no trae dictado. ${atajoSistema()}`
        : e.error === "language-not-supported" ? "Tu navegador no dicta en español."
        : `No se pudo dictar (${e.error}).`
      );
    };
    r.onend = () => {
      setOyendo(false);
      // Se prendió y se apagó sin texto (pasa en navegadores sin dictado de verdad)
      if (!oyo.current) setError((x) => x ?? `No me llegó nada. ${atajoSistema()}`);
      if (ultimo.current) onListo?.(ultimo.current);
    };
    ultimo.current = "";
    oyo.current = false;
    rec.current = r;
    try {
      r.start();
      setOyendo(true);
    } catch {
      setOyendo(false);
      setError("No se pudo prender el micro. Intenta otra vez.");
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
      {error && <span role="status" onClick={() => setError(null)} className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] leading-snug text-panel shadow-lg">{error}</span>}
    </span>
  );
}
