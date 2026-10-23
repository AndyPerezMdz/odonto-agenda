"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sumarDias, diasEntre, pesos } from "@/lib/pagos";
import { deISO, MESES } from "@/lib/fechas";
import { hm, type PEvento } from "@/lib/personal";
import {
  IDEAS_PAGOS, MALETA_BASICA, RESERVAS, emojiReserva, gastadoViaje, maletaViaje, pagosPorAtender, siguienteVencimiento, textoFrecuencia, totalMes,
  type PCosa, type PPagoFijo, type PPagoHecho, type SubtipoReserva, type TipoCosa, type Vencimiento,
} from "@/lib/viajesPagos";
import { Ico, ICONO_LISTAS, Palomita } from "@/components/personal/Listas";

// 2.5 · Viajes completos (itinerario, maleta, reservas y gastos) y pagos fijos. Pro: en Gratis lo que ya tenías se ve y se edita.

type Set_<T> = (f: (x: T) => T) => void;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const corta = (iso: string) => `${deISO(iso).getDate()} ${MESES[deISO(iso).getMonth()].slice(0, 3).toLowerCase()}`;
const conDia = (iso: string) => `${DIAS_CORTOS[deISO(iso).getDay()]} ${corta(iso)}`;
const cuando = (hoy: string, f: string) => {
  const n = diasEntre(hoy, f);
  return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n < 0 ? `hace ${-n} días` : `en ${n} días`;
};
const IC = {
  x: "M6 6l12 12M18 6 6 18",
  copiar: "M9 9h11v11H9zM5 15H4V4h11v1",
  atras: "M15 18l-6-6 6-6",
  candado: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  pago: "M3 7h18v12H3zM3 11h18M7 15h3",
};

/* =============================== Acciones =============================== */

export function useAccionesVP({
  supabase, demo, setCosas, setPresupuestos, setPagosFijos, setPagosHechos, recargar, onPro,
}: {
  supabase: SupabaseClient; demo: boolean;
  setCosas: Set_<PCosa[]>; setPresupuestos: Set_<Record<string, number | null>>; setPagosFijos: Set_<PPagoFijo[]>; setPagosHechos: Set_<PPagoHecho[]>;
  recargar: () => void; onPro: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  async function servidor(p: PromiseLike<{ error: { message: string; hint?: string } | null }>) {
    if (demo) return;
    const r = await p;
    if (!r.error) return setError(null);
    recargar();
    if (r.error.hint === "pro" || /de Pro/.test(r.error.message)) return onPro();
    setError(/does not exist|schema cache/i.test(r.error.message) ? "Falta actualizar la base de datos (SQL 2.5)." : r.error.message);
  }
  return {
    error,
    async guardarCosa(c: Partial<PCosa> & { viaje_id: string; tipo: TipoCosa; titulo: string }) {
      const nuevo = !c.id;
      const id = c.id ?? uid();
      const datos = {
        viaje_id: c.viaje_id, tipo: c.tipo, subtipo: c.subtipo ?? null, titulo: c.titulo.trim().slice(0, 200), fecha: c.fecha || null,
        hora: c.hora ? (c.hora.length === 5 ? `${c.hora}:00` : c.hora) : null, detalle: c.detalle?.trim() || null,
        monto: c.monto == null || Number.isNaN(Number(c.monto)) ? null : Number(c.monto), hecho: c.hecho ?? false,
      };
      setCosas((l) => (nuevo ? [...l, { id, user_id: "", orden: Date.now() / 1000, created_at: new Date().toISOString(), ...datos }] : l.map((x) => (x.id === id ? { ...x, ...datos } : x))));
      if (nuevo) await servidor(supabase.from("p_viaje_cosas").insert({ id, ...datos, orden: Date.now() / 1000 }));
      else await servidor(supabase.from("p_viaje_cosas").update(datos).eq("id", id));
    },
    async variasCosas(viaje_id: string, tipo: TipoCosa, titulos: string[]) {
      if (!titulos.length) return;
      const t = Date.now() / 1000;
      const filas = titulos.map((titulo, i) => ({ id: uid(), viaje_id, tipo, titulo, hecho: false, orden: t + i / 1000 }));
      setCosas((l) => [...l, ...filas.map((f) => ({ ...f, user_id: "", subtipo: null, fecha: null, hora: null, detalle: null, monto: null, created_at: new Date().toISOString() }))]);
      await servidor(supabase.from("p_viaje_cosas").insert(filas));
    },
    async marcarCosa(c: PCosa, hecho: boolean) {
      setCosas((l) => l.map((x) => (x.id === c.id ? { ...x, hecho } : x)));
      await servidor(supabase.from("p_viaje_cosas").update({ hecho }).eq("id", c.id));
    },
    async desmarcarMaleta(viaje_id: string) {
      setCosas((l) => l.map((x) => (x.viaje_id === viaje_id && x.tipo === "maleta" ? { ...x, hecho: false } : x)));
      await servidor(supabase.from("p_viaje_cosas").update({ hecho: false }).eq("viaje_id", viaje_id).eq("tipo", "maleta"));
    },
    async borrarCosa(c: PCosa) {
      setCosas((l) => l.filter((x) => x.id !== c.id));
      await servidor(supabase.from("p_viaje_cosas").delete().eq("id", c.id));
    },
    async guardarPresupuesto(viaje_id: string, n: number | null) {
      setPresupuestos((x) => ({ ...x, [viaje_id]: n }));
      await servidor(supabase.from("p_eventos").update({ presupuesto: n }).eq("id", viaje_id));
    },
    async guardarPago(p: Partial<PPagoFijo> & { nombre: string; dia: number }) {
      const nuevo = !p.id;
      const id = p.id ?? uid();
      const datos = {
        nombre: p.nombre.trim().slice(0, 80), monto: Math.max(0, Number(p.monto) || 0), frecuencia: p.frecuencia ?? "mensual", dia: p.dia,
        mes: p.frecuencia === "anual" ? p.mes ?? 1 : null, avisar_dias: p.avisar_dias ?? 3, activo: p.activo ?? true, notas: p.notas?.trim() || null,
      };
      const hoy = new Date().toLocaleDateString("en-CA");
      setPagosFijos((l) => (nuevo ? [...l, { id, user_id: "", desde: hoy, created_at: new Date().toISOString(), ...datos }] : l.map((x) => (x.id === id ? { ...x, ...datos } : x))));
      if (nuevo) await servidor(supabase.from("p_pagos_fijos").insert({ id, ...datos, desde: hoy }));
      else await servidor(supabase.from("p_pagos_fijos").update(datos).eq("id", id));
    },
    async borrarPago(p: PPagoFijo) {
      setPagosFijos((l) => l.filter((x) => x.id !== p.id));
      setPagosHechos((l) => l.filter((h) => h.pago_id !== p.id));
      await servidor(supabase.from("p_pagos_fijos").delete().eq("id", p.id));
    },
    async marcarPagado(p: PPagoFijo, periodo: string, si: boolean) {
      setPagosHechos((l) => {
        const sin = l.filter((h) => !(h.pago_id === p.id && h.periodo === periodo));
        return si ? [...sin, { pago_id: p.id, periodo, monto: p.monto, pagado_at: new Date().toISOString() }] : sin;
      });
      if (si) await servidor(supabase.from("p_pagos_fijos_hechos").upsert({ pago_id: p.id, periodo, monto: p.monto }, { onConflict: "pago_id,periodo", ignoreDuplicates: true }));
      else await servidor(supabase.from("p_pagos_fijos_hechos").delete().eq("pago_id", p.id).eq("periodo", periodo));
    },
  };
}
export type AccionesVP = ReturnType<typeof useAccionesVP>;

/* =============================== Ventana =============================== */

function Ventana({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <p className="serif mb-4 text-2xl">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

function BotonPro({ texto, onPro }: { texto: string; onPro: () => void }) {
  return (
    <button onClick={onPro} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted hover:bg-panel-2 hover:text-ink">
      <Ico d={IC.candado} size={14} /> {texto} <span className="versalitas rounded-full bg-accent-soft px-1.5 text-accent">Pro</span>
    </button>
  );
}

const montoValido = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s.replace(/[^\d.]/g, "")) || 0));

