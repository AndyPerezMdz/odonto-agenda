"use client";

import { useEffect, useState } from "react";
import Candado from "@/components/Candado";
import { AVISO_1H } from "@/lib/plan";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function llaveBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** 2.0 · "Notificaciones en este celular" + "Tu agenda en tu calendario" (las dos son de Pro). */
export default function TarjetaAvisos({ pro, esDueno }: { pro: boolean; esDueno: boolean }) {
  if (!pro)
    return (
      <Candado
        titulo="Notificaciones y calendario del cel"
        texto="Que el cel te avise cuando tu paciente confirme y cada mañana cuántas citas tienes, y ver tus citas en Google Calendar o en el calendario del iPhone (con alarma 1 hora antes)."
        esDueno={esDueno}
      />
    );
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <Notificaciones />
      <div className="mt-5 border-t border-line pt-5">
        <Calendario />
      </div>
    </section>
  );
}

export function Notificaciones({ descripcion }: { descripcion?: React.ReactNode } = {}) {
  const [estado, setEstado] = useState<"cargando" | "no-soporta" | "ios" | "bloqueado" | "apagado" | "activo">("cargando");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado(ios && !instalada ? "ios" : "no-soporta");
        return;
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? "activo" : "apagado");
    })().catch(() => setEstado("no-soporta"));
  }, []);

  async function activar() {
    setOcupado(true);
    setMsg("");
    try {
      if (!VAPID) throw new Error("Las notificaciones todavía no están configuradas.");
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llaveBytes(VAPID) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo activar.");
      setEstado("activo");
      setMsg("Listo. Mándate una de prueba para ver cómo llegan.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setEstado("apagado");
    setMsg("");
    setOcupado(false);
  }

  async function prueba() {
    setOcupado(true);
    const r = await fetch("/api/push/prueba", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Enviada. Debe llegarte en unos segundos." : d.error ?? "No se pudo enviar.");
    setOcupado(false);
  }

  return (
    <div>
      <h2 className="font-semibold">Notificaciones en este celular</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">
        {descripcion ?? <>Te avisamos {AVISO_1H && <><b>1 hora antes</b> de cada cita tuya, </>}<b>cuando tu paciente confirme</b> (o diga que no puede) y en la mañana cuántas citas tienes hoy.{!AVISO_1H && " ¿Quieres alarma 1 hora antes? Agrega tu agenda a tu calendario (aquí abajo)."} Se activa en cada celular o compu por separado.</>}
      </p>
      {estado === "ios" && <p className="rounded-xl bg-panel-2 p-3 text-sm">En iPhone primero instala la agenda: en Safari toca <b>Compartir → Agregar a inicio</b>, ábrela desde ese ícono y vuelve aquí.</p>}
      {estado === "no-soporta" && <p className="rounded-xl bg-panel-2 p-3 text-sm">Este navegador no acepta notificaciones. Prueba con Chrome en Android o con la agenda instalada en iPhone.</p>}
      {estado === "bloqueado" && <p className="rounded-xl bg-panel-2 p-3 text-sm">Bloqueaste las notificaciones para este sitio. Actívalas en los ajustes del navegador (el candadito junto a la dirección) y recarga.</p>}
      {(estado === "apagado" || estado === "activo") && (
        <div className="flex flex-wrap items-center gap-2">
          {estado === "apagado" ? (
            <button type="button" className="btn btn-primario" onClick={activar} disabled={ocupado}>{ocupado ? "Activando…" : "Activar en este celular"}</button>
          ) : (
            <>
              <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-accent">● Activas aquí</span>
              <button type="button" className="btn btn-sec" onClick={prueba} disabled={ocupado}>Mandarme una de prueba</button>
              <button type="button" className="btn btn-sec" onClick={apagar} disabled={ocupado}>Desactivar</button>
            </>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </div>
  );
}

export function Calendario({ descripcion }: { descripcion?: React.ReactNode } = {}) {
  const [link, setLink] = useState<{ url: string; webcal: string } | null>(null);
  const [msg, setMsg] = useState("");

  async function cargar(nuevo = false) {
    setMsg("");
    const r = await fetch("/api/cal", { method: nuevo ? "POST" : "GET" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setLink(d);
      if (nuevo) setMsg("Link nuevo. El anterior ya no sirve: vuelve a agregarlo en tu calendario.");
    } else setMsg(d.error ?? "No se pudo.");
  }

  async function copiar() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url).catch(() => {});
    setMsg("Copiado.");
  }

  return (
    <div>
      <h2 className="font-semibold">Tu agenda en tu calendario</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">
        {descripcion ?? "Tus citas aparecen solas en Google Calendar o en el calendario del iPhone, con alarma 1 hora antes. Sólo las tuyas; se actualiza cada pocas horas (lo decide tu calendario)."}
      </p>
      {!link ? (
        <button type="button" className="btn btn-sec" onClick={() => cargar()}>Obtener mi link</button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-primario" href={link.webcal}>Agregar a mi calendario</a>
            <button type="button" className="btn btn-sec" onClick={copiar}>Copiar link</button>
          </div>
          <p className="text-xs text-muted">
            <b>Google Calendar:</b> en la compu, “Otros calendarios” → “+” → “Desde URL” y pega el link. <b>iPhone:</b> toca “Agregar a mi calendario”.
          </p>
          <p className="text-xs text-muted">
            Es privado: quien tenga el link ve todo lo que agendaste (nombres incluidos).{" "}
            <button type="button" className="underline hover:text-ink" onClick={() => cargar(true)}>Cambiar link</button>
          </p>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </div>
  );
}
