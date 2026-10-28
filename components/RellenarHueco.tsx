"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cita, Clinica, Materia, Paciente } from "@/lib/types";
import { candidatosHueco, enlaceWhatsApp, IcoWhatsApp, mensajeHueco } from "@/lib/whatsapp";
import { fechaLarga, hhmm } from "@/lib/fechas";

// 3.2 · Se liberó un espacio (cancelaste o borraste una cita): ¿a quién de tus pacientes en espera le escribes?

export default function RellenarHueco({
  hueco, pacientes, userId, yo, clinicas, materias, supabase, onAgendar, onClose,
}: {
  hueco: Cita; pacientes: Paciente[]; userId: string; yo: string | null; clinicas: Clinica[]; materias: Materia[]; supabase: SupabaseClient;
  onAgendar: (p: Paciente) => void; onClose: () => void;
}) {
  const [escritos, setEscritos] = useState<Set<string>>(new Set());
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const lista = candidatosHueco(pacientes, userId, hueco.materia_id).slice(0, 8);
  const clinica = clinicas.find((c) => c.id === hueco.clinica_id)?.numero ?? null;
  const materia = (id: string | null) => materias.find((m) => m.id === id)?.nombre ?? null;

  async function escribio(p: Paciente) {
    setEscritos((s) => new Set(s).add(p.id));
    if (p.estado === "pendiente") await supabase.from("pacientes").update({ estado: "contactado" }).eq("id", p.id);
  }

  return (
    <div className="hoja-fondo fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Rellenar el hueco">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Se liberó un espacio</p>
        <h2 className="mt-1 text-xl font-semibold leading-snug">
          {fechaLarga(hueco.fecha)}, {hhmm(hueco.hora_inicio)}–{hhmm(hueco.hora_fin)}
          {clinica ? ` · ${clinica}` : ""}
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          No lo pierdas: escríbele a alguien de tus pacientes en espera{materia(hueco.materia_id) ? <> (primero los de <b className="text-ink">{materia(hueco.materia_id)}</b>)</> : null}.
        </p>
        {lista.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
            No tienes pacientes en espera. Cuando te pasen un contacto, guárdalo en <b className="text-ink">Pacientes → En espera</b> y aquí te lo sugerimos.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((p) => {
              const wa = enlaceWhatsApp(p.telefono, mensajeHueco(p, hueco, yo, clinica));
              const ya = escritos.has(p.id) || p.estado === "contactado";
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-xl border border-line p-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.nombre}</span>
                    <span className="block truncate text-xs text-muted">
                      {[materia(p.materia_id), p.telefono ? null : "sin teléfono", ya ? "ya le escribiste" : null].filter(Boolean).join(" · ") || "en espera"}
                    </span>
                  </span>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => escribio(p)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25d366] text-white" aria-label={`WhatsApp a ${p.nombre}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={IcoWhatsApp} /></svg>
                    </a>
                  )}
                  <button className="btn btn-sec shrink-0 px-3 py-1.5 text-sm" onClick={() => onAgendar(p)}>Agendar aquí</button>
                </li>
              );
            })}
          </ul>
        )}
        <button className="btn btn-sec mt-4 w-full" onClick={onClose}>Después</button>
      </div>
    </div>
  );
}
