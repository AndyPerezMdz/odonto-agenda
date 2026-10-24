"use client";

import { useMemo, useState } from "react";
import { aISO, deISO, diasDelMes, DIAS_CORTOS_LUNES, MESES } from "@/lib/fechas";
import { sumarDias, diasEntre } from "@/lib/pagos";
import { expandir, hm, ICONO_TIPO, type Ocurrencia, type PCategoria, type PEvento, type PPendiente } from "@/lib/personal";
import type { AccionesVP } from "@/components/personal/ViajesPagos";
import { vencimientosEntre, type PCosa, type PPagoFijo, type PPagoHecho } from "@/lib/viajesPagos";
import { pesos } from "@/lib/pagos";
import { Palomita, type AccionesListas } from "@/components/personal/Listas";
import { TarjetaTuSemana } from "@/components/personal/TuSemana";
import { colorDe, corta, lunesDe, Ico } from "@/components/personal/comun";

// Mi agenda · Semana y Mes.

/* ------------------------------ SEMANA / MES ------------------------------ */

export function SeccionSemana({
  eventos, hoy, categorias, ocultas, setOcultas, catPorId, onAbrir, onMarcar, onNuevo, pendientes, acciones, onEditarPendiente, pagosFijos, pagosHechos, accionesVP, lunesInicial, pro, onPro, cosas,
}: {
  eventos: PEvento[]; hoy: string; categorias: PCategoria[]; ocultas: Set<string>; setOcultas: (s: Set<string>) => void; catPorId: Map<string, PCategoria>;
  onAbrir: (o: Ocurrencia) => void; onMarcar: (e: PEvento, h: boolean) => void; onNuevo: (f?: string) => void;
  pendientes: PPendiente[]; acciones: AccionesListas; onEditarPendiente: (p: PPendiente) => void;
  pagosFijos: PPagoFijo[]; pagosHechos: PPagoHecho[]; accionesVP: AccionesVP; lunesInicial: string | null; pro: boolean; onPro: () => void; cosas: PCosa[];
}) {
  const [vista, setVista] = useState<"semana" | "mes">("semana");
  const [lunes, setLunes] = useState(lunesInicial ?? lunesDe(hoy));
  const [mes, setMes] = useState(() => ({ a: deISO(hoy).getFullYear(), m: deISO(hoy).getMonth() }));
  const domingo = sumarDias(lunes, 6);
  const os = useMemo(() => expandir(eventos, lunes, domingo), [eventos, lunes, domingo]);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const porDia = new Map<string, Ocurrencia[]>();
  for (const o of os) porDia.set(o.dia, [...(porDia.get(o.dia) ?? []), o]);
  const pendPorDia = new Map<string, PPendiente[]>();
  for (const p of pendientes) if (!p.padre_id && p.lista === "hacer" && p.fecha && p.fecha >= lunes && p.fecha <= domingo) pendPorDia.set(p.fecha, [...(pendPorDia.get(p.fecha) ?? []), p]);
  for (const l of pendPorDia.values()) l.sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99") || (b.prioridad ?? 0) - (a.prioridad ?? 0));

  const pagosSemana = vencimientosEntre(pagosFijos, pagosHechos, lunes, domingo);

  function moverMes(n: number) {
    const d = new Date(mes.a, mes.m + n, 1);
    setMes({ a: d.getFullYear(), m: d.getMonth() });
  }
  function toggle(id: string) {
    const s = new Set(ocultas);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setOcultas(s);
  }
  const titulo =
    vista === "semana"
      ? deISO(lunes).getMonth() === deISO(domingo).getMonth()
        ? `${deISO(lunes).getDate()} – ${deISO(domingo).getDate()} de ${MESES[deISO(domingo).getMonth()].toLowerCase()}`
        : `${corta(lunes)} – ${corta(domingo)}`
      : `${MESES[mes.m]} ${mes.a}`;
  const esEstaSemana = lunes === lunesDe(hoy);

  return (
    <div>
      <header className="mb-4 border-b border-line pb-4">
        <div className="flex items-end gap-3">
          <div className="mr-auto min-w-0">
            <p className="versalitas text-muted">{vista === "semana" ? (esEstaSemana ? "Esta semana" : "Semana") : "Mes"}</p>
            <h1 className="serif mt-1 text-4xl leading-none first-letter:uppercase">{titulo}</h1>
          </div>
          <div className="flex rounded-full border border-line bg-panel p-0.5 text-xs font-medium">
            {(["semana", "mes"] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)} className={`rounded-full px-3 py-1 ${vista === v ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}>{v === "semana" ? "Semana" : "Mes"}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <button className="btn btn-sec rounded-full px-3 py-1" onClick={() => (vista === "semana" ? setLunes(sumarDias(lunes, -7)) : moverMes(-1))} aria-label="Anterior">‹</button>
          <button className="btn btn-sec rounded-full px-3 py-1" onClick={() => (vista === "semana" ? setLunes(sumarDias(lunes, 7)) : moverMes(1))} aria-label="Siguiente">›</button>
          <button className="btn btn-sec rounded-full px-3 py-1 text-xs" onClick={() => { setLunes(lunesDe(hoy)); setMes({ a: deISO(hoy).getFullYear(), m: deISO(hoy).getMonth() }); }}>Hoy</button>
          {categorias.length > 0 && (
            <div className="ml-auto flex min-w-0 gap-1 overflow-x-auto">
              {categorias.map((c) => (
                <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={!ocultas.has(c.id)} title={ocultas.has(c.id) ? "Mostrar" : "Ocultar"} className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] ${ocultas.has(c.id) ? "text-muted line-through opacity-50" : ""}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {vista === "semana" && <TarjetaTuSemana eventos={eventos} pagos={pagosFijos} hechos={pagosHechos} lunes={lunes} pro={pro} onPro={onPro} />}
      {vista === "semana" ? (
        <ol className="flex flex-col gap-2.5">
          {dias.map((dia) => {
            const d = deISO(dia);
            const lista = porDia.get(dia) ?? [];
            const pends = pendPorDia.get(dia) ?? [];
            const pagos = pagosSemana.filter((v) => v.fecha === dia);
            const esHoy = dia === hoy;
            return (
              <li key={dia} className={`grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 rounded-2xl border bg-panel p-3 ${esHoy ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line"} ${dia < hoy ? "opacity-70" : ""}`}>
                <button onClick={() => onNuevo(dia)} className="text-left" title="Anotar algo este día">
                  <span className={`versalitas block ${esHoy ? "text-accent" : "text-muted"}`}>{DIAS_CORTOS_LUNES[(d.getDay() + 6) % 7]}</span>
                  <span className={`serif block text-4xl leading-none ${esHoy ? "text-accent" : ""}`}>{d.getDate()}</span>
                </button>
                {lista.length + pends.length + pagos.length === 0 ? (
                  <button onClick={() => onNuevo(dia)} className="self-center text-left text-sm italic text-muted hover:text-ink">— libre</button>
                ) : (
                  <ul className="flex min-w-0 flex-col gap-1">
                    {lista.map((o) => <Renglon key={`${o.id}-${o.dia}`} o={o} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(o)} onMarcar={onMarcar} />)}
                    {pends.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-panel-2">
                        <Palomita chica checked={p.hecho} onChange={(v) => acciones.marcarPendiente(p, v)} etiqueta={`Hecho: ${p.titulo}`} />
                        <button onClick={() => onEditarPendiente(p)} className={`min-w-0 flex-1 truncate text-left ${p.hecho ? "text-muted line-through" : ""}`}>{p.titulo}</button>
                        <span className={`versalitas shrink-0 ${p.hora ? "tabular-nums text-accent" : "text-muted"}`}>{p.hora ? `⏱ ${p.hora.slice(0, 5)}` : "pendiente"}</span>
                      </li>
                    ))}
                    {pagos.map((v) => (
                      <li key={`${v.pago.id}-${v.fecha}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-panel-2">
                        <Palomita chica checked={v.pagado} onChange={(x) => accionesVP.marcarPagado(v.pago, v.fecha, x)} etiqueta={`Ya pagué: ${v.pago.nombre}`} />
                        <span className={`min-w-0 flex-1 truncate ${v.pagado ? "text-muted line-through" : ""}`}>{v.pago.nombre}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{pesos(v.pago.monto)}</span>
                        <span className={`versalitas shrink-0 ${!v.pagado && v.fecha < hoy ? "text-danger" : "text-muted"}`}>pago</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <Mes
          eventos={eventos} hoy={hoy} anio={mes.a} mes={mes.m} catPorId={catPorId} onDia={(dia) => { setLunes(lunesDe(dia)); setVista("semana"); }}
          extras={(desde, hasta) => {
            // 2.8 · también pendientes con fecha, pagos fijos y planes de viaje
            const m = new Map<string, { pend: number; pago: number; plan: number }>();
            const sumar = (d: string, k: "pend" | "pago" | "plan") => { const x = m.get(d) ?? { pend: 0, pago: 0, plan: 0 }; x[k]++; m.set(d, x); };
            for (const p of pendientes) if (!p.padre_id && p.fecha && !p.hecho && p.fecha >= desde && p.fecha <= hasta) sumar(p.fecha, "pend");
            for (const v of vencimientosEntre(pagosFijos, pagosHechos, desde, hasta)) if (!v.pagado) sumar(v.fecha, "pago");
            for (const c of cosas) if ((c.tipo === "itinerario" || c.tipo === "reserva") && c.fecha && c.fecha >= desde && c.fecha <= hasta) sumar(c.fecha, "plan");
            return m;
          }}
        />
      )}
    </div>
  );
}

function Renglon({ o, hoy, catPorId, onAbrir, onMarcar }: { o: Ocurrencia; hoy: string; catPorId: Map<string, PCategoria>; onAbrir: () => void; onMarcar: (e: PEvento, h: boolean) => void }) {
  const color = colorDe(o, catPorId);
  if (o.tipo === "viaje") {
    const fin = o.fecha_fin ?? o.fecha;
    return (
      <li>
        <button onClick={onAbrir} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm font-medium text-white" style={{ background: color }}>
          <Ico d={ICONO_TIPO.viaje} size={14} />
          <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
          <span className="shrink-0 text-xs opacity-85">día {diasEntre(o.fecha, o.dia) + 1} de {diasEntre(o.fecha, fin) + 1}</span>
        </button>
      </li>
    );
  }
  if (o.tipo === "entrega") {
    const atrasada = !o.hecho && o.fecha < hoy;
    return (
      <li className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-panel-2">
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--accent)]" checked={o.hecho} onChange={(x) => onMarcar(o, x.target.checked)} aria-label={`Entregada: ${o.titulo}`} />
        <button onClick={onAbrir} className={`min-w-0 flex-1 truncate text-left ${o.hecho ? "text-muted line-through" : ""}`}>{o.titulo}</button>
        <span className={`versalitas shrink-0 ${atrasada ? "text-danger" : "text-muted"}`}>{atrasada ? "atrasada" : "entrega"}</span>
      </li>
    );
  }
  return (
    <li>
      <button onClick={onAbrir} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-panel-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="w-11 shrink-0 tabular-nums text-muted">{o.hora_inicio ? hm(o.hora_inicio) : "—"}</span>
        <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
        {o.tipo === "recordatorio" && <span className="text-muted"><Ico d={ICONO_TIPO.recordatorio} size={14} /></span>}
      </button>
    </li>
  );
}

type ExtrasDia = Map<string, { pend: number; pago: number; plan: number }>;
function Mes({ eventos, hoy, anio, mes, catPorId, onDia, extras }: { eventos: PEvento[]; hoy: string; anio: number; mes: number; catPorId: Map<string, PCategoria>; onDia: (dia: string) => void; extras: (desde: string, hasta: string) => ExtrasDia }) {
  const dias = useMemo(() => diasDelMes(anio, mes, true), [anio, mes]);
  const desde = aISO(dias[0]);
  const hasta = aISO(dias[dias.length - 1]);
  const porDia = useMemo(() => {
    const m = new Map<string, Ocurrencia[]>();
    for (const o of expandir(eventos, desde, hasta)) m.set(o.dia, [...(m.get(o.dia) ?? []), o]);
    return m;
  }, [eventos, desde, hasta]);
  const ext = extras(desde, hasta);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="grid grid-cols-7 border-b border-line">
        {DIAS_CORTOS_LUNES.map((d) => <span key={d} className="versalitas py-2 text-center text-muted">{d.slice(0, 2)}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const iso = aISO(d);
          const os = porDia.get(iso) ?? [];
          const fuera = d.getMonth() !== mes;
          const viaje = os.find((o) => o.tipo === "viaje");
          return (
            <button key={iso} onClick={() => onDia(iso)} className={`flex min-h-[64px] flex-col items-center gap-1 border-line p-1.5 sm:min-h-[84px] ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${fuera ? "opacity-35" : ""} hover:bg-panel-2`}>
              <span className={`serif grid h-8 w-8 place-items-center rounded-full text-lg leading-none ${iso === hoy ? "bg-accent text-panel" : ""}`}>{d.getDate()}</span>
              {viaje && <span className="h-1 w-full rounded-full" style={{ background: colorDe(viaje, catPorId) }} title={viaje.titulo} />}
              {ext.get(iso)?.pago ? <span className="text-[9px] font-bold leading-none text-[#b8860b]" title="Pago">$</span> : null}
              <span className="flex flex-wrap justify-center gap-0.5">
                {os.filter((o) => o.tipo !== "viaje").slice(0, 4).map((o) => <span key={o.id} className="h-1.5 w-1.5 rounded-full" style={{ background: colorDe(o, catPorId) }} />)}
                {ext.get(iso)?.pend ? <span className="h-1.5 w-1.5 rounded-[2px] border border-muted" title="Pendiente" /> : null}
                {ext.get(iso)?.plan ? <span className="h-1.5 w-1.5 rotate-45 bg-accent/70" title="Plan de viaje" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
