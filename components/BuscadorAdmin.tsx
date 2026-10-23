"use client";

import { useEffect, useRef, useState } from "react";
import type { AgendaAdmin } from "@/lib/admin";
import type { PersonalAdmin } from "@/lib/personalServer";

// 2.8 · Un solo buscador para todo el panel: agendas de clínicas (por nombre o correo de quien está) y personas de Mi agenda.

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function BuscadorAdmin({ agendas, onAgenda, onPersona }: { agendas: AgendaAdmin[]; onAgenda: (id: string) => void; onPersona: (q: string) => void }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [personas, setPersonas] = useState<PersonalAdmin[] | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  async function cargarPersonas() {
    if (personas) return;
    const r = await fetch("/api/admin/personales", { cache: "no-store" });
    if (r.ok) setPersonas((await r.json().catch(() => ({}))).personales ?? []);
  }
  useEffect(() => {
    const fuera = (e: MouseEvent) => caja.current && !caja.current.contains(e.target as Node) && setAbierto(false);
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        caja.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", atajo);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", atajo);
    };
  }, []);

  const t = norm(q.trim());
  const ag = t.length >= 2 ? agendas.filter((a) => norm(`${a.nombre} ${a.miembros.map((m) => `${m.nombre} ${m.email}`).join(" ")}`).includes(t)).slice(0, 6) : [];
  const pe = t.length >= 2 ? (personas ?? []).filter((p) => norm(`${p.nombre ?? ""} ${p.email ?? ""}`).includes(t)).slice(0, 6) : [];
  const elegir = (f: () => void) => {
    f();
    setQ("");
    setAbierto(false);
  };

  return (
    <div ref={caja} className="relative w-full sm:w-72">
      <input
        className="campo py-1.5 text-sm"
        placeholder="Buscar agenda o persona…  ⌘K"
        value={q}
        onFocus={() => { setAbierto(true); cargarPersonas(); }}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
          if (e.key === "Enter" && (ag[0] || pe[0])) elegir(() => (ag[0] ? onAgenda(ag[0].id) : onPersona(pe[0].email ?? pe[0].nombre ?? "")));
        }}
        aria-label="Buscar en el panel"
      />
      {abierto && t.length >= 2 && (
        <div className="absolute right-0 top-full z-30 mt-1 w-full min-w-[18rem] overflow-hidden rounded-xl border border-line bg-panel shadow-xl">
          {!ag.length && !pe.length ? (
            <p className="px-3 py-3 text-sm text-muted">{personas ? "Nada coincide." : "Buscando…"}</p>
          ) : (
            <>
              {ag.length > 0 && <p className="consola-etiqueta px-3 pt-2">Clínicas</p>}
              {ag.map((a) => (
                <button key={a.id} onClick={() => elegir(() => onAgenda(a.id))} className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">
                  <span className="block truncate font-medium">{a.nombre}</span>
                  <span className="block truncate text-xs text-muted">{a.miembros.map((m) => m.email).join(" · ")}</span>
                </button>
              ))}
              {pe.length > 0 && <p className="consola-etiqueta px-3 pt-2">Mi agenda</p>}
              {pe.map((p) => (
                <button key={p.user_id} onClick={() => elegir(() => onPersona(p.email ?? p.nombre ?? ""))} className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">
                  <span className="block truncate font-medium">{p.nombre || p.email}</span>
                  <span className="block truncate text-xs text-muted">{p.email}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
