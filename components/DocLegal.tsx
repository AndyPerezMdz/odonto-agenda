import Link from "next/link";
import { LEGAL } from "@/lib/legal";

// Plantilla para las páginas de Aviso de privacidad y Términos.
export default function DocLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10" />
        <div>
          <p className="text-sm text-muted">{LEGAL.servicio}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        </div>
      </div>
      <article className="legal rounded-2xl border border-line bg-panel p-5 text-[15px] leading-relaxed sm:p-8">
        <p className="!mt-0 text-sm text-muted">Última actualización: {LEGAL.actualizado}</p>
        {children}
      </article>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
        <Link href="/" className="hover:text-ink">← Volver a la agenda</Link>
        <Link href="/privacidad" className="hover:text-ink">Aviso de privacidad</Link>
        <Link href="/terminos" className="hover:text-ink">Términos y condiciones</Link>
      </nav>
    </main>
  );
}
