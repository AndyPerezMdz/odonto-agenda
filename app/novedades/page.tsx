import type { Metadata } from "next";
import Link from "next/link";
import ListaNovedades from "@/components/ListaNovedades";
import { APP_VERSION, NOVEDADES } from "@/lib/novedades";

export const metadata: Metadata = { title: "Novedades — Agenda de clínicas" };

// Historial público de versiones: qué trae cada actualización (no pide sesión).
export default function NovedadesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10" />
        <div>
          <p className="text-sm text-muted">Agenda de clínicas · versión {APP_VERSION}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Novedades</h1>
        </div>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Versiones">
        {NOVEDADES.map((v, i) => (
          <a key={v.version} href={`#v${v.version}`} className={`rounded-full border px-3 py-1 text-sm ${i === 0 ? "border-accent bg-accent-soft font-medium text-accent" : "border-line hover:bg-panel-2"}`}>
            {v.version}{i === 0 && " · actual"}
          </a>
        ))}
      </nav>

      <article className="rounded-2xl border border-line bg-panel p-5 sm:p-8">
        <ListaNovedades lista={NOVEDADES} anclas />
      </article>

      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
        <Link href="/" className="hover:text-ink">← Volver a la agenda</Link>
        <Link href="/privacidad" className="hover:text-ink">Aviso de privacidad</Link>
        <Link href="/terminos" className="hover:text-ink">Términos y condiciones</Link>
      </nav>
    </main>
  );
}
