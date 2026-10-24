"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sumarDias, diasEntre } from "@/lib/pagos";
import { deISO, hoyISO, MESES } from "@/lib/fechas";
import { DIAS_LETRA, PALETA_HABITOS, PRIORIDADES, mejorRacha, rachaActual, tocaHabito, type Ocurrencia, type PHabito, type PMarca, type PPendiente } from "@/lib/personal";
import { DURACION_BLOQUE, DURACIONES, finBloque, textoDuracion } from "@/lib/bloques";
import { sinAcentos } from "@/lib/buscarMi";
import { anotarRapido } from "@/lib/anotarRapido";
import StatsHabito from "@/components/personal/StatsHabito";
import BotonVoz from "@/components/BotonVoz";

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
      setError(/does not exist|schema cache/i.test(r.error.message) ? "Falta actualizar la base de datos (corre supabase/schema.sql)." : r.error.message);
      recargar();
    } else setError(null);
  }
  return {
    error,
    async guardarPendiente(p: Partial<PPendiente> & { titulo: string }) {
      const id = p.id ?? uid();
      const datos: Record<string, unknown> = { titulo: p.titulo.trim().slice(0, 200), notas: p.notas?.trim() || null, lista: p.lista ?? "hacer", fecha: p.fecha || null, padre_id: p.padre_id ?? null };
      // 3.0 · prioridad, lista y bloque: sólo si vienen (y en uno nuevo, sólo si no son lo de siempre)
      for (const k of ["prioridad", "etiqueta", "hora", "duracion"] as const) if (p[k] !== undefined && (p.id || p[k])) datos[k] = p[k] ?? null;
      if (!datos.fecha && datos.hora) { datos.hora = null; datos.duracion = null; }
      const nuevo = !p.id;
      setPendientes((l) => {
        if (!nuevo) return l.map((x) => (x.id === id ? { ...x, ...datos } : x));
        return [...l, { id, user_id: "", hecho: false, hecho_at: null, orden: Date.now() / 1000, created_at: new Date().toISOString(), ...(datos as Omit<PPendiente, "id" | "user_id" | "hecho" | "hecho_at" | "orden" | "created_at">) }];
      });
      if (nuevo) await servidor(supabase.from("p_pendientes").insert({ id, ...datos, orden: Date.now() / 1000 }));
      else await servidor(supabase.from("p_pendientes").update(datos).eq("id", id));
    },
    async marcarPendiente(p: PPendiente, hecho: boolean) {
      const hecho_at = hecho ? new Date().toISOString() : null;
      setPendientes((l) => l.map((x) => (x.id === p.id ? { ...x, hecho, hecho_at } : x)));
      // 3.0 · uno que te compartieron: se palomea en la agenda de quien lo compartió (por el servidor)
      if (p.compartido) {
        if (demo) return;
        const r = await fetch("/api/personal/compartidos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.compartido.id, hecho }) });
        if (!r.ok) {
          setError((await r.json().catch(() => ({}))).error ?? "No se pudo palomear.");
          recargar();
        } else setError(null);
        return;
      }
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
      const datos = {
        nombre: h.nombre.trim().slice(0, 60), color: h.color ?? PALETA_HABITOS[0], dias: h.dias?.length ? [...h.dias].sort() : [0, 1, 2, 3, 4, 5, 6], archivado: h.archivado ?? false,
        // 2.7 · la hora sólo se manda si se usa (así funciona aunque falte el SQL 2.7)
        ...(h.hora !== undefined ? { hora: h.hora ? (h.hora.length === 5 ? `${h.hora}:00` : h.hora) : null } : {}),
      };
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
  pendiente, fechaInicial, listaInicial = "hacer", tituloInicial = "", acciones, onClose, etiquetas = [], sugerir, bloqueInicial = false, extra, compartir,
}: {
  pendiente: PPendiente | null; fechaInicial?: string | null; listaInicial?: PPendiente["lista"]; tituloInicial?: string; acciones: AccionesListas; onClose: () => void;
  etiquetas?: string[]; // 3.0 · las listas que ya usas
  sugerir?: (fecha: string, duracion: number, sinId?: string) => string[]; // 3.0 · huecos libres "HH:MM"
  bloqueInicial?: boolean; // 3.0 · abre con "a una hora" prendido
  extra?: Partial<Pick<PPendiente, "prioridad" | "etiqueta" | "hora" | "duracion">>; // 3.0 · de "Anotar rápido"
  compartir?: React.ReactNode; // 3.0 · "Compartir con…" (sólo los tuyos, ya guardados)
}) {
  const [titulo, setTitulo] = useState(pendiente?.titulo ?? tituloInicial);
  const [lista, setLista] = useState<PPendiente["lista"]>(pendiente?.lista ?? listaInicial);
  const [conFecha, setConFecha] = useState(!!(pendiente?.fecha ?? fechaInicial) || bloqueInicial || !!extra?.hora);
  const [fecha, setFecha] = useState(pendiente?.fecha ?? fechaInicial ?? hoyISO());
  const [notas, setNotas] = useState(pendiente?.notas ?? "");
  const [prioridad, setPrioridad] = useState<number>(pendiente?.prioridad ?? extra?.prioridad ?? 0);
  const [etiqueta, setEtiqueta] = useState(pendiente?.etiqueta ?? extra?.etiqueta ?? "");
  const h0 = pendiente?.hora ?? extra?.hora ?? null;
  const [conHora, setConHora] = useState(!!h0 || bloqueInicial);
  const [hora, setHora] = useState(h0 ? h0.slice(0, 5) : "");
  const [duracion, setDuracion] = useState<number>(pendiente?.duracion ?? extra?.duracion ?? DURACION_BLOQUE);
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const sub = !!pendiente?.padre_id;
  const huecos = conHora && conFecha && sugerir ? sugerir(fecha, duracion, pendiente?.id) : [];
  // Si abre en "a una hora" sin hora, propone el primer hueco libre
  useEffect(() => {
    if (conHora && !hora && huecos[0]) setHora(huecos[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conHora, fecha]);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setError("¿Qué hay que hacer?");
    if (conFecha && conHora && !hora) return setError("¿A qué hora?");
    const datos: Partial<PPendiente> & { titulo: string } = { id: pendiente?.id, padre_id: pendiente?.padre_id ?? null, titulo, notas, lista: sub ? "hacer" : lista, fecha: conFecha && lista === "hacer" ? fecha : null };
    // 3.0 · sólo lo que cambió (así no truena si aún no corre el SQL 3.0)
    const nuevos = {
      prioridad: sub ? 0 : prioridad,
      etiqueta: sub ? null : etiqueta.trim().slice(0, 30) || null,
      hora: datos.fecha && conHora && hora ? `${hora}:00` : null,
      duracion: datos.fecha && conHora && hora ? duracion : null,
    };
    const antes = { prioridad: pendiente?.prioridad ?? 0, etiqueta: pendiente?.etiqueta ?? null, hora: pendiente?.hora ? `${pendiente.hora.slice(0, 5)}:00` : null, duracion: pendiente?.duracion ?? null };
    for (const k of ["prioridad", "etiqueta", "hora", "duracion"] as const) if (nuevos[k] !== antes[k]) (datos as Record<string, unknown>)[k] = nuevos[k];
    acciones.guardarPendiente(datos);
    onClose();
  }
  const sugeridas = etiquetas.filter((x) => x !== etiqueta && (!etiqueta || sinAcentos(x).startsWith(sinAcentos(etiqueta)))).slice(0, 6);
  return (
    <Ventana titulo={pendiente ? (sub ? "Subtarea" : "Pendiente") : "Nuevo pendiente"} onClose={onClose}>
      <form onSubmit={guardar}>
        <input autoFocus={!pendiente} className="campo mb-3 text-lg" placeholder="Ej. Pagar la luz" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} />
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
        {!sub && (
          <>
            <div className="mb-3 flex rounded-full border border-line bg-panel p-0.5 text-xs font-medium" role="radiogroup" aria-label="Prioridad">
              {PRIORIDADES.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={prioridad === x.id} onClick={() => setPrioridad(x.id)} className={`flex-1 rounded-full px-2 py-1.5 ${prioridad === x.id ? (x.id === 2 ? "bg-danger text-white" : x.id === 1 ? "bg-accent text-panel" : "bg-ink text-panel") : "text-muted hover:text-ink"}`}>
                  {x.marca && <b className="mr-1">{x.marca}</b>}{x.nombre}
                </button>
              ))}
            </div>
            <div className="mb-3">
              <input className="campo py-1.5 text-sm" list="etiquetas-pend" placeholder="Lista (opcional): Casa, Escuela, Chamba…" value={etiqueta} maxLength={30} onChange={(e) => setEtiqueta(e.target.value.replace(/^#/, ""))} aria-label="Lista" />
              {sugeridas.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sugeridas.map((x) => <button key={x} type="button" onClick={() => setEtiqueta(x)} className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-muted hover:text-ink">#{x}</button>)}
                </div>
              )}
            </div>
          </>
        )}
        {lista === "hacer" && (
          <div className="mb-3 rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={conFecha} onChange={(e) => setConFecha(e.target.checked)} /> Para el…
              </label>
              {conFecha && <input type="date" style={{ width: "auto" }} className="campo py-1.5" value={fecha} onChange={(e) => setFecha(e.target.value)} />}
              {conFecha && !conHora && <span className="text-xs text-muted">sale en Hoy ese día</span>}
            </div>
            {conFecha && !sub && (
              <>
                <label className="mt-2.5 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={conHora} onChange={(e) => setConHora(e.target.checked)} /> ⏱ A una hora <span className="text-xs text-muted">(bloque en tu día)</span>
                </label>
                {conHora && (
                  <div className="mt-2 pl-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="time" className="campo py-1.5" style={{ width: "7rem" }} value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora del bloque" />
                      <select className="campo py-1.5" style={{ width: "auto" }} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} aria-label="Duración">
                        {DURACIONES.map((m) => <option key={m} value={m}>{textoDuracion(m)}</option>)}
                      </select>
                    </div>
                    {huecos.length > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted">Libre:</span>
                        {huecos.map((x) => (
                          <button key={x} type="button" onClick={() => setHora(x)} className={`rounded-full border px-2.5 py-0.5 tabular-nums ${hora === x ? "border-accent bg-accent-soft text-accent" : "border-line bg-panel text-muted hover:text-ink"}`}>{x}</button>
                        ))}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <textarea className="campo mb-4 min-h-[70px]" placeholder="Notas (opcional)" value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} />
        {compartir}
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
  const [hora, setHora] = useState(habito?.hora ? habito.hora.slice(0, 5) : "");
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const IDEAS = ["Tomar agua", "Gym", "Leer 20 min", "Dormir antes de las 12", "Estudiar", "Meditar", "Caminar", "Sin redes antes de dormir"];

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Ponle nombre a tu hábito.");
    if (!dias.length) return setError("Elige al menos un día.");
    acciones.guardarHabito({ id: habito?.id, nombre, color, dias, archivado: habito?.archivado, hora: hora || (habito?.hora ? null : undefined) });
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
        <label className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Recuérdamelo a las</span>
          <input type="time" className="campo py-1.5" style={{ width: "7rem" }} value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora del aviso (opcional)" />
          {hora ? <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setHora("")}>Quitar</button> : <span className="text-xs text-muted">(opcional, si no lo has palomeado)</span>}
        </label>
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
  pendientes, hoy, acciones, onEditar, onNuevo, onAgendar, onCompartido,
}: {
  pendientes: PPendiente[]; hoy: string; acciones: AccionesListas; onEditar: (p: PPendiente) => void; onNuevo: (lista: PPendiente["lista"], etiqueta?: string) => void;
  onAgendar?: (p: PPendiente) => void; // 3.0 · "⏱ Ponle hora"
  onCompartido?: (p: PPendiente, hecho: boolean) => void; // 3.0 · palomear uno que te compartieron
}) {
  const [lista, setLista] = useState<PPendiente["lista"]>("hacer");
  const [rapido, setRapido] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);
  const [filtro, setFiltro] = useState<string | null>(null); // 3.0 · por lista ("Casa", "Escuela"…)
  const raiz = pendientes.filter((p) => !p.padre_id);
  const hijos = (id: string) => pendientes.filter((p) => p.padre_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const etiquetas = [...new Set(raiz.filter((p) => p.lista === lista && !p.hecho && p.etiqueta).map((p) => p.etiqueta!))].sort((a, b) => a.localeCompare(b));
  const deLista = raiz.filter((p) => p.lista === lista && (!filtro || p.etiqueta === filtro));
  // Lo urgente arriba; luego lo que tiene fecha (lo más cercano primero) y luego en el orden en que lo anotaste
  const abiertos = deLista
    .filter((p) => !p.hecho)
    .sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0) || (a.fecha && b.fecha ? a.fecha.localeCompare(b.fecha) || (a.hora ?? "99").localeCompare(b.hora ?? "99") : a.fecha ? -1 : b.fecha ? 1 : a.orden - b.orden));
  const hechos = deLista.filter((p) => p.hecho).sort((a, b) => (b.hecho_at ?? "").localeCompare(a.hecho_at ?? ""));
  const cuantos = (l: PPendiente["lista"]) => raiz.filter((p) => p.lista === l && !p.hecho).length;
  const marcar = (p: PPendiente, v: boolean) => (p.compartido ? onCompartido?.(p, v) : acciones.marcarPendiente(p, v));

  function anotar(e: React.FormEvent) {
    e.preventDefault();
    if (!rapido.trim()) return;
    // 3.0 · también entiende "#casa", "!!" y "el viernes" / "mañana 5pm"
    const b = anotarRapido(rapido, hoy);
    const titulo = b.titulo || rapido.trim();
    const etiqueta = b.etiqueta ?? filtro ?? undefined;
    acciones.guardarPendiente({
      titulo, lista, ...(lista === "hacer" && b.fecha ? { fecha: b.fecha } : {}),
      ...(b.prioridad ? { prioridad: b.prioridad } : {}), ...(etiqueta ? { etiqueta } : {}),
      ...(lista === "hacer" && b.fecha && b.hora_inicio ? { hora: `${b.hora_inicio}:00`, duracion: b.hora_fin ? Math.max(15, minutos(b.hora_fin) - minutos(b.hora_inicio)) : null } : {}),
    });
    setRapido("");
  }

  return (
    <div>
      <header className="mb-4 flex items-end gap-3 border-b border-line pb-4">
        <div className="mr-auto">
          <p className="versalitas text-muted">Tu lista</p>
          <h1 className="serif mt-1 text-5xl leading-none">Pendientes</h1>
        </div>
        <button onClick={() => onNuevo(lista, filtro ?? undefined)} className="btn btn-sec rounded-full text-sm">Con detalles</button>
      </header>

      <div className="mb-3 flex rounded-full border border-line bg-panel p-0.5 text-sm font-medium">
        {([["hacer", "Por hacer"], ["algun_dia", "Algún día"]] as const).map(([id, t]) => (
          <button key={id} onClick={() => { setLista(id); setFiltro(null); }} className={`flex-1 rounded-full px-3 py-1.5 ${lista === id ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}>
            {t} {cuantos(id) > 0 && <span className="opacity-70">· {cuantos(id)}</span>}
          </button>
        ))}
      </div>

      {(etiquetas.length > 0 || filtro) && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por lista">
          <button onClick={() => setFiltro(null)} aria-pressed={!filtro} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${!filtro ? "border-ink bg-ink text-panel" : "border-line text-muted hover:text-ink"}`}>Todas</button>
          {[...new Set([...etiquetas, ...(filtro ? [filtro] : [])])].map((x) => (
            <button key={x} onClick={() => setFiltro(filtro === x ? null : x)} aria-pressed={filtro === x} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${filtro === x ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}>
              #{x} <span className="opacity-60">{raiz.filter((p) => p.lista === lista && !p.hecho && p.etiqueta === x).length}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={anotar} className="mb-1 flex gap-2">
        <input className="campo flex-1" value={rapido} maxLength={200} onChange={(e) => setRapido(e.target.value)} placeholder={lista === "hacer" ? (filtro ? `Anota en #${filtro} y Enter` : "Anota y Enter: “comprar café #casa”") : "Algo para algún día: “aprender a surfear”"} aria-label="Nuevo pendiente" />
        <BotonVoz valor={rapido} onCambio={setRapido} />
        <button className="btn btn-primario rounded-full px-4" disabled={!rapido.trim()} aria-label="Agregar">+</button>
      </form>
      <p className="mb-4 text-[11px] text-muted">Tip: <b>#lista</b> para ordenarlos, <b>!</b> importante, <b>!!</b> urgente, y “mañana 5pm” lo vuelve bloque.</p>

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
            const pr = p.prioridad ?? 0;
            return (
              <li key={p.id} className={`rounded-2xl border bg-panel ${pr === 2 ? "border-danger/50" : "border-line"}`}>
                <div className="flex items-start gap-3 px-3.5 py-3">
                  <Palomita checked={false} onChange={() => marcar(p, true)} etiqueta={`Hecho: ${p.titulo}`} color={pr === 2 ? "var(--danger)" : undefined} />
                  <button onClick={() => (p.compartido ? onEditar(p) : setAbierto(abiertoAqui ? null : p.id))} className="min-w-0 flex-1 text-left">
                    <span className="flex items-baseline gap-1.5 leading-snug">
                      {pr > 0 && <b className={`shrink-0 text-sm ${pr === 2 ? "text-danger" : "text-accent"}`} title={pr === 2 ? "Urgente" : "Importante"}>{pr === 2 ? "!!" : "!"}</b>}
                      <span className="min-w-0">{p.titulo}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                      {p.fecha && <span className={p.fecha < hoy ? "font-semibold text-danger" : p.fecha === hoy ? "font-semibold text-accent" : ""}>{p.fecha < hoy ? `atrasado (${corta(p.fecha)})` : p.fecha === hoy ? "hoy" : `para el ${corta(p.fecha)}`}{p.hora ? ` · ${p.hora.slice(0, 5)}–${finBloque(p)}` : ""}</span>}
                      {p.etiqueta && !filtro && <span>#{p.etiqueta}</span>}
                      {p.compartido && <span className="font-medium text-accent">👥 de {p.compartido.de}{p.compartido.nuevo ? " · nuevo" : ""}</span>}
                      {subs.length > 0 && <span>{listas}/{subs.length} subtareas</span>}
                      {p.notas && <span className="truncate">· {p.notas}</span>}
                    </span>
                  </button>
                  <button onClick={() => onEditar(p)} className="shrink-0 p-1 text-muted hover:text-ink" aria-label={`Editar ${p.titulo}`}><Ico d={ICONO_LISTAS.lapiz} size={16} /></button>
                </div>
                {abiertoAqui && <Subtareas padre={p} subs={subs} acciones={acciones} onEditar={onEditar} onAgendar={lista === "hacer" ? onAgendar : undefined} />}
              </li>
            );
          })}
        </ul>
      )}

      {hechos.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setVerHechos(!verHechos)} className="text-sm font-medium text-muted hover:text-ink">{verHechos ? "Ocultar" : "Ver"} hechos ({hechos.length})</button>
            {verHechos && <button onClick={() => acciones.borrarPendientes(hechos.filter((h) => !h.compartido).map((h) => h.id))} className="ml-auto text-xs text-danger hover:underline">Borrar los hechos</button>}
          </div>
          {verHechos && (
            <ul className="mt-2 flex flex-col gap-1">
              {hechos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3.5 py-1.5">
                  <Palomita checked onChange={() => marcar(p, false)} etiqueta={`Deshacer: ${p.titulo}`} />
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

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function Subtareas({ padre, subs, acciones, onEditar, onAgendar }: { padre: PPendiente; subs: PPendiente[]; acciones: AccionesListas; onEditar: (p: PPendiente) => void; onAgendar?: (p: PPendiente) => void }) {
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
        {onAgendar && <button onClick={() => onAgendar(padre)} className="font-medium text-accent hover:underline">⏱ {padre.hora ? "Cambiar hora" : "Ponle hora"}</button>}
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
  const [stats, setStats] = useState<PHabito | null>(null); // 3.0
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
          {activos.map((h) => <TarjetaHabito key={h.id} h={h} marcas={porHabito.get(h.id) ?? new Set()} hoy={hoy} dias={dias} acciones={acciones} onEditar={() => onEditar(h)} onStats={() => setStats(h)} />)}
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
      {stats && <StatsHabito h={stats} marcas={porHabito.get(stats.id) ?? new Set()} hoy={hoy} onClose={() => setStats(null)} />}
      <p className="mt-6 text-center text-xs text-muted">Toca un cuadrito para palomear (o despalomear) días pasados. Los días que no tocan no rompen tu racha.</p>
    </div>
  );
}

function TarjetaHabito({ h, marcas, hoy, dias, acciones, onEditar, onStats }: { h: PHabito; marcas: Set<string>; hoy: string; dias: string[]; acciones: AccionesListas; onEditar: () => void; onStats: () => void }) {
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
        <button onClick={onStats} className="font-semibold text-accent hover:underline">📊 {mejor > 0 ? `mejor racha: ${mejor} · ` : ""}estadísticas</button>
        <span>hoy</span>
      </div>
      {racha >= 3 && (
        <button
          onClick={async () => {
            const { presumirRacha } = await import("@/components/personal/presumirRacha");
            await presumirRacha({ nombre: h.nombre, racha, mejor, color: h.color });
          }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-1.5 text-xs font-medium text-muted hover:border-accent hover:text-accent"
        >
          🔥 Presumir mi racha
        </button>
      )}
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
