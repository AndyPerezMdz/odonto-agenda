import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginaPublica } from "@/lib/premiumServer";
import ReservarCita from "@/components/ReservarCita";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await paginaPublica(createAdminClient(), slug);
  return {
    title: p.disponible ? `Agenda tu cita con ${p.nombre}` : "Agenda de clínicas",
    robots: { index: false, follow: false },
  };
}

// Página pública de "Tu link de citas": el paciente ve SÓLO horas libres y reserva.
export default async function LinkDeCitas({ params }: Props) {
  const { slug } = await params;
  const p = await paginaPublica(createAdminClient(), slug);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={44} height={44} className="h-11 w-11" />
        <div>
          <p className="text-sm text-muted">Clínica de Odontología · citas con estudiante</p>
          <h1 className="text-2xl font-semibold tracking-tight">{p.disponible ? `Agenda tu cita con ${p.nombre}` : "Este link no está disponible"}</h1>
        </div>
      </div>

      {p.disponible ? (
        <ReservarCita slug={slug} nombre={p.nombre} dias={p.dias} clinicas={p.clinicas} duracion={p.duracion} />
      ) : (
        <p className="rounded-2xl border border-line bg-panel p-6 text-muted">
          Por ahora no se pueden reservar citas aquí. Si conoces a la estudiante, escríbele directo.
        </p>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Hecho con Agenda de clínicas · <Link href="/privacidad" className="hover:text-ink">Aviso de privacidad</Link>
      </p>
    </main>
  );
}
