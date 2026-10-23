"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cita, Clinica, Material, Materia } from "@/lib/types";
import { sumarDias } from "@/lib/pagos";
import { deISO, hhmm } from "@/lib/fechas";
import { lunesDeTuSemana } from "@/lib/tuSemana";
import Candado from "@/components/Candado";

// 2.8 · "Tu semana" en la agenda de clínicas (Pro): tus citas de lunes a domingo, quién no ha confirmado y,
// en la UADY, el material que se te está acabando de las materias que te tocan.

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export default function TuSemanaClinicas({
  citas, userId, hoy, materiaPorId, pro, esDueno, uady, supabase, onAbrir,
}: {
  citas: Cita[]; userId: string; hoy: string; materiaPorId: Map<string, Materia>; clinicaPorId?: Map<string, Clinica>;
  pro: boolean; esDueno: boolean; uady: boolean; supabase: SupabaseClient; onAbrir: (c: Cita) => void;
}) {
  const lunes = lunesDeTuSemana(hoy);
  const domingo = sumarDias(lunes, 6);
  const [abierto, setAbierto] = useState(false);
  const [falta, setFalta] = useState<Material[]>([]);
  const mias = useMemo(
    () => citas.filter((c) => c.owner_id === userId && c.fecha >= lunes && c.fecha <= domingo && c.estado !== "cancelo").sort((a, b) => `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`)),
    [citas, userId, lunes, domingo]
  );
  const porMateria = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of mias) if (c.materia_id) m.set(c.materia_id, (m.get(c.materia_id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [mias]);
  const sinConfirmar = mias.filter((c) => c.fecha >= hoy && !c.confirmacion);
  const noPueden = mias.filter((c) => c.fecha >= hoy && c.confirmacion === "no_puede");
  const materiasSemana = useMemo(() => new Set(porMateria.map(([id]) => id)), [porMateria]);

  useEffect(() => {
    if (!pro || !uady || !mias.length) return;
    supabase
      .from("material")
      .select("*")
      .in("nivel", ["poco", "nada"])
      .then(({ data }) => setFalta(((data ?? []) as Material[]).filter((x) => (x.owner_id === userId || x.compartido) && (!x.materia_id || materiasSemana.has(x.materia_id)))));
  }, [pro, uady, supabase, userId, mias.length, materiasSemana]);

  const esDomingoOLunes = [0, 1].includes(deISO(hoy).getDay());
  if (!pro) return esDomingoOLunes ? <Candado compacto titulo="Tu semana" texto="Tus citas de la semana, quién no ha confirmado y el material que te falta, de un vistazo." esDueno={esDueno} /> : null;
  if (!mias.length) return null;

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <button onClick={() => setAbierto(!abierto)} className="flex w-full items-center gap-3 text-left" aria-expanded={abierto}>
        <span className="text-2xl">🗓️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{deISO(hoy).getDay() === 0 ? "Tu semana que viene" : "Tu semana"}</span>
          <span className="block text-sm text-muted">
            {mias.length} cita{mias.length === 1 ? "" : "s"}
            {sinConfirmar.length > 0 && <> · <b className="text-ink">{sinConfirmar.length} sin confirmar</b></>}
            {noPueden.length > 0 && <> · <b className="text-danger">{noPueden.length} no puede{noPueden.length === 1 ? "" : "n"}</b></>}
            {falta.length > 0 && <> · te falta material</>}
          </span>
        </span>
        <span className="text-sm text-accent">{abierto ? "Ocultar" : "Ver"}</span>
      </button>
      {abierto && (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 text-sm">
          {porMateria.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {porMateria.map(([id, n]) => {
                const m = materiaPorId.get(id);
                return <span key={id} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `${m?.color ?? "#888"}22`, color: m?.color }}>{m?.nombre ?? "Materia"} · {n}</span>;
              })}
            </div>
          )}
          {[...noPueden, ...sinConfirmar].length > 0 && (
            <div>
              <p className="mb-1 font-medium">Para confirmar</p>
              <ul className="flex flex-col">
                {[...noPueden, ...sinConfirmar].slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => onAbrir(c)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-panel-2">
                      <span className="w-20 shrink-0 text-xs text-muted">{DIAS[deISO(c.fecha).getDay()]} {deISO(c.fecha).getDate()} · {hhmm(c.hora_inicio)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.paciente}</span>
                      <span className={`shrink-0 text-xs ${c.confirmacion === "no_puede" ? "font-semibold text-danger" : "text-muted"}`}>{c.confirmacion === "no_puede" ? "no puede" : "sin confirmar"}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">Ábrela y mándale el link de confirmar por WhatsApp.</p>
            </div>
          )}
          {falta.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Material que se te acaba</p>
              <p className="text-muted">{falta.map((x) => `${x.nombre}${x.nivel === "nada" ? " (no hay)" : ""}`).join(" · ")}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
