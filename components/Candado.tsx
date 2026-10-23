"use client";

import Link from "next/link";
import { BENEFICIOS_PRO } from "@/lib/plan";
import ProbarPro, { usePruebaDisponible } from "@/components/ProbarPro";

/** "Esto es de Pro": en lugar de esconder, enseña lo que se pierden y a dónde ir. */
export default function Candado({
  titulo, texto, esDueno, compacto = false, beneficios = false,
}: { titulo: string; texto: string; esDueno: boolean; compacto?: boolean; beneficios?: boolean }) {
  const prueba = usePruebaDisponible();
  const probar = esDueno && !!prueba?.disponible;
  return (
    <section className={`rounded-2xl border border-dashed border-accent/50 bg-accent-soft/40 ${compacto ? "p-3" : "p-5 text-center sm:p-6"}`}>
      <div className={compacto ? "flex flex-wrap items-center gap-3" : ""}>
        <span className={`inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-panel ${compacto ? "" : "mb-2"}`} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        </span>
        <div className={compacto ? "mr-auto min-w-0" : ""}>
          <p className="font-semibold">{titulo} <span className="ml-1 rounded-full bg-accent px-1.5 py-px align-middle text-[10px] font-bold text-panel">PRO</span></p>
          <p className="text-sm text-muted">{texto}</p>
        </div>
        {beneficios && !compacto && (
          <ul className="mx-auto mt-3 grid max-w-md gap-1 text-left text-sm sm:grid-cols-2">
            {BENEFICIOS_PRO.slice(0, 6).map((b) => <li key={b} className="flex gap-2"><span className="text-accent">✓</span>{b}</li>)}
          </ul>
        )}
        {probar ? (
          <div className={`flex flex-wrap items-center gap-2 ${compacto ? "" : "mt-4 justify-center"}`}>
            <ProbarPro compacto={compacto} />
            <Link href="/personalizar#suscripcion" className={`btn btn-sec shrink-0 ${compacto ? "py-1.5 text-sm" : ""}`}>Ver planes</Link>
          </div>
        ) : esDueno ? (
          <Link href="/personalizar#suscripcion" className={`btn btn-primario shrink-0 ${compacto ? "py-1.5 text-sm" : "mt-4"}`}>Ver planes</Link>
        ) : (
          <p className={`text-xs text-muted ${compacto ? "" : "mt-3"}`}>Pídele al dueño/a de la agenda que active Pro: es para los dos.</p>
        )}
      </div>
    </section>
  );
}

/** Etiqueta chiquita "PRO" junto a un botón o título. */
export function ChipPro() {
  return <span className="ml-1 rounded-full bg-accent px-1.5 py-px align-middle text-[10px] font-bold text-panel">PRO</span>;
}
