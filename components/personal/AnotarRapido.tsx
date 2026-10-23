"use client";

import { useMemo, useState } from "react";
import { anotarRapido, type Borrador } from "@/lib/anotarRapido";
import { REPETIR, TIPOS } from "@/lib/personal";
import { deISO, MESES } from "@/lib/fechas";
import { diasEntre } from "@/lib/pagos";

// 2.6 · "Escríbelo como lo dirías": arma el evento con fecha, hora y lugar, y te deja revisarlo antes de guardar.

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const EJEMPLOS = {
  general: ["Cena con Ana el viernes 9pm en La Chaya", "Gym todos los lunes 7am", "Cumple de mamá 26 de octubre", "Recuérdame pagar la luz el lunes 10am", "Viaje a Cancún del 31 de oct al 3 de nov"],
  odonto: ["Caso clínico de endo el viernes 10am", "Entregar historia clínica mañana", "Examen de perio el 5", "Recuérdame comprar resina el lunes", "Viaje al congreso del 12 al 14 de nov"],
};
const EMOJI: Record<string, string> = { evento: "📅", entrega: "📌", recordatorio: "⏰", viaje: "✈️", pendiente: "☑️" };

export default function AnotarRapido({ hoy, fechaDefault, odonto, onRevisar }: { hoy: string; fechaDefault: string; odonto: boolean; onRevisar: (b: Borrador) => void }) {
  const [t, setT] = useState("");
  const [ejemplo] = useState(() => Math.floor(Math.random() * 5));
  const ej = EJEMPLOS[odonto ? "odonto" : "general"];
  const b = useMemo(() => (t.trim().length >= 3 ? anotarRapido(t, hoy) : null), [t, hoy]);
  const fecha = b?.fecha ?? (b?.clase === "pendiente" ? null : fechaDefault);
  const cuando = (f: string) => {
    const n = diasEntre(hoy, f);
    const d = deISO(f);
    const base = `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
    return n === 0 ? `hoy` : n === 1 ? `mañana (${base})` : base;
  };

  function revisar(e: React.FormEvent) {
    e.preventDefault();
    if (!b || !b.titulo) return;
    onRevisar({ ...b, fecha: b.clase === "pendiente" ? b.fecha : fecha });
  }

  return (
    <form onSubmit={revisar} className="mb-4">
      <label htmlFor="anotar-rapido" className="mb-1.5 block text-sm font-medium">Escríbelo como lo dirías</label>
      <div className="flex gap-2">
        <input
          id="anotar-rapido"
          className="campo flex-1"
          value={t}
          maxLength={200}
          onChange={(e) => setT(e.target.value)}
          placeholder={`Ej. ${ej[ejemplo % ej.length]}`}
          autoComplete="off"
          enterKeyHint="done"
        />
        <button className="btn btn-primario shrink-0 rounded-full px-4" disabled={!b?.titulo}>Revisar</button>
      </div>
      {b && b.titulo && (
        <div className="mt-2 rounded-xl border border-dashed border-accent/50 bg-accent-soft/30 px-3 py-2" aria-live="polite">
          <p className="truncate text-sm font-semibold">
            {EMOJI[b.clase === "pendiente" ? "pendiente" : b.tipo]} {b.titulo}
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <Chip>{b.clase === "pendiente" ? "Pendiente" : TIPOS.find((x) => x.id === b.tipo)?.nombre}</Chip>
            {fecha && <Chip apagado={!b.fecha}>{b.fecha_fin ? `${cuando(fecha)} → ${cuando(b.fecha_fin)}` : cuando(fecha)}{!b.fecha && " (no dijiste cuándo)"}</Chip>}
            {b.hora_inicio && <Chip>🕘 {b.hora_inicio}{b.hora_fin ? `–${b.hora_fin}` : ""}</Chip>}
            {b.lugar && <Chip>📍 {b.lugar}</Chip>}
            {b.repetir !== "nunca" && <Chip>🔁 {REPETIR.find((r) => r.id === b.repetir)?.nombre.split(" (")[0].toLowerCase()}</Chip>}
          </p>
        </div>
      )}
      {!t && <p className="mt-1.5 text-xs text-muted">Con fecha, hora y lugar si quieres. Antes de guardar te dejo revisarlo.</p>}
    </form>
  );
}

function Chip({ children, apagado = false }: { children: React.ReactNode; apagado?: boolean }) {
  return <span className={`rounded-full border border-line bg-panel px-2 py-0.5 ${apagado ? "text-muted" : ""}`}>{children}</span>;
}