/* =============================== Detalle del viaje =============================== */

type Pestana = "itinerario" | "maleta" | "reservas" | "gastos";

export function ViajeDetalle({
  viaje, cosas, todas, viajes, presupuesto, hoy, pro, acciones, onEditar, onClose, onPro,
}: {
  viaje: PEvento; cosas: PCosa[]; todas: PCosa[]; viajes: PEvento[]; presupuesto: number | null; hoy: string; pro: boolean;
  acciones: AccionesVP; onEditar: () => void; onClose: () => void; onPro: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("itinerario");
  const [reserva, setReserva] = useState<PCosa | "nueva" | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !reserva && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose, reserva]);

  const fin = viaje.fecha_fin && viaje.fecha_fin > viaje.fecha ? viaje.fecha_fin : viaje.fecha;
  const dias = diasEntre(viaje.fecha, fin) + 1;
  const falta = diasEntre(hoy, viaje.fecha);
  const m = maletaViaje(cosas);
  const gastado = gastadoViaje(cosas);
  const n = (t: TipoCosa) => cosas.filter((c) => c.tipo === t).length;
  const pestanas: { id: Pestana; t: string; extra: string }[] = [
    { id: "itinerario", t: "Itinerario", extra: n("itinerario") ? String(n("itinerario")) : "" },
    { id: "maleta", t: "Maleta", extra: m.total ? `${m.listas}/${m.total}` : "" },
    { id: "reservas", t: "Reservas", extra: n("reserva") ? String(n("reserva")) : "" },
    { id: "gastos", t: "Gastos", extra: gastado ? pesos(gastado) : "" },
  ];

  return (
    <div className="mi-agenda fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-label={`Viaje: ${viaje.titulo}`}>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-3 sm:px-6 sm:pt-6">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={onClose} className="btn btn-sec rounded-full px-3 py-1.5 text-sm"><Ico d={IC.atras} size={16} /> Volver</button>
          <button onClick={onEditar} className="btn btn-sec ml-auto rounded-full px-3 py-1.5 text-sm"><Ico d={ICONO_LISTAS.lapiz} size={15} /> Editar viaje</button>
        </div>

        <header className="mb-5 flex overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_12px_24px_-18px_rgba(40,30,20,0.6)]">
          <span className="min-w-0 flex-1 px-4 py-4">
            <span className="versalitas text-muted">Pase de abordar</span>
            <h1 className="serif mt-1 truncate text-4xl uppercase leading-none tracking-wide">{viaje.titulo}</h1>
            <span className="mt-2 flex items-center gap-2 text-sm">
              <span><span className="versalitas block text-muted">Ida</span>{conDia(viaje.fecha)}</span>
              <span className="mx-1 text-muted">→</span>
              <span><span className="versalitas block text-muted">Regreso</span>{conDia(fin)}</span>
            </span>
            {viaje.lugar && <span className="mt-2 block truncate text-xs text-muted">{viaje.lugar}</span>}
          </span>
          <span className="boleto-corte grid w-24 shrink-0 place-items-center px-2 text-center">
            <span>
              {fin < hoy ? (
                <><span className="serif block text-3xl leading-none">{dias}</span><span className="text-xs text-muted">día{dias === 1 ? "" : "s"}</span></>
              ) : viaje.fecha <= hoy ? (
                <><span className="versalitas block text-muted">Día</span><span className="serif block text-4xl leading-none text-accent">{diasEntre(viaje.fecha, hoy) + 1}</span><span className="text-xs text-muted">de {dias}</span></>
              ) : (
                <><span className="versalitas block text-muted">Faltan</span><span className="serif block text-4xl leading-none text-accent">{falta}</span><span className="text-xs text-muted">día{falta === 1 ? "" : "s"}</span></>
              )}
            </span>
          </span>
        </header>

        <nav className="sticky top-0 z-10 -mx-4 mb-4 flex gap-1 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0" aria-label="Partes del viaje">
          {pestanas.map((p) => (
            <button key={p.id} onClick={() => setPestana(p.id)} aria-current={pestana === p.id ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${pestana === p.id ? "bg-ink text-panel" : "border border-line bg-panel text-muted hover:text-ink"}`}>
              {p.t}{p.extra && <span className="ml-1 opacity-70">· {p.extra}</span>}
            </button>
          ))}
        </nav>

        {pestana === "itinerario" && <Itinerario viaje={viaje} fin={fin} cosas={cosas} hoy={hoy} pro={pro} acciones={acciones} onPro={onPro} onReserva={(c) => setReserva(c)} />}
        {pestana === "maleta" && <Maleta viaje={viaje} cosas={cosas} todas={todas} viajes={viajes} pro={pro} acciones={acciones} onPro={onPro} />}
        {pestana === "reservas" && <Reservas cosas={cosas} pro={pro} onPro={onPro} onAbrir={(c) => setReserva(c)} />}
        {pestana === "gastos" && <Gastos viaje={viaje} cosas={cosas} presupuesto={presupuesto} hoy={hoy} pro={pro} acciones={acciones} onPro={onPro} />}
      </div>
      {reserva && <ReservaModal viaje={viaje} reserva={reserva === "nueva" ? null : reserva} acciones={acciones} onClose={() => setReserva(null)} />}
    </div>
  );
}

function Itinerario({ viaje, fin, cosas, hoy, pro, acciones, onPro, onReserva }: { viaje: PEvento; fin: string; cosas: PCosa[]; hoy: string; pro: boolean; acciones: AccionesVP; onPro: () => void; onReserva: (c: PCosa | "nueva") => void }) {
  const dias = Array.from({ length: Math.min(60, diasEntre(viaje.fecha, fin) + 1) }, (_, i) => sumarDias(viaje.fecha, i));
  const sinDia = cosas.filter((c) => c.tipo === "itinerario" && (!c.fecha || c.fecha < viaje.fecha || c.fecha > fin));
  return (
    <div className="flex flex-col gap-3">
      {dias.map((d, i) => {
        const delDia = cosas.filter((c) => (c.tipo === "itinerario" || c.tipo === "reserva") && c.fecha === d).sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99"));
        return (
          <section key={d} className={`rounded-2xl border bg-panel p-3.5 ${d === hoy ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line"}`}>
            <p className="mb-2 flex items-baseline gap-2">
              <span className="serif text-xl">Día {i + 1}</span>
              <span className="text-sm text-muted">{conDia(d)}{d === hoy ? " · hoy" : ""}</span>
            </p>
            {delDia.length > 0 && (
              <ul className="mb-2 flex flex-col">
                {delDia.map((c) => (
                  <li key={c.id} className="group flex items-center gap-2.5 py-1 text-sm">
                    <span className="w-11 shrink-0 tabular-nums text-muted">{c.hora ? hm(c.hora) : "—"}</span>
                    {c.tipo === "reserva" ? (
                      <button onClick={() => onReserva(c)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                        <span>{emojiReserva(c.subtipo)}</span><span className="truncate font-medium">{c.titulo}</span><span className="versalitas shrink-0 text-muted">reserva</span>
                      </button>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                        <button onClick={() => acciones.borrarCosa(c)} className="shrink-0 p-1 text-muted opacity-60 hover:text-danger hover:opacity-100" aria-label={`Quitar ${c.titulo}`}><Ico d={IC.x} size={14} /></button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {pro ? <AgregarPlan viaje={viaje} dia={d} acciones={acciones} /> : delDia.length === 0 && <p className="text-sm italic text-muted">Sin planes</p>}
          </section>
        );
      })}
      {sinDia.length > 0 && (
        <section className="rounded-2xl border border-dashed border-line p-3.5">
          <p className="mb-1 text-sm font-medium text-muted">Fuera de las fechas del viaje</p>
          {sinDia.map((c) => (
            <p key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{c.fecha ? `${corta(c.fecha)} · ` : ""}{c.titulo}</span>
              <button onClick={() => acciones.borrarCosa(c)} className="p-1 text-muted hover:text-danger" aria-label={`Quitar ${c.titulo}`}><Ico d={IC.x} size={14} /></button>
            </p>
          ))}
        </section>
      )}
      {!pro && <BotonPro texto="Agregar planes al itinerario" onPro={onPro} />}
      {pro && <p className="text-center text-xs text-muted">Tus reservas con fecha también salen aquí. <button onClick={() => onReserva("nueva")} className="text-accent hover:underline">Agregar reserva</button></p>}
    </div>
  );
}

function AgregarPlan({ viaje, dia, acciones }: { viaje: PEvento; dia: string; acciones: AccionesVP }) {
  const [t, setT] = useState("");
  const [hora, setHora] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!t.trim()) return;
        acciones.guardarCosa({ viaje_id: viaje.id, tipo: "itinerario", titulo: t, fecha: dia, hora: hora || null });
        setT("");
        setHora("");
      }}
      className="flex gap-2"
    >
      <input type="time" style={{ width: "6.9rem" }} className="campo shrink-0 px-2 py-1.5 text-sm" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora (opcional)" />
      <input className="campo min-w-0 flex-1 py-1.5 text-sm" value={t} maxLength={200} onChange={(e) => setT(e.target.value)} placeholder="+ Plan: “cenote Ik Kil”" aria-label={`Nuevo plan para el ${conDia(dia)}`} />
    </form>
  );
}

function Maleta({ viaje, cosas, todas, viajes, pro, acciones, onPro }: { viaje: PEvento; cosas: PCosa[]; todas: PCosa[]; viajes: PEvento[]; pro: boolean; acciones: AccionesVP; onPro: () => void }) {
  const [t, setT] = useState("");
  const maleta = cosas.filter((c) => c.tipo === "maleta").sort((a, b) => Number(a.hecho) - Number(b.hecho) || a.orden - b.orden);
  const { listas, total } = maletaViaje(cosas);
  const ya = new Set(maleta.map((c) => c.titulo.trim().toLowerCase()));
  const faltanBasicos = MALETA_BASICA.filter((x) => !ya.has(x.toLowerCase()));
  // La maleta del viaje anterior más reciente que tenga maleta
  const anterior = viajes
    .filter((v) => v.id !== viaje.id && todas.some((c) => c.viaje_id === v.id && c.tipo === "maleta"))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const deAnterior = anterior ? todas.filter((c) => c.viaje_id === anterior.id && c.tipo === "maleta" && !ya.has(c.titulo.trim().toLowerCase())).map((c) => c.titulo) : [];

  return (
    <div>
      {total > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">{listas === total ? "¡Maleta lista! 🧳" : `Llevas ${listas} de ${total}`}</span>
            {listas > 0 && <button onClick={() => acciones.desmarcarMaleta(viaje.id)} className="text-xs text-muted hover:text-ink">Desmarcar todo</button>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(listas / total) * 100}%` }} /></div>
        </div>
      )}
      {pro ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!t.trim()) return;
            acciones.guardarCosa({ viaje_id: viaje.id, tipo: "maleta", titulo: t });
            setT("");
          }}
          className="mb-3 flex gap-2"
        >
          <input className="campo flex-1" value={t} maxLength={200} onChange={(e) => setT(e.target.value)} placeholder="+ Algo para la maleta" aria-label="Agregar a la maleta" />
        </form>
      ) : (
        <div className="mb-3"><BotonPro texto="Agregar a la maleta" onPro={onPro} /></div>
      )}
      {pro && (faltanBasicos.length > 0 || deAnterior.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {faltanBasicos.length > 0 && <button onClick={() => acciones.variasCosas(viaje.id, "maleta", faltanBasicos)} className="btn btn-sec rounded-full py-1 text-xs">+ Lo básico ({faltanBasicos.length})</button>}
          {deAnterior.length > 0 && <button onClick={() => acciones.variasCosas(viaje.id, "maleta", deAnterior)} className="btn btn-sec rounded-full py-1 text-xs">+ La de {anterior!.titulo} ({deAnterior.length})</button>}
        </div>
      )}
      {maleta.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">La maleta está vacía. Empieza con “Lo básico” y quita lo que no lleves.</p>
      ) : (
        <ul className="grid gap-1 rounded-2xl border border-line bg-panel p-2 sm:grid-cols-2">
          {maleta.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-panel-2">
              <Palomita chica checked={c.hecho} onChange={(v) => acciones.marcarCosa(c, v)} etiqueta={`Empacado: ${c.titulo}`} />
              <span className={`min-w-0 flex-1 truncate text-sm ${c.hecho ? "text-muted line-through" : ""}`}>{c.titulo}</span>
              <button onClick={() => acciones.borrarCosa(c)} className="shrink-0 p-1 text-muted opacity-50 hover:text-danger hover:opacity-100" aria-label={`Quitar ${c.titulo}`}><Ico d={IC.x} size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Reservas({ cosas, pro, onPro, onAbrir }: { cosas: PCosa[]; pro: boolean; onPro: () => void; onAbrir: (c: PCosa | "nueva") => void }) {
  const lista = cosas.filter((c) => c.tipo === "reserva").sort((a, b) => `${a.fecha ?? "9"}${a.hora ?? ""}`.localeCompare(`${b.fecha ?? "9"}${b.hora ?? ""}`));
  const [copiado, setCopiado] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-3">{pro ? <button onClick={() => onAbrir("nueva")} className="btn btn-primario w-full rounded-full">+ Reserva</button> : <BotonPro texto="Agregar reserva" onPro={onPro} />}</div>
      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">Vuelos, hotel, renta de auto, tours… con su número de confirmación a la mano.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lista.map((c) => (
            <li key={c.id} className="rounded-2xl border border-line bg-panel">
              <button onClick={() => onAbrir(c)} className="flex w-full items-start gap-3 px-4 pb-2 pt-3 text-left">
                <span className="text-2xl leading-none">{emojiReserva(c.subtipo)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.titulo}</span>
                  <span className="text-xs text-muted">{c.fecha ? conDia(c.fecha) : "Sin fecha"}{c.hora ? ` · ${hm(c.hora)}` : ""}</span>
                </span>
                {c.monto != null && <span className="shrink-0 text-sm font-medium tabular-nums">{pesos(Number(c.monto))}</span>}
              </button>
              {c.detalle && (
                <div className="flex items-center gap-2 border-t border-dashed border-line px-4 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{c.detalle}</span>
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(c.detalle!); setCopiado(c.id); setTimeout(() => setCopiado(null), 1500); } catch {}
                    }}
                    className="flex shrink-0 items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Ico d={IC.copiar} size={13} /> {copiado === c.id ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReservaModal({ viaje, reserva, acciones, onClose }: { viaje: PEvento; reserva: PCosa | null; acciones: AccionesVP; onClose: () => void }) {
  const [subtipo, setSubtipo] = useState<SubtipoReserva>(reserva?.subtipo ?? "vuelo");
  const [titulo, setTitulo] = useState(reserva?.titulo ?? "");
  const [fecha, setFecha] = useState(reserva?.fecha ?? viaje.fecha);
  const [hora, setHora] = useState(hm(reserva?.hora) || "");
  const [detalle, setDetalle] = useState(reserva?.detalle ?? "");
  const [monto, setMonto] = useState(reserva?.monto != null ? String(reserva.monto) : "");
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  return (
    <Ventana titulo={reserva ? "Reserva" : "Nueva reserva"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!titulo.trim()) return setError("¿De qué es la reserva?");
          acciones.guardarCosa({ id: reserva?.id, viaje_id: viaje.id, tipo: "reserva", subtipo, titulo, fecha, hora: hora || null, detalle, monto: montoValido(monto) });
          onClose();
        }}
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {RESERVAS.map((r) => (
            <button key={r.id} type="button" aria-pressed={subtipo === r.id} onClick={() => setSubtipo(r.id)} className={`rounded-full border px-3 py-1 text-sm ${subtipo === r.id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
              {r.emoji} {r.nombre}
            </button>
          ))}
        </div>
        <input autoFocus={!reserva} className="campo mb-3" placeholder={subtipo === "vuelo" ? "Ej. Vuelo MID → CUN" : subtipo === "hotel" ? "Ej. Hotel Riviera" : "¿Qué es?"} value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="text-sm"><span className="mb-1 block font-medium">Fecha</span><input type="date" className="campo" value={fecha ?? ""} onChange={(e) => setFecha(e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Hora <span className="font-normal text-muted">(opcional)</span></span><input type="time" className="campo" value={hora} onChange={(e) => setHora(e.target.value)} /></label>
        </div>
        <label className="mb-3 block text-sm"><span className="mb-1 block font-medium">Número de confirmación</span><input className="campo font-mono" value={detalle} maxLength={500} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej. XK7P2Q" /></label>
        <label className="mb-4 block text-sm"><span className="mb-1 block font-medium">Costo <span className="font-normal text-muted">(opcional, cuenta en tus gastos)</span></span><input inputMode="decimal" className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$0" /></label>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          {reserva && (borrar ? (
            <button type="button" className="btn rounded-full bg-danger px-4 text-white" onClick={() => { acciones.borrarCosa(reserva); onClose(); }}>¿Seguro? Borrar</button>
          ) : (
            <button type="button" className="btn btn-sec rounded-full text-danger" onClick={() => setBorrar(true)} aria-label="Borrar"><Ico d={ICONO_LISTAS.basura} size={16} /></button>
          ))}
          <button type="button" className="btn btn-sec ml-auto rounded-full" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primario rounded-full">Guardar</button>
        </div>
      </form>
    </Ventana>
  );
}

function Gastos({ viaje, cosas, presupuesto, hoy, pro, acciones, onPro }: { viaje: PEvento; cosas: PCosa[]; presupuesto: number | null; hoy: string; pro: boolean; acciones: AccionesVP; onPro: () => void }) {
  const [t, setT] = useState("");
  const [monto, setMonto] = useState("");
  const [editPres, setEditPres] = useState(false);
  const [pres, setPres] = useState(presupuesto != null ? String(presupuesto) : "");
  const gastos = cosas.filter((c) => c.tipo === "gasto").sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? "") || b.created_at.localeCompare(a.created_at));
  const reservas = cosas.filter((c) => c.tipo === "reserva" && c.monto);
  const total = gastadoViaje(cosas);
  const pct = presupuesto ? Math.min(100, (total / presupuesto) * 100) : 0;
  const pasado = presupuesto != null && total > presupuesto;

  return (
    <div>
      <section className="mb-4 rounded-2xl border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span>
            <span className="versalitas block text-muted">Llevas</span>
            <span className="serif text-4xl leading-none">{pesos(total)}</span>
          </span>
          {editPres ? (
            <form onSubmit={(e) => { e.preventDefault(); acciones.guardarPresupuesto(viaje.id, montoValido(pres)); setEditPres(false); }} className="flex items-center gap-1.5">
              <input autoFocus inputMode="decimal" style={{ width: "7rem" }} className="campo py-1.5 text-right" value={pres} onChange={(e) => setPres(e.target.value)} placeholder="$0" aria-label="Presupuesto" />
              <button className="btn btn-primario rounded-full px-3 py-1.5 text-xs">OK</button>
            </form>
          ) : (
            <button onClick={() => setEditPres(true)} className="text-right text-sm">
              <span className="versalitas block text-muted">Presupuesto</span>
              <span className="font-medium text-accent hover:underline">{presupuesto != null ? pesos(presupuesto) : "Ponerle uno"}</span>
            </button>
          )}
        </div>
        {presupuesto != null && presupuesto > 0 && (
          <>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-panel-2"><div className={`h-full rounded-full ${pasado ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
            <p className={`mt-1.5 text-sm ${pasado ? "font-medium text-danger" : "text-muted"}`}>{pasado ? `Te pasaste por ${pesos(total - presupuesto)}. Ups.` : `Te quedan ${pesos(presupuesto - total)}`}</p>
          </>
        )}
      </section>

      {pro ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!t.trim()) return;
            acciones.guardarCosa({ viaje_id: viaje.id, tipo: "gasto", titulo: t, monto: montoValido(monto) ?? 0, fecha: hoy });
            setT("");
            setMonto("");
          }}
          className="mb-4 flex gap-2"
        >
          <input className="campo min-w-0 flex-1" value={t} maxLength={200} onChange={(e) => setT(e.target.value)} placeholder="+ Gasto: “tacos”" aria-label="Concepto del gasto" />
          <input inputMode="decimal" style={{ width: "6rem" }} className="campo shrink-0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" aria-label="Monto" />
          <button className="btn btn-primario shrink-0 rounded-full px-4" disabled={!t.trim()} aria-label="Agregar gasto">+</button>
        </form>
      ) : (
        <div className="mb-4"><BotonPro texto="Agregar gastos" onPro={onPro} /></div>
      )}

      {gastos.length + reservas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">Anota lo que vas gastando y ve si el presupuesto aguanta.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
          {reservas.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span>{emojiReserva(c.subtipo)}</span>
              <span className="min-w-0 flex-1 truncate">{c.titulo} <span className="versalitas text-muted">reserva</span></span>
              <span className="tabular-nums">{pesos(Number(c.monto))}</span>
            </li>
          ))}
          {gastos.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-12 shrink-0 text-xs text-muted">{c.fecha ? corta(c.fecha) : ""}</span>
              <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
              <span className="tabular-nums">{pesos(Number(c.monto ?? 0))}</span>
              <button onClick={() => acciones.borrarCosa(c)} className="p-1 text-muted opacity-50 hover:text-danger hover:opacity-100" aria-label={`Quitar ${c.titulo}`}><Ico d={IC.x} size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =============================== Pagos fijos =============================== */

export function PagoModal({ pago, acciones, onClose }: { pago: PPagoFijo | null; acciones: AccionesVP; onClose: () => void }) {
  const [nombre, setNombre] = useState(pago?.nombre ?? "");
  const [monto, setMonto] = useState(pago ? String(pago.monto) : "");
  const [frecuencia, setFrecuencia] = useState<PPagoFijo["frecuencia"]>(pago?.frecuencia ?? "mensual");
  const [dia, setDia] = useState(pago?.dia ?? new Date().getDate());
  const [mes, setMes] = useState(pago?.mes ?? new Date().getMonth() + 1);
  const [avisar, setAvisar] = useState(pago?.avisar_dias ?? 3);
  const [notas, setNotas] = useState(pago?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  return (
    <Ventana titulo={pago ? "Pago fijo" : "Nuevo pago fijo"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nombre.trim()) return setError("¿Qué pagas?");
          acciones.guardarPago({ id: pago?.id, nombre, monto: montoValido(monto) ?? 0, frecuencia, dia, mes: frecuencia === "anual" ? mes : null, avisar_dias: avisar, notas, activo: pago?.activo ?? true });
          onClose();
        }}
      >
        <input autoFocus={!pago} className="campo mb-2 text-lg" placeholder="Ej. Renta" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
        {!pago && !nombre && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {IDEAS_PAGOS.map((i) => <button key={i} type="button" onClick={() => setNombre(i)} className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-muted hover:text-ink">{i}</button>)}
          </div>
        )}
        <label className="mb-3 mt-3 block text-sm"><span className="mb-1 block font-medium">¿Cuánto?</span><input inputMode="decimal" className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$0" /></label>
        <div className="mb-3 flex rounded-full border border-line bg-panel p-0.5 text-sm font-medium">
          {(["mensual", "anual"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFrecuencia(f)} className={`flex-1 rounded-full px-3 py-1.5 ${frecuencia === f ? "bg-ink text-panel" : "text-muted"}`}>{f === "mensual" ? "Cada mes" : "Cada año"}</button>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-medium">El día</span>
          <select style={{ width: "auto" }} className="campo py-1.5" value={dia} onChange={(e) => setDia(Number(e.target.value))} aria-label="Día">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {frecuencia === "anual" && (
            <>
              <span>de</span>
              <select style={{ width: "auto" }} className="campo py-1.5" value={mes} onChange={(e) => setMes(Number(e.target.value))} aria-label="Mes">
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m.toLowerCase()}</option>)}
              </select>
            </>
          )}
        </div>
        {dia > 28 && frecuencia === "mensual" && <p className="-mt-2 mb-3 text-xs text-muted">En los meses más cortos, el último día.</p>}
        <p className="mb-1.5 text-sm font-medium">Avísame</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[0, 1, 3, 5, 7].map((n) => (
            <button key={n} type="button" aria-pressed={avisar === n} onClick={() => setAvisar(n)} className={`rounded-full border px-3 py-1 text-sm ${avisar === n ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
              {n === 0 ? "El mismo día" : `${n} día${n === 1 ? "" : "s"} antes`}
            </button>
          ))}
        </div>
        <textarea className="campo mb-4 min-h-[60px]" placeholder="Notas (opcional): “a la cuenta de Don Pepe”" value={notas} maxLength={500} onChange={(e) => setNotas(e.target.value)} />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {pago && (borrar ? (
            <button type="button" className="btn rounded-full bg-danger px-4 text-white" onClick={() => { acciones.borrarPago(pago); onClose(); }}>Borrar con su historial</button>
          ) : (
            <>
              <button type="button" className="btn btn-sec rounded-full text-danger" onClick={() => setBorrar(true)} aria-label="Borrar"><Ico d={ICONO_LISTAS.basura} size={16} /></button>
              <button type="button" className="btn btn-sec rounded-full text-xs" onClick={() => { acciones.guardarPago({ ...pago, activo: !pago.activo }); onClose(); }}>{pago.activo ? "Pausar" : "Reactivar"}</button>
            </>
          ))}
          <button type="button" className="btn btn-sec ml-auto rounded-full" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primario rounded-full">Guardar</button>
        </div>
      </form>
    </Ventana>
  );
}

export function SeccionPagos({
  pagos, hechos, hoy, pro, acciones, onEditar, onNuevo, onPro,
}: { pagos: PPagoFijo[]; hechos: PPagoHecho[]; hoy: string; pro: boolean; acciones: AccionesVP; onEditar: (p: PPagoFijo) => void; onNuevo: () => void; onPro: () => void }) {
  const [mes, setMes] = useState(() => ({ a: deISO(hoy).getFullYear(), m: deISO(hoy).getMonth() }));
  const t = useMemo(() => totalMes(pagos, hechos, mes.a, mes.m), [pagos, hechos, mes]);
  const atender = pagosPorAtender(pagos, hechos, hoy);
  const activos = pagos.filter((p) => p.activo).sort((a, b) => (siguienteVencimiento(a, hoy) ?? "9").localeCompare(siguienteVencimiento(b, hoy) ?? "9"));
  const pausados = pagos.filter((p) => !p.activo);
  const esteMes = mes.a === deISO(hoy).getFullYear() && mes.m === deISO(hoy).getMonth();
  const mover = (n: number) => {
    const d = new Date(mes.a, mes.m + n, 1);
    setMes({ a: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div>
      <header className="mb-5 flex items-end gap-3 border-b border-line pb-4">
        <div className="mr-auto">
          <p className="versalitas text-muted">Lo que pagas cada mes</p>
          <h1 className="serif mt-1 text-5xl leading-none">Pagos fijos</h1>
        </div>
        <button onClick={pro ? onNuevo : onPro} className="btn btn-primario rounded-full">{!pro && <Ico d={IC.candado} size={14} />}+ Pago</button>
      </header>

      {pagos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center">
          <p className="serif text-2xl">Que no se te pase ninguno.</p>
          <p className="mt-1 text-sm text-muted">Renta, tarjeta, celular, Netflix… Anota cuánto y qué día, te avisa antes y palomeas “Ya pagué”.</p>
          {pro ? <button onClick={onNuevo} className="btn btn-sec mt-4 rounded-full">Agregar mi primer pago</button> : <div className="mx-auto mt-4 max-w-xs"><BotonPro texto="Agregar pagos fijos" onPro={onPro} /></div>}
        </div>
      ) : (
        <>
          {/* Total del mes */}
          <section className="mb-5 rounded-2xl border border-line bg-panel p-4">
            <div className="mb-2 flex items-center gap-2">
              <button className="btn btn-sec rounded-full px-2.5 py-0.5" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
              <span className="serif flex-1 text-center text-xl first-letter:uppercase">{MESES[mes.m].toLowerCase()} {mes.a !== deISO(hoy).getFullYear() ? mes.a : ""}</span>
              <button className="btn btn-sec rounded-full px-2.5 py-0.5" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <span><span className="versalitas block text-muted">Total</span><span className="serif text-2xl">{pesos(t.total)}</span></span>
              <span><span className="versalitas block text-muted">Pagado</span><span className="serif text-2xl text-accent">{pesos(t.pagado)}</span></span>
              <span><span className="versalitas block text-muted">Falta</span><span className="serif text-2xl">{pesos(t.falta)}</span></span>
            </div>
            {t.total > 0 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent" style={{ width: `${(t.pagado / t.total) * 100}%` }} /></div>}
            {!esteMes && t.vencimientos.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {t.vencimientos.map((v) => (
                  <li key={`${v.pago.id}-${v.fecha}`} className="flex items-center gap-2">
                    <span className="w-10 text-xs text-muted">{deISO(v.fecha).getDate()}</span>
                    <span className={`min-w-0 flex-1 truncate ${v.pagado ? "text-muted line-through" : ""}`}>{v.pago.nombre}</span>
                    <span className="tabular-nums">{pesos(v.pago.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {atender.length > 0 && (
            <section className="nota mb-5 -rotate-[0.4deg] rounded-sm p-4 shadow-[0_10px_20px_-12px_rgba(60,45,10,0.45)]">
              <h2 className="serif mb-2 text-2xl">Toca pagar</h2>
              <ul className="flex flex-col gap-2">{atender.map((v) => <RenglonPago key={`${v.pago.id}-${v.fecha}`} v={v} hoy={hoy} acciones={acciones} />)}</ul>
            </section>
          )}

          <h2 className="serif mb-2 text-2xl">Todos</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
            {activos.map((p) => {
              const sig = siguienteVencimiento(p, hoy);
              const yaEste = sig ? hechos.some((h) => h.pago_id === p.id && h.periodo === sig) : false;
              return (
                <li key={p.id}>
                  <button onClick={() => onEditar(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={IC.pago} size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.nombre}</span>
                      <span className="text-xs text-muted">{textoFrecuencia(p)}{sig ? ` · ${yaEste ? "ya pagado" : `próximo ${cuando(hoy, sig)}`}` : ""}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{pesos(p.monto)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {pausados.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Pausados: {pausados.map((p, i) => <span key={p.id}>{i > 0 && ", "}<button onClick={() => onEditar(p)} className="underline-offset-2 hover:underline">{p.nombre}</button></span>)}
            </p>
          )}
          <p className="mt-6 text-center text-xs text-muted">Te aparecen en Hoy los días antes que elegiste. Sólo es un recordatorio: aquí no se cobra ni se paga nada.</p>
        </>
      )}
    </div>
  );
}

/** Un pago por atender, con "Ya pagué" (va en Hoy y en Pagos). */
export function RenglonPago({ v, hoy, acciones }: { v: Vencimiento; hoy: string; acciones: AccionesVP }) {
  const atrasado = v.fecha < hoy;
  return (
    <li className="flex items-start gap-3">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--nota-ink)]" checked={v.pagado} onChange={(x) => acciones.marcarPagado(v.pago, v.fecha, x.target.checked)} aria-label={`Ya pagué: ${v.pago.nombre}`} />
      <span className={`min-w-0 flex-1 leading-snug ${v.pagado ? "line-through opacity-60" : ""}`}>
        {v.pago.nombre} <span className="tabular-nums opacity-75">· {pesos(v.pago.monto)}</span>
      </span>
      <span className={`shrink-0 text-xs ${atrasado ? "font-bold text-danger" : v.fecha === hoy ? "font-bold" : "opacity-75"}`}>
        {atrasado ? `pago atrasado ${diasEntre(v.fecha, hoy)} d` : `pagar ${cuando(hoy, v.fecha)}`}
      </span>
    </li>
  );
}

