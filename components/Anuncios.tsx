"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Anuncio = { id: string; titulo: string; texto: string };
const CLAVE = (id: string) => `anuncio-cerrado-${id}`;

// Anuncios del staff arriba de la agenda. La base ya filtra por universidad y vigencia; cada quien los cierra.
export default function Anuncios({ supabase }: { supabase: SupabaseClient }) {
  const [lista, setLista] = useState<Anuncio[]>([]);
  useEffect(() => {
    supabase
      .from("anuncios")
      .select("id,titulo,texto")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        const cerrado = (id: string) => { try { return localStorage.getItem(CLAVE(id)) === "1"; } catch { return false; } };
        setLista(((data as Anuncio[]) ?? []).filter((a) => !cerrado(a.id)));
      });
  }, [supabase]);

  function cerrar(id: string) {
    try { localStorage.setItem(CLAVE(id), "1"); } catch {}
    setLista((l) => l.filter((a) => a.id !== id));
  }

  if (!lista.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {lista.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
          <svg className="mt-0.5 shrink-0 text-accent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/></svg>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-accent">{a.titulo}</p>
            <p className="whitespace-pre-line text-ink">{a.texto}</p>
          </div>
          <button onClick={() => cerrar(a.id)} className="shrink-0 rounded-md px-1.5 text-muted hover:text-ink" aria-label="Cerrar anuncio">✕</button>
        </div>
      ))}
    </div>
  );
}
