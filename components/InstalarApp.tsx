"use client";

import { useEffect, useState } from "react";

const CLAVE = "instalar-oculto";
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Aviso en el celular para agregar la agenda a la pantalla de inicio (se abre como app).
export default function InstalarApp() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    let oculto = false;
    try { oculto = localStorage.getItem(CLAVE) === "1"; } catch {}
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const movil = window.matchMedia("(max-width: 1023px)").matches && "ontouchstart" in window;
    if (oculto || instalada || !movil) return;

    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(esIos);
    if (esIos) setVisible(true);

    const alPoder = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", alPoder);
    return () => window.removeEventListener("beforeinstallprompt", alPoder);
  }, []);

  function cerrar() {
    try { localStorage.setItem(CLAVE, "1"); } catch {}
    setVisible(false);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice.catch(() => null);
    cerrar();
  }

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-line bg-panel p-3">
      <img src="/icon-192.png" alt="" width={40} height={40} className="shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Tenla como app en tu cel</p>
        {ios ? (
          <p className="text-muted">
            Toca <b className="text-ink">Compartir</b>{" "}
            <svg className="inline -mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>{" "}
            y luego <b className="text-ink">Agregar a inicio</b>.
          </p>
        ) : (
          <p className="text-muted">Se abre desde tu pantalla de inicio, sin buscarla en el navegador.</p>
        )}
        {evento && (
          <button onClick={instalar} className="btn btn-primario mt-2 py-1.5 text-sm">Instalar</button>
        )}
      </div>
      <button onClick={cerrar} className="btn btn-sec shrink-0 px-2 py-0.5 text-xs" aria-label="No mostrar otra vez">✕</button>
    </div>
  );
}
