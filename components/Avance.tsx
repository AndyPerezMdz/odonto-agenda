"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCatalogos, useCitas } from "@/lib/useDatos";
import { prefs, type Cita, type Materia } from "@/lib/types";
import { aplicarTema } from "@/lib/tema";
import { deISO, fechaLarga, hhmm, hoyISO } from "@/lib/fechas";
import { rangoDe } from "@/lib/cuatrimestre";
import { sumarDias } from "@/lib/pagos";

// "Mi avance": cuántos casos lleva cada quien por materia en el cuatrimestre, contra la meta.
export default function Avance({ userId }: { userId: string }) {
  const { supabase, perfiles, materias, recargar: recargarCatalogos } = useCatalogos();
  const [fechaRef, setFechaRef] = useState(hoyISO());
  const [persona, setPersona] = useState(userId);
  const rango = rangoDe(deISO(fechaRef));
  const { citas, recargar } = useCitas(rango.desde, rango.hasta);
  const hoy = hoyISO();

  const yo = perfiles.find((p) => p.id === userId);
  useEffect(() => {
    if (yo) aplicarTema(prefs(yo.preferencias).tema);
  }, [yo]);

  const esMio = persona === userId;
  const mias = useMemo(() => citas.filter((c) => c.owner_id === persona), [citas, persona]);

  const filas = useMemo(() => {
    const porMateria = new Map<string, Cita[]>();
    for (const c of mias) {
      const k = c.materia_id ?? "";
      porMateria.set(k, [...(porMateria.get(k) ?? []), c]);
    }
    const lista = materias
      .filter((m) => m.activo || porMateria.has(m.id))
      .map((m) => ({ materia: m as Materia | null, citas: porMateria.get(m.id) ?? [] }));
    if (porMateria.has("")) lista.push({ materia: null, citas: porMateria.get("")! });
    return lista.map(({ materia, citas }) => ({
      materia,
      asistio: citas.filter((c) => c.estado === "asistio").length,
      falto: citas.filter((c) => c.estado === "falto").length,
      agendadas: citas.filter((c) => !c.estado && c.fecha >= hoy).length,
      sinMarcar: citas.filter((c) => !c.estado && c.fecha < hoy).length,
    }));
  }, [mias, materias, hoy]);

  const total = filas.reduce((n, f) => n + f.asistio, 0);
  const faltas = filas.reduce((n, f) => n + f.falto, 0);
  const asistencia = total + faltas > 0 ? Math.round((total / (total + faltas)) * 100) : null;
  const pendientesDeMarcar = mias.filter((c) => !c.estado && c.fecha < hoy);
  const quien = perfiles.find((p) => p.id === persona);

  async function marcar(id: string, estado: "asistio" | "falto") {
    await supabase.from("citas").update({ estado }).eq("id", id);
    recargar();
  }

  async function guardarMeta(id: string, meta: number | null) {
    await supabase.from("materias").update({ meta }).eq("id", id);
    recargarCatalogos();
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 flex items-center gap-3">
        <Link href="/" className="btn btn-sec px-2.5" aria-label="Volver">‹</Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mi avance</h1>
          <p className="text-sm text-muted">Casos atendidos por materia en el cuatrimestre.</p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button className="btn btn-sec px-2.5" onClick={() => setFechaRef(sumarDias(rango.desde, -1))} aria-label="Cuatrimestre anterior">‹</button>
          <button className="btn btn-sec px-2.5" onClick={() => setFechaRef(sumarDias(rango.hasta, 1))} aria-label="Cuatrimestre siguiente">›</button>
        </div>
        <h2 className="font-semibold first-letter:uppercase">{rango.nombre}</h2>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {perfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${persona === p.id ? "border-ink bg-ink text-panel" : "border-line hover:bg-panel-2"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.id === userId ? "Yo" : p.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ["Casos atendidos", String(total)],
          ["Faltas de pacientes", String(faltas)],
          ["Asistencia", asistencia === null ? "—" : `${asistencia}%`],
        ].map(([t, v]) => (
          <div key={t} className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
            <p className="text-xs text-muted">{t}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {esMio && pendientesDeMarcar.length > 0 && (
        <section className="mb-5 rounded-2xl border-2 border-accent bg-panel p-4">
          <h3 className="font-semibold">Tienes {pendientesDeMarcar.length} cita{pendientesDeMarcar.length === 1 ? "" : "s"} sin marcar</h3>
          <p className="mb-3 text-sm text-muted">Sólo cuentan los casos marcados como <b>Asistió</b>.</p>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {pendientesDeMarcar.slice(0, 8).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="font-medium">{c.paciente}</span>
                <span className="text-xs text-muted first-letter:uppercase">{fechaLarga(c.fecha)} · {hhmm(c.hora_inicio)}</span>
                <span className="ml-auto flex gap-1.5">
                  <button onClick={() => marcar(c.id, "asistio")} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-[#e6f4ea] hover:text-[#1e6b3a]">Asistió</button>
                  <button onClick={() => marcar(c.id, "falto")} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-[#fbecea] hover:text-[#7a1f1a]">Faltó</button>
                </span>
              </li>
            ))}
          </ul>
          {pendientesDeMarcar.length > 8 && <p className="mt-2 text-xs text-muted">…y {pendientesDeMarcar.length - 8} más. Márcalas desde la agenda.</p>}
        </section>
      )}

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{esMio ? "Tus casos por materia" : `Casos de ${quien?.nombre ?? ""}`}</h3>
          <span className="text-xs text-muted">La meta es la misma para los dos. Toca el número para cambiarla.</span>
        </div>
        {filas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Aún no hay materias. Agrégalas en <Link href="/personalizar" className="font-medium text-accent">Personalizar</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {filas.map((f) => (
              <FilaMateria key={f.materia?.id ?? "sin"} {...f} onMeta={guardarMeta} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilaMateria({
  materia, asistio, falto, agendadas, sinMarcar, onMeta,
}: {
  materia: Materia | null;
  asistio: number;
  falto: number;
  agendadas: number;
  sinMarcar: number;
  onMeta: (id: string, meta: number | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(materia?.meta ?? ""));
  const meta = materia?.meta ?? null;
  const color = materia?.color ?? "#94a3b8";
  const pct = meta ? Math.min(100, (asistio / meta) * 100) : 0;
  const pctAgendadas = meta ? Math.min(100 - pct, (agendadas / meta) * 100) : 0;
  const cumplida = meta !== null && asistio >= meta;

  function guardar() {
    setEditando(false);
    const n = parseInt(valor, 10);
    const nueva = Number.isFinite(n) && n > 0 ? Math.min(n, 999) : null;
    if (materia && nueva !== meta) onMeta(materia.id, nueva);
  }

  return (
    <li>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="h-2.5 w-2.5 shrink-0 self-center rounded-full" style={{ background: color }} />
        <span className="font-medium">{materia?.nombre ?? "Sin materia"}</span>
        {cumplida && <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-medium text-[#1e6b3a]">¡Meta cumplida!</span>}
        <span className="ml-auto text-sm tabular-nums">
          <b>{asistio}</b>
          {materia && (
            <>
              <span className="text-muted"> de </span>
              {editando ? (
                <input
                  autoFocus
                  type="number"
                  min={1}
                  max={999}
                  className="campo inline-block w-16 px-2 py-0.5 text-sm"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onBlur={guardar}
                  onKeyDown={(e) => e.key === "Enter" && guardar()}
                />
              ) : (
                <button onClick={() => setEditando(true)} className="rounded-md border border-dashed border-line px-1.5 text-muted hover:border-accent hover:text-accent" title="Cambiar meta">
                  {meta ?? "meta"}
                </button>
              )}
            </>
          )}
        </span>
      </div>
      {meta ? (
        <div className="flex h-2.5 overflow-hidden rounded-full bg-panel-2">
          <div style={{ width: `${pct}%`, background: color }} />
          <div style={{ width: `${pctAgendadas}%`, background: `${color}55` }} />
        </div>
      ) : (
        <div className="h-2.5 rounded-full bg-panel-2" />
      )}
      <p className="mt-1 text-xs text-muted">
        {agendadas > 0 ? `${agendadas} agendada${agendadas === 1 ? "" : "s"}` : "Nada agendado"}
        {falto > 0 && ` · ${falto} falta${falto === 1 ? "" : "s"}`}
        {sinMarcar > 0 && ` · ${sinMarcar} sin marcar`}
        {meta && !cumplida && ` · te faltan ${meta - asistio}`}
      </p>
    </li>
  );
}
