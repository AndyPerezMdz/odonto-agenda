"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// Anuncios del staff (lo que publicas en tu panel), ARRIBA de Hoy, bien visibles. 3.3: también en Mi agenda.
// La base ya filtra por universidad y vigencia; aquí se filtra para quién es. Cada quien lo cierra una vez.

type Anuncio = { id: string; titulo: string; texto: string; para?: "clinicas" | "mi" | "todos" | null };
const CLAVE = (id: string) => `anuncio-cerrado-${id}`;

export default function Anuncios({ supabase, para = "clinicas" }: { supabase: SupabaseClient; para?: "clinicas" | "mi" }) {
  const [lista, setLista] = useState<Anuncio[]>([]);
  useEffect(() => {
    supabase
      .from("anuncios")
      .select("*") // ("*": funciona antes y después del SQL 3.3)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const cerrado = (id: string) => { try { return localStorage.getItem(CLAVE(id)) === "1"; } catch { return false; } };
        setLista(((data as Anuncio[]) ?? []).filter((a) => (a.para ?? "clinicas") === para || a.para === "todos").filter((a) => !cerrado(a.id)).slice(0, 3));
      });
  }, [supabase, para]);

  function cerrar(id: string) {
    try { localStorage.setItem(CLAVE(id), "1"); } catch {}
    setLista((l) => l.filter((a) => a.id !== id));
  }

  if (!lista.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {lista.map((a) => (
        <section key={a.id} className="relative overflow-hidden rounded-2xl border-2 border-accent/50 bg-accent-soft/60 px-4 py-3.5 pr-10 shadow-sm">
          <button onClick={() => cerrar(a.id)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-panel hover:text-ink" aria-label="Cerrar anuncio">✕</button>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" /></svg>
            Aviso
          </p>
          <p className="mt-1 text-base font-semibold leading-snug">{a.titulo}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink/85">{a.texto}</p>
        </section>
      ))}
    </div>
  );
}
