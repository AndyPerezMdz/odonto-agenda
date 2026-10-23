"use client";

import { useCallback, useEffect, useState } from "react";
import { estadoPago, pesos } from "@/lib/pagos";
import { ahorroDe, type Plan } from "@/lib/precios";
import { BENEFICIOS_PRO, DIAS_PRUEBA, PAGO_EN_LINEA } from "@/lib/plan";
import ProbarPro from "@/components/ProbarPro";
import { fechaLarga, hoyISO } from "@/lib/fechas";

type Datos = {
  pagadoHasta: string | null;
  enPrueba: boolean;
  pruebaDisponible?: boolean; // 2.3 · aún puede activar sus 15 días
  codigoCreador: string | null;
  precio: number;
  planes: Plan[]; // mensual, trimestral, por periodo, anual (los activos de su universidad)
  mensual: number;
  mp: boolean; // ¿hay pago con tarjeta / OXXO (Mercado Pago)?
  codigo: string;
  banco: { banco?: string; clabe?: string; titular?: string };
  pagos: { id: string; monto: number; meses: number; metodo: string; cubre_desde: string; cubre_hasta: string; created_at: string }[];
  avisoPendiente: string | null;
  ultimoAviso: { estado: "pendiente" | "confirmado" | "descartado"; fecha: string } | null;
};

export function Copiable({ etiqueta, valor, grande }: { etiqueta: string; valor: string; grande?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-muted">{etiqueta}</p>
        <p className={`font-medium tabular-nums ${grande ? "text-base sm:text-lg sm:tracking-wide" : "truncate"}`}>{valor || "—"}</p>
      </div>
      {valor && (
        <button
          type="button"
          className="btn btn-sec shrink-0 px-2.5 py-1 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(valor.replace(/\s/g, etiqueta === "CLABE" ? "" : " ")).then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            });
          }}
        >
          {copiado ? "¡Copiado!" : "Copiar"}
        </button>
      )}
    </div>
  );
}

