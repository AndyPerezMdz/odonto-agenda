import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { citaPorToken } from "@/lib/confirmar";
import { fechaLarga } from "@/lib/fechas";
import BotonesConfirmar from "@/components/BotonesConfirmar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirma tu cita", robots: { index: false, follow: false } };

// Página para el PACIENTE (sin cuenta): confirma o avisa que no puede ir. No muestra nada clínico.
export default async function ConfirmarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await citaPorToken(createAdminClient(), token);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-accent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clinicas-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
          Agenda de clínicas
        </div>
        {!c ? (
          <>
            <h1 className="mb-2 text-xl font-semibold">Este link ya no sirve</h1>
            <p className="text-sm text-muted">La cita se canceló o el link cambió. Escríbele directo a quien te agendó.</p>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold">Hola, {c.paciente}</h1>
            <p className="mb-4 text-sm text-muted">{c.alumno} te agendó una cita:</p>
            <div className="mb-5 rounded-xl bg-panel-2 p-4">
              <p className="text-lg font-semibold first-letter:uppercase">{fechaLarga(c.fecha)}</p>
              <p className="text-sm">a las <b>{c.hora}</b>{c.clinica ? <> · {c.clinica}</> : null}</p>
            </div>
            {c.pasada ? (
              <p className="text-sm text-muted">Esta cita ya pasó.</p>
            ) : (
              <BotonesConfirmar token={token} inicial={c.confirmacion} alumno={c.alumno} />
            )}
          </>
        )}
        <p className="mt-6 text-center text-[11px] text-muted">Sólo se guarda si vienes o no. Ningún dato médico.</p>
      </div>
    </main>
  );
}
