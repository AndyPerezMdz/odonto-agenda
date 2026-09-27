"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { APP_VERSION, ICONOS, NOVEDADES, pendientes, type Version } from "@/lib/novedades";
import ListaNovedades from "@/components/ListaNovedades";

type Props = {
  supabase: SupabaseClient;
  userId: string;
  vista: string | null | undefined; // última versión que ya leyó
  todas?: boolean; // abierta a mano: muestra el historial completo
  onLeido: () => void;
  onClose: () => void;
};

// "¿Qué hay de nuevo?": aparece una vez por actualización. "Después" la deja pendiente (con puntito).
export default function Novedades({ supabase, userId, vista, todas = false, onLeido, onClose }: Props) {
  const lista: Version[] = todas ? NOVEDADES : pendientes(vista);
  const [guardando, setGuardando] = useState(false);
  const yaLeida = !!vista && !pendientes(vista).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function entendido() {
    setGuardando(true);
    await supabase.from("perfiles").update({ version_vista: APP_VERSION }).eq("id", userId);
    setGuardando(false);
    onLeido();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl border border-line bg-panel shadow-xl sm:rounded-2xl">
        <div className="border-b border-line p-5 pb-4">
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d={ICONOS.estrella} /></svg>
            Versión {APP_VERSION}
          </p>
          <h2 className="text-lg font-semibold">{todas ? "Novedades de la agenda" : "¿Qué hay de nuevo?"}</h2>
          {!todas && <p className="text-sm text-muted">La agenda se actualizó. Esto es lo que ya puedes hacer:</p>}
        </div>

        <div className="overflow-y-auto p-5">
          <ListaNovedades lista={lista} conVersion={todas || lista.length > 1} />
          <Link href="/novedades" onClick={onClose} className="mt-5 block text-center text-sm font-medium text-accent hover:underline">
            Ver todas las versiones →
          </Link>
        </div>

        <div className="flex gap-2 border-t border-line p-4">
          {yaLeida ? (
            <button className="btn btn-primario w-full" onClick={onClose}>Cerrar</button>
          ) : (
            <>
              <button className="btn btn-sec flex-1" onClick={onClose} disabled={guardando}>Después</button>
              <button className="btn btn-primario flex-1" onClick={entendido} disabled={guardando}>
                {guardando ? "…" : "¡Entendido!"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
