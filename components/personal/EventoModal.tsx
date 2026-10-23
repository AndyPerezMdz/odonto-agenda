"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { REPETIR, TIPOS, hm, ICONO_TIPO, type Ocurrencia, type PCategoria, type PEvento, type Repetir, type TipoEvento } from "@/lib/personal";
import { fechaLarga } from "@/lib/fechas";

type Props = {
  supabase: SupabaseClient;
  userId: string;
  evento: PEvento | Ocurrencia | null; // null = nuevo
  fechaInicial: string;
  tipoInicial?: TipoEvento;
  categorias: PCategoria[];
  onClose: () => void;
  onGuardado: (fecha: string) => void;
  demo?: boolean;
  odonto?: boolean; // ejemplos de odonto o de cualquier persona
  pro?: boolean; // 2.3 · en Gratis: sin viajes nuevos
  onPro?: () => void; // abre "Eso es de Pro"
  borrador?: { tipo?: TipoEvento; titulo?: string; fecha?: string | null; fecha_fin?: string | null; hora_inicio?: string | null; hora_fin?: string | null; lugar?: string | null; repetir?: Repetir }; // 2.6 · de "Anotar rápido"
};

export default function EventoModal({ supabase, userId, evento, fechaInicial, tipoInicial, categorias, onClose, onGuardado, demo = false, odonto = true, pro = true, onPro, borrador: b }: Props) {
  const nuevo = !evento;
  const dia = evento && "dia" in evento ? evento.dia : null; // la aparición que se abrió (series)
  const tipo0 = evento?.tipo ?? b?.tipo ?? tipoInicial ?? "evento";
  const [tipo, setTipo] = useState<TipoEvento>(tipo0);
  const [titulo, setTitulo] = useState(evento?.titulo ?? b?.titulo ?? "");
  const [fecha, setFecha] = useState(evento?.fecha ?? b?.fecha ?? fechaInicial);
  const [fechaFin, setFechaFin] = useState(evento?.fecha_fin ?? evento?.fecha ?? b?.fecha_fin ?? b?.fecha ?? fechaInicial);
  const [todoElDia, setTodoElDia] = useState(evento ? !evento.hora_inicio : b ? !b.hora_inicio : tipo0 === "entrega" || tipo0 === "viaje");
  const [inicio, setInicio] = useState(hm(evento?.hora_inicio) || hm(b?.hora_inicio) || "09:00");
  const [fin, setFin] = useState(
    hm(evento?.hora_fin) || hm(b?.hora_fin) || (b?.hora_inicio && Number(b.hora_inicio.slice(0, 2)) < 23 ? `${String(Number(b.hora_inicio.slice(0, 2)) + 1).padStart(2, "0")}:${b.hora_inicio.slice(3, 5)}` : "10:00")
  );
  const [lugar, setLugar] = useState(evento?.lugar ?? b?.lugar ?? "");
  const [notas, setNotas] = useState(evento?.notas ?? "");
  const [categoria, setCategoria] = useState<string>(evento?.categoria_id ?? "");
  const [repetir, setRepetir] = useState<Repetir>(evento?.repetir ?? b?.repetir ?? "nunca");
  const [hasta, setHasta] = useState(evento?.repetir_hasta ?? "");
  const [hecho, setHecho] = useState(evento?.hecho ?? false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(false);

  // Escape cierra
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const conHora = (tipo === "evento" || tipo === "recordatorio") && !todoElDia;
  const puedeRepetir = tipo === "evento" || tipo === "recordatorio";
  const esSerie = !!evento && evento.repetir !== "nunca" && puedeRepetir;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) return setError(tipo === "viaje" ? "¿A dónde vas?" : "Ponle un nombre.");
    if (tipo === "viaje" && fechaFin < fecha) return setError("El regreso no puede ser antes de la ida.");
    if (conHora && tipo === "evento" && fin <= inicio) return setError("La hora de fin debe ser después de la de inicio.");
    if (puedeRepetir && repetir !== "nunca" && hasta && hasta < fecha) return setError("“Hasta” no puede ser antes de la primera fecha.");
    if (demo) return setError("En la demo no se guarda nada. Pide tu agenda para usarla de verdad (botón “La quiero” arriba).");
    setGuardando(true);
    const datos = {
      tipo,
      titulo: titulo.trim().slice(0, 120),
      fecha,
      fecha_fin: tipo === "viaje" ? fechaFin : null,
      hora_inicio: conHora ? inicio : null,
      hora_fin: conHora && tipo === "evento" ? fin : null,
      lugar: tipo === "evento" || tipo === "viaje" ? lugar.trim().slice(0, 120) || null : null,
      notas: notas.trim().slice(0, 1000) || null,
      categoria_id: categoria || null,
      repetir: puedeRepetir ? repetir : "nunca",
      repetir_hasta: puedeRepetir && repetir !== "nunca" ? hasta || null : null,
      hecho: tipo === "entrega" ? hecho : false,
      hecho_at: tipo === "entrega" && hecho ? evento?.hecho_at ?? new Date().toISOString() : null,
    };
    const { error } = nuevo
      ? await supabase.from("p_eventos").insert({ ...datos, user_id: userId })
      : await supabase.from("p_eventos").update(datos).eq("id", evento!.id);
    setGuardando(false);
    if (error) return setError(/Pro/.test(error.message) ? "Eso es de Pro. Revisa tu plan en Ajustes → Tu plan." : "No se pudo guardar: " + error.message);
    onGuardado(fecha);
  }

  async function quitar(soloEste: boolean) {
    if (!evento) return;
    if (demo) return setError("En la demo no se borra nada.");
    setGuardando(true);
    const { error } = soloEste && dia
      ? await supabase.from("p_eventos").update({ excepciones: [...(evento.excepciones ?? []), dia] }).eq("id", evento.id)
      : await supabase.from("p_eventos").delete().eq("id", evento.id);
    setGuardando(false);
    if (error) return setError("No se pudo borrar: " + error.message);
    onGuardado(dia ?? evento.fecha);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="serif text-2xl">{nuevo ? "Nuevo" : "Editar"}</h2>
          <button type="button" onClick={onClose} className="btn btn-sec px-2.5" aria-label="Cerrar">✕</button>
        </div>

        {/* Tipo */}
        <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-line p-1" role="radiogroup" aria-label="Tipo">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tipo === t.id}
              title={t.detalle}
              onClick={() => {
                // En Gratis no se crean viajes ni recordatorios nuevos (lo que ya tenías sí se edita)
                if (!pro && t.id === "viaje" && evento?.tipo !== t.id) return onPro?.();
                setTipo(t.id);
                if (t.id === "entrega" || t.id === "viaje") setTodoElDia(true);
              }}
              className={`relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition ${tipo === t.id ? "bg-accent text-panel" : "text-muted hover:bg-panel-2 hover:text-ink"} ${!pro && t.id === "viaje" && evento?.tipo !== t.id ? "opacity-60" : ""}`}
            >
              {!pro && t.id === "viaje" && evento?.tipo !== t.id && <span className="absolute right-1 top-1 text-[9px] font-bold uppercase">Pro</span>}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONO_TIPO[t.id]} /></svg>
              {t.nombre}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">{tipo === "viaje" ? "¿A dónde?" : tipo === "entrega" ? "¿Qué entregas?" : tipo === "recordatorio" ? "¿Qué no se te debe olvidar?" : "¿Qué es?"}</span>
            <input
              className="campo"
              autoFocus={nuevo}
              value={titulo}
              maxLength={120}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === "viaje" ? "Ej. Cancún" : tipo === "entrega" ? (odonto ? "Ej. Caso clínico de Endodoncia" : "Ej. Reporte mensual") : tipo === "recordatorio" ? (odonto ? "Ej. Pagar inscripción" : "Ej. Pagar la tarjeta") : odonto ? "Ej. Curso de fotografía clínica" : "Ej. Clase de inglés"}
            />
          </label>

          {tipo === "viaje" ? (
            <>
              <label className="text-sm"><span className="mb-1 block font-medium">Ida</span>
                <input type="date" className="campo" value={fecha} onChange={(e) => { setFecha(e.target.value); if (fechaFin < e.target.value) setFechaFin(e.target.value); }} required />
              </label>
              <label className="text-sm"><span className="mb-1 block font-medium">Regreso</span>
                <input type="date" className="campo" value={fechaFin} min={fecha} onChange={(e) => setFechaFin(e.target.value)} required />
              </label>
            </>
          ) : (
            <label className="col-span-2 text-sm"><span className="mb-1 block font-medium">{tipo === "entrega" ? "Para cuándo" : "Fecha"}</span>
              <input type="date" className="campo" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
          )}

          {(tipo === "evento" || tipo === "recordatorio") && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} />
              {tipo === "recordatorio" ? "Sin hora" : "Todo el día"}
            </label>
          )}
          {conHora && (
            <>
              <label className={`text-sm ${tipo === "recordatorio" ? "col-span-2" : ""}`}><span className="mb-1 block font-medium">{tipo === "recordatorio" ? "Hora" : "Empieza"}</span>
                <input type="time" className="campo" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
              </label>
              {tipo === "evento" && (
                <label className="text-sm"><span className="mb-1 block font-medium">Termina</span>
                  <input type="time" className="campo" value={fin} onChange={(e) => setFin(e.target.value)} required />
                </label>
              )}
            </>
          )}

          {(tipo === "evento" || tipo === "viaje") && (
            <label className="col-span-2 text-sm"><span className="mb-1 block font-medium">{tipo === "viaje" ? "Hotel / detalles del lugar (opcional)" : "Lugar (opcional)"}</span>
              <input className="campo" value={lugar} maxLength={120} onChange={(e) => setLugar(e.target.value)} placeholder={tipo === "viaje" ? "Ej. Hotel Riviera, vuelo VB1234" : odonto ? "Ej. Consultorio Dr. Pech" : "Ej. Oficina, sala 2"} />
            </label>
          )}

          {categorias.length > 0 && (
            <div className="col-span-2 text-sm">
              <span className="mb-1.5 block font-medium">Categoría</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setCategoria("")} className={`rounded-full border px-3 py-1 text-xs ${!categoria ? "border-ink bg-ink text-panel" : "border-line text-muted"}`}>Ninguna</button>
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoria(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    style={categoria === c.id ? { background: c.color, borderColor: c.color, color: "#fff" } : { borderColor: "var(--line)" }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: categoria === c.id ? "#fff" : c.color }} />
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {puedeRepetir && (
            <div className="col-span-2 grid grid-cols-2 gap-3 rounded-xl border border-line p-3">
              <label className="text-sm"><span className="mb-1 block font-medium">Repetir</span>
                <select className="campo" value={repetir} onChange={(e) => setRepetir(e.target.value as Repetir)}>
                  {REPETIR.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </label>
              {repetir !== "nunca" && (
                <label className="text-sm"><span className="mb-1 block font-medium">Hasta (opcional)</span>
                  <input type="date" className="campo" value={hasta} min={fecha} onChange={(e) => setHasta(e.target.value)} />
                </label>
              )}
              {esSerie && <p className="col-span-2 text-xs text-muted">Los cambios aplican a toda la serie.</p>}
            </div>
          )}

          {tipo === "entrega" && !nuevo && (
            <label className="col-span-2 flex items-center gap-2 rounded-xl border border-line p-3 text-sm font-medium">
              <input type="checkbox" checked={hecho} onChange={(e) => setHecho(e.target.checked)} />
              Ya la entregué
            </label>
          )}

          <label className="col-span-2 text-sm"><span className="mb-1 block font-medium">Notas (opcional)</span>
            <textarea className="campo min-h-[64px] resize-y" value={notas} maxLength={1000} onChange={(e) => setNotas(e.target.value)} />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {borrar ? (
          <div className="mt-4 rounded-xl border border-danger/40 p-3">
            <p className="mb-2 text-sm font-medium">¿Borrar “{evento?.titulo}”?</p>
            <div className="flex flex-wrap gap-2">
              {esSerie && dia && <button type="button" className="btn btn-sec" disabled={guardando} onClick={() => quitar(true)}>Sólo el {fechaLarga(dia)}</button>}
              <button type="button" className="btn btn-peligro" disabled={guardando} onClick={() => quitar(false)}>{esSerie ? "Toda la serie" : "Sí, borrar"}</button>
              <button type="button" className="btn btn-sec ml-auto" onClick={() => setBorrar(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2">
            {!nuevo && <button type="button" className="btn btn-sec text-danger" onClick={() => setBorrar(true)}>Borrar</button>}
            <button type="submit" className="btn btn-primario ml-auto" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
          </div>
        )}
      </form>
    </div>
  );
}
