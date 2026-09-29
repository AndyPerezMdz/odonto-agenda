"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Horario, Material, Perfil } from "@/lib/types";
import { useMaterial } from "@/lib/useDatos";
import { avisosMaterial, type Aviso } from "@/lib/material";

const ESTILO: Record<Aviso["nivel"], string> = {
  urgente: "border-danger/40 bg-[#fbecea] text-[#7a1f1a] dark:bg-[#3a1c1a] dark:text-[#f3c9c4]",
  atencion: "border-[#e8d49a] bg-[#fdf6e3] text-[#6b4f0c] dark:border-[#5b4a1c] dark:bg-[#2e2716] dark:text-[#ecd9a4]",
  info: "border-line bg-panel-2 text-ink",
};

/** Lista de avisos. En la agenda (compacto) sólo salen los urgentes y de atención, con link a Mi material. */
export default function AvisosMaterial({
  userId, horarios, perfiles, compacto = false, material: externo,
}: { userId: string; horarios: Horario[]; perfiles: Perfil[]; compacto?: boolean; material?: Material[] | null }) {
  const propio = useMaterial();
  const material = externo ?? propio.material;
  const [ahora, setAhora] = useState<Date | null>(null);
  // Se calcula en el navegador (la hora del servidor no es la de Mérida) y se refresca cada 5 min
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 300000);
    return () => clearInterval(t);
  }, []);

  const avisos = useMemo(() => {
    if (!material || !ahora) return [];
    const nombre = (id: string | null) => perfiles.find((p) => p.id === id)?.nombre ?? "tu compa";
    const lista = avisosMaterial(material, userId, horarios.filter((h) => h.owner_id === userId), nombre, ahora);
    return compacto ? lista.filter((a) => a.nivel !== "info") : lista;
  }, [material, ahora, perfiles, userId, horarios, compacto]);

  if (!avisos.length) return null;
  const visibles = compacto ? avisos.slice(0, 2) : avisos;

  return (
    <div className={`flex flex-col gap-2 ${compacto ? "mb-4" : "mb-5"}`}>
      {visibles.map((a) => (
        <div key={a.id} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${ESTILO[a.nivel]}`}>
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {a.nivel === "info" ? <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></> : <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>}
          </svg>
          <p className="flex-1">{a.texto}</p>
          {compacto && (
            <Link href="/material" className="shrink-0 font-medium underline underline-offset-2">
              Ver
            </Link>
          )}
        </div>
      ))}
      {compacto && avisos.length > 2 && (
        <Link href="/material" className="self-start text-xs font-medium text-accent hover:underline">
          +{avisos.length - 2} aviso{avisos.length - 2 === 1 ? "" : "s"} más de tu material
        </Link>
      )}
    </div>
  );
}
