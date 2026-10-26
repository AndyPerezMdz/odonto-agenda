"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_KEY } from "@/lib/supabase/env";
import { EVENTO_SINCRONIZADA } from "@/lib/conexion";


type Fallido = { tabla: string; mensaje: string };

// 3.4 · Sin conexión: registra el service worker (guarda lo último que viste y la cola de cambios),
// sube la cola cuando vuelve el internet y enseña un aviso chiquito arriba.
export default function Conexion() {
  const [enLinea, setEnLinea] = useState(true);
  const [cola, setCola] = useState(0);
  const [fallidos, setFallidos] = useState<Fallido[]>([]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    const supabase = createClient();
    setEnLinea(navigator.onLine);
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    const mandar = async (msg: Record<string, unknown>) => {
      const reg = await navigator.serviceWorker.ready;
      (navigator.serviceWorker.controller ?? reg.active)?.postMessage(msg);
    };
    const sincronizar = async () => {
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const s = data.session;
      if (!s) return;
      await mandar({ tipo: "usuario", id: s.user.id });
      if (navigator.onLine) await mandar({ tipo: "sincronizar", token: s.access_token, apikey: SUPABASE_KEY });
    };
    const alMensaje = (e: MessageEvent) => {
      const d = e.data ?? {};
      if (d.tipo === "cola") setCola(d.n ?? 0);
      if (d.tipo === "sincronizado") {
        setCola(d.quedan ?? 0);
        if (d.subidos) window.dispatchEvent(new Event(EVENTO_SINCRONIZADA));
        if (d.fallidos?.length) setFallidos((f) => [...f, ...d.fallidos]);
      }
    };
    const alVolverRed = () => { setEnLinea(true); sincronizar(); };
    const alPerderRed = () => setEnLinea(false);
    const alVolver = () => document.visibilityState === "visible" && sincronizar();
    navigator.serviceWorker.addEventListener("message", alMensaje);
    window.addEventListener("online", alVolverRed);
    window.addEventListener("offline", alPerderRed);
    document.addEventListener("visibilitychange", alVolver);
    const { data: auth } = supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") mandar({ tipo: "salir" }); });
    sincronizar();
    mandar({ tipo: "estado" });
    const t = setInterval(sincronizar, 60_000);
    return () => {
      clearInterval(t);
      auth.subscription.unsubscribe();
      navigator.serviceWorker.removeEventListener("message", alMensaje);
      window.removeEventListener("online", alVolverRed);
      window.removeEventListener("offline", alPerderRed);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  if (enLinea && !cola && !fallidos.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4" style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}>
      {(!enLinea || cola > 0) && (
        <p className="rounded-full px-4 py-1.5 text-xs font-semibold shadow-lg" style={{ background: "#2b2520", color: "#fbf8f2" }} role="status">
          {!enLinea
            ? `Sin conexión · ${cola ? `${cola} cambio${cola === 1 ? "" : "s"} por subir` : "lo que anotes se sube solo al volver"}`
            : `Subiendo ${cola} cambio${cola === 1 ? "" : "s"}…`}
        </p>
      )}
      {fallidos.length > 0 && (
        <div className="pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-xs shadow-lg" style={{ background: "#fbe4dd", color: "#7a2414" }} role="alert">
          <b>No se pudo subir {fallidos.length === 1 ? "un cambio" : `${fallidos.length} cambios`} que hiciste sin señal:</b>
          <ul className="mt-1 list-disc pl-4">{fallidos.slice(0, 3).map((f, i) => <li key={i}>{f.mensaje}</li>)}</ul>
          <button className="mt-2 font-semibold underline" onClick={() => setFallidos([])}>Entendido</button>
        </div>
      )}
    </div>
  );
}
