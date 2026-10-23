"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sumarDias, diasEntre } from "@/lib/pagos";
import { deISO, MESES } from "@/lib/fechas";
import { DIAS_LETRA, PALETA_HABITOS, mejorRacha, rachaActual, tocaHabito, type Ocurrencia, type PHabito, type PMarca, type PPendiente } from "@/lib/personal";

// 2.4 · Pendientes (por hacer / algún día, con subtareas) y hábitos con racha. Todo Gratis, sin tope.

type Set_<T> = (f: (x: T) => T) => void;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const corta = (iso: string) => `${deISO(iso).getDate()} ${MESES[deISO(iso).getMonth()].slice(0, 3).toLowerCase()}`;
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function Ico({ d, size = 18, w = 1.9 }: { d: string; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
export const ICONO_LISTAS = {
  pendiente: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  habito: "M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3.5 3C13 8 12 5 9 2c0 4-4 7-4 13 0 4 3 7 7 7z",
  check: "M5 12.5 10 17 19 7",
  pastel: "M4 21h16M5 21v-7h14v7M8 14V11M12 14V11M16 14V11M8 8.5a1 1 0 0 0 0-2M12 8.5a1 1 0 0 0 0-2M16 8.5a1 1 0 0 0 0-2",
  lapiz: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  basura: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
};

/* =============================== Acciones =============================== */

/** Guardar/palomear/borrar pendientes y hábitos: se ve al instante y se manda al servidor detrás. */
export function useAccionesListas({
  supabase, demo, setPendientes, setHabitos, setMarcas, recargar,
}: {
  supabase: SupabaseClient; demo: boolean;
  setPendientes: Set_<PPendiente[]>; setHabitos: Set_<PHabito[]>; setMarcas: Set_<PMarca[]>; recargar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  async function servidor(p: PromiseLike<{ error: { message: string } | null }>) {
    if (demo) return;
    const r = await p;
    if (r.error) {
      setError(/does not exist|schema cache/i.test(r.error.message) ? "Falta actualizar la base de datos (SQL 2.4)." : r.error.message);
      recargar();
    } else setError(null);
  }
  return {
    error,
    async guardarPendiente(p: Partial<PPendiente> & { titulo: string }) {
      const id = p.id ?? uid();
      const datos = { titulo: p.titulo.trim().slice(0, 200), notas: p.notas?.trim() || null, lista: p.lista ?? "hacer", fecha: p.fecha || null, padre_id: p.padre_id ?? null };
      const nuevo = !p.id;
      setPendientes((l) => {
        if (!nuevo) return l.map((x) => (x.id === id ? { ...x, ...datos } : x));
        return [...l, { id, user_id: "", hecho: false, hecho_at: null, orden: Date.now() / 1000, created_at: new Date().toISOString(), ...datos }];
      });
      if (nuevo) await servidor(supabase.from("p_pendientes").insert({ id, ...datos, orden: Date.now() / 1000 }));
      else await servidor(supabase.from("p_pendientes").update(datos).eq("id", id));
    },
    async marcarPendiente(p: PPendiente, hecho: boolean) {
      const hecho_at = hecho ? new Date().toISOString() : null;
      setPendientes((l) => l.map((x) => (x.id === p.id ? { ...x, hecho, hecho_at } : x)));
      await servidor(supabase.from("p_pendientes").update({ hecho, hecho_at }).eq("id", p.id));
    },
    async moverPendiente(p: PPendiente, lista: PPendiente["lista"]) {
      setPendientes((l) => l.map((x) => (x.id === p.id ? { ...x, lista } : x)));
      await servidor(supabase.from("p_pendientes").update({ lista }).eq("id", p.id));
    },
    async borrarPendientes(ids: string[]) {
      if (!ids.length) return;
      setPendientes((l) => l.filter((x) => !ids.includes(x.id) && !(x.padre_id && ids.includes(x.padre_id))));
      await servidor(supabase.from("p_pendientes").delete().in("id", ids));
    },
    async guardarHabito(h: Partial<PHabito> & { nombre: string }) {
      const id = h.id ?? uid();
      const datos = { nombre: h.nombre.trim().slice(0, 60), color: h.color ?? PALETA_HABITOS[0], dias: h.dias?.length ? [...h.dias].sort() : [0, 1, 2, 3, 4, 5, 6], archivado: h.archivado ?? false };
      const nuevo = !h.id;
      setHabitos((l) => {
        if (!nuevo) return l.map((x) => (x.id === id ? { ...x, ...datos } : x));
        return [...l, { id, user_id: "", orden: Date.now() / 1000, created_at: new Date().toISOString(), ...datos }];
      });
      if (nuevo) await servidor(supabase.from("p_habitos").insert({ id, ...datos, orden: Date.now() / 1000 }));
      else await servidor(supabase.from("p_habitos").update(datos).eq("id", id));
    },
    async borrarHabito(h: PHabito) {
      setHabitos((l) => l.filter((x) => x.id !== h.id));
      setMarcas((l) => l.filter((m) => m.habito_id !== h.id));
      await servidor(supabase.from("p_habitos").delete().eq("id", h.id));
    },
    async marcarHabito(h: PHabito, fecha: string, si: boolean) {
      setMarcas((l) => (si ? [...l.filter((m) => !(m.habito_id === h.id && m.fecha === fecha)), { habito_id: h.id, fecha }] : l.filter((m) => !(m.habito_id === h.id && m.fecha === fecha))));
      if (si) await servidor(supabase.from("p_habito_marcas").upsert({ habito_id: h.id, fecha }, { onConflict: "habito_id,fecha", ignoreDuplicates: true }));
      else await servidor(supabase.from("p_habito_marcas").delete().eq("habito_id", h.id).eq("fecha", fecha));
    },
  };
}
export type AccionesListas = ReturnType<typeof useAccionesListas>;

/** Marcas agrupadas por hábito (para rachas y la cuadrícula). */
export function useMarcasPorHabito(marcas: PMarca[]) {
  return useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const x of marcas) {
      if (!m.has(x.habito_id)) m.set(x.habito_id, new Set());
      m.get(x.habito_id)!.add(x.fecha);
    }
    return m;
  }, [marcas]);
}

