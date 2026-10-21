"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePersonal } from "@/lib/usePersonal";
import { aISO, deISO, diasDelMes, DIAS_CORTOS_LUNES, fechaLarga, hoyISO, MESES } from "@/lib/fechas";
import { sumarDias, diasEntre } from "@/lib/pagos";
import { entregasPendientes, expandir, ICONO_TIPO, textoHora, type Ocurrencia, type PCategoria, type PEvento, type TipoEvento } from "@/lib/personal";
import EventoModal from "@/components/personal/EventoModal";

type Modal = { evento: PEvento | Ocurrencia | null; fecha: string; tipo?: TipoEvento };

export default function AgendaPersonal({ userId, nombre, tieneClinica, demo = false }: { userId: string; nombre: string; tieneClinica: boolean; demo?: boolean }) {
  const { supabase, eventos, categorias, error, recargar, setEventos } = usePersonal(demo);
  const hoy = hoyISO();
  const [anio, setAnio] = useState(deISO(hoy).getFullYear());
  const [mes, setMes] = useState(deISO(hoy).getMonth());
  const [sel, setSel] = useState(hoy);
  const [vista, setVista] = useState<"mes" | "lista">("mes");
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!demo) document.cookie = "ultima_agenda=personal; path=/; max-age=31536000; samesite=lax";
  }, [demo]);
  const aClinicas = () => { document.cookie = "ultima_agenda=clinicas; path=/; max-age=31536000; samesite=lax"; };

  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const visibles = useMemo(() => (eventos ?? []).filter((e) => !e.categoria_id || !ocultas.has(e.categoria_id)), [eventos, ocultas]);
  const dias = useMemo(() => diasDelMes(anio, mes, true), [anio, mes]);
  const desde = aISO(dias[0]);
  const hasta = aISO(dias[dias.length - 1]);
  const porDia = useMemo(() => {
    const m = new Map<string, Ocurrencia[]>();
    for (const o of expandir(visibles, desde, hasta)) m.set(o.dia, [...(m.get(o.dia) ?? []), o]);
    return m;
  }, [visibles, desde, hasta]);
  const lista = useMemo(() => expandir(visibles, hoy, sumarDias(hoy, 60)), [visibles, hoy]);
  const delDia = useMemo(() => expandir(visibles, sel, sel), [visibles, sel]);

  function mover(n: number) {
    const d = new Date(anio, mes + n, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  }
  function irAHoy() {
    const d = deISO(hoy);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
    setSel(hoy);
  }
  function guardado(fecha: string) {
    setModal(null);
    setSel(fecha);
    const d = deISO(fecha);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
    recargar();
  }
  async function marcar(e: PEvento, hecho: boolean) {
    if (demo) {
      setEventos((l) => (l ?? []).map((x) => (x.id === e.id ? { ...x, hecho } : x)));
      return;
    }
    await supabase.from("p_eventos").update({ hecho, hecho_at: hecho ? new Date().toISOString() : null }).eq("id", e.id);
    recargar();
  }
  function toggleCat(id: string) {
    const s = new Set(ocultas);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setOcultas(s);
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {demo && <BannerDemo />}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Mi agenda</h1>
          <p className="text-sm text-muted">{nombre ? `Hola, ${nombre}` : "Tu agenda personal"}</p>
        </div>
        {!demo && <><div className="hidden items-center gap-2 sm:flex">
          {tieneClinica && <Link href="/" onClick={aClinicas} className="btn btn-sec" title="Cambiar a tu agenda de clínicas">Agenda de clínicas</Link>}
          <Link href="/personal/ajustes" className="btn btn-sec">Ajustes</Link>
          <form action="/auth/salir" method="post"><button className="btn btn-sec">Salir</button></form>
        </div>
        <div className="relative sm:hidden">
          <button onClick={() => setMenu(!menu)} className="btn btn-sec" aria-label="Más opciones" aria-expanded={menu}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-panel py-1 text-sm shadow-xl">
                {tieneClinica && <Link href="/" onClick={aClinicas} className="block px-4 py-2.5 hover:bg-panel-2">Agenda de clínicas</Link>}
                <Link href="/personal/ajustes" className="block px-4 py-2.5 hover:bg-panel-2">Ajustes</Link>
                <form action="/auth/salir" method="post"><button className="block w-full px-4 py-2.5 text-left hover:bg-panel-2">Salir</button></form>
              </div>
            </>
          )}
        </div></>}
      </header>

      {error && <p className="mb-4 rounded-xl bg-panel-2 p-3 text-sm text-danger">No se pudo cargar tu agenda: {error}</p>}

      {eventos && <Hoy eventos={visibles} todos={eventos} hoy={hoy} catPorId={catPorId} onAbrir={(o) => setModal({ evento: o, fecha: o.dia })} onMarcar={marcar} />}

      {/* Botones rápidos */}
      <div className="mb-4 flex flex-wrap gap-2">
        {([["evento", "+ Evento"], ["viaje", "+ Viaje"], ["entrega", "+ Entrega"], ["recordatorio", "+ Recordatorio"]] as [TipoEvento, string][]).map(([t, txt]) => (
          <button key={t} onClick={() => setModal({ evento: null, fecha: sel >= hoy ? sel : hoy, tipo: t })} className={`btn ${t === "evento" ? "btn-primario" : "btn-sec"}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONO_TIPO[t]} /></svg>
            {txt.slice(2)}
          </button>
        ))}
      </div>

      <div className={`grid gap-5 ${vista === "mes" ? "lg:grid-cols-[1fr_340px]" : ""}`}>
        <section className="min-w-0 rounded-2xl border border-line bg-panel p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {vista === "mes" && (
              <>
                <div className="flex items-center gap-1">
                  <button className="btn btn-sec px-2.5" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
                  <button className="btn btn-sec px-2.5" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
                </div>
                <h2 className="text-lg font-semibold">{MESES[mes]} {anio}</h2>
                <button className="btn btn-sec ml-1 py-1 text-xs" onClick={irAHoy}>Hoy</button>
              </>
            )}
            {vista === "lista" && <h2 className="text-lg font-semibold">Próximos 60 días</h2>}
            <div className="ml-auto flex rounded-lg border border-line p-0.5 text-xs font-medium">
              {(["mes", "lista"] as const).map((v) => (
                <button key={v} onClick={() => setVista(v)} className={`rounded-md px-2.5 py-1 ${vista === v ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>
                  {v === "mes" ? "Mes" : "Lista"}
                </button>
              ))}
            </div>
          </div>

          {categorias.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  aria-pressed={!ocultas.has(c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs ${ocultas.has(c.id) ? "text-muted line-through opacity-60" : ""}`}
                  title={ocultas.has(c.id) ? "Mostrar" : "Ocultar"}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.nombre}
                </button>
              ))}
            </div>
          )}

          {!eventos ? (
            <p className="py-10 text-center text-sm text-muted">Cargando…</p>
          ) : vista === "mes" ? (
            <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line text-xs">
              {DIAS_CORTOS_LUNES.map((d) => (
                <div key={d} className="border-b border-line bg-panel-2 py-1.5 text-center font-medium text-muted">{d}</div>
              ))}
              {dias.map((d, i) => {
                const iso = aISO(d);
                const os = porDia.get(iso) ?? [];
                const fuera = d.getMonth() !== mes;
                return (
                  <button
                    key={iso}
                    onClick={() => setSel(iso)}
                    className={`flex min-h-[76px] flex-col items-stretch justify-start border-line p-1 text-left transition sm:min-h-[96px] ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${fuera ? "bg-panel-2/60 text-muted" : ""} ${sel === iso ? "ring-2 ring-inset ring-accent" : "hover:bg-panel-2"}`}
                  >
                    <span className={`mb-0.5 inline-grid h-6 w-6 place-items-center rounded-full text-[12px] ${iso === hoy ? "bg-accent font-semibold text-panel" : ""}`}>{d.getDate()}</span>
                    <div className="flex flex-col gap-0.5">
                      {os.slice(0, 3).map((o) => <Chip key={`${o.id}-${iso}`} o={o} cat={o.categoria_id ? catPorId.get(o.categoria_id) : undefined} dia={iso} />)}
                      {os.length > 3 && <span className="px-1 text-[10px] text-muted">+{os.length - 3} más</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <VistaLista os={lista} hoy={hoy} catPorId={catPorId} onAbrir={(o) => setModal({ evento: o, fecha: o.dia })} onMarcar={marcar} />
          )}
        </section>

        {vista === "mes" && (
          <aside className="rounded-2xl border border-line bg-panel p-4">
            <div className="mb-3 flex items-start gap-2">
              <div className="mr-auto">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{sel === hoy ? "Hoy" : sel === sumarDias(hoy, 1) ? "Mañana" : "Día"}</p>
                <h3 className="text-lg font-semibold first-letter:uppercase">{fechaLarga(sel)}</h3>
              </div>
              <button className="btn btn-primario shrink-0" onClick={() => setModal({ evento: null, fecha: sel })}>+ Nuevo</button>
            </div>
            {delDia.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Nada este día.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {delDia.map((o) => (
                  <li key={`${o.id}-${o.dia}`}>
                    <Tarjeta o={o} cat={o.categoria_id ? catPorId.get(o.categoria_id) : undefined} hoy={hoy} onAbrir={() => setModal({ evento: o, fecha: o.dia })} onMarcar={marcar} />
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-muted">{demo ? "Demo con datos de ejemplo · no se guarda nada" : "Mi agenda · sólo tú la ves"}</p>

      {modal && (
        <EventoModal
          key={`${modal.evento?.id ?? "nuevo"}-${modal.fecha}-${modal.tipo ?? ""}`}
          supabase={supabase}
          userId={userId}
          evento={modal.evento}
          fechaInicial={modal.fecha}
          tipoInicial={modal.tipo}
          categorias={categorias}
          onClose={() => setModal(null)}
          onGuardado={guardado}
          demo={demo}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

const ico = (t: TipoEvento) => (t === "viaje" ? "✈ " : t === "entrega" ? "📌 " : t === "recordatorio" ? "🔔 " : "");

function Chip({ o, cat, dia }: { o: Ocurrencia; cat?: PCategoria; dia: string }) {
  const color = cat?.color ?? "#6b7280";
  if (o.tipo === "viaje") {
    const inicio = dia === o.fecha;
    return (
      <span className="truncate rounded px-1 py-px text-[10px] font-medium text-white" style={{ background: color }} title={o.titulo}>
        {inicio ? `✈ ${o.titulo}` : `↳ ${o.titulo}`}
      </span>
    );
  }
  return (
    <span className={`truncate rounded px-1 py-px text-[10px] ${o.tipo === "entrega" && o.hecho ? "line-through opacity-60" : ""}`} style={{ background: `${color}22`, color }} title={o.titulo}>
      {o.hora_inicio && <span className="hidden sm:inline">{o.hora_inicio.slice(0, 5)} </span>}{ico(o.tipo)}{o.titulo}
    </span>
  );
}

function Tarjeta({ o, cat, hoy, onAbrir, onMarcar }: { o: Ocurrencia; cat?: PCategoria; hoy: string; onAbrir: () => void; onMarcar: (e: PEvento, h: boolean) => void }) {
  const color = cat?.color ?? "#6b7280";
  const vencida = o.tipo === "entrega" && !o.hecho && o.fecha < hoy;
  const dias = o.tipo === "viaje" && o.fecha_fin ? diasEntre(o.fecha, o.fecha_fin) + 1 : 0;
  return (
    <div className="flex items-stretch rounded-xl border border-line" style={{ borderLeft: `4px solid ${color}` }}>
      {o.tipo === "entrega" && (
        <label className="grid place-items-center border-r border-line px-3" title={o.hecho ? "Marcar como pendiente" : "Ya la entregué"}>
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={o.hecho} onChange={(e) => onMarcar(o, e.target.checked)} aria-label="Entregada" />
        </label>
      )}
      <button onClick={onAbrir} className="min-w-0 flex-1 rounded-r-xl p-3 text-left hover:bg-panel-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate font-medium ${o.tipo === "entrega" && o.hecho ? "text-muted line-through" : ""}`}>{ico(o.tipo)}{o.titulo}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {o.tipo === "viaje" ? `${dias} día${dias === 1 ? "" : "s"}` : o.tipo === "entrega" ? (vencida ? <b className="text-danger">Atrasada</b> : "Entrega") : textoHora(o)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {cat && <span className="rounded-md px-1.5 py-0.5" style={{ background: `${color}22`, color }}>{cat.nombre}</span>}
          {o.tipo === "viaje" && o.fecha_fin && <span>{fechaLarga(o.fecha)} → {fechaLarga(o.fecha_fin)}</span>}
          {o.lugar && <span className="truncate">📍 {o.lugar}</span>}
          {o.serie && <span title="Se repite">↻</span>}
        </div>
        {o.notas && <p className="mt-1 line-clamp-2 text-xs text-muted">{o.notas}</p>}
      </button>
    </div>
  );
}

function Hoy({ eventos, todos, hoy, catPorId, onAbrir, onMarcar }: { eventos: PEvento[]; todos: PEvento[]; hoy: string; catPorId: Map<string, PCategoria>; onAbrir: (o: Ocurrencia) => void; onMarcar: (e: PEvento, h: boolean) => void }) {
  const deHoy = expandir(eventos, hoy, hoy).filter((o) => o.tipo !== "entrega");
  const viaje = deHoy.find((o) => o.tipo === "viaje");
  const resto = deHoy.filter((o) => o.tipo !== "viaje");
  const { vencidas, proximas } = entregasPendientes(todos, hoy, 7);
  const proximoViaje = !viaje ? todos.filter((e) => e.tipo === "viaje" && e.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] : undefined;

  return (
    <section className="mb-5 grid gap-3 lg:grid-cols-2">
      <div className="min-w-0 rounded-2xl border border-line bg-panel p-4">
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="font-semibold">Hoy</h2>
          <span className="text-sm text-muted first-letter:uppercase">{fechaLarga(hoy)}</span>
        </div>
        {viaje && (
          <p className="mb-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
            ✈ Estás de viaje: <b>{viaje.titulo}</b>
            {viaje.fecha_fin && <> · día {diasEntre(viaje.fecha, hoy) + 1} de {diasEntre(viaje.fecha, viaje.fecha_fin) + 1}</>}
          </p>
        )}
        {resto.length === 0 && !viaje ? (
          <p className="text-sm text-muted">
            Nada agendado para hoy.
            {proximoViaje && <> Tu próximo viaje: <b>{proximoViaje.titulo}</b> en {diasEntre(hoy, proximoViaje.fecha)} día{diasEntre(hoy, proximoViaje.fecha) === 1 ? "" : "s"}.</>}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {resto.map((o) => {
              const c = o.categoria_id ? catPorId.get(o.categoria_id) : undefined;
              return (
                <li key={`${o.id}-${o.dia}`}>
                  <button onClick={() => onAbrir(o)} className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c?.color ?? "#6b7280" }} />
                    <span className="w-[5.5rem] shrink-0 tabular-nums text-muted sm:w-24">{textoHora(o)}</span>
                    <span className="min-w-0 truncate">{ico(o.tipo)}{o.titulo}</span>
                    {o.lugar && <span className="ml-auto hidden truncate text-xs text-muted sm:inline">📍 {o.lugar}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="min-w-0 rounded-2xl border border-line bg-panel p-4">
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="font-semibold">Por entregar</h2>
          <span className="text-sm text-muted">próximos 7 días</span>
        </div>
        {vencidas.length + proximas.length === 0 ? (
          <p className="text-sm text-muted">Nada pendiente. Milagro.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...vencidas, ...proximas].map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={e.hecho} onChange={(x) => onMarcar(e, x.target.checked)} aria-label={`Entregada: ${e.titulo}`} />
                <button onClick={() => onAbrir({ ...e, dia: e.fecha, serie: false })} className="min-w-0 flex-1 truncate text-left">{e.titulo}</button>
                <span className={`shrink-0 text-xs ${e.fecha < hoy ? "font-semibold text-danger" : e.fecha === hoy ? "font-semibold text-accent" : "text-muted"}`}>
                  {e.fecha < hoy ? `atrasada ${diasEntre(e.fecha, hoy)} d` : e.fecha === hoy ? "hoy" : e.fecha === sumarDias(hoy, 1) ? "mañana" : `en ${diasEntre(hoy, e.fecha)} d`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function VistaLista({ os, hoy, catPorId, onAbrir, onMarcar }: { os: Ocurrencia[]; hoy: string; catPorId: Map<string, PCategoria>; onAbrir: (o: Ocurrencia) => void; onMarcar: (e: PEvento, h: boolean) => void }) {
  // Los viajes sólo se listan el día que empiezan (o hoy, si ya vas en camino)
  const filtradas = os.filter((o) => o.tipo !== "viaje" || o.dia === o.fecha || o.dia === hoy);
  const grupos = new Map<string, Ocurrencia[]>();
  for (const o of filtradas) grupos.set(o.dia, [...(grupos.get(o.dia) ?? []), o]);
  if (!grupos.size) return <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Nada en los próximos 60 días. Agenda algo, ¿no?</p>;
  return (
    <div className="flex flex-col gap-4">
      {[...grupos].map(([dia, lista]) => (
        <div key={dia}>
          <p className="mb-1.5 text-sm font-semibold first-letter:uppercase">
            {dia === hoy ? "Hoy · " : dia === sumarDias(hoy, 1) ? "Mañana · " : ""}{fechaLarga(dia)}
          </p>
          <ul className="flex flex-col gap-2">
            {lista.map((o) => (
              <li key={`${o.id}-${o.dia}`}>
                <Tarjeta o={o} cat={o.categoria_id ? catPorId.get(o.categoria_id) : undefined} hoy={hoy} onAbrir={() => onAbrir(o)} onMarcar={onMarcar} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Barra de la demo: es de mentiritas, y el botón para pedirla de verdad. */
function BannerDemo() {
  const [estado, setEstado] = useState<"" | "enviando" | "pendiente" | "tiene">("");
  async function pedir() {
    setEstado("enviando");
    const r = await fetch("/api/personal/solicitud", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setEstado(d.estado === "tiene" ? "tiene" : "pendiente");
  }
  return (
    <div className="sticky top-2 z-30 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
      <p className="w-full text-accent sm:w-auto sm:flex-1">
        <b>Esto es una demo</b> con datos de ejemplo: pícale a todo, no se guarda nada.
      </p>
      {estado === "pendiente" ? (
        <span className="font-medium text-accent">¡Listo! Te avisamos por correo cuando esté.</span>
      ) : estado === "tiene" ? (
        <a href="/personal" className="btn btn-primario py-1.5 text-xs">Abrir mi agenda</a>
      ) : (
        <button onClick={pedir} disabled={estado === "enviando"} className="btn btn-primario py-1.5 text-xs">{estado === "enviando" ? "Pidiendo…" : "La quiero"}</button>
      )}
      <a href="/personalizar#personal" className="btn btn-sec py-1.5 text-xs">Salir de la demo</a>
    </div>
  );
}
