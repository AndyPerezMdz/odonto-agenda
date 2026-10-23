"use client";

import { useState } from "react";
import type { AgendaAdmin, MesResumen, ResumenAdmin } from "@/lib/admin";
import type { ResumenMiAdmin } from "@/lib/miAdmin";
import { diasEntre, pesos } from "@/lib/pagos";
import { fechaLarga, hoyISO } from "@/lib/fechas";
import { enPruebaViva, Ingresos, Kpi, mesCorto, mesLargo, pagando } from "@/components/TableroAdmin";

// Panel de staff, por producto: el resumen de Dinero (Clínicas | Mi agenda | Total) y las secciones de Mi agenda.

/* ------------------------------ Dinero: todo junto ------------------------------ */

/** La tabla que desglosa: cada producto en su renglón y el total abajo. */
export function DesgloseDinero({ agendas, resumen, mi, etiquetaClinicas }: { agendas: AgendaAdmin[]; resumen: ResumenAdmin; mi: ResumenMiAdmin | null; etiquetaClinicas: string }) {
  const hoy = hoyISO();
  const pagan = agendas.filter((a) => pagando(a, hoy));
  const cl = {
    cobrado: resumen.meses.at(-1)?.cobrado ?? 0,
    antes: resumen.meses.at(-2)?.cobrado ?? 0,
    recurrente: pagan.reduce((n, a) => n + a.precio_mensual, 0),
    pagando: pagan.length,
    prueba: agendas.filter((a) => enPruebaViva(a, hoy)).length,
    total: agendas.length,
  };
  const m = mi
    ? { cobrado: mi.cobradoMes, antes: mi.meses.at(-2)?.cobrado ?? 0, recurrente: mi.recurrente, pagando: mi.pagando, prueba: mi.pruebas.activas, total: mi.personas.total }
    : null;
  const filas: [string, typeof cl | null, string][] = [
    [etiquetaClinicas, cl, "agendas"],
    ["Mi agenda", m, "personas"],
  ];
  const suma = (k: keyof typeof cl) => cl[k] + (m ? m[k] : 0);
  const mes = mesLargo(resumen.meses.at(-1)?.mes ?? hoy.slice(0, 7));
  const delta = (a: number, b: number) => (a === b ? "=" : `${a > b ? "▲" : "▼"} ${pesos(Math.abs(a - b))}`);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="px-4 py-2.5 text-left font-medium">Producto</th>
              <th className="px-3 py-2.5 text-right font-medium">Cobrado en {mes}</th>
              <th className="px-3 py-2.5 text-right font-medium">Recurrente</th>
              <th className="px-3 py-2.5 text-right font-medium">Pagando</th>
              <th className="px-3 py-2.5 text-right font-medium">En prueba</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(([t, f, unidad]) => (
              <tr key={t} className="border-b border-line">
                <td className="px-4 py-3 font-medium">{t}</td>
                {f ? (
                  <>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {pesos(f.cobrado)} <span className={`ml-1 text-[11px] ${f.cobrado >= f.antes ? "text-accent" : "text-danger"}`}>{delta(f.cobrado, f.antes)}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{pesos(f.recurrente)}/mes</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.pagando}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{f.prueba}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{f.total} {unidad}</td>
                  </>
                ) : (
                  <td colSpan={5} className="px-4 py-3 text-right text-muted">Cargando…</td>
                )}
              </tr>
            ))}
            <tr className="bg-panel-2/60 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-3 py-3 text-right tabular-nums">{pesos(suma("cobrado"))}</td>
              <td className="px-3 py-3 text-right tabular-nums">{pesos(suma("recurrente"))}/mes</td>
              <td className="px-3 py-3 text-right tabular-nums">{suma("pagando")}</td>
              <td className="px-3 py-3 text-right tabular-nums">{suma("prueba")}</td>
              <td className="px-4 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">Recurrente = lo que entra cada mes de quienes pagan (Mi agenda: su último pago entre los meses que cubre). La cortesía y el Pro incluido por clínicas no cuentan.</p>
    </section>
  );
}

