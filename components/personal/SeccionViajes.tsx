"use client";

import { useState } from "react";
import { diasEntre } from "@/lib/pagos";
import type { PCategoria, PEvento } from "@/lib/personal";
import type { PCosa } from "@/lib/viajesPagos";
import { Ico, I } from "@/components/personal/comun";
import { Boleto, extraViaje } from "@/components/personal/Boleto";

// Mi agenda · Viajes (bitácora de pases de abordar).

/* ------------------------------ VIAJES ------------------------------ */

export function SeccionViajes({ eventos, hoy, catPorId, cosas, onAbrir, onNuevo }: { eventos: PEvento[]; hoy: string; catPorId: Map<string, PCategoria>; cosas: PCosa[]; onAbrir: (e: PEvento) => void; onNuevo: () => void }) {
  const viajes = eventos.filter((e) => e.tipo === "viaje");
  const fin = (e: PEvento) => (e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : e.fecha);
  const proximos = viajes.filter((e) => fin(e) >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasados = viajes.filter((e) => fin(e) < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const [verPasados, setVerPasados] = useState(false);
  const diasFuera = proximos.reduce((n, e) => n + diasEntre(e.fecha, fin(e)) + 1, 0);

  return (
    <div>
      <header className="mb-5 flex items-end gap-3 border-b border-line pb-4">
        <div className="mr-auto">
          <p className="versalitas text-muted">Bitácora</p>
          <h1 className="serif mt-1 text-5xl leading-none">Viajes</h1>
          {proximos.length > 0 && <p className="mt-1.5 text-sm text-muted">{proximos.length} por venir · {diasFuera} día{diasFuera === 1 ? "" : "s"} fuera</p>}
        </div>
        <button onClick={onNuevo} className="btn btn-primario rounded-full"><Ico d={I.mas1} w={2.4} /> Viaje</button>
      </header>

      {proximos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center">
          <p className="serif text-2xl">Sin viajes a la vista.</p>
          <p className="mt-1 text-sm text-muted">Anota el próximo y aquí te cuenta los días que faltan.</p>
        </div>
      ) : (
        proximos.map((e) => <Boleto key={e.id} e={{ ...e, dia: e.fecha, serie: false }} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(e)} enCurso={e.fecha <= hoy} extra={extraViaje(cosas, e.id) || "Itinerario, maleta, reservas y gastos →"} />)
      )}

      {pasados.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setVerPasados(!verPasados)} className="text-sm font-medium text-muted hover:text-ink">
            {verPasados ? "Ocultar" : "Ver"} viajes pasados ({pasados.length})
          </button>
          {verPasados && <div className="mt-3">{pasados.map((e) => <Boleto key={e.id} e={{ ...e, dia: e.fecha, serie: false }} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(e)} />)}</div>}
        </div>
      )}
    </div>
  );
}
