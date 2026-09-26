"use client";

import { useCallback, useEffect, useState } from "react";
import type { EstadoCompanero } from "@/lib/companero";
import type { Periodo } from "@/lib/cuatrimestre";

type Estado = EstadoCompanero & { periodo: Periodo };

/** Estado del compañero (sólo funciona para el dueño). */
export function useCompanero() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const res = await fetch("/api/companero", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEstado(data);
      setError(null);
    } else setError(data.error ?? "No se pudo cargar.");
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { estado, error, recargar };
}

export async function invitar(email: string): Promise<string | null> {
  const res = await fetch("/api/companero", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error ?? "No se pudo enviar la invitación.";
}

export async function quitar(): Promise<string | null> {
  const res = await fetch("/api/companero", { method: "DELETE" });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error ?? "No se pudo quitar.";
}

/* ------------------------------------------------------------------ */

export function FormInvitar({ onEnviado, emailInicial = "", textoBoton = "Enviar invitación" }: { onEnviado: (email: string) => void; emailInicial?: string; textoBoton?: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const err = await invitar(email);
    setEnviando(false);
    if (err) return setError(err);
    onEnviado(email.trim());
  }

  return (
    <form onSubmit={enviar}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          placeholder="correo@decompañero.com"
          className="campo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn-primario shrink-0" disabled={enviando}>
          {enviando ? "Enviando…" : textoBoton}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-2 text-xs text-muted">Le llegará un correo para crear su contraseña. Que revise Spam si no lo ve.</p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export default function TarjetaCompanero({ onCambio }: { onCambio: () => void }) {
  const { estado, error, recargar } = useCompanero();
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const c = estado?.companero;

  async function hacerQuitar() {
    setTrabajando(true);
    const err = await quitar();
    setTrabajando(false);
    setConfirmando(false);
    setAviso(err ?? (c?.pendiente ? "Invitación cancelada." : `Listo, ${c?.nombre} ya no tiene acceso.`));
    await recargar();
    onCambio();
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Compañero/a del cuatrimestre</h2>
          <p className="mt-0.5 text-sm text-muted">
            Eres el dueño de la agenda: sólo tú invitas a quien la comparte contigo. Cada cuatrimestre te preguntaremos si sigue la misma persona.
          </p>
        </div>
        {estado && <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">{estado.periodo.nombre}</span>}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!estado && !error && <p className="text-sm text-muted">Cargando…</p>}
      {aviso && <p className="mb-3 text-sm text-accent">{aviso}</p>}

      {estado && !c && (
        <FormInvitar
          onEnviado={(email) => {
            setAviso(`Invitación enviada a ${email}.`);
            recargar();
          }}
        />
      )}

      {c && (
        <div className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto min-w-0">
              <p className="truncate font-medium">{c.pendiente ? c.email : c.nombre}</p>
              <p className="truncate text-sm text-muted">
                {c.pendiente ? "Invitación enviada · aún no crea su cuenta" : `${c.email} · ${c.citas} cita${c.citas === 1 ? "" : "s"}`}
              </p>
            </div>
            {c.pendiente && (
              <button
                className="btn btn-sec"
                disabled={trabajando}
                onClick={async () => {
                  setTrabajando(true);
                  const err = await invitar(c.email ?? "");
                  setTrabajando(false);
                  setAviso(err ?? `Invitación reenviada a ${c.email}.`);
                  recargar();
                }}
              >
                Reenviar
              </button>
            )}
            {!confirmando && (
              <button className="btn btn-peligro" onClick={() => setConfirmando(true)}>
                {c.pendiente ? "Cancelar invitación" : "Quitar"}
              </button>
            )}
          </div>

          {confirmando && (
            <div className="mt-3 rounded-lg bg-[#fbecea] p-3 text-sm text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]">
              {c.pendiente ? (
                <p className="mb-3">Se cancelará la invitación y el enlace que le llegó dejará de funcionar.</p>
              ) : (
                <p className="mb-3">
                  Se borrará la cuenta de <b>{c.nombre}</b> y <b>sus {c.citas} cita{c.citas === 1 ? "" : "s"}</b>. Esto no se puede deshacer.
                </p>
              )}
              <div className="flex gap-2">
                <button className="btn bg-danger text-panel" disabled={trabajando} onClick={hacerQuitar}>
                  {trabajando ? "Borrando…" : "Sí, quitar"}
                </button>
                <button className="btn btn-sec" onClick={() => setConfirmando(false)}>No</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
