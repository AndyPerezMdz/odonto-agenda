"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Clinica, Horario, Materia } from "@/lib/types";
import { hhmm } from "@/lib/fechas";
import { DIAS } from "@/lib/horario";

// "Los martes de 8 a 12 tengo Clínica 1": se pinta en la agenda y te enseña tus huecos libres.
export default function MiHorario({
  supabase, userId, horarios, clinicas, materias, onCambio,
}: { supabase: SupabaseClient; userId: string; horarios: Horario[]; clinicas: Clinica[]; materias: Materia[]; onCambio: () => void }) {
  const mios = horarios.filter((h) => h.owner_id === userId);
  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("12:00");
  const [clinicaId, setClinicaId] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const clinica = new Map(clinicas.map((c) => [c.id, c.numero]));
  const materia = new Map(materias.map((m) => [m.id, m]));
  const sinMateria = mios.filter((h) => !h.materia_id).length;

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fin <= inicio) return setError("La hora de fin debe ser después de la de inicio.");
    const { error } = await supabase.from("horarios").insert({
      dia_semana: dia,
      hora_inicio: inicio,
      hora_fin: fin,
      clinica_id: clinicaId || null,
      materia_id: materiaId || null,
      etiqueta: etiqueta.trim() || null,
    });
    if (error) return setError("No se pudo guardar: " + error.message);
    setEtiqueta("");
    onCambio();
  }

  async function cambiarMateria(id: string, materia_id: string) {
    await supabase.from("horarios").update({ materia_id: materia_id || null }).eq("id", id);
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
              <select
                className="rounded-lg border border-line bg-panel px-1.5 py-0.5 text-xs"
                value={h.materia_id ?? ""}
                onChange={(e) => cambiarMateria(h.id, e.target.value)}
                aria-label="Materia de este bloque"
                style={h.materia_id ? { borderColor: materia.get(h.materia_id)?.color } : undefined}
              >
                <option value="">¿Qué materia?</option>
                {materias.filter((m) => m.activo || m.id === h.materia_id).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <button onClick={() => quitar(h.id)} className="ml-auto text-xs text-danger hover:underline">Quitar</button>
            </li>
          ))}
        </ul>
      )}

      {mios.length > 0 && sinMateria > 0 && materias.length > 0 && (
        <p className="-mt-2 mb-4 text-xs text-muted">Ponle su materia a cada bloque: así Mi avance te dice cuántas clínicas te quedan de cada una.</p>
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
        <select className="campo col-span-2 sm:col-span-2" value={materiaId} onChange={(e) => setMateriaId(e.target.value)} aria-label="Materia">
          <option value="">Materia…</option>
          {materias.filter((m) => m.activo).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <input className="campo col-span-2 sm:col-span-3" placeholder="Etiqueta opcional (ej. turno matutino)" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