/* =============================== Ventanas =============================== */

function Ventana({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <p className="serif mb-4 text-2xl">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

export function PendienteModal({
  pendiente, fechaInicial, listaInicial = "hacer", acciones, onClose,
}: { pendiente: PPendiente | null; fechaInicial?: string | null; listaInicial?: PPendiente["lista"]; acciones: AccionesListas; onClose: () => void }) {
  const [titulo, setTitulo] = useState(pendiente?.titulo ?? "");
  const [lista, setLista] = useState<PPendiente["lista"]>(pendiente?.lista ?? listaInicial);
  const [conFecha, setConFecha] = useState(!!(pendiente?.fecha ?? fechaInicial));
  const [fecha, setFecha] = useState(pendiente?.fecha ?? fechaInicial ?? sumarDias(new Date().toISOString().slice(0, 10), 0));
  const [notas, setNotas] = useState(pendiente?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const sub = !!pendiente?.padre_id;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setError("¿Qué hay que hacer?");
    acciones.guardarPendiente({ id: pendiente?.id, padre_id: pendiente?.padre_id ?? null, titulo, notas, lista: sub ? "hacer" : lista, fecha: conFecha && lista === "hacer" ? fecha : null });
    onClose();
  }
  return (
    <Ventana titulo={pendiente ? (sub ? "Subtarea" : "Pendiente") : "Nuevo pendiente"} onClose={onClose}>
      <form onSubmit={guardar}>
        <input autoFocus className="campo mb-3 text-lg" placeholder="Ej. Pagar la luz" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} />
        {!sub && (
          <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lista">
            {([["hacer", "Por hacer", "Lo de estos días"], ["algun_dia", "Algún día", "Sin prisa, para no olvidarlo"]] as const).map(([id, t, d]) => (
              <button key={id} type="button" role="radio" aria-checked={lista === id} onClick={() => setLista(id)} className={`rounded-xl border px-3 py-2 text-left ${lista === id ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2"}`}>
                <span className={`block text-sm font-semibold ${lista === id ? "text-accent" : ""}`}>{t}</span>
                <span className="text-xs text-muted">{d}</span>
              </button>
            ))}
          </div>
        )}
        {lista === "hacer" && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={conFecha} onChange={(e) => setConFecha(e.target.checked)} /> Para el…
            </label>
            {conFecha && <input type="date" className="campo w-auto py-1.5" value={fecha} onChange={(e) => setFecha(e.target.value)} />}
            {conFecha && <span className="text-xs text-muted">sale en Hoy ese día</span>}
          </div>
        )}
        <textarea className="campo mb-4 min-h-[70px]" placeholder="Notas (opcional)" value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          {pendiente && (
            borrar ? (
              <button type="button" className="btn rounded-full bg-danger px-4 text-white" onClick={() => { acciones.borrarPendientes([pendiente.id]); onClose(); }}>¿Seguro? Borrar</button>
            ) : (
              <button type="button" className="btn btn-sec rounded-full text-danger" onClick={() => setBorrar(true)} aria-label="Borrar"><Ico d={ICONO_LISTAS.basura} size={16} /></button>
            )
          )}
          <button type="button" className="btn btn-sec ml-auto rounded-full" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primario rounded-full">Guardar</button>
        </div>
      </form>
    </Ventana>
  );
}

