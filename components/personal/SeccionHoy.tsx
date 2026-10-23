"use client";

import { useEffect, useState } from "react";
import { deISO, DIAS_CORTOS_LUNES, MESES } from "@/lib/fechas";
import { sumarDias, diasEntre } from "@/lib/pagos";
import { entregasPendientes, expandir, fechasQueVienen, hm, ICONO_TIPO, type Ocurrencia, type PCategoria, type PEvento, type PHabito, type PMarca, type PPendiente } from "@/lib/personal";
import { RenglonPago, type AccionesVP } from "@/components/personal/ViajesPagos";
import { pagosPorAtender, totalMes, type PCosa, type PPagoFijo, type PPagoHecho } from "@/lib/viajesPagos";
import { pesos } from "@/lib/pagos";
import { FechasQueVienen, HabitosHoy, type AccionesListas } from "@/components/personal/Listas";
import { AvisoDomingo } from "@/components/personal/TuSemana";
import { colorDe, cuando, ahoraHM, DIAS_LARGOS, Ico, I } from "@/components/personal/comun";
import { Boleto, extraViaje } from "@/components/personal/Boleto";

// Mi agenda · Hoy: línea del tiempo, hábitos, atajos, post-it, viaje, fechas y lo que viene.

/* ------------------------------ HOY ------------------------------ */

