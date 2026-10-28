"use client";


import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { fuentePapel } from "@/lib/fuentePapel";

/**
 * 3.7 · Animación al abrir la agenda (una vez por sesión: al abrir la app, no cada que cambias de sección).
 * - "mi": un libro abierto que se escribe solo, con su pluma.
 * - "clinicas": un diente que se cepilla, hace burbujas y queda brillando.
 * Vive en el layout raíz y viene desde el HTML del servidor, así que es LO PRIMERO que se ve (antes que la agenda).
 * Si ya se vio en esta sesión, el script del <head> (SCRIPT_INTRO) la esconde antes de pintar.
 * Se va cuando la agenda avisa que ya cargó (avisarAgendaLista), mínimo ~2 s y máximo 3 s. Tocarla la salta.
 */
const MINIMO = 2100; // lo que dura la animación completa (libro con su palomita; diente con su brillo)
const MAXIMO = 3000;
const EVENTO = "agenda:lista";

type Tipo = "mi" | "clinicas";
const tipoDe = (ruta: string | null): Tipo | null =>
  ruta === "/" ? "clinicas" : ruta === "/personal" || ruta?.startsWith("/mi-agenda/demo") ? "mi" : null;


/** La agenda ya cargó: que se vaya la intro (cuando termine su animación). */
export function avisarAgendaLista() {
  (window as unknown as { __agendaLista?: boolean }).__agendaLista = true;
  window.dispatchEvent(new Event(EVENTO));
}

export default function Intro() {
  const tipo = tipoDe(usePathname());
  const [mostrar, setMostrar] = useState<Tipo | null>(tipo);
  const [saliendo, setSaliendo] = useState(false);
  const inicio = useRef(0); // ms desde que abrió la página (la animación CSS arrancó al pintar)
  const montado = useRef(false);

  // Al abrir (o al pasar a la otra agenda): ¿toca enseñarla?
  useEffect(() => {
    const primera = !montado.current;
    montado.current = true;
    if (!tipo) return setMostrar(null);
    let visto = true;
    try {
      visto = (primera && document.documentElement.dataset.intro === "no") || !!sessionStorage.getItem(`intro-${tipo}`) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!visto) sessionStorage.setItem(`intro-${tipo}`, "1");
    } catch {}
    if (visto) {
      if (primera) setMostrar(null);
      return;
    }
    delete document.documentElement.dataset.intro;
    if (!primera) {
      (window as unknown as { __agendaLista?: boolean }).__agendaLista = false;
      inicio.current = performance.now();
    }
    setSaliendo(false);
    setMostrar(tipo);
  }, [tipo]);

  // Cuándo se va
  useEffect(() => {
    if (!mostrar || saliendo) return;
    const salir = () => setSaliendo(true);
    const resta = (ms: number) => Math.max(0, inicio.current + ms - performance.now());
    let tMin: ReturnType<typeof setTimeout> | undefined;
    const alListo = () => { clearTimeout(tMin); tMin = setTimeout(salir, resta(MINIMO)); };
    const tMax = setTimeout(salir, resta(MAXIMO));
    window.addEventListener(EVENTO, alListo);
    if ((window as unknown as { __agendaLista?: boolean }).__agendaLista) alListo();
    return () => { clearTimeout(tMax); clearTimeout(tMin); window.removeEventListener(EVENTO, alListo); };
  }, [mostrar, saliendo]);

  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => { setMostrar(null); setSaliendo(false); }, 450);
    return () => clearTimeout(t);
  }, [saliendo]);

  if (!mostrar) return null;
  return (
    <div
      key={mostrar}
      className={`intro fixed inset-0 z-[95] grid place-items-center ${mostrar === "mi" ? `mi-agenda ${fuentePapel.variable}` : ""} ${saliendo ? "intro-sale" : ""}`}
      style={{ background: "var(--bg)" }}
      onClick={() => setSaliendo(true)}
      aria-hidden
    >
      <div className="flex flex-col items-center">
        {mostrar === "mi" ? <Libro /> : <Diente />}
        <p className={`intro-titulo mt-5 text-2xl ${mostrar === "mi" ? "serif" : "font-semibold tracking-tight"}`} style={{ color: "var(--text, inherit)" }}>
          {mostrar === "mi" ? "Mi agenda" : "Tu agenda de clínicas"}
        </p>
      </div>
    </div>
  );
}