export default function TarjetaSuscripcion() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("periodo");
  const [yendo, setYendo] = useState(false);
  const [retorno, setRetorno] = useState<string | null>(null);
  useEffect(() => {
    setRetorno(new URLSearchParams(window.location.search).get("pago"));
  }, []);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/pago", { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setDatos(d);
    else setError(d.error ?? "No se pudo cargar.");
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function yaPague(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const res = await fetch("/api/pago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referencia, plan: elegido?.id ?? "mes" }),
    });
    const d = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) return setError(d.error ?? "No se pudo avisar.");
    setAviso("¡Gracias! Ya le avisamos al administrador. En cuanto confirme tu transferencia se actualizará tu suscripción.");
    setReferencia("");
    cargar();
  }

  if (!datos) {
    return (
      <section id="suscripcion" className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="font-semibold">Suscripción</h2>
        <p className="mt-1 text-sm text-muted">{error ?? "Cargando…"}</p>
      </section>
    );
  }

  const estado = estadoPago(datos.pagadoHasta, hoyISO());
  const clabe = (datos.banco.clabe ?? "").replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{11})(\d?)/, "$1 $2 $3 $4").trim();
  const sinDatosBanco = !datos.banco.clabe;
  const elegido = datos.planes.find((p) => p.id === plan) ?? datos.planes[0];
  const monto = elegido ? elegido.precio : datos.precio;

  async function pagarEnLinea() {
    if (!elegido) return;
    setYendo(true);
    setError(null);
    const r = await fetch("/api/pago/mp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: elegido.id }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) {
      setYendo(false);
      return setError(d.error ?? "No se pudo abrir el pago.");
    }
    window.location.href = d.url;
  }

  const insignia =
    estado.tipo === "cortesia"
      ? { t: "Sin vencimiento", c: "bg-accent-soft text-accent" }
      : estado.tipo === "activa"
        ? { t: `${datos.enPrueba ? "Prueba de Pro" : "Pro"} hasta el ${fechaLarga(estado.vence)}`, c: "bg-accent-soft text-accent" }
        : estado.tipo === "por_vencer"
          ? { t: estado.dias === 0 ? "Vence hoy" : `Vence en ${estado.dias} día${estado.dias === 1 ? "" : "s"}`, c: "bg-[#fdf6e3] text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]" }
          : { t: "Estás en Gratis", c: "bg-panel-2 text-muted" };

  return (
    <section id="suscripcion" className="scroll-mt-4 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Suscripción · Pro</h2>
          <p className="mt-0.5 text-sm text-muted">
            {estado.tipo === "cortesia"
              ? "Tu agenda no tiene fecha de vencimiento."
              : `Pro para tu agenda (tú y tu compañero/a), desde ${pesos(datos.mensual)} al mes. Sin pagar sigues en Gratis.`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${insignia.c}`}>{insignia.t}</span>
      </div>

      {datos.pruebaDisponible && (
        <div className="mb-4 rounded-xl border-2 border-accent bg-accent-soft/40 p-4">
          <p className="font-semibold">Prueba Pro {DIAS_PRUEBA} días gratis</p>
          <p className="mb-3 mt-0.5 text-sm text-muted">Tu agenda está en Gratis. Cuando quieras, actívala: todo Pro para ti y tu compa durante {DIAS_PRUEBA} días{datos.codigoCreador ? ", más los días de tu código de creador" : ""}. Sin tarjeta y sin cobro al terminar.</p>
          <ProbarPro onActivada={cargar} />
        </div>
      )}
      {(datos.enPrueba || datos.pruebaDisponible) && <CanjearCodigo aplicado={datos.codigoCreador} pendiente={!!datos.pruebaDisponible} onCanjeado={cargar} />}

      {estado.tipo !== "cortesia" && (
        <>
          {PAGO_EN_LINEA && retorno === "ok" && <p className="mb-3 rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent">¡Gracias! En cuanto Mercado Pago confirme tu pago se activa tu Pro (normalmente en segundos). Recarga si no lo ves.</p>}
          {PAGO_EN_LINEA && retorno === "pendiente" && <p className="mb-3 rounded-xl bg-[#fdf6e3] px-3 py-3 text-sm text-[#5c4712]">Tu pago quedó pendiente (si pagaste en OXXO, se acredita cuando la tienda lo reporta). Te avisamos por correo al activarse.</p>}
          {PAGO_EN_LINEA && retorno === "error" && <p className="mb-3 rounded-xl bg-[#fbecea] px-3 py-3 text-sm text-[#7a1f1a]">El pago no se completó. Puedes intentar otra vez o pagar por transferencia.</p>}

          <p className="mb-2 text-sm font-medium">Elige tu plan de Pro</p>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Plan">
            {datos.planes.map((p) => {
              const ahorro = ahorroDe(p, datos.mensual);
              const pct = ahorro ? Math.round((ahorro / (datos.mensual * p.meses)) * 100) : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={elegido?.id === p.id}
                  onClick={() => setPlan(p.id)}
                  className={`relative rounded-xl border px-3 py-2.5 text-left ${elegido?.id === p.id ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2"}`}
                >
                  {p.id === "periodo" && <span className="absolute -top-2 right-2 rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-panel">Recomendado</span>}
                  <span className={`block text-sm font-semibold ${elegido?.id === p.id ? "text-accent" : ""}`}>{p.nombre}</span>
                  <span className="block text-lg font-semibold tabular-nums">{pesos(p.precio)}</span>
                  <span className="text-xs text-muted">{p.meses === 1 ? "por mes" : `${p.meses} meses${pct ? ` · ahorras ${pct}%` : ""}`}</span>
                </button>
              );
            })}
          </div>
          <details className="mb-4 text-sm">
            <summary className="cursor-pointer text-muted hover:text-ink">¿Qué trae Pro?</summary>
            <ul className="mt-2 grid gap-1 pl-1 sm:grid-cols-2">
              {BENEFICIOS_PRO.map((b) => <li key={b} className="flex gap-2"><span className="text-accent">✓</span>{b}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">Sin Pro tu agenda sigue funcionando en Gratis: citas, tu compa, horario, asistencia, folios y tu avance del periodo.</p>
          </details>

          {datos.mp && (
            <div className="mb-4 rounded-xl border-2 border-accent p-3">
              <button className="btn btn-primario w-full" disabled={yendo || !elegido} onClick={pagarEnLinea}>
                {yendo ? "Abriendo Mercado Pago…" : `Pagar ${elegido ? pesos(elegido.precio) : ""} con tarjeta u OXXO`}
              </button>
              <p className="mt-1.5 text-center text-xs text-muted">Con tarjeta se activa al instante. En OXXO, cuando la tienda reporta tu pago.</p>
            </div>
          )}
          {datos.mp && <p className="mb-2 text-sm font-medium">O por transferencia</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-line px-3">
              <p className="pt-3 text-sm font-semibold">Transferencia SPEI</p>
              {sinDatosBanco ? (
                <p className="py-3 text-sm text-muted">Los datos bancarios aún no están disponibles. Contacta al administrador.</p>
              ) : (
                <>
                  <Copiable etiqueta="Monto" valor={`${pesos(monto)}`} />
                  <Copiable etiqueta="CLABE" valor={clabe} grande />
                  <Copiable etiqueta="Banco" valor={datos.banco.banco ?? ""} />
                  <Copiable etiqueta="Beneficiario" valor={datos.banco.titular ?? ""} />
                  <Copiable etiqueta="Concepto (¡importante!)" valor={datos.codigo} />
                </>
              )}
            </div>

            <div className="flex min-w-0 flex-col">
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Transfiere el monto desde la app de tu banco.</li>
                <li>Escribe el <b className="text-ink">concepto {datos.codigo}</b> para identificar tu pago.</li>
                <li>Presiona <b className="text-ink">Ya pagué</b> aquí abajo.</li>
              </ol>

              {!datos.avisoPendiente && datos.ultimoAviso?.estado === "descartado" && (
                <p className="mb-3 rounded-xl bg-[#fbecea] px-3 py-3 text-sm text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]">
                  Tu aviso del {fechaLarga(datos.ultimoAviso.fecha.slice(0, 10))} <b>no se pudo confirmar</b>: no vimos la transferencia. Revisa CLABE y concepto y vuelve a avisar, o responde al correo que te enviamos con tu comprobante.
                </p>
              )}
              {!datos.avisoPendiente && datos.ultimoAviso?.estado === "confirmado" && datos.pagos[0] && (
                <p className="mb-3 rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent">
                  ¡Gracias! Tu último pago quedó confirmado. Estás cubierto hasta el {fechaLarga(datos.pagos[0].cubre_hasta)}.
                </p>
              )}
              {datos.avisoPendiente ? (
                <p className="rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent">
                  Avisaste de un pago el {fechaLarga(datos.avisoPendiente.slice(0, 10))}. Está en espera de confirmación.
                </p>
              ) : (
                <form onSubmit={yaPague} className="mt-auto">
                  <label className="mb-1 block text-sm font-medium">
                    Clave de rastreo <span className="font-normal text-muted">(opcional)</span>
                  </label>
                  <input className="campo mb-3" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="La que te da tu banco al transferir" />
                  <button className="btn btn-primario w-full" disabled={enviando || sinDatosBanco}>
                    {enviando ? "Avisando…" : "Ya pagué"}
                  </button>
                </form>
              )}
              {aviso && <p className="mt-3 text-sm text-accent">{aviso}</p>}
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            </div>
          </div>

          {datos.pagos.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">Pagos recientes</p>
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {datos.pagos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>{fechaLarga(p.created_at.slice(0, 10))}</span>
                    <span className="text-muted">
                      {p.meses} mes{p.meses === 1 ? "" : "es"} · cubre hasta el {fechaLarga(p.cubre_hasta)}
                    </span>
                    <span className="font-medium tabular-nums">{pesos(p.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Durante el mes gratis: "¿Tienes un código de creador?" → meses extra. */
export function CanjearCodigo({ aplicado, pendiente = false, onCanjeado }: { aplicado: string | null; pendiente?: boolean; onCanjeado: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  if (aplicado) {
    return (
      <p className="mb-4 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
        Código <b>{aplicado}</b> {pendiente ? "guardado: sus días extra se suman cuando actives tu prueba." : "aplicado a tu prueba de Pro."}
      </p>
    );
  }

  async function canjear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    const res = await fetch("/api/codigo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }) });
    const d = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) return setMsg({ ok: false, t: d.error ?? "No se pudo aplicar." });
    setMsg({ ok: true, t: d.pendiente ? `¡Listo! Cuando actives tu prueba tendrás ${d.dias} días extra de Pro, cortesía de ${d.creador}.` : `¡Listo! Tienes ${d.dias} días extra de Pro, cortesía de ${d.creador}.` });
    onCanjeado();
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mb-4 text-sm font-medium text-accent hover:underline">
        ¿Tienes un código de creador?
      </button>
    );
  }
  return (
    <form onSubmit={canjear} className="mb-4 rounded-xl border border-line p-3">
      <label className="mb-1 block text-sm font-medium">Código de creador</label>
      <div className="flex gap-2">
        <input className="campo uppercase placeholder:normal-case" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. JENRRY" autoFocus />
        <button className="btn btn-primario shrink-0" disabled={enviando || !codigo.trim()}>{enviando ? "…" : "Aplicar"}</button>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-accent" : "text-danger"}`}>{msg.t}</p>}
      <p className="mt-2 text-xs text-muted">Te da días extra de Pro. Sólo se puede usar uno, durante tu prueba.</p>
    </form>
  );
}