export function SeccionHoy({
  odonto, eventos, todos, hoy, nombre, catPorId, onAbrir, onMarcar, onNuevo, onSemana, onViajes, onPendientes, onHabitos,
  pendientes, habitos, marcas, acciones, onEditarPendiente, onNuevoHabito, cosas, pagosFijos, pagosHechos, accionesVP, pro, onTuSemana, onPagos, ocultos, onPersonalizar,
}: {
  odonto: boolean; eventos: PEvento[]; todos: PEvento[]; hoy: string; nombre: string; catPorId: Map<string, PCategoria>;
  onAbrir: (o: Ocurrencia) => void; onMarcar: (e: PEvento, h: boolean) => void; onNuevo: (f?: string) => void; onSemana: () => void; onViajes: () => void;
  onPendientes: () => void; onHabitos: () => void;
  pendientes: PPendiente[]; habitos: PHabito[]; marcas: PMarca[]; acciones: AccionesListas; onEditarPendiente: (p: PPendiente) => void; onNuevoHabito: () => void;
  cosas: PCosa[]; pagosFijos: PPagoFijo[]; pagosHechos: PPagoHecho[]; accionesVP: AccionesVP; pro: boolean; onTuSemana: () => void; onPagos: () => void;
  ocultos: Set<string>; onPersonalizar: () => void;
}) {
  const [ahora, setAhora] = useState(ahoraHM);
  useEffect(() => {
    const t = setInterval(() => setAhora(ahoraHM()), 60_000);
    return () => clearInterval(t);
  }, []);
  const d = deISO(hoy);
  const deHoy = expandir(eventos, hoy, hoy);
  const viaje = deHoy.find((o) => o.tipo === "viaje");
  const linea = deHoy.filter((o) => o.tipo === "evento" || o.tipo === "recordatorio");
  const todoElDia = linea.filter((o) => !o.hora_inicio);
  const conHora = linea.filter((o) => o.hora_inicio);
  const iAhora = conHora.findIndex((o) => hm(o.hora_inicio) > ahora);
  const { vencidas, proximas } = entregasPendientes(todos, hoy, 7);
  // Pendientes con fecha de hoy o atrasados (los de "algún día" no estorban aquí)
  const pendHoy = pendientes.filter((p) => !p.padre_id && p.lista === "hacer" && p.fecha && p.fecha <= hoy && (!p.hecho || (p.hecho_at ?? "").slice(0, 10) === hoy)).sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
  const sinFecha = pendientes.filter((p) => !p.padre_id && p.lista === "hacer" && !p.hecho && !p.fecha).length;
  const fechas = fechasQueVienen(eventos, hoy, 14);
  const pagosHoy = pagosPorAtender(pagosFijos, pagosHechos, hoy);
  const planesHoy = viaje ? cosas.filter((c) => c.viaje_id === viaje.id && (c.tipo === "itinerario" || c.tipo === "reserva") && c.fecha === hoy).sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99")) : [];
  const proximoViaje = !viaje ? todos.filter((e) => e.tipo === "viaje" && e.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] : undefined;
  const semana = expandir(eventos, sumarDias(hoy, 1), sumarDias(hoy, 6)).filter((o) => o.tipo !== "viaje" || o.dia === o.fecha);
  const porDia = new Map<string, Ocurrencia[]>();
  for (const o of semana) porDia.set(o.dia, [...(porDia.get(o.dia) ?? []), o]);

  return (
    <div>
      {/* Encabezado tipo página de agenda */}
      <header className="mb-6 flex items-end gap-4 border-b border-line pb-4">
        <div className="mr-auto min-w-0">
          <p className="versalitas text-muted">{nombre ? `Hola, ${nombre}` : "Tu agenda"}</p>
          <h1 className="serif mt-1 text-5xl leading-[0.95] sm:text-6xl">{DIAS_LARGOS[d.getDay()]}</h1>
          <p className="serif mt-1 text-xl italic text-accent">
            {d.getDate()} de {MESES[d.getMonth()].toLowerCase()}
          </p>
        </div>
        <div className="grid h-[72px] w-[72px] shrink-0 -rotate-6 place-items-center rounded-full border-2 border-dashed border-accent/60 text-center text-accent">
          <span className="leading-none">
            <span className="serif block text-3xl">{linea.length}</span>
            <span className="versalitas text-[0.55rem]">hoy</span>
          </span>
        </div>
      </header>

      {pro && !ocultos.has("domingo") && <AvisoDomingo eventos={todos} pagos={pagosFijos} hechos={pagosHechos} hoy={hoy} onVer={onTuSemana} />}
      {viaje && <Boleto e={viaje} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(viaje)} enCurso extra={extraViaje(cosas, viaje.id)} />}
      {planesHoy.length > 0 && (
        <ul className="-mt-3 mb-6 rounded-b-2xl border border-t-0 border-line bg-panel/70 px-4 py-2 text-sm">
          {planesHoy.map((c) => (
            <li key={c.id} className="flex gap-3 py-0.5">
              <span className="w-11 shrink-0 tabular-nums text-muted">{c.hora ? hm(c.hora) : "—"}</span>
              <span className="min-w-0 flex-1 truncate">{c.tipo === "reserva" ? "📌 " : ""}{c.titulo}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Línea del tiempo */}
      <section className="mb-8">
        {todoElDia.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1.5">
            {todoElDia.map((o) => (
              <li key={`${o.id}-${o.dia}`}>
                <button onClick={() => onAbrir(o)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-left hover:bg-panel-2">
                  <span className="versalitas w-14 shrink-0 text-muted">Todo el día</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorDe(o, catPorId) }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{o.titulo}</span>
                  {o.tipo === "recordatorio" && <span className="text-muted"><Ico d={ICONO_TIPO.recordatorio} size={15} /></span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {conHora.length === 0 && todoElDia.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
            <p className="serif text-2xl">Día libre.</p>
            <p className="mt-1 text-sm text-muted">{odonto ? "Disfrútalo… o adelanta ese caso clínico." : "Disfrútalo… o adelanta pendientes. Tú sabes."}</p>
            <button onClick={() => onNuevo()} className="btn btn-sec mt-4 rounded-full">Anotar algo para hoy</button>
          </div>
        ) : (
          <ol className="relative">
            {conHora.map((o, i) => {
              const paso = (hm(o.hora_fin) || hm(o.hora_inicio)) <= ahora;
              const color = colorDe(o, catPorId);
              return (
                <li key={`${o.id}-${o.dia}`}>
                  {i === iAhora && <MarcaAhora ahora={ahora} />}
                  <div className={`grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] items-stretch ${paso ? "opacity-55" : ""}`}>
                    <span className="serif pt-2.5 text-lg leading-none tabular-nums">{hm(o.hora_inicio)}</span>
                    <span className="relative flex justify-center">
                      <span className="absolute inset-y-0 w-px bg-line" />
                      <span className="relative mt-3 h-3 w-3 rounded-full ring-4 ring-bg" style={{ background: color }} />
                    </span>
                    <button onClick={() => onAbrir(o)} className="mb-2.5 min-w-0 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-left shadow-[0_1px_0_var(--line)] transition hover:-translate-y-px hover:bg-panel-2">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{o.titulo}</span>
                        {o.tipo === "recordatorio" && <span className="text-muted"><Ico d={ICONO_TIPO.recordatorio} size={15} /></span>}
                        {o.serie && <span className="text-muted" title="Se repite"><Ico d={I.repite} size={14} /></span>}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        {o.hora_fin && <span>hasta las {hm(o.hora_fin)}</span>}
                        {o.lugar && <span className="inline-flex min-w-0 items-center gap-1 truncate"><Ico d={I.lugar} size={12} />{o.lugar}</span>}
                        {o.categoria_id && catPorId.get(o.categoria_id) && <span style={{ color }}>{catPorId.get(o.categoria_id)!.nombre}</span>}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
            {iAhora === -1 && conHora.length > 0 && <MarcaAhora ahora={ahora} fin />}
          </ol>
        )}
      </section>

      {!ocultos.has("habitos") && <HabitosHoy habitos={habitos} marcas={marcas} hoy={hoy} acciones={acciones} onVer={onHabitos} onNuevo={onNuevoHabito} />}

      {/* 2.8 · Atajos a Viajes y Pagos (lo de Pro, a la vista) */}
      {!ocultos.has("atajos") && <Atajos todos={todos} hoy={hoy} pagosFijos={pagosFijos} pagosHechos={pagosHechos} pro={pro} onViajes={onViajes} onPagos={onPagos} />}

      {/* Pendientes y entregas: post-it */}
      {!ocultos.has("postit") && (
      <section className="nota mb-8 -rotate-[0.6deg] rounded-sm p-5 shadow-[0_10px_20px_-12px_rgba(60,45,10,0.45)]">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="serif text-2xl">No se te olvide</h2>
          <button onClick={onPendientes} className="text-xs underline-offset-2 opacity-75 hover:underline">{sinFecha ? `+${sinFecha} sin fecha →` : "Pendientes →"}</button>
        </div>
        {vencidas.length + proximas.length + pendHoy.length + pagosHoy.length === 0 ? (
          <p className="serif text-lg italic opacity-80">Nada pendiente. Milagro.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pagosHoy.map((v) => <RenglonPago key={`${v.pago.id}-${v.fecha}`} v={v} hoy={hoy} acciones={accionesVP} />)}
            {pendHoy.map((p) => (
              <li key={p.id} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--nota-ink)]" checked={p.hecho} onChange={(x) => acciones.marcarPendiente(p, x.target.checked)} aria-label={`Hecho: ${p.titulo}`} />
                <button onClick={() => onEditarPendiente(p)} className={`min-w-0 flex-1 text-left leading-snug ${p.hecho ? "line-through opacity-60" : ""}`}>{p.titulo}</button>
                <span className={`shrink-0 text-xs ${p.fecha! < hoy ? "font-bold text-danger" : "opacity-75"}`}>{p.fecha! < hoy ? `atrasado ${diasEntre(p.fecha!, hoy)} d` : "hoy"}</span>
              </li>
            ))}
            {[...vencidas, ...proximas].map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--nota-ink)]" checked={e.hecho} onChange={(x) => onMarcar(e, x.target.checked)} aria-label={`Entregada: ${e.titulo}`} />
                <button onClick={() => onAbrir({ ...e, dia: e.fecha, serie: false })} className="min-w-0 flex-1 text-left leading-snug">{e.titulo}</button>
                <span className={`shrink-0 text-xs ${e.fecha < hoy ? "font-bold text-danger" : e.fecha === hoy ? "font-bold" : "opacity-75"}`}>
                  {e.fecha < hoy ? `entrega atrasada ${diasEntre(e.fecha, hoy)} d` : `entrega ${cuando(hoy, e.fecha)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      )}

      {proximoViaje && !ocultos.has("viaje") && (
        <div className="mb-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="serif text-2xl">Tu próximo viaje</h2>
            <button onClick={onViajes} className="text-sm font-medium text-accent hover:underline">Todos</button>
          </div>
          <Boleto e={{ ...proximoViaje, dia: proximoViaje.fecha, serie: false }} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir({ ...proximoViaje, dia: proximoViaje.fecha, serie: false })} extra={extraViaje(cosas, proximoViaje.id)} />
        </div>
      )}

      {!ocultos.has("fechas") && <FechasQueVienen fechas={fechas} hoy={hoy} onAbrir={onAbrir} />}

      {/* Lo que viene */}
      {!ocultos.has("viene") && (
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="serif text-2xl">Lo que viene</h2>
          <button onClick={onSemana} className="text-sm font-medium text-accent hover:underline">Ver la semana</button>
        </div>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
          {Array.from({ length: 6 }, (_, i) => sumarDias(hoy, i + 1)).map((dia) => {
            const os = porDia.get(dia) ?? [];
            const dd = deISO(dia);
            return (
              <li key={dia}>
                <button onClick={() => (os[0] ? onAbrir(os[0]) : onNuevo(dia))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel-2">
                  <span className="w-12 shrink-0">
                    <span className="versalitas block text-muted">{DIAS_CORTOS_LUNES[(dd.getDay() + 6) % 7]}</span>
                    <span className="serif block text-xl leading-none">{dd.getDate()}</span>
                  </span>
                  {os.length === 0 ? (
                    <span className="text-sm italic text-muted">libre</span>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {os.slice(0, 3).map((o) => (
                        <span key={o.id} className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs" style={{ background: `${colorDe(o, catPorId)}1f`, color: colorDe(o, catPorId) }}>
                          {o.tipo === "viaje" ? "✈" : o.hora_inicio ? hm(o.hora_inicio) : o.tipo === "entrega" ? "Entrega" : ""} <span className="truncate">{o.titulo}</span>
                        </span>
                      ))}
                      {os.length > 3 && <span className="text-xs text-muted">+{os.length - 3}</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      )}

      <button onClick={onPersonalizar} className="mx-auto mt-6 flex items-center gap-1.5 rounded-full border border-dashed border-line px-4 py-1.5 text-xs text-muted hover:border-accent hover:text-accent">
        🧩 Personalizar Hoy{ocultos.size ? ` · ${ocultos.size} oculto${ocultos.size === 1 ? "" : "s"}` : ""}
      </button>
    </div>
  );
}

function Atajos({ todos, hoy, pagosFijos, pagosHechos, pro, onViajes, onPagos }: { todos: PEvento[]; hoy: string; pagosFijos: PPagoFijo[]; pagosHechos: PPagoHecho[]; pro: boolean; onViajes: () => void; onPagos: () => void }) {
  const viajes = todos.filter((e) => e.tipo === "viaje" && (e.fecha_fin ?? e.fecha) >= hoy).length;
  const d = deISO(hoy);
  const mesT = totalMes(pagosFijos, pagosHechos, d.getFullYear(), d.getMonth());
  const tarjeta = (titulo: string, detalle: string, icono: string, onClick: () => void, candado: boolean) => (
    <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-panel px-3.5 py-3 text-left hover:bg-panel-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={icono} size={17} /></span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-medium">{titulo}{candado && <span className="versalitas flex items-center gap-0.5 rounded-full bg-accent-soft px-1.5 text-accent"><Ico d={I.candado} size={10} />Pro</span>}</span>
        <span className="block truncate text-xs text-muted">{detalle}</span>
      </span>
    </button>
  );
  return (
    <div className="mb-8 flex gap-2.5">
      {tarjeta("Viajes", viajes ? `${viajes} por venir` : "Planea el próximo", I.viajes, onViajes, !pro && !viajes)}
      {tarjeta("Pagos", pagosFijos.length ? (mesT.falta ? `Faltan ${pesos(mesT.falta)} este mes` : "Todo pagado este mes ✓") : "Que no se te pase ninguno", I.pagos, onPagos, !pro && !pagosFijos.length)}
    </div>
  );
}

function MarcaAhora({ ahora, fin = false }: { ahora: string; fin?: boolean }) {
  return (
    <div className={`grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] items-center ${fin ? "mt-1" : "mb-2.5"}`}>
      <span className="versalitas text-accent">{ahora}</span>
      <span className="flex justify-center"><span className="h-2 w-2 rounded-full bg-accent" /></span>
      <span className="h-px bg-accent/70" />
    </div>
  );
}
