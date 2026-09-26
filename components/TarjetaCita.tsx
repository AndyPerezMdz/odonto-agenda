"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cita, Clinica, EstadoCita, Materia, Perfil } from "@/lib/types";
import { hhmm } from "@/lib/fechas";
import { estadoDe } from "@/lib/estados";

type Props = {
  cita: Cita;
  userId: string;
  hoy: string;
  dueno?: Perfil;
  clinica?: Clinica | null;
  materia?: Materia | null;
  supabase: SupabaseClient;
  soloLectura?: boolean;
  onAbrir: () => void;
  onCambio: () => void;
};

// Una cita en lista (panel del día, vista de lista). Si ya pasó y es tuya, deja marcar Asistió/Faltó de un toque.
export default function TarjetaCita({ cita: c, userId, hoy, dueno, clinica, materia, supabase, soloLectura, onAbrir, onCambio }: Props) {
  const [marcando, setMarcando] = useState(false);
  const est = estadoDe(c.estado);
  const cancelada = c.estado === "cancelo";
  const puedeMarcar = !soloLectura && c.owner_id === userId && !c.estado && c.fecha <= hoy;

  async function marcar(estado: EstadoCita) {
    setMarcando(true);
    await supabase.from("citas").update({ estado }).eq("id", c.id);
    setMarcando(false);
    onCambio();
  }

  return (
    <div
      className={`rounded-xl border border-line transition ${cancelada ? "opacity-60" : ""}`}
      style={{ borderLeft: `4px solid ${dueno?.color ?? "#888"}` }}
    >
      <button onClick={onAbrir} className="w-full rounded-xl p-3 text-left hover:bg-panel-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-medium ${cancelada ? "line-through" : ""}`}>{c.paciente}</span>
          <span className="shrink-0 text-sm tabular-nums text-muted">
            {hhmm(c.hora_inicio)}–{hhmm(c.hora_fin)}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {clinica && <span className="rounded-md bg-panel-2 px-1.5 py-0.5">{clinica.numero}</span>}
          {materia && (
            <span className="rounded-md px-1.5 py-0.5" style={{ background: `${materia.color}22`, color: materia.color }}>
              {materia.nombre}
            </span>
          )}
          {c.estado && <span className={`rounded-md px-1.5 py-0.5 font-medium ${est.clase}`}>{est.corto}</span>}
          <span className="ml-auto text-muted">{dueno?.id === userId ? "Tú" : dueno?.nombre}</span>
        </div>
        {c.notas && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{c.notas}</p>}
      </button>
      {puedeMarcar && (
        <div className="flex items-center gap-1.5 border-t border-line px-3 py-2 text-xs">
          <span className="mr-auto text-muted">¿Llegó?</span>
          <button disabled={marcando} onClick={() => marcar("asistio")} className="rounded-full border border-line px-2.5 py-1 font-medium hover:bg-[#e6f4ea] hover:text-[#1e6b3a]">
            Asistió
          </button>
          <button disabled={marcando} onClick={() => marcar("falto")} className="rounded-full border border-line px-2.5 py-1 font-medium hover:bg-[#fbecea] hover:text-[#7a1f1a]">
            Faltó
          </button>
        </div>
      )}
    </div>
  );
}
