"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cita, Clinica, Materia, Perfil } from "@/lib/types";
import { CAMPOS_CITA } from "@/lib/useDatos";
import { deISO, hhmm, MESES } from "@/lib/fechas";
import { estadoDe } from "@/lib/estados";

type Props = {
  supabase: SupabaseClient;
  userId: string;
  perfiles: Perfil[];
  clinicas: Clinica[];
  materias: Materia[];
  onIr: (fecha: string) => void;
  onClose: () => void;
};

const fechaCorta = (iso: string) => {
  const d = deISO(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()}`;
};

// Historial de un paciente: todas sus citas (de los dos), de la más reciente a la más vieja.
export default function BuscarPaciente({ supabase, userId, perfiles, clinicas, materias, onIr, onClose }: Props) {
  const [q, setQ] = useState("");
  const [citas, setCitas] = useState<Cita[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const texto = q.trim().replace(/[%_,()*]/g, "");
    if (texto.length < 2) {
      setCitas(null);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("citas")
        .select(CAMPOS_CITA)
        .ilike("paciente", `%${texto}%`)
        .order("fecha", { ascending: false })
        .order("hora_inicio", { ascending: false })
        .limit(200);
      setCitas((data as Cita[]) ?? []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, supabase]);

  const grupos = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of citas ?? []) {
      const k = c.paciente.trim().toLowerCase().replace(/\s+/g, " ");
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return [...m.values()];
  }, [citas]);

  const perfil = new Map(perfiles.map((p) => [p.id, p]));
  const clinica = new Map(clinicas.map((c) => [c.id, c]));
  const materia = new Map(materias.map((m) => [m.id, m]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-start sm:p-4 sm:pt-[10vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-panel shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-line p-4">
          <svg className="shrink-0 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
            placeholder="Nombre del paciente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={onClose} className="btn btn-sec px-2.5 py-1" aria-label="Cerrar">✕</button>
        </div>

        <div className="overflow-y-auto p-4">
          {citas === null && <p className="text-center text-sm text-muted">Escribe al menos 2 letras para ver el historial de un paciente.</p>}
          {citas !== null && !buscando && grupos.length === 0 && <p className="text-center text-sm text-muted">No hay citas con ese nombre.</p>}

          <div className="flex flex-col gap-4">
            {grupos.map((lista) => {
              const vino = lista.filter((c) => c.estado === "asistio").length;
              const falto = lista.filter((c) => c.estado === "falto").length;
              return (
                <section key={lista[0].id}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                    <h3 className="font-semibold">{lista[0].paciente}</h3>
                    <span className="text-xs text-muted">
                      {lista.length} cita{lista.length === 1 ? "" : "s"} · asistió {vino} · faltó {falto}
                    </span>
                  </div>
                  <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                    {lista.map((c) => {
                      const est = estadoDe(c.estado);
                      const m = c.materia_id ? materia.get(c.materia_id) : null;
                      const dueno = perfil.get(c.owner_id);
                      return (
                        <li key={c.id}>
                          <button onClick={() => onIr(c.fecha)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-panel-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dueno?.color }} title={dueno?.id === userId ? "Tú" : dueno?.nombre} />
                            <span className="font-medium tabular-nums">{fechaCorta(c.fecha)}</span>
                            <span className="tabular-nums text-muted">{hhmm(c.hora_inicio)}</span>
                            {c.clinica_id && <span className="text-muted">{clinica.get(c.clinica_id)?.numero}</span>}
                            {m && <span style={{ color: m.color }}>{m.nombre}</span>}
                            <span className={`ml-auto rounded-md px-1.5 py-0.5 text-xs font-medium ${est.clase}`}>{est.corto}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
