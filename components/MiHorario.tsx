"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Clinica, Horario } from "@/lib/types";
import { hhmm } from "@/lib/fechas";
import { DIAS } from "@/lib/horario";

// "Los martes de 8 a 12 tengo Clínica 1": se pinta en la agenda y te enseña tus huecos libres.
export default function MiHorario({
  supabase, userId, horarios, clinicas, onCambio,
}: { supabase: SupabaseClient; userId: string; horarios: Horario[]; clinicas: Clinica[]; onCambio: () => void }) {
  const mios = horarios.filter((h) => h.owner_id === userId);
  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("12:00");
  const [clinicaId, setClinicaId] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const clinica = new Map(clinicas.map((c) => [c.id, c.numero]));

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fin <= inicio) return setError("La hora de fin debe ser después de la de inicio.");
    const { error } = await supabase.from("horarios").insert({
      dia_semana: dia,
      hora_inicio: inicio,
      hora_fin: fin,
      clinica_id: clinicaId || null,
      etiqueta: etiqueta.trim() || null,
    });
    if (error) return setError("No se pudo guardar: " + error.message);
    setEtiqueta("");
    onCambio();
  }

  async function quitar(id: string) {
    await supabase.from("horarios").delete().eq("id", id);
    onCambio();
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="font-semibold">Mi horario de clínica</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">
        Tus bloques fijos de cada semana. Se marcan en la agenda y en el día te dice qué huecos te quedan libres para meter pacientes.
      </p>

      {mios.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line text-sm">
          {mios.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="w-24 font-medium">{DIAS[h.dia_semana]}</span>
              <span className="tabular-nums">{hhmm(h.hora_inicio)}–{hhmm(h.hora_fin)}</span>
              <span className="text-muted">{[h.clinica_id && clinica.get(h.clinica_id), h.etiqueta].filter(Boolean).join(" · ")}</span>
              <button onClick={() => quitar(h.id)} className="ml-auto text-xs text-danger hover:underline">Quitar</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={agregar} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
        <select className="campo col-span-2 sm:col-span-1" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DIAS[d]}</option>)}
        </select>
        <input type="time" className="campo" value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="Inicio" />
        <input type="time" className="campo" value={fin} onChange={(e) => setFin(e.target.value)} aria-label="Fin" />
        <select className="campo" value={clinicaId} onChange={(e) => setClinicaId(e.target.value)}>
          <option value="">Clínica…</option>
          {clinicas.filter((c) => c.activo).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}
        </select>
        <button className="btn btn-primario">Agregar</button>
        <input className="campo col-span-2 sm:col-span-5" placeholder="Etiqueta opcional (ej. Clínica integral, turno matutino)" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