export function HabitoModal({ habito, acciones, onClose }: { habito: PHabito | null; acciones: AccionesListas; onClose: () => void }) {
  const [nombre, setNombre] = useState(habito?.nombre ?? "");
  const [color, setColor] = useState(habito?.color ?? PALETA_HABITOS[0]);
  const [dias, setDias] = useState<number[]>(habito?.dias ?? [0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const IDEAS = ["Tomar agua", "Gym", "Leer 20 min", "Dormir antes de las 12", "Estudiar", "Meditar", "Caminar", "Sin redes antes de dormir"];

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Ponle nombre a tu hábito.");
    if (!dias.length) return setError("Elige al menos un día.");
    acciones.guardarHabito({ id: habito?.id, nombre, color, dias, archivado: habito?.archivado });
    onClose();
  }
  const orden = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Ventana titulo={habito ? "Tu hábito" : "Nuevo hábito"} onClose={onClose}>
      <form onSubmit={guardar}>
        <input autoFocus className="campo mb-2 text-lg" placeholder="Ej. Tomar 2 L de agua" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
        {!habito && !nombre && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {IDEAS.map((i) => <button key={i} type="button" onClick={() => setNombre(i)} className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-muted hover:text-ink">{i}</button>)}
          </div>
        )}
        <p className="mb-1.5 mt-3 text-sm font-medium">¿Qué días?</p>
        <div className="mb-1 flex gap-1.5">
          {orden.map((d) => {
            const on = dias.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} aria-label={DIAS_LARGOS[d]} onClick={() => setDias(on ? dias.filter((x) => x !== d) : [...dias, d])} className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold ${on ? "border-transparent text-white" : "border-line text-muted"}`} style={on ? { background: color } : undefined}>
                {DIAS_LETRA[d]}
              </button>
            );
          })}
        </div>
        <div className="mb-4 flex gap-2 text-xs">
          <button type="button" className="text-accent hover:underline" onClick={() => setDias([0, 1, 2, 3, 4, 5, 6])}>Diario</button>
          <button type="button" className="text-accent hover:underline" onClick={() => setDias([1, 2, 3, 4, 5])}>Entre semana</button>
          <button type="button" className="text-accent hover:underline" onClick={() => setDias([0, 6])}>Fines</button>
        </div>
        <p className="mb-1.5 text-sm font-medium">Color</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PALETA_HABITOS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full ${color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`} style={{ background: c }} />)}
        </div>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {habito && (
            borrar ? (
              <button type="button" className="btn rounded-full bg-danger px-4 text-white" onClick={() => { acciones.borrarHabito(habito); onClose(); }}>Borrar con su historial</button>
            ) : (
              <>
                <button type="button" className="btn btn-sec rounded-full text-danger" onClick={() => setBorrar(true)} aria-label="Borrar"><Ico d={ICONO_LISTAS.basura} size={16} /></button>
                <button type="button" className="btn btn-sec rounded-full text-xs" onClick={() => { acciones.guardarHabito({ ...habito, archivado: !habito.archivado }); onClose(); }}>{habito.archivado ? "Reactivar" : "Archivar"}</button>
              </>
            )
          )}
          <button type="button" className="btn btn-sec ml-auto rounded-full" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primario rounded-full">Guardar</button>
        </div>
      </form>
    </Ventana>
  );
}

/* =============================== Pendientes =============================== */

