"use client";

import { useEffect, useState } from "react";
import type { Cita, Clinica, Materia } from "@/lib/types";
import { hhmm } from "@/lib/fechas";

/** 2.0 · "Hoy" (gratis): tu día de un vistazo — cuántas citas, la que sigue, quién confirmó y qué llevar. */
export default function PanelHoy({
  citas, userId, hoy, clinicaPorId, materiaPorId, onAbrir,
}: {
  citas: Cita[];
  userId: string;
  hoy: string;
  clinicaPorId: Map<string, Clinica>;
  materiaPorId: Map<string, Materia>;
  onAbrir: (c: Cita) => void;
}) {
  const [ahora, setAhora] = useState("");
  useEffect(() => {
    const tic = () => {
      const d = new Date();
      setAhora(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tic();
    const t = setInterval(tic, 60000);
    return () => clearInterval(t);
  }, []);

  const mias = citas
    .filter((c) => c.fecha === hoy && c.owner_id === userId && c.estado !== "cancelo")
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  if (!mias.length || !ahora) return null;

  const pendientes = mias.filter((c) => hhmm(c.hora_fin) > ahora);
  const sigue = pendientes[0];
  const enCurso = sigue && hhmm(sigue.hora_inicio) <= ahora;
  const confirmaron = mias.filter((c) => c.confirmacion === "confirmada").length;
  const noPueden = mias.filter((c) => c.confirmacion === "no_puede");
  const llevar = [
    ...new Set(
      pendientes.flatMap((c) =>
        (c.materia_id ? materiaPorId.get(c.materia_id)?.material ?? "" : "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
      )
    ),
  ];

  return (
    <section className="mb-5 rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-semibold">Hoy</h2>
        <p className="text-sm text-muted">
          {mias.length === 1 ? "1 cita tuya" : `${mias.length} citas tuyas`}
          {confirmaron > 0 && <> · <span className="text-[#1e6b3a] dark:text-[#9fd8b0]">{confirmaron} confirmó{confirmaron === 1 ? "" : "ron"}</span></>}
          {!pendientes.length && " · ya terminaste, ve a descansar (o a hacer la historia clínica)"}
        </p>
      </div>

      {sigue && (
        <button onClick={() => onAbrir(sigue)} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-panel-2 p-3 text-left hover:brightness-95">
          <span className="grid h-11 w-14 shrink-0 place-items-center rounded-lg bg-accent text-sm font-semibold tabular-nums text-panel">{hhmm(sigue.hora_inicio)}</span>
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">{enCurso ? "Ahorita" : "La que sigue"}</span>
            <span className="block truncate font-medium">
              {sigue.paciente}
              {sigue.clinica_id && clinicaPorId.get(sigue.clinica_id) && <span className="font-normal text-muted"> · {clinicaPorId.get(sigue.clinica_id)!.numero}</span>}
            </span>
          </span>
          {sigue.confirmacion === "confirmada" && <span className="ml-auto shrink-0 text-xs font-medium text-[#1e6b3a] dark:text-[#9fd8b0]">✓ Confirmó</span>}
        </button>
      )}

      {noPueden.length > 0 && (
        <p className="mt-2 rounded-lg bg-[#fbecea] px-3 py-2 text-sm text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]">
          Dijo que no puede ir: <b>{noPueden.map((c) => `${c.paciente} (${hhmm(c.hora_inicio)})`).join(", ")}</b>. Reagenda o busca otro paciente.
        </p>
      )}

      {llevar.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">Qué llevar hoy ({llevar.length})</summary>
          <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {llevar.map((x) => <li key={x} className="flex gap-2"><span className="text-accent">•</span>{x}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