/** Libro abierto: las páginas, unos renglones que se van escribiendo y la pluma siguiéndolos. */
function Libro() {
  // Renglones a mano (izquierda y derecha), como ondas suaves
  const renglon = (x: number, y: number, ancho: number) => {
    const p = [`M ${x} ${y}`];
    for (let i = 0; i < ancho; i += 12) p.push(`q 3 -4 6 0 t 6 0`);
    return p.join(" ");
  };
  const lineas = [
    { d: renglon(34, 52, 60), x: 34, y: 52, w: 60 },
    { d: renglon(34, 66, 72), x: 34, y: 66, w: 72 },
    { d: renglon(34, 80, 48), x: 34, y: 80, w: 48 },
    { d: renglon(130, 52, 66), x: 130, y: 52, w: 66 },
    { d: renglon(130, 66, 54), x: 130, y: 66, w: 54 },
  ];
  const cada = 0.32; // s por renglón
  return (
    <svg width="230" height="150" viewBox="0 0 230 150" className="intro-libro overflow-visible">
      {/* sombra y pastas */}
      <ellipse cx="115" cy="132" rx="96" ry="7" fill="var(--text)" opacity=".08" />
      <path d="M14 24 Q 64 12 115 26 Q 166 12 216 24 L 216 122 Q 166 110 115 124 Q 64 110 14 122 Z" fill="var(--accent)" />
      {/* páginas */}
      <path d="M20 22 Q 66 10 113 24 L 113 118 Q 66 104 20 116 Z" fill="var(--panel)" />
      <path d="M117 24 Q 164 10 210 22 L 210 116 Q 164 104 117 118 Z" fill="var(--panel)" />
      <path d="M113 24 L 113 118 M117 24 L 117 118" stroke="var(--line)" strokeWidth="1.5" />
      {/* margen */}
      <path d="M28 26 L 28 112" stroke="var(--accent)" strokeOpacity=".35" strokeWidth="1" />
      {lineas.map((l, i) => (
        <path
          key={i}
          d={l.d}
          fill="none"
          stroke="var(--tinta, var(--text))"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={1}
          className="intro-trazo"
          style={{ animationDelay: `${0.25 + i * cada}s`, animationDuration: `${cada}s` }}
        />
      ))}
      {/* palomita al final */}
      <path d="M150 86 l 6 6 l 12 -14" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="intro-trazo" style={{ animationDelay: `${0.3 + lineas.length * cada}s`, animationDuration: ".3s" }} />
      {/* pluma: viaja renglón por renglón */}
      <g className="intro-pluma" style={{ ["--pasos" as string]: lineas.length }}>
        <g transform="rotate(35)">
          <path d="M0 0 L -4 -10 L -4 -44 Q 0 -50 4 -44 L 4 -10 Z" fill="var(--text)" />
          <path d="M-4 -10 L 0 0 L 4 -10 Z" fill="var(--accent)" />
        </g>
      </g>
      <style>{lineas
        .map((l, i) => {
          const a = ((0.25 + i * cada) / (0.25 + lineas.length * cada + 0.4)) * 100;
          const b = ((0.25 + (i + 1) * cada) / (0.25 + lineas.length * cada + 0.4)) * 100;
          return `${a.toFixed(1)}%{transform:translate(${l.x}px,${l.y}px)}${(b - 0.5).toFixed(1)}%{transform:translate(${l.x + l.w}px,${l.y}px)}`;
        })
        .join("")
        .replace(/^/, "@keyframes pluma{0%{transform:translate(120px,20px);opacity:0}6%{opacity:1}")
        .concat(`100%{transform:translate(170px,88px);opacity:1}}.intro-pluma{animation:pluma ${(0.25 + lineas.length * cada + 0.4).toFixed(2)}s linear both}`)}</style>
    </svg>
  );
}

/** Diente: el cepillo va y viene, salen burbujas y al final brilla. */
function Diente() {
  const dienteD = "M40 14 C 54 6 66 14 80 12 C 96 10 108 22 106 44 C 104 62 98 72 96 92 C 94 112 88 126 80 126 C 72 126 72 104 66 96 C 62 92 58 92 54 96 C 48 104 48 126 40 126 C 32 126 26 112 24 92 C 22 72 16 62 14 44 C 12 22 24 8 40 14 Z";
  return (
    <svg width="170" height="170" viewBox="-10 -10 140 150" className="overflow-visible">
      <defs>
        <clipPath id="intro-diente"><path d={dienteD} /></clipPath>
        <linearGradient id="intro-brillo" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="134" rx="38" ry="5" fill="var(--text, #000)" opacity=".08" />
      <g className="intro-diente">
        <path d={dienteD} fill="#ffffff" stroke="var(--accent)" strokeWidth="4" strokeLinejoin="round" />
        {/* manchitas que se van con el cepillado */}
        <g className="intro-manchas" fill="#e9dcb4">
          <circle cx="44" cy="40" r="6" /><circle cx="76" cy="52" r="5" /><circle cx="58" cy="30" r="4" />
        </g>
        {/* carita */}
        <g className="intro-carita" fill="var(--accent)">
          <circle cx="47" cy="58" r="4" /><circle cx="73" cy="58" r="4" />
          <path d="M50 72 Q 60 82 70 72" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <g clipPath="url(#intro-diente)">
          <rect className="intro-brillo" x="-60" y="-10" width="40" height="160" fill="url(#intro-brillo)" transform="skewX(-20)" />
        </g>
      </g>
      {/* burbujas */}
      {[[30, 20, 0], [88, 16, 0.25], [60, 4, 0.5], [100, 40, 0.7], [20, 46, 0.9]].map(([x, y, d], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 5 : 7} fill="#fff" stroke="var(--accent)" strokeOpacity=".5" strokeWidth="1.5" className="intro-burbuja" style={{ animationDelay: `${d}s` }} />
      ))}
      {/* cepillo */}
      <g className="intro-cepillo">
        <rect x="70" y="-6" width="72" height="10" rx="5" fill="var(--accent)" transform="rotate(-18 70 -6)" />
        <g transform="rotate(-18 70 -6)">
          <rect x="44" y="-8" width="30" height="8" rx="2" fill="#7cc6ee" />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={46 + i * 4.6} y="0" width="2.6" height="9" rx="1" fill="#bfe6fa" />)}
        </g>
      </g>
      {/* destellos */}
      {[[108, 12, 1.65], [6, 30, 1.8], [100, 96, 1.95]].map(([x, y, d], i) => (
        <path key={i} d={`M${x} ${y - 9} L ${x + 2.5} ${y - 2.5} L ${x + 9} ${y} L ${x + 2.5} ${y + 2.5} L ${x} ${y + 9} L ${x - 2.5} ${y + 2.5} L ${x - 9} ${y} L ${x - 2.5} ${y - 2.5} Z`} fill="#f5c542" className="intro-destello" style={{ animationDelay: `${d}s` }} />
      ))}
    </svg>
  );
}
