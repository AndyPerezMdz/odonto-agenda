"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BotonActivar from "@/components/personal/BotonActivar";

/** El gancho de Mi agenda dentro de la de clínicas: mini vista previa, demo y (2.3) "Activarla" al instante. */
export default function GanchoMiAgenda() {
  const [estado, setEstado] = useState<"cargando" | "nada" | "pendiente" | "tiene">("cargando");
  useEffect(() => {
    fetch("/api/personal/solicitud").then((r) => r.json()).then((d) => setEstado(d.estado === "tiene" ? "tiene" : "nada")).catch(() => setEstado("nada"));
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      {/* Vista previa en miniatura (no son datos reales) */}
      <div
        className="relative px-5 pb-0 pt-5 text-[#2b2520]"
        style={{ backgroundColor: "#f3ede2", backgroundImage: "radial-gradient(#ddd2bf 1px, transparent 1.3px)", backgroundSize: "18px 18px" }}
        aria-hidden
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7d7265]">Mi agenda</p>
        <p className="mt-0.5 max-w-sm text-xl leading-snug" style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, serif' }}>Tu vida fuera de la clínica, también en orden.</p>
        <div className="mx-auto mt-4 max-w-sm rounded-t-2xl border border-b-0 border-[#e0d5c2] bg-[#fbf8f2] p-3 text-[12px] shadow-xl">
          <p className="mb-1 text-[22px] leading-none" style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, serif' }}>Miércoles</p>
          <p className="mb-2 text-[11px] italic text-[#b4472e]" style={{ fontFamily: 'Georgia, serif' }}>21 de octubre</p>
          <Fila color="#9333ea" hora="07:00" t="Gym" />
          <Fila color="#2563eb" hora="09:00" t="Curso de fotografía clínica" />
          <Fila color="#059669" hora="16:00" t="Pacientes en consultorio" />
          <div className="mt-2.5 -rotate-1 rounded-sm bg-[#f8eab0] px-2.5 py-1.5 text-[#4f4415]">
            <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-[#4f4415]/50" />Caso clínico de Endodoncia <span className="ml-auto font-semibold text-[#b4322b]">mañana</span></p>
          </div>
          <div className="mt-2.5 flex overflow-hidden rounded-lg border border-[#e0d5c2]">
            <span className="w-1 bg-[#ea580c]" />
            <span className="flex-1 px-2 py-1"><span className="block text-[9px] font-semibold uppercase tracking-widest text-[#7d7265]">✈ Pase de abordar</span><span className="font-semibold uppercase tracking-wide">Cancún</span></span>
            <span className="border-l-2 border-dashed border-[#e0d5c2] px-2.5 py-1 text-center"><span className="block text-[9px] uppercase text-[#7d7265]">Faltan</span><b className="text-[#b4472e]">9 días</b></span>
          </div>
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
              <BotonActivar texto="Activarla" className="btn btn-primario" />
            </>
          )}
        </div>
        {estado !== "tiene" && <p className="mt-3 text-xs text-muted">Si tu agenda de clínicas es Pro, tu Mi agenda también, sin pagar extra. En Gratis tienes eventos, pendientes, hábitos y recordatorios.</p>}
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
