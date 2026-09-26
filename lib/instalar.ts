"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// El navegador avisa UNA vez que se puede instalar; lo guardamos para usarlo desde cualquier botón.
let evento: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    evento = e as EventoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    evento = null;
    oyentes.forEach((f) => f());
  });
}

export type Plataforma = "ios" | "android" | "compu";

export function useInstalar() {
  const [, refrescar] = useState(0);
  const [info, setInfo] = useState<{ plataforma: Plataforma; instalada: boolean; movil: boolean }>({
    plataforma: "compu",
    instalada: false,
    movil: false,
  });

  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    oyentes.add(f);
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const android = /android/i.test(ua);
    setInfo({
      plataforma: ios ? "ios" : android ? "android" : "compu",
      instalada:
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      movil: ios || android || window.matchMedia("(pointer: coarse)").matches,
    });
    return () => {
      oyentes.delete(f);
    };
  }, []);

  async function instalar() {
    if (!evento) return false;
    await evento.prompt();
    const r = await evento.userChoice.catch(() => null);
    evento = null;
    refrescar((n) => n + 1);
    return r?.outcome === "accepted";
  }

  return { ...info, puedeInstalar: !!evento, instalar };
}
