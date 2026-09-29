"use client";

import { useState } from "react";
import Link from "next/link";
import type { DiaLibre } from "@/lib/premium";
import { MOTIVOS } from "@/lib/premium";
import { fechaLarga, MESES } from "@/lib/fechas";

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const partes = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  return { dia: DIAS_CORTOS[f.getDay()], num: d, mes: MESES[m - 1].slice(0, 3).toLowerCase() };
};

type Hecha = { fecha: string; hora: string; fin: string; clinica: string | null };

// Lo que ve el paciente: días con lugar → horas → sus datos → listo.
export default function ReservarCita({
  slug, nombre, dias: diasIniciales, clinicas, duracion,
}: { slug: string; nombre: string; dias: DiaLibre[]; clinicas: Record<string, string>; duracion: number }) {
  const [dias, setDias] = useState(diasIniciales);
  const [fecha, setFecha] = useState(diasIniciales[0]?.fecha ?? "");
  const [hora, setHora] = useState<string | null>(null);
  const [paciente, setPaciente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [motivo, setMotivo] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [trampa, setTrampa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecha, setHecha] = useState<Hecha | null>(null);

  const dia = dias.find((d) => d.fecha === fecha);
  const espacio = dia?.espacios.find((e) => e.hora === hora);

  async function reservar(e: React.FormEvent) {
    e.preventDefault();
    if (!espacio) return setError("Elige un horario.");
    setEnviando(true);
    setError(null);
    const res = await fetch(`/api/c/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, hora, nombre: paciente, telefono, motivo, acepto, sitio_web: trampa }),
    });
    const d = await res.json().catch(() => ({}));
    setEnviando(false);
    if (res.ok) return setHecha(d);
    setError(d.error ?? "No se pudo reservar.");
    if (d.ocupado) {
      // Quitamos ese horario para que no lo vuelva a intentar
      setDias((ds) => ds.map((x) => (x.fecha === fecha ? { ...x, espacios: x.espacios.filter((s) => s.hora !== hora) } : x)).filter((x) => x.espacios.length));
      setHora(null);
    }
  }

  if (hecha) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </div>
        <h2 className="text-xl font-semibold">¡Listo, {paciente.split(" ")[0]}!</h2>
        <p className="mt-2 text-muted">
          Tu cita es el <b className="text-ink">{fechaLarga(hecha.fecha)}</b> de <b className="text-ink">{hecha.hora} a {hecha.fin}</b>
          {hecha.clinica ? <> en <b className="text-ink">{hecha.clinica}</b></> : null}.
        </p>
        <p className="mt-3 text-sm text-muted">{nombre} te va a escribir por WhatsApp para confirmarla. Si no puedes ir, avísale con tiempo.</p>
      </div>
    );
  }

  if (!dias.length) {
    return (
      <p className="rounded-2xl border border-line bg-panel p-6 text-muted">
        {nombre} no tiene horarios libres en las próximas dos semanas. Vuelve a revisar en unos días.
      </p>
    );
  }

  return (
    <form onSubmit={reservar} className="flex flex-col gap-5">
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">1. Elige el día</h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {dias.map((d) => {
            const p = partes(d.fecha);
            const activo = d.fecha === fecha;
            return (
              <button
                type="button"
                key={d.fecha}
                onClick={() => { setFecha(d.fecha); setHora(null); }}
                className={`flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2 ${activo ? "border-accent bg-accent text-panel" : "border-line hover:bg-panel-2"}`}
              >
                <span className="text-xs">{p.dia}</span>
                <span className="text-xl font-semibold leading-tight">{p.num}</span>
                <span className="text-xs">{p.mes}</span>
              </button>
            );
          })}
        </div>

        <h2 className="mb-3 mt-5 font-semibold">2. Elige la hora <span className="text-sm font-normal text-muted">(la cita dura {duracion >= 60 && duracion % 60 === 0 ? `${duracion / 60} h` : `${duracion} min`})</span></h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {dia?.espacios.map((s) => (
            <button
              type="button"
              key={s.hora}
              onClick={() => setHora(s.hora)}
              className={`rounded-xl border px-2 py-2.5 text-sm font-medium tabular-nums ${hora === s.hora ? "border-accent bg-accent text-panel" : "border-line hover:bg-panel-2"}`}
            >
              {s.hora}
            </button>
          ))}
        </div>
        {espacio?.clinica_id && clinicas[espacio.clinica_id] && (
          <p className="mt-3 text-sm text-muted">Será en <b className="text-ink">{clinicas[espacio.clinica_id]}</b>.</p>
        )}
      </section>

      <section className={`rounded-2xl border border-line bg-panel p-4 sm:p-5 ${hora ? "" : "pointer-events-none opacity-50"}`}>
        <h2 className="mb-3 font-semibold">3. Tus datos</h2>
        <label className="mb-1 block text-sm font-medium" htmlFor="pac">Nombre completo</label>
        <input id="pac" required className="campo mb-4" value={paciente} onChange={(e) => setPaciente(e.target.value)} autoComplete="name" />

        <label className="mb-1 block text-sm font-medium" htmlFor="tel">WhatsApp</label>
        <input id="tel" required inputMode="tel" className="campo mb-4" placeholder="999 123 4567" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />

        <label className="mb-1 block text-sm font-medium" htmlFor="mot">¿Qué buscas? <span className="font-normal text-muted">(opcional)</span></label>
        <select id="mot" className="campo mb-4" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          <option value="">Prefiero decírselo en persona</option>
          {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
        </select>

        {/* Trampa para bots: una persona nunca ve ni llena este campo */}
        <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={trampa} onChange={(e) => setTrampa(e.target.value)} name="sitio_web" />

        <label className="mb-4 flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>
            Acepto que {nombre} use mi nombre y teléfono sólo para contactarme sobre esta cita (<Link href="/privacidad" target="_blank" className="text-accent underline">Aviso de privacidad</Link>).
          </span>
        </label>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button className="btn btn-primario w-full" disabled={enviando || !hora}>
          {enviando ? "Reservando…" : hora ? `Reservar ${partes(fecha).dia} ${partes(fecha).num} a las ${hora}` : "Reservar"}
        </button>
      </section>
    </form>
  );
}
