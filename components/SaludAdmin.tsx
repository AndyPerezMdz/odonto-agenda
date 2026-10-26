"use client";

import { useCallback, useEffect, useState } from "react";
import type { Salud } from "@/lib/salud";

// 2.8 · Panel → Ajustes: ¿está todo conectado? Llaves (sólo si están, nunca su valor), crons y SQL.

const hace = (iso: string | null) => {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? "ahorita" : min < 60 ? `hace ${min} min` : min < 48 * 60 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`;
};

export function useSalud() {
  const [s, setS] = useState<Salud | null>(null);
  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/salud", { cache: "no-store" });
    if (r.ok) setS(await r.json());
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  return { salud: s, recargar: cargar };
}

export default function SaludAdmin({ onAviso }: { onAviso: (m: string) => void }) {
  const { salud: s, recargar } = useSalud();
  const [mandando, setMandando] = useState(false);
  if (!s) return <section className="rounded-2xl border border-line bg-panel p-4 text-sm text-muted">Revisando la salud del sistema…</section>;
  const Punto = ({ ok }: { ok: boolean }) => <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-accent" : "bg-danger"}`} aria-label={ok ? "Bien" : "Por revisar"} />;
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Salud del sistema</h2>
        <span className={`text-sm font-medium ${s.problemas ? "text-danger" : "text-accent"}`}>{s.problemas ? `${s.problemas} por revisar` : "Todo bien"}</span>
      </div>
      <p className="mb-3 mt-0.5 text-sm text-muted">Para que un cron caído no te agarre en curva. Las llaves sólo dicen si están puestas en Vercel, nunca su valor.</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="consola-etiqueta mb-1.5">Llaves en Vercel</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {s.llaves.map((x) => (
              <li key={x.id} className="flex items-start gap-2"><span className="mt-1.5 flex"><Punto ok={x.ok} /></span><span>{x.nombre}{!x.ok && <span className="block text-xs text-muted">Falta {x.detalle}</span>}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="consola-etiqueta mb-1.5">Crons</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {s.crones.map((x) => (
              <li key={x.id} className="flex items-start gap-2"><span className="mt-1.5 flex"><Punto ok={x.ok} /></span><span>{x.nombre}<span className="block text-xs text-muted">{x.cada} · corrió {hace(x.at)}</span></span></li>
            ))}
          </ul>
          {s.crones.some((x) => !x.ok && x.cada !== "diario") && <p className="mt-2 text-xs text-muted">Los de cada 5 y 15 min los pone Supabase: corre <b>supabase/cron-recordatorios.sql</b> (con tu sitio y tu CRON_SECRET).</p>}
        </div>
        <div>
          <p className="consola-etiqueta mb-1.5">SQL corrido</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {s.sql.map((x) => (
              <li key={x.id} className="flex items-center gap-2"><Punto ok={x.ok} />{x.nombre}</li>
            ))}
          </ul>
          {s.sql.some((x) => !x.ok) && <p className="mt-2 text-xs text-muted">Corre <b>supabase/schema.sql</b> completo en el SQL Editor (se puede correr las veces que quieras).</p>}
        </div>
      </div>
      {s.correo && (
        <div className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-sm">
          <span className="mt-1.5 flex"><Punto ok={s.correo.ok} /></span>
          <span>Envío de correos<span className="block break-words text-xs text-muted">{s.correo.detalle}</span></span>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
        <button className="btn btn-sec py-1.5 text-xs" onClick={recargar}>Volver a revisar</button>
        <button
          className="btn btn-sec py-1.5 text-xs"
          disabled={mandando}
          onClick={async () => {
            setMandando(true);
            const r = await fetch("/api/admin/salud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "smtp" }) });
            const d = await r.json().catch(() => ({}));
            setMandando(false);
            onAviso(r.ok ? "Supabase sí manda correos: te llegó uno de “restablecer contraseña” (ignóralo)." : `Supabase NO pudo mandar el correo: ${d.error ?? r.status}. Revisa la llave del SMTP.`);
            recargar();
          }}
        >
          Probar correos de registro
        </button>
        <button
          className="btn btn-sec py-1.5 text-xs"
          disabled={mandando}
          onClick={async () => {
            setMandando(true);
            const r = await fetch("/api/admin/salud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "semana" }) });
            const d = await r.json().catch(() => ({}));
            setMandando(false);
            onAviso(r.ok && d.enviado ? "Te mandé “Tu semana” a tu correo." : `No se pudo: ${d.error ?? d.motivo ?? r.status}`);
          }}
        >
          {mandando ? "Mandando…" : "Mandarme “Tu semana” ahora"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">“Tu semana” te llega solo cada lunes temprano: lo cobrado, quién llegó, quién vence y lo que te espera aquí.</p>
    </section>
  );
}
