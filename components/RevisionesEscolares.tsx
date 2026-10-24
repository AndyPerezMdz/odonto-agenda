"use client";

import { useEffect, useState } from "react";
import type { RevisionEscolar } from "@/lib/verificacionServer";

// 3.1 · Panel de staff (Hoy): quienes no tienen acceso a su correo institucional y piden que los apruebes a mano.

const UNI: Record<string, string> = { upp: "UPP", uady: "UADY" };

export default function RevisionesEscolares({ onAviso }: { onAviso?: (t: string) => void }) {
  const [lista, setLista] = useState<RevisionEscolar[] | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/verificaciones", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { revisiones: [] }))
      .then((d) => setLista(d.revisiones ?? []))
      .catch(() => setLista([]));
  }, []);
  if (!lista?.length) return null;

  async function resolver(r: RevisionEscolar, aprobar: boolean) {
    setTrabajando(r.user_id);
    const res = await fetch("/api/admin/verificaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: r.user_id, aprobar }) });
    setTrabajando(null);
    if (res.ok) {
      setLista((l) => (l ?? []).filter((x) => x.user_id !== r.user_id));
      onAviso?.(aprobar ? `Aprobado: ${r.nombre ?? r.email}. Ya le avisamos por correo.` : `Rechazado: ${r.nombre ?? r.email}. Le avisamos por correo.`);
    } else onAviso?.((await res.json().catch(() => ({}))).error ?? "No se pudo.");
  }

  return (
    <section className="rounded-2xl border border-accent/50 bg-accent-soft/30 p-4">
      <h2 className="font-semibold">🎓 Por aprobar: estudiantes sin correo institucional ({lista.length})</h2>
      <p className="mb-3 text-sm text-muted">Quieren abrir su agenda de clínicas y no pudieron confirmar con su correo de la escuela. Revisa lo que escribieron (matrícula, semestre).</p>
      <ul className="flex flex-col gap-2">
        {lista.map((r) => (
          <li key={r.user_id} className="rounded-xl border border-line bg-panel p-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b>{r.nombre ?? "Sin nombre"}</b>
              <span className="text-sm text-muted">{r.email}</span>
              <span className="rounded-full bg-panel-2 px-2 text-xs font-semibold">{UNI[r.universidad] ?? r.universidad}</span>
              <span className="ml-auto text-xs text-muted">{new Date(r.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
            </div>
            {r.nota && <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-panel-2 px-3 py-2 text-sm">{r.nota}</p>}
            <div className="mt-2 flex gap-2">
              <button className="btn btn-primario px-3 py-1.5 text-sm" disabled={trabajando === r.user_id} onClick={() => resolver(r, true)}>Aprobar</button>
              <button className="btn btn-sec px-3 py-1.5 text-sm text-danger" disabled={trabajando === r.user_id} onClick={() => resolver(r, false)}>Rechazar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
