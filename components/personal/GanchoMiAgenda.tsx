"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** 2.2 · El gancho de Mi agenda dentro de la de clínicas: mini vista previa, demo y "La quiero". */
export default function GanchoMiAgenda() {
  const [estado, setEstado] = useState<"cargando" | "nada" | "pendiente" | "tiene" | "enviando">("cargando");
  useEffect(() => {
    fetch("/api/personal/solicitud").then((r) => r.json()).then((d) => setEstado(d.estado ?? "nada")).catch(() => setEstado("nada"));
  }, []);

  async function pedir() {
    setEstado("enviando");
    const r = await fetch("/api/personal/solicitud", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setEstado(d.estado === "tiene" ? "tiene" : "pendiente");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      {/* Vista previa en miniatura (no son datos reales) */}
      <div className="relative bg-gradient-to-br from-[#2a2563] to-[#0f0d2c] px-5 pb-0 pt-5 text-white" aria-hidden>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#b3afff]">Mi agenda</p>
        <p className="mt-1 max-w-sm font-semibold leading-snug">Tu vida fuera de la clínica, también en orden.</p>
        <div className="mx-auto mt-4 max-w-sm rounded-t-2xl bg-white p-3 text-[12px] text-[#15171e] shadow-2xl">
          <p className="mb-1.5 font-semibold">Hoy</p>
          <Fila color="#9333ea" hora="07:00" t="Gym" />
          <Fila color="#2563eb" hora="09:00" t="Curso de fotografía clínica" />
          <Fila color="#059669" hora="16:00" t="Pacientes en consultorio" />
          <p className="mb-1.5 mt-3 font-semibold">Por entregar</p>
          <p className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-[#c9ccd6]" />Caso clínico de Endodoncia <span className="ml-auto text-[#c43d3d]">mañana</span></p>
          <p className="mt-2 rounded-md bg-[#ea580c] px-2 py-0.5 text-[11px] font-medium text-white">✈ Cancún · 4 días</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <h2 className="font-semibold">¿Y tu vida fuera de la clínica?</h2>
        <p className="mt-1 text-sm text-muted">
          Viajes, cursos, entregas, el consultorio de las tardes y recordatorios, en una agenda aparte que <b className="text-ink">sólo tú ves</b>. Con tu misma cuenta: cambias entre las dos con un toque.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {estado === "tiene" ? (
            <Link href="/personal" className="btn btn-primario">Abrir Mi agenda</Link>
          ) : (
            <>
              <Link href="/personal/demo" className="btn btn-sec">Ver cómo se ve</Link>
              {estado === "pendiente" ? (
                <span className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">Ya la pediste. Te llega un correo cuando esté lista.</span>
              ) : (
                <button onClick={pedir} disabled={estado === "enviando" || estado === "cargando"} className="btn btn-primario">{estado === "enviando" ? "Pidiendo…" : "La quiero"}</button>
              )}
            </>
          )}
        </div>
        {estado !== "tiene" && <p className="mt-3 text-xs text-muted">Por ahora es por invitación: la activamos a mano y te avisamos por correo.</p>}
      </div>
    </section>
  );
}

function Fila({ color, hora, t }: { color: string; hora: string; t: string }) {
  return (
    <p className="mb-1 flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="w-10 tabular-nums text-[#646a7a]">{hora}</span>
      {t}
    </p>
  );
}
