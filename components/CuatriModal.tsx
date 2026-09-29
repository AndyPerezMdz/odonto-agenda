"use client";

import { useEffect, useState } from "react";
import type { Perfil } from "@/lib/types";
import { useCompanero, quitar, FormInvitar, LinkCompanero } from "@/components/TarjetaCompanero";

type Paso = "pregunta" | "confirmarBorrar" | "invitar" | "listo";

// Al iniciar cada cuatrimestre le pregunta al dueño si sigue el mismo compañero.
export default function CuatriModal({ yo, onCambio, onVisible }: { yo: Perfil; onCambio: () => void; onVisible?: (v: boolean) => void }) {
  const { estado } = useCompanero();
  const [paso, setPaso] = useState<Paso>("pregunta");
  const [cerrado, setCerrado] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");

  const c = estado?.companero;
  // Sólo pregunta si hay un compañero ACTIVO y este cuatri aún no se confirma
  const toca = !!estado && !!c && !c.pendiente && yo.periodo_confirmado !== estado.periodo.id;
  const visible = !cerrado && (toca || paso !== "pregunta");
  // Avisa a la agenda si esta pregunta está en pantalla (para no encimar otras ventanas)
  useEffect(() => {
    if (estado) onVisible?.(visible);
  }, [estado, visible, onVisible]);
  if (cerrado || (!toca && paso === "pregunta")) return null;

  async function confirmarPeriodo() {
    await fetch("/api/companero", { method: "PATCH" });
    onCambio();
  }

  async function siSigue() {
    setTrabajando(true);
    await confirmarPeriodo();
    setCerrado(true);
  }

  async function borrar() {
    setTrabajando(true);
    setError(null);
    const err = await quitar();
    setTrabajando(false);
    if (err) return setError(err);
    await confirmarPeriodo();
    setPaso("invitar");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-line bg-panel p-6 shadow-xl sm:rounded-2xl">
        {estado && (
          <p className="mb-2 inline-block rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
            Cuatrimestre {estado.periodo.nombre}
          </p>
        )}

        {paso === "pregunta" && c && (
          <>
            <h2 className="mb-2 text-lg font-semibold">¡Empezó un nuevo cuatrimestre!</h2>
            <p className="mb-5 text-sm text-muted">
              ¿<b className="text-ink">{c.nombre}</b> sigue siendo tu compañero/a de clínica?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn btn-primario flex-1" disabled={trabajando} onClick={siSigue}>
                Sí, sigue
              </button>
              <button className="btn btn-sec flex-1" disabled={trabajando} onClick={() => setPaso("confirmarBorrar")}>
                No, cambió
              </button>
            </div>
          </>
        )}

        {paso === "confirmarBorrar" && c && (
          <>
            <h2 className="mb-2 text-lg font-semibold">Quitar a {c.nombre}</h2>
            <p className="mb-5 text-sm text-muted">
              Se borrará su cuenta y <b className="text-ink">sus {c.citas} cita{c.citas === 1 ? "" : "s"}</b>. Ya no podrá entrar a la agenda. Esto no se puede deshacer.
            </p>
            {error && <p className="mb-3 text-sm text-danger">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn flex-1 bg-danger text-panel" disabled={trabajando} onClick={borrar}>
                {trabajando ? "Borrando…" : "Sí, quitar"}
              </button>
              <button className="btn btn-sec flex-1" disabled={trabajando} onClick={() => setPaso("pregunta")}>
                Regresar
              </button>
            </div>
          </>
        )}

        {paso === "invitar" && (
          <>
            <h2 className="mb-2 text-lg font-semibold">Invita a tu nuevo compañero/a</h2>
            <p className="mb-4 text-sm text-muted">Escribe su correo y le mandamos la invitación, o mándale el link por WhatsApp.</p>
            <FormInvitar
              onEnviado={(email) => {
                setMensaje(`Invitación enviada a ${email}.`);
                setPaso("listo");
                onCambio();
              }}
            />
            <LinkCompanero />
            <button className="mt-4 w-full text-center text-sm text-muted hover:text-ink" onClick={() => setCerrado(true)}>
              Lo invito después (desde Personalizar)
            </button>
          </>
        )}

        {paso === "listo" && (
          <>
            <h2 className="mb-2 text-lg font-semibold">¡Listo!</h2>
            <p className="mb-5 text-sm text-muted">{mensaje} Cuando cree su contraseña, verás sus citas en la agenda.</p>
            <button className="btn btn-primario w-full" onClick={() => setCerrado(true)}>
              Ir a la agenda
            </button>
          </>
        )}
      </div>
    </div>
  );
}
