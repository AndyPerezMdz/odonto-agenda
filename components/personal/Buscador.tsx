"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buscarMi, type ResultadoMi } from "@/lib/buscarMi";
import type { PEvento, PHabito, PPendiente } from "@/lib/personal";
import type { PCosa, PPagoFijo } from "@/lib/viajesPagos";
import { deISO, MESES } from "@/lib/fechas";
import BotonVoz from "@/components/BotonVoz";

// 3.0 · Buscar en toda tu agenda: "¿cuándo fue la cena con Ana?"

const ICONO: Record<ResultadoMi["clase"], string> = { evento: "📅", pendiente: "☑️", habito: "🔥", cosa: "🧳", pago: "💸" };
const fechaCorta = (iso: string, hoy: string) => {
  const d = deISO(iso);
  const anio = iso.slice(0, 4) !== hoy.slice(0, 4) ? ` ${iso.slice(0, 4)}` : "";
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}${anio}`;
};

export default function Buscador({
  datos, hoy, onClose, onElegir,
}: {
  datos: { eventos: PEvento[]; pendientes: PPendiente[]; habitos: PHabito[]; cosas: PCosa[]; pagos: PPagoFijo[] };
  hoy: string; onClose: () => void; onElegir: (r: ResultadoMi) => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const res = useMemo(() => buscarMi(q, { ...datos, hoy }), [q, datos, hoy]);
  // Separador entre lo que viene y lo que ya pasó
  const iPasado = res.findIndex((r) => r.fecha && r.fecha < hoy);

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-black/40 sm:p-4 sm:pt-[10vh]" onClick={onClose}>
      <div className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden border border-line bg-bg shadow-2xl sm:max-h-[75vh] sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Buscar en tu agenda">
        <div className="flex items-center gap-2 border-b border-line p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3">
          <span className="pl-1 text-muted" aria-hidden>🔍</span>
          <input
            ref={ref}
            type="search"
            className="min-w-0 flex-1 bg-transparent py-2 text-lg outline-none"
            placeholder="Busca: cena, dentista, renta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar"
            enterKeyHint="search"
            onKeyDown={(e) => { if (e.key === "Enter" && res[0]) onElegir(res[0]); }}
          />
          <BotonVoz valor="" onCambio={setQ} />
          <button onClick={onClose} className="btn btn-sec rounded-full px-3 text-sm">Cerrar</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {q.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">Eventos, pendientes, hábitos, planes de viaje y pagos. Sin acentos también funciona.</p>
          ) : !res.length ? (
            <p className="serif px-3 py-10 text-center text-xl italic text-muted">Nada con “{q.trim()}”. ¿Seguro que lo anotaste?</p>
          ) : (
            <ul>
              {res.map((r, i) => (
                <li key={`${r.clase}-${r.id}`}>
                  {i === 0 && r.fecha && r.fecha >= hoy && <p className="versalitas px-3 pb-1 pt-2 text-muted">Lo que viene</p>}
                  {i === iPasado && <p className="versalitas px-3 pb-1 pt-3 text-muted">Ya pasó</p>}
                  <button onClick={() => onElegir(r)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-panel-2">
                    <span className="text-lg" aria-hidden>{ICONO[r.clase]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.titulo}{r.clase === "evento" && r.e.compartido ? ` · de ${r.e.compartido.de}` : ""}</span>
                      {r.detalle && <span className="block truncate text-xs text-muted">{r.detalle}</span>}
                    </span>
                    {r.fecha && <span className={`shrink-0 text-xs tabular-nums ${r.fecha === hoy ? "font-semibold text-accent" : "text-muted"}`}>{r.fecha === hoy ? "hoy" : fechaCorta(r.fecha, hoy)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
