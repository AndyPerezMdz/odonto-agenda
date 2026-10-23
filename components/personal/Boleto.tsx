"use client";

import { diasEntre } from "@/lib/pagos";
import { ICONO_TIPO, type Ocurrencia, type PCategoria } from "@/lib/personal";
import { gastadoViaje, maletaViaje, type PCosa } from "@/lib/viajesPagos";
import { pesos } from "@/lib/pagos";
import { colorDe, corta, Ico, I } from "@/components/personal/comun";

// Mi agenda · el pase de abordar de cada viaje.

/* --------------------------- PASE DE ABORDAR --------------------------- */

/** "Maleta 2/6 · $8,840" debajo del pase de abordar */
export function extraViaje(cosas: PCosa[], id: string) {
  const mias = cosas.filter((c) => c.viaje_id === id);
  const m = maletaViaje(mias);
  const g = gastadoViaje(mias);
  return [m.total ? `Maleta ${m.listas}/${m.total}` : "", g ? `${pesos(g)} gastado` : ""].filter(Boolean).join(" · ");
}

export function Boleto({ e, hoy, catPorId, onAbrir, enCurso = false, extra }: { e: Ocurrencia; hoy: string; catPorId: Map<string, PCategoria>; onAbrir: () => void; enCurso?: boolean; extra?: string }) {
  const fin = e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : e.fecha;
  const dias = diasEntre(e.fecha, fin) + 1;
  const falta = diasEntre(hoy, e.fecha);
  const pasado = fin < hoy;
  const color = colorDe(e, catPorId);
  return (
    <button onClick={onAbrir} className={`mb-6 flex w-full overflow-hidden rounded-2xl border border-line bg-panel text-left shadow-[0_12px_24px_-18px_rgba(40,30,20,0.6)] transition hover:-translate-y-0.5 ${pasado ? "opacity-60" : ""}`}>
      <span className="w-1.5 shrink-0" style={{ background: color }} />
      <span className="min-w-0 flex-1 px-4 py-3.5">
        <span className="versalitas flex items-center gap-1.5 text-muted"><Ico d={ICONO_TIPO.viaje} size={13} /> {enCurso ? "Estás de viaje" : "Pase de abordar"}</span>
        <span className="serif mt-1 block truncate text-3xl uppercase leading-none tracking-wide">{e.titulo}</span>
        <span className="mt-2 flex items-center gap-2 text-sm">
          <span><span className="versalitas block text-muted">Ida</span>{corta(e.fecha)}</span>
          <span className="mx-1 text-muted">→</span>
          <span><span className="versalitas block text-muted">Regreso</span>{corta(fin)}</span>
        </span>
        {e.lugar && <span className="mt-2 flex items-center gap-1 truncate text-xs text-muted"><Ico d={I.lugar} size={12} />{e.lugar}</span>}
        {extra && <span className="versalitas mt-1.5 block text-accent">{extra}</span>}
      </span>
      <span className="boleto-corte grid w-24 shrink-0 place-items-center px-2 text-center">
        <span>
          {enCurso ? (
            <>
              <span className="versalitas block text-muted">Día</span>
              <span className="serif block text-4xl leading-none text-accent">{diasEntre(e.fecha, hoy) + 1}</span>
              <span className="text-xs text-muted">de {dias}</span>
            </>
          ) : pasado ? (
            <>
              <span className="serif block text-3xl leading-none">{dias}</span>
              <span className="text-xs text-muted">día{dias === 1 ? "" : "s"}</span>
            </>
          ) : (
            <>
              <span className="versalitas block text-muted">Faltan</span>
              <span className="serif block text-4xl leading-none text-accent">{falta}</span>
              <span className="text-xs text-muted">día{falta === 1 ? "" : "s"}</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}
