"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import VerificarEscolar from "@/components/VerificarEscolar";
import { fechaLarga } from "@/lib/fechas";
import { universidad, type Universidad } from "@/lib/universidades";

// 3.1 · Quien ya tenía agenda de clínicas: "Confirma que eres estudiante antes del…" (con plazo).

type Pendiente = { necesita: false } | { necesita: true; universidad: Universidad; plazo: string; vencido: boolean; enRevision: boolean; correoSugerido: string | null };

/** Banner arriba de Hoy (mientras corre el plazo). Abre la verificación en una ventana. */
export function AvisoVerificar() {
  const [p, setP] = useState<Pendiente | null>(null);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    fetch("/api/registro/verificar?agenda=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setP)
      .catch(() => null);
  }, []);
  if (!p?.necesita) return null;
  const u = universidad(p.universidad);
  return (
    <>
      <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${p.enRevision ? "border-line bg-panel" : "border-accent/50 bg-accent-soft/40"}`}>
        <span className="text-xl" aria-hidden>🎓</span>
        <span className="min-w-0 flex-1">
          {p.enRevision ? (
            <><b>Estamos revisando tu solicitud.</b> Te avisamos por correo; mientras, sigue usando tu agenda.</>
          ) : (
            <><b>Confirma que eres estudiante de la {u.nombre}</b> antes del {fechaLarga(p.plazo)}: te mandamos un código a tu correo institucional. Es un minuto.</>
          )}
        </span>
        <button className="btn btn-primario shrink-0 px-3 py-1.5 text-sm" onClick={() => setAbierto(true)}>{p.enRevision ? "Usar mi correo" : "Verificar"}</button>
      </div>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setAbierto(false)}>
          <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-line bg-panel p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirma que eres estudiante">
            <h2 className="mb-1 text-xl font-semibold">Confirma que eres estudiante</h2>
            <p className="mb-4 text-sm text-muted">Agenda de clínicas · {u.nombre}</p>
            <VerificarEscolar uni={p.universidad} correoInicial={p.correoSugerido} onListo={() => { setAbierto(false); setP({ necesita: false }); }} />
            <button className="mt-4 w-full text-center text-xs text-muted hover:text-ink" onClick={() => setAbierto(false)}>Después</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Se venció el plazo: no entra a su agenda hasta verificar (no se borra nada). */
export function BloqueoVerificar({ uni, plazo, correoSugerido }: { uni: Universidad; plazo: string; correoSugerido: string | null }) {
  const router = useRouter();
  return (
    <AuthCard titulo="Confirma que eres estudiante" subtitulo={`Tu plazo era el ${fechaLarga(plazo)}. Tu agenda y tus citas están intactas: en cuanto confirmes, entras.`}>
      <VerificarEscolar uni={uni} correoInicial={correoSugerido} onListo={() => router.refresh()} />
      <form action="/auth/salir" method="post" className="mt-4">
        <button className="w-full text-center text-xs text-muted hover:text-ink">Cerrar sesión</button>
      </form>
    </AuthCard>
  );
}
