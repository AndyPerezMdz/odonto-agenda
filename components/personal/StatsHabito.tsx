"use client";

import { useEffect, useMemo } from "react";
import { statsHabito } from "@/lib/statsHabito";
import type { PHabito } from "@/lib/personal";
import { deISO, MESES } from "@/lib/fechas";

// 3.0 · Estadísticas de un hábito: el mapa de calor de 6 meses y los números que presumir (o no).

const DIAS = ["D", "L", "M", "M", "J", "V", "S"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export default function StatsHabito({ h, marcas, hoy, onClose }: { h: PHabito; marcas: Set<string>; hoy: string; onClose: () => void }) {
  const s = useMemo(() => statsHabito(h, marcas, hoy), [h, marcas, hoy]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const conDatos = s.porDia.filter((d) => d.pct != null);
  const mejorDia = conDatos.length > 1 ? conDatos.reduce((a, b) => (b.pct! > a.pct! ? b : a)) : null;
  const peorDia = conDatos.length > 1 ? conDatos.reduce((a, b) => (b.pct! < a.pct! ? b : a)) : null;
  // Etiquetas de mes arriba del mapa (en la columna donde empieza cada mes)
  const meses = s.semanas.map((c, i) => {
    const m = deISO(c[0].fecha).getMonth();
    const antes = i ? deISO(s.semanas[i - 1][0].fecha).getMonth() : -1;
    return m !== antes ? MESES[m].slice(0, 3).toLowerCase() : "";
  });
  const frase = s.d30.pct >= 90 ? "Máquina. 🔥" : s.d30.pct >= 70 ? "Vas muy bien." : s.d30.pct >= 40 ? "Ahí la llevas. Se puede más." : s.d30.tocaban ? "Este mes está flojito. Hoy es buen día para volver." : "Apenas empiezas.";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Estadísticas de ${h.nombre}`}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <p className="versalitas text-muted">Estadísticas</p>
        <h2 className="serif mb-1 text-3xl leading-tight">{h.nombre}</h2>
        <p className="mb-4 text-sm text-muted">{frase}</p>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Dato n={`${s.racha}`} t="racha actual" color={h.color} />
          <Dato n={`${s.mejor}`} t="mejor racha" />
          <Dato n={`${s.mes.pct}%`} t={`de ${MESES[deISO(hoy).getMonth()].toLowerCase()} (${s.mes.hechos}/${s.mes.tocaban})`} />
          <Dato n={`${s.d30.pct}%`} t="últimos 30 días" />
        </div>

        <p className="mb-1.5 text-sm font-medium">Últimos 6 meses</p>
        <div className="pb-1">
          <div className="grid w-full gap-[2px]" style={{ gridTemplateColumns: `0.9rem repeat(${s.semanas.length}, minmax(0, 1fr))` }}>
            <span />
            {meses.map((m, i) => <span key={i} className="h-3 overflow-visible whitespace-nowrap text-[9px] leading-3 text-muted">{m}</span>)}
            {[0, 1, 2, 3, 4, 5, 6].map((fila) => (
              <Fila key={fila} fila={fila} s={s} color={h.color} />
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--panel-2)" }} /> sin hacer
          <span className="ml-2 h-2.5 w-2.5 rounded-[3px]" style={{ background: h.color }} /> hecho
          <span className="ml-2 h-2.5 w-2.5 rounded-[3px] opacity-30" style={{ background: "var(--panel-2)" }} /> no tocaba
        </div>

        <p className="mb-2 mt-5 text-sm font-medium">Por día (últimos 3 meses)</p>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const x = s.porDia[d];
            return (
              <div key={d} className="text-center" title={DIAS_LARGOS[d]}>
                <div className="relative mx-auto h-16 w-full overflow-hidden rounded-lg bg-panel-2">
                  {x.pct != null && <div className="absolute inset-x-0 bottom-0 rounded-lg" style={{ height: `${Math.max(4, x.pct)}%`, background: h.color, opacity: 0.85 }} />}
                </div>
                <p className="mt-1 text-[11px] font-semibold">{DIAS[d]}</p>
                <p className="text-[10px] text-muted">{x.pct == null ? "—" : `${x.pct}%`}</p>
              </div>
            );
          })}
        </div>
        {mejorDia && peorDia && mejorDia.dia !== peorDia.dia && (
          <p className="mt-3 text-sm text-muted">Tu mejor día es el <b className="text-ink">{DIAS_LARGOS[mejorDia.dia]}</b>; el que más se te va, el <b className="text-ink">{DIAS_LARGOS[peorDia.dia]}</b>.</p>
        )}
        <button className="btn btn-sec mt-5 w-full rounded-full" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

function Dato({ n, t, color }: { n: string; t: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-3">
      <p className="serif text-3xl leading-none" style={color ? { color } : undefined}>{n}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted">{t}</p>
    </div>
  );
}

function Fila({ fila, s, color }: { fila: number; s: ReturnType<typeof statsHabito>; color: string }) {
  return (
    <>
      <span className="self-center text-[9px] leading-none text-muted">{fila % 2 === 0 ? DIAS[(fila + 1) % 7] : ""}</span>
      {s.semanas.map((col) => {
        const c = col[fila];
        if (c.futuro) return <span key={c.fecha} />;
        return (
          <span
            key={c.fecha}
            title={`${c.fecha}${c.si ? " ✓" : ""}`}
            className={`aspect-square w-full rounded-[2px] ${!c.si && (!c.toca || c.antes) ? "opacity-30" : ""}`}
            style={{ background: c.si ? color : "var(--panel-2)" }}
          />
        );
      })}
    </>
  );
}