/** Cobrado por mes con las dos barras juntas (Clínicas abajo, Mi agenda encima). */
export function IngresosJuntos({ clinicas, mi }: { clinicas: MesResumen[]; mi: MesResumen[] | null }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const meses = clinicas.map((c, i) => ({ mes: c.mes, cl: c.cobrado, mi: mi?.find((x) => x.mes === c.mes)?.cobrado ?? 0, i }));
  const max = Math.max(...meses.map((m) => m.cl + m.mi), 1);
  const total = meses.reduce((n, m) => n + m.cl + m.mi, 0);
  const H = 140;
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Cobrado por mes</h2>
        <span className="text-xs text-muted">{pesos(total)} en 6 meses</span>
      </div>
      <div className="mb-3 flex gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Clínicas</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#d9a441]" /> Mi agenda</span>
      </div>
      <div className="relative" onMouseLeave={() => setSobre(null)}>
        <div className="flex items-end gap-2 border-b border-line" style={{ height: H }}>
          {meses.map((m) => {
            const alto = (v: number) => (v ? Math.max(3, Math.round((v / max) * (H - 18))) : 0);
            return (
              <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setSobre(m.i)} tabIndex={0} aria-label={`${mesLargo(m.mes)}: clínicas ${pesos(m.cl)}, Mi agenda ${pesos(m.mi)}`}>
                {(sobre === m.i || m.i === meses.length - 1) && m.cl + m.mi > 0 && <span className="mb-1 text-[11px] font-semibold tabular-nums">{pesos(m.cl + m.mi)}</span>}
                <span className="w-full max-w-10 rounded-t bg-[#d9a441]" style={{ height: alto(m.mi) }} />
                <span className={`w-full max-w-10 bg-accent ${m.mi ? "" : "rounded-t"}`} style={{ height: alto(m.cl) }} />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-2">
          {meses.map((m) => <span key={m.mes} className={`flex-1 text-center text-[11px] ${m.i === meses.length - 1 ? "font-semibold" : "text-muted"}`}>{mesCorto(m.mes)}</span>)}
        </div>
        {sobre != null && (
          <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-lg">
            <b className="block capitalize">{mesLargo(meses[sobre].mes)}</b>
            <span className="block tabular-nums">Clínicas {pesos(meses[sobre].cl)}</span>
            <span className="block tabular-nums">Mi agenda {pesos(meses[sobre].mi)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ Dinero: Mi agenda ------------------------------ */

export function DineroMi({ r, onVer }: { r: ResumenMiAdmin; onVer: (q: string) => void }) {
  const [antes, ahora] = r.meses.slice(-2);
  const delta = ahora.cobrado - antes.cobrado;
  const base = r.pruebas.convertidas + r.pruebas.perdidas;
  const conv = base ? Math.round((r.pruebas.convertidas / base) * 100) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi destacado titulo={`Cobrado en ${mesLargo(ahora.mes)}`} valor={pesos(ahora.cobrado)} detalle={delta === 0 ? `Igual que ${mesLargo(antes.mes)}` : `${delta > 0 ? "▲" : "▼"} ${pesos(Math.abs(delta))} vs ${mesLargo(antes.mes)}`} />
        <Kpi titulo="Ingreso recurrente" valor={`${pesos(r.recurrente)}/mes`} detalle={r.pagando ? `${r.pagando} persona${r.pagando === 1 ? "" : "s"} pagando` : "Nadie paga todavía"} tono={r.pagando ? "bien" : "mal"} />
        <Kpi titulo="En prueba de Pro" valor={String(r.pruebas.activas)} detalle={r.pruebas.terminanSemana ? `${r.pruebas.terminanSemana} termina${r.pruebas.terminanSemana === 1 ? "" : "n"} esta semana` : "Ninguna termina esta semana"} tono={r.pruebas.terminanSemana ? "ojo" : "neutro"} />
        <Kpi titulo="Pasan de prueba a pago" valor={conv == null ? "—" : `${conv}%`} detalle={base ? `${r.pruebas.convertidas} de ${base} pagaron` : "Aún no termina ninguna prueba"} tono={conv == null ? "neutro" : conv >= 50 ? "bien" : conv >= 25 ? "ojo" : "mal"} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Renovaciones r={r} onVer={onVer} />
        <div className="flex min-w-0 flex-col gap-4">
          <Ingresos resumen={{ meses: r.meses }} nuevas="persona" />
          <PlanesDeLaGente r={r} />
        </div>
      </div>
    </div>
  );
}

function Renovaciones({ r, onVer }: { r: ResumenMiAdmin; onVer: (q: string) => void }) {
  const conPago = r.renovaciones.filter((x) => x.tipo === "pro");
  const enRiesgo = r.renovaciones.filter((x) => x.tipo === "prueba");
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold">Vencen en 30 días</h2>
        <p className="text-xs text-muted">{conPago.length} renuevan · {enRiesgo.length} pruebas por terminar. Sin cargos automáticos: si no pagan, bajan a Gratis.</p>
      </div>
      {r.renovaciones.length === 0 ? (
        <p className="p-5 text-center text-sm text-muted">Nada vence este mes.</p>
      ) : (
        <ul className="divide-y divide-line">
          {r.renovaciones.map((x) => (
            <li key={x.user_id}>
              <button onClick={() => onVer(x.email ?? x.nombre ?? "")} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel-2">
                <span className="consola-mono w-14 shrink-0 text-xs text-muted">{x.dias === 0 ? "hoy" : `en ${x.dias} d`}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{x.nombre || x.email}</span>
                  <span className={`text-xs ${x.tipo === "prueba" ? "text-[#d9a441]" : "text-muted"}`}>{x.tipo === "prueba" ? "Termina su prueba" : `Renueva · ${fechaLarga(x.hasta)}`}</span>
                </span>
                <span className="shrink-0 tabular-nums">{x.monto != null ? pesos(x.monto) : "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanesDeLaGente({ r }: { r: ResumenMiAdmin }) {
  const e = r.personas.porEstado;
  const filas: [string, number, string][] = [
    ["Pagando", e.pro, "bg-accent"],
    ["En prueba", e.prueba, "bg-[#d9a441]"],
    ["Pro por clínicas", e.clinicas, "bg-accent/50"],
    ["Cortesía", e.cortesia, "bg-muted/50"],
    ["Gratis", e.gratis, "bg-line"],
  ];
  const total = Math.max(1, r.personas.total);
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">En qué plan están</h2>
        <span className="text-xs text-muted">{r.personas.total} personas</span>
      </div>
      <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-panel-2">
        {filas.map(([t, n, c]) => n > 0 && <span key={t} className={c} style={{ width: `${(n / total) * 100}%` }} title={`${t}: ${n}`} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {filas.map(([t, n, c]) => (
          <li key={t} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-sm ${c}`} />
            <span className="mr-auto text-muted">{t}</span>
            <span className="tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Mi agenda → Uso ------------------------------ */

export function UsoMi({ r }: { r: ResumenMiAdmin }) {
  const p = r.personas;
  const base = Math.max(1, p.activas);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Personas" valor={String(p.total)} detalle={`${p.activas} activas · ${p.nuevas30} nuevas en 30 días`} />
        <Kpi titulo="Entraron esta semana" valor={String(p.entraron7)} detalle={`${Math.round((p.entraron7 / base) * 100)}% de las activas`} tono={p.entraron7 / base >= 0.5 ? "bien" : p.entraron7 / base >= 0.25 ? "ojo" : "mal"} />
        <Kpi titulo="Palomitas de hábitos" valor={String(r.marcas7)} detalle="en los últimos 7 días" />
        <Kpi titulo="Sin contraseña" valor={String(p.sinContrasena)} detalle={p.sinContrasena ? "Entran sólo con link" : "Todas tienen"} tono={p.sinContrasena ? "ojo" : "bien"} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-panel p-4">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="font-semibold">Qué usan</h2>
            <span className="text-xs text-muted">de {p.activas} activas</span>
          </div>
          <p className="mb-3 text-xs text-muted">Cuántas personas tienen al menos uno. Sólo contamos: nunca vemos qué anotan.</p>
          <ul className="flex flex-col gap-2.5">
            {r.uso.map((u) => (
              <li key={u.id}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{u.nombre}</span>
                  <span className="tabular-nums text-muted"><b className="text-ink">{u.personas}</b> · {u.total} en total</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (u.personas / base) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="mb-3 font-semibold">Quiénes son</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <Par t="Estudiantes de odonto" n={p.odonto} total={p.total} />
            <Par t="Público general" n={p.general} total={p.total} />
            <Par t="Sólo Mi agenda" n={p.soloMi} total={p.total} />
            <Par t="También usan clínicas" n={p.total - p.soloMi} total={p.total} />
            <Par t="Nuevas esta semana" n={p.nuevas7} total={p.total} />
            <Par t="Llegaron por un amigo" n={r.invitados} total={p.total} />
          </ul>
        </section>
      </div>
    </div>
  );
}

function Par({ t, n, total }: { t: string; n: number; total: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className="mr-auto text-muted">{t}</span>
      <span className="tabular-nums">{n}</span>
      <span className="consola-mono w-10 text-right text-[11px] text-muted">{total ? Math.round((n / total) * 100) : 0}%</span>
    </li>
  );
}

/* ------------------------------ Hoy: lo de Mi agenda ------------------------------ */

/** Pruebas y Pro de Mi agenda que se acaban en 3 días (para escribirles si quieres). */
export function HoyMi({ r, onVer }: { r: ResumenMiAdmin; onVer: (q: string) => void }) {
  const hoy = hoyISO();
  const pronto = r.renovaciones.filter((x) => diasEntre(hoy, x.hasta) <= 3);
  if (!pronto.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="font-semibold">Mi agenda · se les acaba</h2>
        <span className="consola-mono rounded bg-panel-2 px-1.5 text-[11px]">{pronto.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {pronto.map((x) => (
          <li key={x.user_id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${x.tipo === "prueba" ? "bg-[#d9a441]" : "bg-muted"}`} />
            <span className="min-w-0 flex-1">
              <b className="font-semibold">{x.nombre || x.email}</b> · {x.tipo === "prueba" ? "termina su prueba de Pro" : "vence su Pro"} {x.dias === 0 ? "hoy" : x.dias === 1 ? "mañana" : `en ${x.dias} días`}
              <span className="block text-xs text-muted">Le llega el aviso automático por correo; aquí por si quieres escribirle tú.</span>
            </span>
            <button onClick={() => onVer(x.email ?? "")} className="btn btn-sec shrink-0 py-1 text-xs">Ver</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
