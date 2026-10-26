"use client";

import { useEffect, useMemo, useState } from "react";
import type { Cita, Clinica } from "@/lib/types";
import { hhmm } from "@/lib/fechas";
import { sumarDias } from "@/lib/pagos";
import { enlaceWhatsApp, enlaceConfirmar, mensajeConfirmar, IcoWhatsApp } from "@/lib/whatsapp";

const leer = (k: string): string[] => {
  try { return JSON.parse(localStorage.getItem(k) ?? "[]"); } catch { return []; }
};
const escribir = (k: string, v: string[]) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};

/**
 * 3.5 · "Recuérdale a los de mañana": desde las 12 del día, la lista de tus pacientes de mañana que no han confirmado,
 * cada uno con su WhatsApp ya escrito (y su link para confirmar con un toque). Vas tocando y se van palomeando. Pro.
 */
export default function RecordarManana({ citas, hoy, userId, clinicaPorId, onAbrir }: { citas: Cita[]; hoy: string; userId: string; clinicaPorId: Map<string, Clinica>; onAbrir: (c: Cita) => void }) {
  const manana = sumarDias(hoy, 1);
  const llave = `recordados-${manana}`;
  const [listo, setListo] = useState(false);
  const [mandados, setMandados] = useState<string[]>([]);
  const [cerrado, setCerrado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setMandados(leer(llave));
    setCerrado(leer("recordar-cerrado").includes(manana));
    setListo(true);
  }, [llave, manana]);

  const lista = useMemo(
    () => citas.filter((c) => c.fecha === manana && c.owner_id === userId && !c.estado && !c.confirmacion).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
    [citas, manana, userId]
  );
  if (!listo || cerrado || !lista.length || new Date().getHours() < 12) return null;

  const faltan = lista.filter((c) => !mandados.includes(c.id)).length;
  const marcar = (id: string) => {
    const n = [...new Set([...mandados, id])];
    setMandados(n);
    escribir(llave, n);
  };
  const cerrar = () => {
    escribir("recordar-cerrado", [...leer("recordar-cerrado").slice(-10), manana]);
    setCerrado(true);
  };

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: "#25D366" }} aria-hidden>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={IcoWhatsApp} /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{faltan ? `Recuérdale a ${faltan === 1 ? "tu paciente" : `tus ${faltan} pacientes`} de mañana` : "Ya les escribiste a todos los de mañana ✓"}</p>
          <p className="text-sm text-muted">{faltan ? "Un WhatsApp hoy y te ahorras el plantón. Confirman con un toque." : "Cuando confirmen, te sale “✓ Confirmó” en su cita."}</p>
        </div>
        <button className="text-sm text-muted hover:text-ink" onClick={cerrar} aria-label="Cerrar">✕</button>
      </div>
      {!abierto ? (
        faltan > 0 && <button className="btn mt-3 w-full text-sm text-white" style={{ background: "#25D366" }} onClick={() => setAbierto(true)}>Ver la lista</button>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {lista.map((c) => {
            const clinica = c.clinica_id ? clinicaPorId.get(c.clinica_id)?.numero : null;
            const link = c.token_confirmar ? enlaceConfirmar(c.token_confirmar, window.location.origin) : undefined;
            const wa = enlaceWhatsApp(c.telefono, mensajeConfirmar(c, clinica, link));
            const ya = mandados.includes(c.id);
            return (
              <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-12 shrink-0 font-semibold tabular-nums text-muted">{hhmm(c.hora_inicio)}</span>
                <span className={`min-w-0 flex-1 truncate font-medium ${ya ? "text-muted line-through" : ""}`}>{c.paciente}</span>
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => marcar(c.id)} className={`btn shrink-0 py-1.5 text-xs ${ya ? "btn-sec" : "text-white"}`} style={ya ? undefined : { background: "#25D366" }}>
                    {ya ? "✓ Enviado" : "WhatsApp"}
                  </a>
                ) : (
                  <button className="btn btn-sec shrink-0 py-1.5 text-xs" onClick={() => onAbrir(c)}>Sin teléfono</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
