"use client";

import { useEffect, useState } from "react";
import { useInstalar, type Plataforma } from "@/lib/instalar";

const CLAVE = "instalar-oculto";

const IcoCompartir = () => (
  <svg className="inline -mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>
);

/** Pasos para cada plataforma, por si el navegador no ofrece el botón de instalar. */
function Pasos({ plataforma }: { plataforma: Plataforma }) {
  if (plataforma === "ios")
    return (
      <ol className="list-decimal space-y-1 pl-5">
        <li>Ábrela en <b className="text-ink">Safari</b>.</li>
        <li>Toca <b className="text-ink">Compartir</b> <IcoCompartir /> (abajo al centro).</li>
        <li>Baja y elige <b className="text-ink">Agregar a inicio</b>.</li>
      </ol>
    );
  if (plataforma === "android")
    return (
      <ol className="list-decimal space-y-1 pl-5">
        <li>Ábrela en <b className="text-ink">Chrome</b>.</li>
        <li>Toca el menú <b className="text-ink">⋮</b> (arriba a la derecha).</li>
        <li>Elige <b className="text-ink">Instalar app</b> o <b className="text-ink">Agregar a la pantalla principal</b>.</li>
      </ol>
    );
  return (
    <ol className="list-decimal space-y-1 pl-5">
      <li>En <b className="text-ink">Chrome</b> o <b className="text-ink">Edge</b>, busca el ícono de instalar al final de la barra de dirección.</li>
      <li>O abre el menú <b className="text-ink">⋮</b> → <b className="text-ink">Instalar Agenda</b> (a veces está en “Guardar y compartir”).</li>
    </ol>
  );
}

// Aviso en el celular (una vez) para agregar la agenda a la pantalla de inicio.
export default function InstalarApp() {
  const { plataforma, instalada, movil, puedeInstalar, instalar } = useInstalar();
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    try { setOculto(localStorage.getItem(CLAVE) === "1"); } catch { setOculto(false); }
  }, []);

  function cerrar() {
    try { localStorage.setItem(CLAVE, "1"); } catch {}
    setOculto(true);
  }

  if (oculto || instalada || !movil) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-line bg-panel p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={40} height={40} className="shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Tenla como app en tu cel</p>
        {puedeInstalar ? (
          <>
            <p className="text-muted">Se abre desde tu pantalla de inicio, sin buscarla en el navegador.</p>
            <button onClick={async () => (await instalar()) && cerrar()} className="btn btn-primario mt-2 py-1.5 text-sm">Instalar</button>
          </>
        ) : (
          <div className="mt-1 text-muted"><Pasos plataforma={plataforma} /></div>
        )}
      </div>
      <button onClick={cerrar} className="btn btn-sec shrink-0 px-2 py-0.5 text-xs" aria-label="No mostrar otra vez">✕</button>
    </div>
  );
}

// Ventana con las instrucciones (desde "Instalar como app", abajo de la agenda o en el menú).
export function VentanaInstalar({ onClose }: { onClose: () => void }) {
  const { plataforma, instalada, puedeInstalar, instalar } = useInstalar();
  const [ver, setVer] = useState<Plataforma | null>(null);
  const actual = ver ?? plataforma;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-t-2xl border border-line bg-panel p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Instalar como app</h2>
          <button onClick={onClose} className="btn btn-sec px-2.5 py-1" aria-label="Cerrar">✕</button>
        </div>
        {instalada ? (
          <p className="text-sm text-muted">¡Ya la estás usando como app!</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">Queda en tu pantalla de inicio con su ícono y se abre sin la barra del navegador.</p>
            {puedeInstalar && (
              <button onClick={async () => (await instalar()) && onClose()} className="btn btn-primario mb-4 w-full">Instalar ahora</button>
            )}
            <div className="mb-3 flex gap-1 rounded-lg border border-line p-0.5 text-xs font-medium">
              {(["ios", "android", "compu"] as const).map((p) => (
                <button key={p} onClick={() => setVer(p)} className={`flex-1 rounded-md px-2 py-1.5 ${actual === p ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>
                  {p === "ios" ? "iPhone" : p === "android" ? "Android" : "Compu"}
                </button>
              ))}
            </div>
            <div className="text-sm text-muted"><Pasos plataforma={actual} /></div>
          </>
        )}
      </div>
    </div>
  );
}
