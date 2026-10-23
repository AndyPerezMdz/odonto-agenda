"use client";

import { useCallback, useEffect, useState } from "react";
import { Copiable } from "@/components/TarjetaSuscripcion";
import { BENEFICIOS_MI_PRO, GRATIS_MI, type EstadoMi, type PlanMi } from "@/lib/planMi";
import { pesos } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";
import ProbarMi from "@/components/personal/ProbarMi";
import { DIAS_PRUEBA_MI } from "@/lib/planMi";

type Datos = {
  estado: EstadoMi | null;
  pruebaDisponible?: boolean;
  planes: PlanMi[];
  codigo: string;
  banco: { banco?: string; clabe?: string; titular?: string };
  pagos: { id: string; monto: number; meses: number; cubre_hasta: string; created_at: string }[];
  ultimoAviso: { estado: string; fecha: string } | null;
};

/** 2.3 · "Tu plan" de Mi agenda: estado, planes, transferencia y "Ya pagué" (igual que la suscripción de clínicas). */
export default function TarjetaPlanMi() {
  const [d, setD] = useState<Datos | null>(null);
  const [plan, setPlan] = useState<string>("mes");
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/personal/plan", { cache: "no-store" });
    const x = await r.json().catch(() => ({}));
    if (r.ok) setD(x);
    else setError(x.error ?? "No se pudo cargar.");
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!d)
    return (
      <section id="plan" className="scroll-mt-4 rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="serif text-xl">Tu plan</h2>
        <p className="mt-1 text-sm text-muted">{error ?? "Cargando…"}</p>
      </section>
    );

  const e = d.estado;
  const mensual = d.planes[0]?.precio ?? 0;
  const elegido = d.planes.find((p) => p.id === plan) ?? d.planes[0];
  const clabe = (d.banco.clabe ?? "").replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{11})(\d?)/, "$1 $2 $3 $4").trim();
  const pendiente = d.ultimoAviso?.estado === "pendiente";
  const etiqueta =
    !e ? "—" :
    e.tipo === "cortesia" ? "Pro de cortesía · sin vencimiento" :
    e.tipo === "clinicas" ? `Pro incluido con tu agenda de clínicas${e.hasta ? ` (hasta el ${fechaLarga(e.hasta)})` : ""}` :
    e.tipo === "prueba" ? `Prueba de Pro hasta el ${fechaLarga(e.hasta)}` :
    e.tipo === "pro" ? `Pro hasta el ${fechaLarga(e.hasta)}` : "Estás en Gratis";
  // Con cortesía o cubierto por clínicas no hace falta pagar (pero si quiere asegurar su Pro propio, puede)
  const sinPagar = e?.tipo === "cortesia";

  async function yaPague(ev: React.FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await fetch("/api/personal/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: elegido?.id, referencia }) });
    const x = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setError(x.error ?? "No se pudo avisar.");
    setAviso("¡Gracias! En cuanto confirmemos tu transferencia se activa tu Pro y te llega un correo.");
    setReferencia("");
    cargar();
  }

  return (
    <section id="plan" className="scroll-mt-4 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="serif text-xl">Tu plan</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e?.pro ? "bg-accent-soft text-accent" : "bg-panel-2 text-muted"}`}>{etiqueta}</span>
      </div>

      {d.pruebaDisponible && (
        <div className="mt-4 rounded-2xl border-2 border-accent bg-accent-soft/40 p-4">
          <p className="serif text-lg">Prueba Pro {DIAS_PRUEBA_MI} días gratis</p>
          <p className="mb-3 mt-0.5 text-sm text-muted">Actívala cuando quieras: todo Pro durante {DIAS_PRUEBA_MI} días, sin tarjeta y sin cobro al terminar.</p>
          <ProbarMi onActivada={() => window.location.reload()} />
        </div>
      )}

      {e?.tipo === "clinicas" && <p className="mt-2 text-sm text-muted">Como tu agenda de clínicas es Pro, tu Mi agenda también lo es, sin pagar extra. Si un día tu agenda de clínicas baja a Gratis, Mi agenda también.</p>}

      {!sinPagar && (
        <>
          <p className="mb-2 mt-4 text-sm font-medium">{e?.pro ? "Extiende tu Pro" : "Pásate a Pro"}</p>
          <div className="mb-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Plan">
            {d.planes.map((p) => {
              const ahorro = Math.max(0, mensual * p.meses - p.precio);
              const pct = ahorro ? Math.round((ahorro / (mensual * p.meses)) * 100) : 0;
              const sel = elegido?.id === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={sel} onClick={() => setPlan(p.id)} className={`rounded-xl border px-3 py-2.5 text-left ${sel ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2"}`}>
                  <span className={`block text-sm font-semibold ${sel ? "text-accent" : ""}`}>{p.nombre}</span>
                  <span className="serif block text-2xl leading-tight">{pesos(p.precio)}</span>
                  <span className="text-xs text-muted">{p.meses === 1 ? "por mes" : `${p.meses} meses${pct ? ` · -${pct}%` : ""}`}</span>
                </button>
              );
            })}
          </div>
          <details className="mb-4 text-sm">
            <summary className="cursor-pointer text-muted hover:text-ink">¿Qué trae Pro?</summary>
            <ul className="mt-2 grid gap-1 pl-1 sm:grid-cols-2">
              {BENEFICIOS_MI_PRO.map((b) => <li key={b} className="flex gap-2"><span className="text-accent">✓</span>{b}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">En Gratis: {GRATIS_MI.join(", ").toLowerCase()}. Nunca pierdes lo que anotaste.</p>
          </details>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-line px-3">
              <p className="pt-3 text-sm font-semibold">Transferencia SPEI</p>
              {!d.banco.clabe ? (
                <p className="py-3 text-sm text-muted">Los datos bancarios aún no están disponibles. Escríbenos.</p>
              ) : (
                <>
                  <Copiable etiqueta="Monto" valor={elegido ? pesos(elegido.precio) : ""} />
                  <Copiable etiqueta="CLABE" valor={clabe} grande />
                  <Copiable etiqueta="Banco" valor={d.banco.banco ?? ""} />
                  <Copiable etiqueta="Beneficiario" valor={d.banco.titular ?? ""} />
                  <Copiable etiqueta="Concepto (¡importante!)" valor={d.codigo} />
                </>
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Transfiere el monto desde la app de tu banco.</li>
                <li>Escribe el <b className="text-ink">concepto {d.codigo}</b>.</li>
                <li>Presiona <b className="text-ink">Ya pagué</b>.</li>
              </ol>
              {d.ultimoAviso?.estado === "rechazado" && (
                <p className="mb-3 rounded-xl bg-panel-2 px-3 py-3 text-sm text-danger">Tu aviso del {fechaLarga(d.ultimoAviso.fecha.slice(0, 10))} no se pudo confirmar: revisa CLABE y concepto y vuelve a avisar, o responde al correo con tu comprobante.</p>
              )}
              {pendiente ? (
                <p className="rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent">Avisaste de un pago el {fechaLarga(d.ultimoAviso!.fecha.slice(0, 10))}. En cuanto lo confirmemos se activa tu Pro.</p>
              ) : (
                <form onSubmit={yaPague} className="mt-auto">
                  <label className="mb-1 block text-sm font-medium">Clave de rastreo <span className="font-normal text-muted">(opcional)</span></label>
                  <input className="campo mb-3" value={referencia} maxLength={80} onChange={(x) => setReferencia(x.target.value)} placeholder="La que te da tu banco" />
                  <button className="btn btn-primario w-full rounded-full" disabled={enviando || !d.banco.clabe}>{enviando ? "Avisando…" : "Ya pagué"}</button>
                </form>
              )}
              {aviso && <p className="mt-3 text-sm text-accent">{aviso}</p>}
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">Sin tarjeta y sin cargos automáticos: cuando se acaba tu tiempo, sigues en Gratis hasta que vuelvas a pagar.</p>
        </>
      )}

      {d.pagos.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">Pagos recientes</p>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {d.pagos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>{fechaLarga(p.created_at.slice(0, 10))}</span>
                <span className="text-muted">hasta el {fechaLarga(p.cubre_hasta)}</span>
                <span className="font-medium tabular-nums">{pesos(Number(p.monto))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
