import type { MarcadorId } from "@/lib/tema";

// Formas en un lienzo de 32×32. "dy" sube un poco el número en formas que no son simétricas.
const FORMAS: Record<MarcadorId, { d: React.ReactNode; dy: string }> = {
  circulo: { d: <circle cx="16" cy="16" r="16" />, dy: "0" },
  cuadro: { d: <rect x="1" y="1" width="30" height="30" rx="8" />, dy: "0" },
  corazon: {
    d: <path d="M16 30C6.5 23.5 1 17.8 1 11.2 1 6.6 4.6 3 9 3c3 0 5.4 1.6 7 4 1.6-2.4 4-4 7-4 4.4 0 8 3.6 8 8.2 0 6.6-5.5 12.3-15 18.8z" />,
    dy: "-2px",
  },
  flor: {
    d: (
      <g>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <circle key={i} cx={16 + 9 * Math.cos(a)} cy={16 + 9 * Math.sin(a)} r="6.5" />;
        })}
        <circle cx="16" cy="16" r="11" />
      </g>
    ),
    dy: "0",
  },
  muela: {
    d: (
      <path d="M8.5 2C4.4 2 1.5 5.4 1.5 10c0 4.6 2.2 7.2 3.2 11.4C5.8 26 6.8 31 9.6 31c2.8 0 3.2-7.2 6.4-7.2s3.6 7.2 6.4 7.2c2.8 0 3.8-5 4.9-9.6 1-4.2 3.2-6.8 3.2-11.4 0-4.6-2.9-8-7-8-3.1 0-4.7 1.6-7.5 1.6S11.6 2 8.5 2z" />
    ),
    dy: "-4px",
  },
};

export default function MarcadorHoy({ forma, dia, className = "" }: { forma: MarcadorId; dia: number; className?: string }) {
  const f = FORMAS[forma] ?? FORMAS.circulo;
  return (
    <span className={`relative grid h-7 w-7 place-items-center sm:h-8 sm:w-8 ${className}`}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full fill-accent" aria-hidden="true">
        {f.d}
      </svg>
      <span className="relative text-xs font-semibold text-panel sm:text-sm" style={{ transform: `translateY(${f.dy})` }}>
        {dia}
      </span>
    </span>
  );
}
