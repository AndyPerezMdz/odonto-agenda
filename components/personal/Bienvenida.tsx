"use client";

import { useEffect, useState } from "react";
import { NOVEDADES_MI, type NovedadMi } from "@/lib/novedadesMi";

// 2.9 · La bienvenida de 3 pasos (primera vez) y "¿Qué hay de nuevo?" de Mi agenda.

function Hoja({ onClose, children, etiqueta }: { onClose: () => void; children: React.ReactNode; etiqueta: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="hoja-fondo fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-bg p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={etiqueta}>
        {children}
      </div>
    </div>
  );
}

const PASOS = (odonto: boolean) => [
  {
    e: "☀️",
    t: "Tu día, de un vistazo",
    x: "En Hoy ves tu línea del tiempo, lo que no se te debe olvidar y tus hábitos. Lo que ya pasó se va apagando.",
    ej: null as string | null,
  },
  {
    e: "✍️",
    t: "Escríbelo como lo dirías",
    x: "Toca el + y escribe una frase. Se arma sola con fecha, hora y lugar; tú sólo revisas.",
    ej: odonto ? "Caso clínico de endo el viernes 10am" : "Cena con Ana el viernes 9pm en La Chaya",
  },
  {
    e: "🔥",
    t: "Hábitos con racha",
    x: "Agua, gym, leer… Los palomeas cada día y ves crecer tu racha. Gratis y todos los que quieras.",
    ej: null,
  },
];

export function Bienvenida({ nombre, odonto, onListo }: { nombre: string; odonto: boolean; onListo: () => void }) {
  const [i, setI] = useState(0);
  const pasos = PASOS(odonto);
  const p = pasos[i];
  return (
    <Hoja onClose={onListo} etiqueta="Bienvenida">
      <p className="versalitas text-muted">{i === 0 ? (nombre ? `Hola, ${nombre}` : "¡Hola!") : `${i + 1} de ${pasos.length}`}</p>
      <div className="my-5 text-center">
        <span className="text-6xl">{p.e}</span>
        <h2 className="serif mt-3 text-3xl leading-tight">{p.t}</h2>
        <p className="mx-auto mt-2 max-w-xs text-muted">{p.x}</p>
        {p.ej && <p className="nota mx-auto mt-4 max-w-xs -rotate-1 rounded-sm px-4 py-3 text-sm italic shadow-[0_8px_16px_-10px_rgba(60,45,10,0.45)]">“{p.ej}”</p>}
      </div>
      <div className="mb-4 flex justify-center gap-1.5" aria-hidden>
        {pasos.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-1.5 bg-line"}`} />)}
      </div>
      <div className="flex gap-2">
        {i > 0 ? <button className="btn btn-sec rounded-full" onClick={() => setI(i - 1)}>Atrás</button> : <button className="btn btn-sec rounded-full" onClick={onListo}>Saltar</button>}
        <button className="btn btn-primario ml-auto rounded-full px-6" onClick={() => (i < pasos.length - 1 ? setI(i + 1) : onListo())}>{i < pasos.length - 1 ? "Siguiente" : "¡A darle!"}</button>
      </div>
    </Hoja>
  );
}

export function Novedades({ versiones, pro, onListo }: { versiones: typeof NOVEDADES_MI; pro: boolean; onListo: () => void }) {
  const lista = versiones.length ? versiones : NOVEDADES_MI.slice(0, 1);
  return (
    <Hoja onClose={onListo} etiqueta="¿Qué hay de nuevo?">
      <p className="versalitas text-accent">¿Qué hay de nuevo?</p>
      <h2 className="serif mb-4 mt-1 text-3xl leading-tight">{lista[0].titulo}</h2>
      <div className="flex flex-col gap-5">
        {lista.map((v) => (
          <section key={v.version}>
            {lista.length > 1 && <p className="versalitas mb-2 text-muted">{v.titulo}</p>}
            <ul className="flex flex-col gap-3">
              {v.items.map((n: NovedadMi) => (
                <li key={n.t} className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl">{n.e}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      {n.t}
                      {n.pro && !pro && <span className="versalitas rounded-full bg-accent-soft px-1.5 text-accent">Pro</span>}
                    </span>
                    <span className="block text-sm text-muted">{n.x}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <button className="btn btn-primario mt-6 w-full rounded-full" onClick={onListo}>Va</button>
    </Hoja>
  );
}
