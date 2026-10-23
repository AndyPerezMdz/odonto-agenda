"use client";

import Link from "next/link";
import BotonActivar from "@/components/personal/BotonActivar";
import ProbarMi from "@/components/personal/ProbarMi";
import type { EstadoMi } from "@/lib/planMi";
import { fechaLarga } from "@/lib/fechas";

// Mi agenda · la barra de la demo y el aviso del plan.

/* ------------------------------ DEMO ------------------------------ */

/** Barra de la demo: es de mentiritas, y el botón para tenerla de verdad (2.3: al instante). */
export function BannerDemo({ publico = false }: { publico?: boolean }) {
  return (
    <div className="nota sticky top-2 z-20 mb-6 flex flex-wrap items-center gap-3 rounded-sm px-4 py-3 text-sm shadow-[0_10px_20px_-14px_rgba(60,45,10,0.5)]">
      <p className="w-full sm:w-auto sm:flex-1">
        <b>Esto es una demo</b> con datos de ejemplo: pícale a todo, no se guarda nada.
      </p>
      {publico ? (
        <a href="/mi-agenda/registro" className="btn btn-primario rounded-full py-1.5 text-xs">La quiero</a>
      ) : (
        <span><BotonActivar texto="La quiero" className="btn btn-primario rounded-full py-1.5 text-xs" /></span>
      )}
      <a href={publico ? "/mi-agenda" : "/personalizar#personal"} className="btn btn-sec rounded-full py-1.5 text-xs">Salir de la demo</a>
    </div>
  );
}

/** 2.3 · Aviso del plan arriba de todo: últimos días de Pro, o que está en Gratis. */
export function AvisoPlan({ e, prueba }: { e: EstadoMi; prueba: boolean }) {
  let texto: React.ReactNode = null;
  if ((e.tipo === "prueba" || e.tipo === "pro") && e.dias <= 3)
    texto = e.dias === 0 ? <>Hoy es tu <b>último día de {e.tipo === "prueba" ? "prueba de " : ""}Pro</b>. Mañana sigues en Gratis.</> : <>Te quedan <b>{e.dias} día{e.dias === 1 ? "" : "s"} de {e.tipo === "prueba" ? "prueba de " : ""}Pro</b> (hasta el {fechaLarga(e.hasta)}).</>;
  else if (e.tipo === "gratis")
    texto = prueba
      ? <>Estás en <b>Gratis</b>. ¿Quieres probar los viajes completos, los pagos fijos y el resumen de cada mañana? Tienes <b>15 días de Pro gratis</b> cuando quieras.</>
      : <>Estás en <b>Gratis</b>: tus cosas siguen aquí. Viajes, pagos fijos, tus colores y los avisos de la mañana vuelven con Pro.</>;
  if (!texto) return null;
  return (
    <div className="nota mb-6 flex flex-wrap items-center gap-3 rounded-sm px-4 py-3 text-sm shadow-[0_10px_20px_-14px_rgba(60,45,10,0.5)]">
      <p className="w-full min-w-0 sm:w-auto sm:flex-1">{texto}</p>
      {e.tipo === "gratis" && prueba ? <ProbarMi compacto /> : <Link href="/personal/ajustes#plan" className="btn btn-primario shrink-0 rounded-full py-1.5 text-xs">{e.tipo === "gratis" ? "Pásate a Pro" : "Elegir plan"}</Link>}
    </div>
  );
}
