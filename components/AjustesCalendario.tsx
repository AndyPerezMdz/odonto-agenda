"use client";

import { useState } from "react";
import type { AjustesAgenda, Perfil } from "@/lib/types";

const MODOS: { id: AjustesAgenda["turnos"]; nombre: string; detalle: string }[] = [
  { id: "ninguno", nombre: "Cada quien lo suyo", detalle: "Cada quien opera a sus propios pacientes." },
  { id: "hora", nombre: "Una hora y una hora", detalle: "En cada clínica se turnan por hora." },
  { id: "clinica", nombre: "Una clínica y una clínica", detalle: "Una clínica opera uno y la siguiente el otro." },
  { id: "semana", nombre: "Una semana y una semana", detalle: "Una semana opera uno y la siguiente el otro." },
];

// UADY: semana en que arrancan las clínicas y turnos de la pareja para operar.
export default function AjustesCalendario({
  ajustes, perfiles, userId, onCambio,
}: { ajustes: AjustesAgenda; perfiles: Perfil[]; userId: string; onCambio: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const hayPareja = perfiles.length >= 2;

  async function guardar(cambios: Record<string, unknown>, ok = "Guardado.") {
    setGuardando(true);
    setMsg(null);
    const r = await fetch("/api/agenda", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
    const d = await r.json().catch(() => ({}));
    setGuardando(false);
    setMsg(r.ok ? { ok: true, texto: ok } : { ok: false, texto: d.error ?? "No se pudo guardar." });
    if (r.ok) onCambio();
  }

  const inicia = ajustes.turnos_inicia ?? perfiles.find((p) => p.rol === "owner")?.id ?? "";

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="font-semibold">Clínicas y turnos</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">Tu agenda va por semestres de la UADY (agosto–diciembre y enero–julio). Con esto sabe cuántas clínicas te quedan y si vas a tiempo con tus casos. Es compartido con tu compa.</p>

      <div className="sm:max-w-sm">
        <label className="mb-1.5 block text-sm font-medium" htmlFor="semana">Las clínicas empiezan en la</label>
        <select
          id="semana"
          className="campo"
          value={ajustes.semana_clinicas}
          disabled={guardando}
          onChange={(e) => guardar({ semana_clinicas: Number(e.target.value) })}
        >
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? "1ª semana (desde el inicio)" : `${n}ª semana del semestre`}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">La primera suele ser para conseguir paciente y esterilizar.</p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm font-medium">¿Cómo se turnan para operar?</p>
        <p className="mb-2 text-xs text-muted">El caso le cuenta sólo a quien opera. La agenda te dice a quién le toca y tu ritmo cuenta sólo las clínicas donde operas.</p>
        {!hayPareja ? (
          <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">Cuando tengas compañero/a en la agenda podrás poner sus turnos.</p>
        ) : (
          <>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  disabled={guardando}
                  onClick={() => ajustes.turnos !== m.id && guardar({ turnos: m.id, ...(m.id !== "ninguno" && !ajustes.turnos_inicia ? { turnos_inicia: inicia } : {}) })}
                  className={`rounded-xl border p-2.5 text-left text-sm ${ajustes.turnos === m.id ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2"}`}
                >
                  <span className={`block font-medium ${ajustes.turnos === m.id ? "text-accent" : ""}`}>{m.nombre}</span>
                  <span className="text-xs text-muted">{m.detalle}</span>
                </button>
              ))}
            </div>
            {ajustes.turnos !== "ninguno" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span>{ajustes.turnos === "hora" ? "En cada clínica, la primera hora opera" : ajustes.turnos === "semana" ? "La primera semana de clínicas opera" : "La primera clínica opera"}</span>
                <select className="campo" style={{ width: "auto" }} value={inicia} disabled={guardando} onChange={(e) => guardar({ turnos_inicia: e.target.value })}>
                  {perfiles.map((p) => <option key={p.id} value={p.id}>{p.id === userId ? `${p.nombre} (yo)` : p.nombre}</option>)}
                </select>
              </div>
            )}
          </>
        )}
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-accent" : "text-danger"}`}>{msg.texto}</p>}
    </section>
  );
}
