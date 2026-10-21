"use client";

import Shell from "@/components/Shell";
import { esUady } from "@/lib/universidades";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCatalogos } from "@/lib/useDatos";
import { prefs } from "@/lib/types";
import { aplicarTema } from "@/lib/tema";
import Candado from "@/components/Candado";
import MisPacientes from "@/components/MisPacientes";
import BancoPacientes from "@/components/BancoPacientes";

// /pacientes: los que ya atiendes (con historia y folios) y los que tienes por conseguir.
export default function PaginaPacientes({ userId }: { userId: string }) {
  const { supabase, perfiles, clinicas, materias, pro, nombreAgenda, ajustes } = useCatalogos();
  const yo = perfiles.find((p) => p.id === userId);
  const p = prefs(yo?.preferencias);
  const [tab, setTab] = useState<"mis" | "banco">("mis");

  useEffect(() => {
    if (yo) aplicarTema(p.tema);
  }, [yo, p.tema]);

  // /pacientes#banco abre directo el banco
  useEffect(() => {
    if (window.location.hash === "#banco") setTab("banco");
  }, []);
  function elegir(t: "mis" | "banco") {
    setTab(t);
    history.replaceState(null, "", t === "banco" ? "#banco" : "#");
  }

  return (
    <Shell actual="pacientes" titulo="Pacientes" nombreAgenda={nombreAgenda} uady={esUady(ajustes.universidad)} esDueno={perfiles.find((x) => x.id === userId)?.rol === "owner"}>
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 flex items-center gap-3">
                <div>
          <p className="text-sm text-muted">{tab === "mis" ? "Tus pacientes con su No. de historia clínica y los folios de cada tratamiento." : "Gente por conseguir o en espera, para cuando te falte un caso."}</p>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 rounded-xl border border-line bg-panel p-1 text-sm font-medium">
        {([["mis", "Mis pacientes"], ["banco", "Por conseguir"]] as const).map(([id, t]) => (
          <button key={id} onClick={() => elegir(id)} className={`flex-1 rounded-lg px-3 py-2 transition ${tab === id ? "bg-accent text-panel" : "text-muted hover:bg-panel-2 hover:text-ink"}`}>
            {t}
          </button>
        ))}
      </nav>

      {!pro ? (
        <Candado
          esDueno={yo?.rol === "owner"}
          titulo={tab === "mis" ? "Mis pacientes" : "Pacientes por conseguir"}
          texto={tab === "mis" ? "Todos tus pacientes con su No. de historia, sus folios y cuántas veces vinieron, en un solo lugar. Tus folios siguen guardados en cada cita." : "Tu lista de gente por conseguir o en espera, para agendarla de un toque cuando te falte un caso."}
          beneficios
        />
      ) : tab === "mis" ? (
        <MisPacientes
          supabase={supabase}
          userId={userId}
          perfiles={perfiles}
          clinicas={clinicas}
          materias={materias}
          soloLectura={false}
        />
      ) : (
        <BancoPacientes userId={userId} embebido />
      )}
    </div>
    </Shell>
  );
}
