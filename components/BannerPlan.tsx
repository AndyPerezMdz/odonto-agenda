"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// 2.0 · Ya no hay "sólo lectura": avisa cuando se acaba Pro y, ya en Gratis, lo recuerda (se puede cerrar).
export default function BannerPlan({ pro, quedan, esDueno, cargando }: { pro: boolean; quedan: number | null; esDueno: boolean; cargando: boolean }) {
  const clave = `banner-gratis-${new Date().toISOString().slice(0, 7)}`; // vuelve a salir cada mes
  const [cerrado, setCerrado] = useState(true);
  useEffect(() => {
    try { setCerrado(localStorage.getItem(clave) === "1"); } catch { setCerrado(false); }
  }, [clave]);

  if (cargando) return null;
  let texto: React.ReactNode = null;
  let cerrable = false;
  if (pro && quedan != null && quedan <= 3) {
    texto = quedan === 0 ? <>Hoy es tu <b>último día de Pro</b>. Mañana la agenda sigue, pero en Gratis.</> : <>Te quedan <b>{quedan} día{quedan === 1 ? "" : "s"} de Pro</b>. Después sigues en Gratis con lo básico.</>;
  } else if (!pro && !cerrado) {
    texto = <>Estás en <b>Gratis</b>: tus citas y tu compa siguen aquí. Recordatorios, historial, PDF para doctores y lo demás vuelven con Pro.</>;
    cerrable = true;
  }
  if (!texto) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8c36a] bg-[#fdf6e3] px-4 py-3 text-sm text-[#5c4712] dark:border-[#6b5620] dark:bg-[#2a2415] dark:text-[#ecd9a4]">
      <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-bold text-panel">PRO</span>
      <p className="mr-auto min-w-0 flex-1">{texto} {!esDueno && "Pídele al dueño/a que lo active: es para los dos."}</p>
      {esDueno && <Link href="/personalizar#suscripcion" className="btn btn-sec shrink-0 py-1.5 text-xs">Ver planes</Link>}
      {cerrable && (
        <button
          type="button"
          aria-label="Cerrar"
          className="shrink-0 px-1 text-lg leading-none opacity-60 hover:opacity-100"
          onClick={() => { try { localStorage.setItem(clave, "1"); } catch {} setCerrado(true); }}
        >×</button>
      )}
    </div>
  );
}
