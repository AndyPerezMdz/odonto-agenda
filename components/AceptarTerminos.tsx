"use client";

import { useState } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

// Para cuentas que ya existían antes del Aviso de privacidad: se les pide aceptarlo una vez.
export default function AceptarTerminos({ supabase, userId, onAceptado }: { supabase: SupabaseClient; userId: string; onAceptado: () => void }) {
  const [acepto, setAcepto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setGuardando(true);
    const { error } = await supabase.from("perfiles").update({ acepto_terminos_at: new Date().toISOString() }).eq("id", userId);
    setGuardando(false);
    if (error) return setError("No se pudo guardar. Intenta de nuevo.");
    onAceptado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-line bg-panel p-6 shadow-xl sm:rounded-2xl">
        <h2 className="mb-2 text-lg font-semibold">Aviso de privacidad y términos</h2>
        <p className="mb-4 text-sm text-muted">
          Publicamos nuestro <b className="text-ink">Aviso de privacidad</b> y los <b className="text-ink">Términos y condiciones</b>: explican qué datos
          guardamos, para qué, y cómo funciona la suscripción. Te pedimos también <b className="text-ink">no escribir diagnósticos ni datos clínicos</b> en las notas.
        </p>
        <div className="mb-4 flex gap-2">
          <Link href="/privacidad" target="_blank" className="btn btn-sec flex-1 text-sm">Leer aviso</Link>
          <Link href="/terminos" target="_blank" className="btn btn-sec flex-1 text-sm">Leer términos</Link>
        </div>
        <label className="mb-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>Leí y acepto el Aviso de privacidad y los Términos y condiciones.</span>
        </label>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button className="btn btn-primario w-full" disabled={!acepto || guardando} onClick={aceptar}>
          {guardando ? "Guardando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