export function SeccionPendientes({
  pendientes, hoy, acciones, onEditar, onNuevo,
}: { pendientes: PPendiente[]; hoy: string; acciones: AccionesListas; onEditar: (p: PPendiente) => void; onNuevo: (lista: PPendiente["lista"]) => void }) {
  const [lista, setLista] = useState<PPendiente["lista"]>("hacer");
  const [rapido, setRapido] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);
  const raiz = pendientes.filter((p) => !p.padre_id);
  const hijos = (id: string) => pendientes.filter((p) => p.padre_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const deLista = raiz.filter((p) => p.lista === lista);
  // Primero los que tienen fecha (los más cercanos arriba), luego en el orden en que los anotaste
  const abiertos = deLista.filter((p) => !p.hecho).sort((a, b) => (a.fecha && b.fecha ? a.fecha.localeCompare(b.fecha) : a.fecha ? -1 : b.fecha ? 1 : a.orden - b.orden));
  const hechos = deLista.filter((p) => p.hecho).sort((a, b) => (b.hecho_at ?? "").localeCompare(a.hecho_at ?? ""));
  const cuantos = (l: PPendiente["lista"]) => raiz.filter((p) => p.lista === l && !p.hecho).length;

  function anotar(e: React.FormEvent) {
    e.preventDefault();
    if (!rapido.trim()) return;
    acciones.guardarPendiente({ titulo: rapido, lista });
    setRapido("");
  }

  return (
    <div>
      <header className="mb-4 flex items-end gap-3 border-b border-line pb-4">
        <div className="mr-auto">
          <p className="versalitas text-muted">Tu lista</p>
          <h1 className="serif mt-1 text-5xl leading-none">Pendientes</h1>
        </div>
        <button onClick={() => onNuevo(lista)} className="btn btn-sec rounded-full text-sm">Con detalles</button>
      </header>

      <div className="mb-4 flex rounded-full border border-line bg-panel p-0.5 text-sm font-medium">
        {([["hacer", "Por hacer"], ["algun_dia", "Algún día"]] as const).map(([id, t]) => (
          <button key={id} onClick={() => setLista(id)} className={`flex-1 rounded-full px-3 py-1.5 ${lista === id ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}>
            {t} {cuantos(id) > 0 && <span className="opacity-70">· {cuantos(id)}</span>}
          </button>
        ))}
      </div>

      <form onSubmit={anotar} className="mb-4 flex gap-2">
        <input className="campo flex-1" value={rapido} maxLength={200} onChange={(e) => setRapido(e.target.value)} placeholder={lista === "hacer" ? "Anota y Enter: “comprar café”" : "Algo para algún día: “aprender a surfear”"} aria-label="Nuevo pendiente" />
        <button className="btn btn-primario rounded-full px-4" disabled={!rapido.trim()} aria-label="Agregar">+</button>
      </form>

      {abiertos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
          <p className="serif text-2xl">{lista === "hacer" ? "Todo hecho." : "Nada por aquí."}</p>
          <p className="mt-1 text-sm text-muted">{lista === "hacer" ? "O no has anotado nada. No juzgamos." : "Aquí van las cosas que quieres hacer sin fecha: viajes, cursos, ese libro."}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {abiertos.map((p) => {
            const subs = hijos(p.id);
            const listas = subs.filter((s) => s.hecho).length;
            const abiertoAqui = abierto === p.id;
            return (
              <li key={p.id} className="rounded-2xl border border-line bg-panel">
                <div className="flex items-start gap-3 px-3.5 py-3">
                  <Palomita checked={false} onChange={() => acciones.marcarPendiente(p, true)} etiqueta={`Hecho: ${p.titulo}`} />
                  <button onClick={() => setAbierto(abiertoAqui ? null : p.id)} className="min-w-0 flex-1 text-left">
                    <span className="block leading-snug">{p.titulo}</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                      {p.fecha && <span className={p.fecha < hoy ? "font-semibold text-danger" : p.fecha === hoy ? "font-semibold text-accent" : ""}>{p.fecha < hoy ? `atrasado (${corta(p.fecha)})` : p.fecha === hoy ? "hoy" : `para el ${corta(p.fecha)}`}</span>}
                      {subs.length > 0 && <span>{listas}/{subs.length} subtareas</span>}
                      {p.notas && <span className="truncate">· {p.notas}</span>}
                    </span>
                  </button>
                  <button onClick={() => onEditar(p)} className="shrink-0 p-1 text-muted hover:text-ink" aria-label={`Editar ${p.titulo}`}><Ico d={ICONO_LISTAS.lapiz} size={16} /></button>
                </div>
                {abiertoAqui && <Subtareas padre={p} subs={subs} acciones={acciones} onEditar={onEditar} />}
              </li>
            );
          })}
        </ul>
      )}

      {hechos.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setVerHechos(!verHechos)} className="text-sm font-medium text-muted hover:text-ink">{verHechos ? "Ocultar" : "Ver"} hechos ({hechos.length})</button>
            {verHechos && <button onClick={() => acciones.borrarPendientes(hechos.map((h) => h.id))} className="ml-auto text-xs text-danger hover:underline">Borrar los hechos</button>}
          </div>
          {verHechos && (
            <ul className="mt-2 flex flex-col gap-1">
              {hechos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3.5 py-1.5">
                  <Palomita checked onChange={() => acciones.marcarPendiente(p, false)} etiqueta={`Deshacer: ${p.titulo}`} />
                  <span className="min-w-0 flex-1 truncate text-muted line-through">{p.titulo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Subtareas({ padre, subs, acciones, onEditar }: { padre: PPendiente; subs: PPendiente[]; acciones: AccionesListas; onEditar: (p: PPendiente) => void }) {
  const [t, setT] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="border-t border-dashed border-line px-3.5 pb-3 pt-2 pl-11">
      <ul className="mb-2 flex flex-col gap-1">
        {subs.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5">
            <Palomita chica checked={s.hecho} onChange={(v) => acciones.marcarPendiente(s, v)} etiqueta={`Hecha: ${s.titulo}`} />
            <button onClick={() => onEditar(s)} className={`min-w-0 flex-1 truncate text-left text-sm ${s.hecho ? "text-muted line-through" : ""}`}>{s.titulo}</button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!t.trim()) return;
          acciones.guardarPendiente({ titulo: t, padre_id: padre.id });
          setT("");
          ref.current?.focus();
        }}
        className="flex gap-2"
      >
        <input ref={ref} autoFocus={!subs.length} className="campo flex-1 py-1.5 text-sm" value={t} maxLength={200} onChange={(e) => setT(e.target.value)} placeholder="+ Subtarea" aria-label="Nueva subtarea" />
      </form>
      <div className="mt-2 flex gap-3 text-xs">
        <button onClick={() => acciones.moverPendiente(padre, padre.lista === "hacer" ? "algun_dia" : "hacer")} className="text-muted hover:text-ink">Mover a {padre.lista === "hacer" ? "Algún día" : "Por hacer"}</button>
      </div>
    </div>
  );
}

export function Palomita({ checked, onChange, etiqueta, chica = false, color }: { checked: boolean; onChange: (v: boolean) => void; etiqueta: string; chica?: boolean; color?: string }) {
  const s = chica ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={etiqueta}
      onClick={() => onChange(!checked)}
      className={`grid ${s} mt-px shrink-0 place-items-center rounded-full border-2 transition ${checked ? "border-transparent text-white" : "border-muted/50 text-transparent hover:border-accent"}`}
      style={checked ? { background: color ?? "var(--accent)" } : undefined}
    >
      <Ico d={ICONO_LISTAS.check} size={chica ? 11 : 13} w={3} />
    </button>
  );
}

/* =============================== Hábitos =============================== */

const fuego = (n: number) => (n >= 30 ? "🔥🔥🔥" : n >= 7 ? "🔥🔥" : n > 0 ? "🔥" : "");

export function SeccionHabitos({
  habitos, marcas, hoy, acciones, onEditar, onNuevo,
}: { habitos: PHabito[]; marcas: PMarca[]; hoy: string; acciones: AccionesListas; onEditar: (h: PHabito) => void; onNuevo: () => void }) {
  const porHabito = useMarcasPorHabito(marcas);
  const [verArchivados, setVerArchivados] = useState(false);
  const activos = habitos.filter((h) => !h.archivado);
  const archivados = habitos.filter((h) => h.archivado);
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13));
  const tocanHoy = activos.filter((h) => tocaHabito(h, hoy));
  const hechosHoy = tocanHoy.filter((h) => porHabito.get(h.id)?.has(hoy)).length;

  return (
    <div>
      <header className="mb-5 flex items-end gap-3 border-b border-line pb-4">
        <div className="mr-auto">
          <p className="versalitas text-muted">{tocanHoy.length ? `Hoy: ${hechosHoy} de ${tocanHoy.length}` : "Poquito cada día"}</p>
          <h1 className="serif mt-1 text-5xl leading-none">Hábitos</h1>
        </div>
        <button onClick={onNuevo} className="btn btn-primario rounded-full"><Ico d="M12 5v14M5 12h14" w={2.4} /> Hábito</button>
      </header>

      {activos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center">
          <p className="serif text-2xl">Empieza con uno.</p>
          <p className="mt-1 text-sm text-muted">Tomar agua, leer, el gym… Lo palomeas cada día y ves crecer tu racha.</p>
          <button onClick={onNuevo} className="btn btn-sec mt-4 rounded-full">Crear mi primer hábito</button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {activos.map((h) => <TarjetaHabito key={h.id} h={h} marcas={porHabito.get(h.id) ?? new Set()} hoy={hoy} dias={dias} acciones={acciones} onEditar={() => onEditar(h)} />)}
        </ul>
      )}

      {archivados.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setVerArchivados(!verArchivados)} className="text-sm font-medium text-muted hover:text-ink">{verArchivados ? "Ocultar" : "Ver"} archivados ({archivados.length})</button>
          {verArchivados && (
            <ul className="mt-2 flex flex-col gap-1">
              {archivados.map((h) => (
                <li key={h.id}>
                  <button onClick={() => onEditar(h)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-panel-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: h.color }} /> {h.nombre}
                    <span className="ml-auto text-xs">mejor racha: {mejorRacha(h, porHabito.get(h.id) ?? new Set(), hoy)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-muted">Toca un cuadrito para palomear (o despalomear) días pasados. Los días que no tocan no rompen tu racha.</p>
    </div>
  );
}

function TarjetaHabito({ h, marcas, hoy, dias, acciones, onEditar }: { h: PHabito; marcas: Set<string>; hoy: string; dias: string[]; acciones: AccionesListas; onEditar: () => void }) {
  const racha = rachaActual(h, marcas, hoy);
  const mejor = mejorRacha(h, marcas, hoy);
  const toca = tocaHabito(h, hoy);
  const hecho = marcas.has(hoy);
  const frecuencia = h.dias.length === 7 ? "Diario" : h.dias.length === 5 && !h.dias.includes(0) && !h.dias.includes(6) ? "Entre semana" : [1, 2, 3, 4, 5, 6, 0].filter((d) => h.dias.includes(d)).map((d) => DIAS_LETRA[d]).join(" ");
  return (
    <li className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={() => acciones.marcarHabito(h, hoy, !hecho)}
          aria-pressed={hecho}
          aria-label={hecho ? `Quitar palomita de hoy: ${h.nombre}` : `Palomear hoy: ${h.nombre}`}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 transition active:scale-95 ${hecho ? "border-transparent text-white" : toca ? "text-transparent hover:text-muted" : "border-dashed text-transparent opacity-60"}`}
          style={hecho ? { background: h.color } : { borderColor: h.color }}
        >
          <Ico d={ICONO_LISTAS.check} size={22} w={3} />
        </button>
        <button onClick={onEditar} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-lg font-medium leading-tight">{h.nombre}</span>
          <span className="text-xs text-muted">{frecuencia}{!toca && " · hoy descansas"}</span>
        </button>
        <div className="shrink-0 text-right">
          <span className="serif block text-3xl leading-none" style={{ color: racha ? h.color : undefined }}>{racha}</span>
          <span className="text-[11px] text-muted">{racha === 1 ? "día" : "días"} {fuego(racha)}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
        {dias.map((d) => {
          const si = marcas.has(d);
          const tocaD = tocaHabito(h, d);
          const futuro = d > hoy;
          return (
            <button
              key={d}
              disabled={futuro}
              onClick={() => acciones.marcarHabito(h, d, !si)}
              title={`${DIAS_LARGOS[deISO(d).getDay()]} ${corta(d)}${si ? " ✓" : ""}`}
              aria-label={`${DIAS_LARGOS[deISO(d).getDay()]} ${corta(d)}: ${si ? "hecho" : "sin hacer"}`}
              className={`aspect-square rounded-[5px] ${d === hoy ? "ring-1 ring-ink/40 ring-offset-1 ring-offset-panel" : ""} ${!si && !tocaD ? "opacity-30" : ""}`}
              style={{ background: si ? h.color : "var(--panel-2)" }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>hace 2 semanas</span>
        <span>{mejor > 0 && `mejor racha: ${mejor}`}</span>
        <span>hoy</span>
      </div>
    </li>
  );
}

/* =============================== En "Hoy" =============================== */

/** Los hábitos que tocan hoy, para palomear de un toque. */
export function HabitosHoy({ habitos, marcas, hoy, acciones, onVer, onNuevo }: { habitos: PHabito[]; marcas: PMarca[]; hoy: string; acciones: AccionesListas; onVer: () => void; onNuevo: () => void }) {
  const porHabito = useMarcasPorHabito(marcas);
  const deHoy = habitos.filter((h) => !h.archivado && tocaHabito(h, hoy));
  const hechos = deHoy.filter((h) => porHabito.get(h.id)?.has(hoy)).length;
  if (!habitos.some((h) => !h.archivado))
    return (
      <button onClick={onNuevo} className="mb-8 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-left hover:bg-panel-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={ICONO_LISTAS.habito} /></span>
        <span className="min-w-0">
          <span className="block font-medium">Arma tu racha</span>
          <span className="text-xs text-muted">Un hábito (agua, leer, gym) que palomeas cada día.</span>
        </span>
      </button>
    );
  if (!deHoy.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="serif text-2xl">Tus hábitos</h2>
        <button onClick={onVer} className="text-sm font-medium text-accent hover:underline">{hechos === deHoy.length ? "¡Todos! 🎉" : `${hechos} de ${deHoy.length}`}</button>
      </div>
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {deHoy.map((h) => {
          const m = porHabito.get(h.id) ?? new Set<string>();
          const hecho = m.has(hoy);
          const racha = rachaActual(h, m, hoy);
          return (
            <li key={h.id} className="snap-start">
              <button
                onClick={() => acciones.marcarHabito(h, hoy, !hecho)}
                aria-pressed={hecho}
                className={`flex w-[8.5rem] flex-col items-start gap-2 rounded-2xl border p-3 text-left transition active:scale-[0.97] ${hecho ? "border-transparent text-white" : "border-line bg-panel"}`}
                style={hecho ? { background: h.color } : undefined}
              >
                <span className="flex w-full items-center justify-between">
                  <span className={`grid h-7 w-7 place-items-center rounded-full border-2 ${hecho ? "border-white/80" : ""}`} style={hecho ? undefined : { borderColor: h.color }}>
                    {hecho && <Ico d={ICONO_LISTAS.check} size={14} w={3} />}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${hecho ? "" : "text-muted"}`}>{racha > 0 ? `${racha} ${fuego(racha).slice(0, 2)}` : ""}</span>
                </span>
                <span className="line-clamp-2 text-sm font-medium leading-tight">{h.nombre}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Cumpleaños y aniversarios (lo que se repite cada año) de las próximas dos semanas. */
export function FechasQueVienen({ fechas, hoy, onAbrir }: { fechas: Ocurrencia[]; hoy: string; onAbrir: (o: Ocurrencia) => void }) {
  if (!fechas.length) return null;
  return (
    <section className="mb-8">
      <h2 className="serif mb-2 text-2xl">Fechas que vienen</h2>
      <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {fechas.map((o) => {
          const n = diasEntre(hoy, o.dia);
          const anios = deISO(o.dia).getFullYear() - deISO(o.fecha).getFullYear();
          return (
            <li key={`${o.id}-${o.dia}`}>
              <button onClick={() => onAbrir(o)} className="flex w-[9.5rem] flex-col items-start gap-1 rounded-2xl border border-line bg-panel p-3 text-left hover:bg-panel-2">
                <span className="flex w-full items-center justify-between text-accent">
                  <Ico d={ICONO_LISTAS.pastel} size={18} />
                  <span className="versalitas">{n === 1 ? "mañana" : `en ${n} días`}</span>
                </span>
                <span className="line-clamp-2 text-sm font-medium leading-tight">{o.titulo}</span>
                <span className="text-xs text-muted">{corta(o.dia)}{anios > 0 ? ` · ${anios} año${anios === 1 ? "" : "s"}` : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
