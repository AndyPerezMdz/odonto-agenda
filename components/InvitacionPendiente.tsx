"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvitacionParaMi } from "@/lib/invitaciones";
import { fechaLarga } from "@/lib/fechas";

// Alguien con cuenta en OTRA agenda fue invitado a una nueva: aquí decide, sabiendo qué pierde y qué no.
export default function InvitacionPendiente({ onVisible }: { onVisible?: (v: boolean) => void }) {
  const [lista, setLista] = useState<InvitacionParaMi[] | null>(null);
  const [cerrada, setCerrada] = useState(false);
  const [entiendo, setEntiendo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/invitaciones", { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    setLista(res.ok ? d.invitaciones ?? [] : []);
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const inv = lista?.[0];
  const visible = !!inv && !cerrada;
  useEffect(() => {
    if (lista) onVisible?.(visible);
  }, [lista, visible, onVisible]);
  if (!visible || !inv) return null;

  const pierde = inv.soyDueno || inv.misCitas > 0;

  async function responder(accion: "aceptar" | "rechazar") {
    setTrabajando(true);
    setError(null);
    const res = await fetch("/api/invitaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: inv!.id, accion }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTrabajando(false);
      return setError(d.error ?? "No se pudo.");
    }
    if (accion === "aceptar") {
      window.location.href = "/"; // entra ya a su nueva agenda
      return;
    }
    setTrabajando(false);
    setEntiendo(false);
    await cargar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 shadow-xl sm:rounded-2xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Invitación</p>
        <h2 className="text-lg font-semibold">
          {inv.quien ? `${inv.quien} te invitó a su agenda` : inv.rol === "owner" ? "Tienes una agenda nueva esperándote" : "Te invitaron a otra agenda"}
        </h2>
        <p className="mb-4 text-sm text-muted">
          <b className="text-ink">{inv.agenda}</b>
          {inv.rol === "owner" ? " · como dueño/a" : " · como compañero/a"}
        </p>

        {!inv.puede ? (
          <p className="mb-4 rounded-xl bg-[#fdf6e3] p-3 text-sm text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]">{inv.motivo}</p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium">Si aceptas:</p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-muted">
              {inv.soyDueno ? (
                <li>
                  <b className="text-danger">Tu agenda actual se borra</b>
                  {inv.misCitas > 0 && <> con tus {inv.misCitas} cita{inv.misCitas === 1 ? "" : "s"}</>}
                  {inv.companero && <>, y <b className="text-ink">{inv.companero}</b> pierde su acceso</>}.
                  {inv.pagadaHasta && <> Estaba pagada hasta el {fechaLarga(inv.pagadaHasta)}; esos días se pierden.</>}
                </li>
              ) : inv.misCitas > 0 ? (
                <li>
                  <b className="text-danger">Tus {inv.misCitas} cita{inv.misCitas === 1 ? "" : "s"}</b> de tu agenda actual se borran.
                </li>
              ) : (
                <li>Dejas tu agenda actual.</li>
              )}
              <li>
                {inv.destinoEnPrueba
                  ? "Esa agenda está en su mes gratis: al entrar, usas el tuyo."
                  : inv.devolucion === "devuelve"
                    ? "Te devolvemos tu mes gratis: lo podrás usar después en tu propia agenda."
                    : inv.devolucion === "gastada"
                      ? "Tu mes gratis ya cuenta como usado."
                      : "Tu mes gratis no se toca."}
              </li>
              <li>Entras a {inv.agenda} con tu misma cuenta y contraseña.</li>
            </ul>
            {pierde && (
              <label className="mb-4 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} />
                <span>Entiendo que lo de mi agenda actual se borra y no se puede recuperar.</span>
              </label>
            )}
          </>
        )}

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sec" disabled={trabajando} onClick={() => responder("rechazar")}>Rechazar</button>
          <button className="btn btn-sec" disabled={trabajando} onClick={() => setCerrada(true)}>Después</button>
          {inv.puede && (
            <button className="btn btn-primario ml-auto" disabled={trabajando || (pierde && !entiendo)} onClick={() => responder("aceptar")}>
              {trabajando ? "Cambiando…" : "Aceptar y cambiarme"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
