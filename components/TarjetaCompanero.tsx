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
      <p className="mt-2 text-xs text-muted">Le llegará un correo para crear su contraseña (si ya tiene cuenta, para aceptar cambiarse a tu agenda). Que revise Spam si no lo ve.</p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

/** Link para que el compañero/a se registre y entre directo, sin correo de invitación. */
export function LinkCompanero() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async (nuevo = false) => {
    const res = await fetch("/api/companero/enlace", { method: nuevo ? "POST" : "GET", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setUrl(d.url);
      setError(null);
    } else setError(d.error ?? "No se pudo crear el link.");
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar; mantén presionado el link para copiarlo.");
    }
  }

  const mensaje = url ? `¡Hola! Te invito a compartir mi Agenda de clínicas. Regístrate aquí y entras directo a mi agenda: ${url}` : "";
  return (
    <div className="mt-4 rounded-xl border border-dashed border-line p-3">
      <p className="text-sm font-medium">O mándale un link por WhatsApp</p>
      <p className="mb-3 mt-0.5 text-xs text-muted">Se registra desde ahí y entra directo a tu agenda. Sirve una sola vez.</p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {url && (
        <>
          <p className="mb-3 truncate rounded-lg bg-panel-2 px-3 py-2 font-mono text-xs text-muted" title={url}>{url}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sec text-sm" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar link"}</button>
            <a className="btn text-sm text-white" style={{ background: "#25D366" }} href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">
              Mandar por WhatsApp
            </a>
            <button className="ml-auto text-xs text-muted hover:text-ink" onClick={() => cargar(true)} title="El link anterior deja de servir">
              Generar otro
            </button>
          </div>
        </>
      )}
    </div>
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
      <div className="mb-4 flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
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
        <>
          <FormInvitar
            onEnviado={(email) => {
              setAviso(`Invitación enviada a ${email}.`);
              recargar();
            }}
          />
          <LinkCompanero />
        </>
      )}

      {c && (
        <div className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto min-w-0">
              <p className="truncate font-medium">{c.pendiente ? c.email : c.nombre}</p>
              <p className="truncate text-sm text-muted">
                {c.invitacion ? "Ya tiene cuenta · falta que acepte cambiarse a tu agenda" : c.pendiente ? "Invitación enviada · aún no crea su cuenta" : `${c.email} · ${c.citas} cita${c.citas === 1 ? "" : "s"}`}
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
                <p className="mb-3">Se cancelará la invitación{c.invitacion ? "." : " y el enlace que le llegó dejará de funcionar."}</p>
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
