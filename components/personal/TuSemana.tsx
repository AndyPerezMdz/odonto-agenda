"use client";

import { useMemo } from "react";
import { deISO } from "@/lib/fechas";
import { pesos } from "@/lib/pagos";
import type { PEvento } from "@/lib/personal";
import { semanaVacia, tuSemana } from "@/lib/tuSemana";
import type { PPagoFijo, PPagoHecho } from "@/lib/viajesPagos";

// 2.6 · Tarjeta "Tu semana" (Pro) arriba de la Semana, y el aviso del domingo en Hoy.

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const corto = (iso: string) => `${DIAS[deISO(iso).getDay()].slice(0, 3)} ${deISO(iso).getDate()}`;

type Props = { eventos: PEvento[]; pagos: PPagoFijo[]; hechos: PPagoHecho[]; lunes: string; pro: boolean; onPro: () => void };

export function TarjetaTuSemana({ eventos, pagos, hechos, lunes, pro, onPro }: Props) {
  const s = useMemo(() => tuSemana(eventos, pagos, hechos, lunes), [eventos, pagos, hechos, lunes]);
  if (!pro)
    return (
      <button onClick={onPro} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-left hover:bg-panel-2">
        <span className="text-xl">🗓️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Tu semana en un vistazo</span>
          <span className="text-xs text-muted">Entregas, pagos, cumpleaños y viajes, y un correo cada domingo.</span>
        </span>
        <span className="versalitas shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-accent">Pro</span>
      </button>
    );
  if (semanaVacia(s)) return <p className="mb-4 rounded-2xl border border-dashed border-line px-4 py-3 text-center text-sm italic text-muted">Semana tranquila. Sospechosamente tranquila.</p>;
  const tiles = [
    { e: "📅", n: String(s.eventos), t: s.eventos === 1 ? "evento" : "eventos" },
    { e: "📌", n: String(s.entregas.length), t: s.entregas.length === 1 ? "entrega" : "entregas" },
    { e: "💸", n: s.pagos.length ? pesos(s.totalPagos) : "0", t: s.pagos.length === 1 ? "1 pago" : `${s.pagos.length} pagos` },
    { e: s.viajes.length ? "✈️" : "🎂", n: String(s.viajes.length || s.fechas.length), t: s.viajes.length ? (s.viajes.length === 1 ? "viaje" : "viajes") : s.fechas.length === 1 ? "cumple" : "cumples" },
  ];
  const detalle = [
    ...s.entregas.slice(0, 3).map((o) => `📌 ${o.titulo} (${corto(o.dia)})`),
    ...s.pagos.slice(0, 3).map((v) => `💸 ${v.pago.nombre} ${pesos(v.pago.monto)} (${corto(v.fecha)})`),
    ...s.fechas.map((o) => `🎂 ${o.titulo} (${corto(o.dia)})`),
    ...s.viajes.map((v) => `✈️ ${v.titulo} (${corto(v.fecha)})`),
  ];
  return (
    <section className="mb-4 rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="serif text-2xl">Tu semana</h2>
        {s.diaPesado && <span className="text-xs text-muted">El {DIAS[deISO(s.diaPesado.dia).getDay()]} viene pesado ({s.diaPesado.n})</span>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {tiles.map((x) => (
          <div key={x.t} className="rounded-xl bg-panel-2 px-1 py-2">
            <span className="block text-base leading-none">{x.e}</span>
            <span className="serif mt-1 block truncate text-xl leading-none">{x.n}</span>
            <span className="block truncate text-[10px] text-muted">{x.t}</span>
          </div>
        ))}
      </div>
      {detalle.length > 0 && (
        <ul className="mt-3 flex flex-col gap-0.5 text-sm">
          {detalle.slice(0, 6).map((d) => <li key={d} className="truncate">{d}</li>)}
          {detalle.length > 6 && <li className="text-xs text-muted">y {detalle.length - 6} más</li>}
        </ul>
      )}
    </section>
  );
}

/** En Hoy, sólo los domingos (Pro): "Mañana empieza tu semana". */
export function AvisoDomingo({ eventos, pagos, hechos, hoy, onVer }: { eventos: PEvento[]; pagos: PPagoFijo[]; hechos: PPagoHecho[]; hoy: string; onVer: () => void }) {
  const lunes = useMemo(() => {
    const d = deISO(hoy);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [hoy]);
  const s = useMemo(() => tuSemana(eventos, pagos, hechos, lunes), [eventos, pagos, hechos, lunes]);
  if (deISO(hoy).getDay() !== 0 || semanaVacia(s)) return null;
  const partes = [
    s.entregas.length ? `${s.entregas.length} entrega${s.entregas.length === 1 ? "" : "s"}` : "",
    s.pagos.length ? `${pesos(s.totalPagos)} en pagos` : "",
    s.fechas.length ? `${s.fechas.length} cumple${s.fechas.length === 1 ? "" : "s"}` : "",
    s.viajes.length ? `${s.viajes.length} viaje${s.viajes.length === 1 ? "" : "s"}` : "",
    s.eventos ? `${s.eventos} evento${s.eventos === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return (
    <button onClick={onVer} className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft/40 px-4 py-3 text-left hover:bg-accent-soft/60">
      <span className="text-2xl">🗓️</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Mañana empieza tu semana</span>
        <span className="text-sm text-muted">{partes.join(" · ")}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-accent">Ver →</span>
    </button>
  );
}

