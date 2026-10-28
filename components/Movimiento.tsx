"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 3.6 · Movimiento global:
 * - Al cerrar un modal (.hoja-fondo), React lo quita de golpe: aquí dejamos una copia "fantasma" que sale suave y se borra.
 * - Al tocar un link a otra página, una barrita arriba dice "ya voy" hasta que la página nueva llega.
 */
export default function Movimiento() {
  const ruta = usePathname();
  const [cargando, setCargando] = useState(false);

  useEffect(() => setCargando(false), [ruta]);

  useEffect(() => {
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const obs = new MutationObserver((cambios) => {
      if (quieto) return;
      for (const c of cambios) {
        c.removedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement) || n.dataset.fantasma) return;
          const modal = n.classList.contains("hoja-fondo") ? n : null;
          if (!modal) return;
          const copia = modal.cloneNode(true) as HTMLElement;
          copia.dataset.fantasma = "1";
          copia.setAttribute("aria-hidden", "true");
          copia.inert = true;
          copia.style.pointerEvents = "none";
          copia.classList.add("saliendo");
          // Conserva el tema de Mi agenda (colores y letra) si el modal vivía adentro, sin su fondo de papel
          const envoltura = c.target instanceof HTMLElement ? (c.target.closest(".mi-agenda") as HTMLElement | null) : null;
          const caja = document.createElement("div");
          caja.dataset.fantasma = "1";
          if (envoltura) {
            caja.className = "mi-agenda";
            const papel = getComputedStyle(envoltura).getPropertyValue("--font-papel");
            caja.style.cssText = `background:none;min-height:0;height:0;${papel ? `--font-papel:${papel};` : ""}`;
          }
          caja.appendChild(copia);
          document.body.appendChild(caja);
          const quitar = () => caja.remove();
          copia.addEventListener("animationend", (e) => e.target === copia && quitar());
          setTimeout(quitar, 400);
        });
      }
    });
    // 3.7 · Con un modal abierto, la página de atrás no scrollea (en iPhone se iba todo para arriba y abajo)
    const bloquear = () => document.documentElement.classList.toggle("con-modal", !!document.querySelector(".hoja-fondo:not(.saliendo)"));
    const obsModal = new MutationObserver(bloquear);
    obsModal.observe(document.body, { childList: true, subtree: true });
    bloquear();
    obs.observe(document.body, { childList: true, subtree: true });

    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || url.pathname.startsWith("/api/")) return;
      setCargando(true);
    };
    document.addEventListener("click", alClic);
    return () => {
      obs.disconnect();
      obsModal.disconnect();
      document.removeEventListener("click", alClic);
    };
  }, []);

  useEffect(() => {
    if (!cargando) return;
    const t = setTimeout(() => setCargando(false), 10000);
    return () => clearTimeout(t);
  }, [cargando]);

  return cargando ? <div className="barra-carga" aria-hidden /> : null;
}
