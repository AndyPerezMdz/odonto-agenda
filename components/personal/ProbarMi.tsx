"use client";

import { useState } from "react";
import { DIAS_PRUEBA_MI } from "@/lib/planMi";

/** 2.3 · "Probar Pro 15 días gratis" de Mi agenda: primero explica qué pasa, luego la activa y recarga. */
export default function ProbarMi({ compacto = false, onActivada }: { compacto?: boolean; onActivada?: () => void }) {
  const [paso, setPaso] = useState<"" | "confirmar" | "activando">("");
  const [error, setError] = useState<string | null>(null);

  async function activar() {
    setPaso("activando");
    setError(null);
    const r = await fetch("/api/personal/prueba", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setPaso("confirmar");
      return setError(d.error ?? "No se pudo activar. Intenta otra vez.");
    }
    if (onActivada) onActivada();
    else window.location.reload();
  }

  if (!paso)
    return (
      <button type="button" onClick={() => setPaso("confirmar")} className={`btn btn-primario rounded-full ${compacto ? "py-1.5 text-xs" : "w-full py-2.5"}`}>
        Probar Pro {DIAS_PRUEBA_MI} días gratis
      </button>
    );
  return (
    <div className="w-full rounded-2xl border border-accent/40 bg-panel p-3 text-left text-sm text-ink">
      <p>
        Durante <b>{DIAS_PRUEBA_MI} días</b> tienes todo Pro. Al terminar vuelves a Gratis <b>sin perder nada</b> y no se te cobra nada. Sólo se puede usar una vez.
      </p>
      {error && <p className="mt-2 text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-sec rounded-full py-1.5 text-sm" onClick={() => setPaso("")}>Ahora no</button>
        <button type="button" className="btn btn-primario rounded-full py-1.5 text-sm" disabled={paso === "activando"} onClick={activar}>{paso === "activando" ? "Activando…" : "Activar mi prueba"}</button>
      </div>
    </div>
  );
}
