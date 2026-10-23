"use client";

import { useEffect, useState } from "react";
import { DIAS_PRUEBA } from "@/lib/plan";

// 2.3 · La prueba de Pro ya no arranca sola: el dueño la activa cuando quiere, desde un candadito o Suscripción.

let cache: Promise<{ disponible: boolean; dueno: boolean }> | null = null;
/** ¿Puede activar la prueba? (una sola consulta por página, aunque haya varios candados) */
export function usePruebaDisponible() {
  const [r, setR] = useState<{ disponible: boolean; dueno: boolean } | null>(null);
  useEffect(() => {
    cache ??= fetch("/api/pago/prueba", { cache: "no-store" }).then((x) => x.json()).catch(() => ({ disponible: false, dueno: false }));
    cache.then(setR);
  }, []);
  return r;
}

/** "Probar Pro 15 días gratis": primero explica qué pasa, luego la activa y recarga. */
export default function ProbarPro({ compacto = false, onActivada }: { compacto?: boolean; onActivada?: () => void }) {
  const [paso, setPaso] = useState<"" | "confirmar" | "activando">("");
  const [error, setError] = useState<string | null>(null);

  async function activar() {
    setPaso("activando");
    setError(null);
    const r = await fetch("/api/pago/prueba", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setPaso("confirmar");
      return setError(d.error ?? "No se pudo activar. Intenta otra vez.");
    }
    cache = null;
    if (onActivada) onActivada();
    else window.location.reload();
  }

  if (!paso)
    return (
      <button type="button" onClick={() => setPaso("confirmar")} className={`btn btn-primario shrink-0 ${compacto ? "py-1.5 text-sm" : ""}`}>
        Probar Pro {DIAS_PRUEBA} días gratis
      </button>
    );
  return (
    <div className="w-full rounded-xl border border-accent/40 bg-panel p-3 text-left text-sm">
      <p>
        Durante <b>{DIAS_PRUEBA} días</b> tienes todo Pro, para ti y tu compa. Al terminar vuelves a Gratis <b>sin perder nada</b> y no se te cobra nada. Sólo se puede usar una vez.
      </p>
      {error && <p className="mt-2 text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-sec py-1.5 text-sm" onClick={() => setPaso("")}>Ahora no</button>
        <button type="button" className="btn btn-primario py-1.5 text-sm" disabled={paso === "activando"} onClick={activar}>{paso === "activando" ? "Activando…" : "Activar mi prueba"}</button>
      </div>
    </div>
  );
}
