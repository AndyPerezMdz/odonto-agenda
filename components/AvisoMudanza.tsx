"use client";

import { useEffect, useState } from "react";

// 3.3 · "Nos mudamos a laagendita.app": una vez, en la dirección nueva, hasta fin de año. Se puede cerrar.

const HASTA = "2026-12-31";
const LLAVE = "aviso-mudanza-laagendita";

export default function AvisoMudanza() {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const sitio = process.env.NEXT_PUBLIC_SITE_URL;
    let canon = "";
    try { canon = sitio ? new URL(sitio).host : ""; } catch {}
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Merida" });
    let cerrado = false;
    try { cerrado = localStorage.getItem(LLAVE) === "1"; } catch {}
    setVer(!!canon && location.host === canon && !canon.endsWith(".vercel.app") && hoy <= HASTA && !cerrado);
  }, []);
  if (!ver) return null;
  const cerrar = () => {
    try { localStorage.setItem(LLAVE, "1"); } catch {}
    setVer(false);
  };
  return (
    <div className="relative mb-4 rounded-2xl border border-line bg-panel px-4 py-3 pr-10 text-sm">
      <button onClick={cerrar} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink" aria-label="Cerrar">✕</button>
      <p className="font-semibold">📦 Nos mudamos a <span className="text-accent">{location.host}</span></p>
      <p className="mt-1 text-muted">
        Tu agenda es la misma, sólo cambió la dirección: guárdala en favoritos. Si tenías la app en tu pantalla de inicio, bórrala e
        instálala otra vez desde aquí. Tus avisos del cel siguen llegando: no tienes que activarlos de nuevo.
      </p>
    </div>
  );
}
