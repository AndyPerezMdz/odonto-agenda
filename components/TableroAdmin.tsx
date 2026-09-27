"use client";

import { useEffect, useState } from "react";
import type { AgendaAdmin, ResumenAdmin } from "@/lib/admin";
import { estadoPago, pesos, codigoAgenda, diasEntre, sumarDias } from "@/lib/pagos";
import { fechaLarga, hoyISO, MESES } from "@/lib/fechas";

// Piezas del tablero del panel: saludo, números del negocio, "Hoy te toca", ingresos por mes y códigos.

export const DIAS_FANTASMA = 14; // sin entrar tantos días = foco rojo

/* ---------------- utilidades compartidas ---------------- */

export function hace(iso: string | null): string {
  if (!iso) return "nunca ha entrado";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "entró hoy";
  if (dias === 1) return "entró ayer";
  if (dias < 14) return `entró hace ${dias} días`;
  if (dias < 60) return `entró hace ${Math.floor(dias / 7)} semanas`;
  return `entró hace ${Math.floor(dias / 30)} meses`;
}

export function diasSinEntrar(a: AgendaAdmin): number | null {
  const ref = a.ultimoAcceso ?? a.created_at;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
}

/** Paga de verdad: ya tiene pagos y no ha vencido del todo. */
export function pagando(a: AgendaAdmin, hoy: string) {
  const t = estadoPago(a.pagado_hasta, hoy).tipo;
  return a.pagada && (t === "activa" || t === "por_vencer" || t === "gracia");
}

/** En mes gratis y todavía corriendo. */
export function enPruebaViva(a: AgendaAdmin, hoy: string) {
  const t = estadoPago(a.pagado_hasta, hoy).tipo;
  return a.enPrueba && (t === "activa" || t === "por_vencer");
}

const mesCorto = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1].slice(0, 3).toLowerCase();
const mesLargo = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1].toLowerCase();

/* ---------------- saludo ---------------- */

export function Saludo() {
  // Se calcula en el navegador (evita que el servidor salude con otra hora)
  const [s, setS] = useState<{ hola: string; fecha: string } | null>(null);
  useEffect(() => {
    const h = new Date().getHours();
    const hola = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
    const fecha = fechaLarga(hoyISO());
    setS({ hola, fecha: fecha[0].toUpperCase() + fecha.slice(1) });
  }, []);
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{s ? `${s.hola}, jefe` : "Panel de administración"}</h1>
      <p className="text-sm text-muted">{s ? `${s.fecha} · así va el negocio` : " "}</p>
    </>
  );
}

/* ---------------- números del negocio ---------------- */

type Tono = "bien" | "mal" | "ojo" | "neutro";
const TONO: Record<Tono, string> = {
  bien: "text-accent",
  mal: "text-danger",
  ojo: "text-[#8a6a14] dark:text-[#ecd9a4]",
  neutro: "text-muted",
};

function Kpi({ titulo, valor, detalle, tono = "neutro", destacado }: { titulo: string; valor: string; detalle: string; tono?: Tono; destacado?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destacado ? "border-accent bg-accent text-panel" : "border-line bg-panel"}`}>
      <p className={`text-xs ${destacado ? "text-panel/80" : "text-muted"}`}>{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      <p className={`mt-1 text-xs font-medium ${destacado ? "text-panel/85" : TONO[tono]}`}>{detalle}</p>
    </div>
  );
}

export function Numeros({ agendas, resumen }: { agendas: AgendaAdmin[]; resumen: ResumenAdmin }) {
  const hoy = hoyISO();
  const [antes, ahora] = resumen.meses.slice(-2);
  const delta = ahora.cobrado - antes.cobrado;

  const pagan = agendas.filter((a) => pagando(a, hoy));
  const mrr = pagan.reduce((n, a) => n + a.precio_mensual, 0);

  const pruebas = agendas.filter((a) => enPruebaViva(a, hoy));
  const terminanSemana = pruebas.filter((a) => a.pagado_hasta && diasEntre(hoy, a.pagado_hasta) <= 7).length;

  const conPrueba = agendas.filter((a) => a.prueba_hasta);
  const convertidas = conPrueba.filter((a) => a.pagada).length;
  const perdidas = conPrueba.filter((a) => !a.pagada && !enPruebaViva(a, hoy)).length;
  const base = convertidas + perdidas;
  const conversion = base ? Math.round((convertidas / base) * 100) : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        destacado
        titulo={`Cobrado en ${mesLargo(ahora.mes)}`}
        valor={pesos(ahora.cobrado)}
        detalle={
          delta === 0
            ? `Igual que ${mesLargo(antes.mes)}`
            : `${delta > 0 ? "▲" : "▼"} ${pesos(Math.abs(delta))} vs ${mesLargo(antes.mes)}`
        }
      />
      <Kpi
        titulo="Ingreso recurrente"
        valor={`${pesos(mrr)}/mes`}
        detalle={pagan.length ? `${pagan.length} agenda${pagan.length === 1 ? "" : "s"} pagando` : "Nadie paga todavía"}
        tono={pagan.length ? "bien" : "mal"}
      />
      <Kpi
        titulo="En mes gratis"
        valor={String(pruebas.length)}
        detalle={terminanSemana ? `${terminanSemana} termina${terminanSemana === 1 ? "" : "n"} esta semana` : "Ninguna termina esta semana"}
        tono={terminanSemana ? "ojo" : "neutro"}
      />
      <Kpi
        titulo="Pasan de gratis a pago"
        valor={conversion == null ? "—" : `${conversion}%`}
        detalle={base ? `${convertidas} de ${base} pagaron` : "Aún no termina ningún mes gratis"}
        tono={conversion == null ? "neutro" : conversion >= 50 ? "bien" : conversion >= 25 ? "ojo" : "mal"}
      />
    </div>
  );
}

export function Totales({ agendas }: { agendas: AgendaAdmin[] }) {
  const usuarios = agendas.reduce((n, a) => n + a.miembros.filter((m) => !m.pendiente).length, 0);
  const citas = agendas.reduce((n, a) => n + a.citas, 0);
  const semana = agendas.reduce((n, a) => n + a.citasSemana, 0);
  return (
    <p className="mt-3 text-center text-xs text-muted">
      {agendas.length} agenda{agendas.length === 1 ? "" : "s"} · {usuarios} usuario{usuarios === 1 ? "" : "s"} · {citas} citas en total
      {semana > 0 && <> · <b className="text-ink">{semana} nuevas esta semana</b></>}
    </p>
  );
}

/* ---------------- Hoy te toca ---------------- */

type Nivel = "urgente" | "dinero" | "ojo";
type Pendiente = {
  id: string;
  nivel: Nivel;
  titulo: string;
  detalle: string;
  agenda: AgendaAdmin;
  whatsapp?: string;
  correo?: "pago" | "prueba" | "inactiva";
};

const NIVEL: Record<Nivel, { punto: string; orden: number }> = {
  urgente: { punto: "bg-danger", orden: 0 },
  dinero: { punto: "bg-[#c99a2e]", orden: 1 },
  ojo: { punto: "bg-muted", orden: 2 },
};

function pendientesDe(agendas: AgendaAdmin[]): Pendiente[] {
  const hoy = hoyISO();
  const lista: Pendiente[] = [];
  for (const a of agendas) {
    const e = estadoPago(a.pagado_hasta, hoy);
    const dueno = a.miembros.find((m) => m.rol === "owner");
    const nombre = dueno?.nombre?.split(" ")[0] ?? "";
    const hola = `Hola${nombre ? ` ${nombre}` : ""}! Te escribo de Agenda de clínicas.`;
    const pagar = `Son ${pesos(a.precio_mensual)} al mes con el concepto ${codigoAgenda(a.id)}; los datos están en Personalizar → Suscripción.`;

    // 1) Dinero: vencidas, en gracia y por vencer
    if (e.tipo === "gracia") {
      lista.push({
        id: `pago-${a.id}`, nivel: "urgente", agenda: a, correo: "pago",
        titulo: a.enPrueba ? "Se le acabó el mes gratis y no ha pagado" : "Venció y está en días de gracia",
        detalle: `Se bloquea el ${fechaLarga(e.bloqueo)}`,
        whatsapp: `${hola} ${a.enPrueba ? "Tu mes gratis ya terminó" : `Tu suscripción venció el ${fechaLarga(e.vence)}`}; para seguir agendando sólo falta renovar. ${pagar} ¡Gracias!`,
      });
    } else if (e.tipo === "vencida" && diasEntre(e.vence, hoy) <= 30 && dueno) {
      lista.push({
        id: `pago-${a.id}`, nivel: "dinero", agenda: a, correo: "pago",
        titulo: "Vencida, en sólo lectura",
        detalle: `Desde el ${fechaLarga(sumarDias(e.vence, 4))}. Todavía se puede rescatar.`,
        whatsapp: `${hola} Tu agenda quedó en sólo lectura, pero tus citas siguen guardadas. Si quieres reactivarla: ${pagar}`,
      });
    } else if (e.tipo === "por_vencer" && a.enPrueba) {
      lista.push({
        id: `prueba-${a.id}`, nivel: "dinero", agenda: a, correo: "prueba",
        titulo: e.dias === 0 ? "Su mes gratis termina hoy" : `Su mes gratis termina en ${e.dias} día${e.dias === 1 ? "" : "s"}`,
        detalle: `${hace(a.ultimoAcceso)} · ${a.citas} cita${a.citas === 1 ? "" : "s"} capturadas`,
        whatsapp: `${hola} ¿Qué tal te ha ido con la agenda? Tu mes gratis termina el ${fechaLarga(e.vence)}. Si quieres seguir usándola: ${pagar}`,
      });
    } else if (e.tipo === "por_vencer") {
      lista.push({
        id: `pago-${a.id}`, nivel: "ojo", agenda: a,
        titulo: e.dias === 0 ? "Vence hoy" : `Vence en ${e.dias} día${e.dias === 1 ? "" : "s"}`,
        detalle: "Le llega el aviso automático por correo; aquí por si quieres escribirle tú.",
        whatsapp: `${hola} Te recuerdo que tu suscripción vence el ${fechaLarga(e.vence)}. ${pagar} ¡Gracias!`,
      });
    }

    // 2) Fantasmas: pagan o están en prueba, pero ya no entran
    const sinEntrar = diasSinEntrar(a);
    if ((pagando(a, hoy) || enPruebaViva(a, hoy)) && sinEntrar != null && sinEntrar >= DIAS_FANTASMA) {
      lista.push({
        id: `fantasma-${a.id}`, nivel: a.enPrueba ? "dinero" : "ojo", agenda: a, correo: "inactiva",
        titulo: a.ultimoAcceso ? `No entra desde hace ${sinEntrar} días` : "Nunca ha entrado",
        detalle: a.enPrueba ? "Está en mes gratis: si no la usa, no va a pagar." : "Paga pero no la usa: candidata a irse.",
        whatsapp: `${hola} Vi que hace rato no entras a la agenda, ¿todo bien? Si algo no te funciona, dime y lo arreglo.`,
      });
    }

    // 3) Cuentas colgadas
    if (!dueno && !a.invitacionPendiente) {
      lista.push({ id: `sindueno-${a.id}`, nivel: "ojo", agenda: a, titulo: "No tiene dueño/a", detalle: "Invita a alguien o bórrala." });
    } else if (a.invitacionPendiente) {
      lista.push({ id: `inv-${a.id}`, nivel: "ojo", agenda: a, titulo: "Invitación sin aceptar", detalle: a.invitacionPendiente });
    }
    for (const m of a.miembros.filter((m) => m.pendiente)) {
      lista.push({ id: `conf-${m.id}`, nivel: "ojo", agenda: a, titulo: `${m.nombre} no ha confirmado su correo`, detalle: m.email ?? "" });
    }
  }
  return lista.sort((x, y) => NIVEL[x.nivel].orden - NIVEL[y.nivel].orden);
}

export function HoyTeToca({
  agendas, avisosPendientes, onVer, onAviso,
}: { agendas: AgendaAdmin[]; avisosPendientes: number; onVer: (id: string) => void; onAviso: (m: string) => void }) {
  const lista = pendientesDe(agendas);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const visibles = todos ? lista : lista.slice(0, 6);

  async function correo(p: Pendiente) {
    setEnviando(p.id);
    const res = await fetch(`/api/admin/agendas/${p.agenda.id}/recordar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: p.correo }),
    });
    const d = await res.json().catch(() => ({}));
    setEnviando(null);
    onAviso(res.ok ? `Correo enviado a “${p.agenda.nombre}”.` : d.error ?? "No se pudo enviar.");
  }

  const total = lista.length + avisosPendientes;
  return (
    <section className="rounded-2xl border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="font-semibold">Hoy te toca</h2>
        {total > 0 && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-panel tabular-nums">{total}</span>}
      </div>

      {lista.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-2xl">☕</p>
          <p className="mt-1 font-medium">{avisosPendientes ? "Sólo confirma los pagos de arriba." : "Todo en orden."}</p>
          <p className="text-sm text-muted">{avisosPendientes ? "Lo demás está tranquilo." : "Nadie debe, nadie se fue. Ve a dormir."}</p>
        </div>
      ) : (
        <ul>
          {visibles.map((p, i) => (
            <li key={p.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${NIVEL[p.nivel].punto}`} aria-hidden />
              <button onClick={() => onVer(p.agenda.id)} className="min-w-0 flex-1 basis-[calc(100%-1.25rem)] text-left sm:basis-0">
                <span className="block text-sm">
                  <b>{p.agenda.nombre}</b> <span className="text-muted">·</span> {p.titulo}
                </span>
                <span className="block truncate text-xs text-muted">{p.detalle}</span>
              </button>
              <span className="ml-5 flex shrink-0 gap-1.5 sm:ml-0">
                {p.whatsapp && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(p.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-xs font-medium text-white"
                    title="Abre WhatsApp con el mensaje escrito; tú eliges el chat"
                  >
                    WhatsApp
                  </a>
                )}
                {p.correo && (
                  <button disabled={enviando === p.id} onClick={() => correo(p)} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-panel-2">
                    {enviando === p.id ? "…" : "Correo"}
                  </button>
                )}
                {!p.whatsapp && !p.correo && (
                  <button onClick={() => onVer(p.agenda.id)} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-panel-2">Ver</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {lista.length > 6 && (
        <button onClick={() => setTodos(!todos)} className="w-full border-t border-line px-4 py-2.5 text-sm font-medium text-accent hover:bg-panel-2">
          {todos ? "Ver menos" : `Ver ${lista.length - 6} más`}
        </button>
      )}
    </section>
  );
}

/* ---------------- ingresos por mes ---------------- */

export function Ingresos({ resumen }: { resumen: ResumenAdmin }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const meses = resumen.meses;
  const max = Math.max(...meses.map((m) => m.cobrado), 1);
  const total = meses.reduce((n, m) => n + m.cobrado, 0);
  const H = 120;

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Cobrado por mes</h2>
        <span className="text-xs text-muted">{pesos(total)} en 6 meses</span>
      </div>

      <div className="relative" onMouseLeave={() => setSobre(null)}>
        <div className="flex items-end gap-2 border-b border-line" style={{ height: H }}>
          {meses.map((m, i) => {
            const alto = m.cobrado ? Math.max(4, Math.round((m.cobrado / max) * (H - 18))) : 0;
            const actual = i === meses.length - 1;
            return (
              <div
                key={m.mes}
                className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end"
                onMouseEnter={() => setSobre(i)}
                onFocus={() => setSobre(i)}
                tabIndex={0}
                aria-label={`${mesLargo(m.mes)}: ${pesos(m.cobrado)}, ${m.pagos} pagos, ${m.nuevas} agendas nuevas`}
              >
                {(actual || sobre === i) && m.cobrado > 0 && (
                  <span className="mb-1 text-[11px] font-semibold tabular-nums text-ink">{pesos(m.cobrado)}</span>
                )}
                <span
                  className={`w-full max-w-10 rounded-t ${actual ? "bg-accent" : "bg-accent/45"} ${sobre === i ? "!bg-accent" : ""}`}
                  style={{ height: alto }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-2">
          {meses.map((m, i) => (
            <span key={m.mes} className={`flex-1 text-center text-[11px] ${i === meses.length - 1 ? "font-semibold text-ink" : "text-muted"}`}>
              {mesCorto(m.mes)}
            </span>
          ))}
        </div>
        <div className="mt-1 flex gap-2" title="Agendas nuevas ese mes">
          {meses.map((m) => (
            <span key={m.mes} className="flex-1 text-center text-[11px] tabular-nums text-muted">{m.nuevas ? `+${m.nuevas}` : "·"}</span>
          ))}
        </div>
        <p className="mt-1 text-center text-[11px] text-muted">abajo: agendas nuevas del mes</p>

        {sobre != null && (
          <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-lg">
            <b className="block capitalize">{mesLargo(meses[sobre].mes)} {meses[sobre].mes.slice(0, 4)}</b>
            <span className="block tabular-nums">{pesos(meses[sobre].cobrado)} · {meses[sobre].pagos} pago{meses[sobre].pagos === 1 ? "" : "s"}</span>
            <span className="block text-muted">{meses[sobre].nuevas} agenda{meses[sobre].nuevas === 1 ? "" : "s"} nueva{meses[sobre].nuevas === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- códigos de creador ---------------- */

export function PorCodigo({ agendas, resumen, onVerTodos }: { agendas: AgendaAdmin[]; resumen: ResumenAdmin; onVerTodos: () => void }) {
  const hoy = hoyISO();
  const creador = new Map(resumen.codigos.map((c) => [c.codigo, c.creador]));
  const grupos = new Map<string, AgendaAdmin[]>();
  for (const a of agendas) {
    const k = a.codigo ?? "";
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  const filas = [...grupos.entries()]
    .map(([codigo, as]) => ({
      codigo,
      total: as.length,
      prueba: as.filter((a) => enPruebaViva(a, hoy)).length,
      pagan: as.filter((a) => a.pagada).length,
    }))
    .sort((x, y) => (x.codigo === "" ? 1 : y.codigo === "" ? -1 : y.total - x.total));

  if (!resumen.codigos.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-panel">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
        <h2 className="font-semibold">De dónde llegan</h2>
        <button onClick={onVerTodos} className="text-xs font-medium text-accent hover:underline">Códigos →</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-1 text-left font-medium">Código</th>
            <th className="px-2 py-1 text-right font-medium">Agendas</th>
            <th className="px-2 py-1 text-right font-medium">Gratis</th>
            <th className="px-4 py-1 text-right font-medium">Pagan</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.codigo || "-"} className="border-t border-line">
              <td className="px-4 py-2">
                {f.codigo ? <span className="font-mono font-semibold">{f.codigo}</span> : <span className="text-muted">Sin código</span>}
                {f.codigo && creador.get(f.codigo) && <span className="block truncate text-xs text-muted">{creador.get(f.codigo)}</span>}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{f.total}</td>
              <td className="px-2 py-2 text-right tabular-nums text-muted">{f.prueba}</td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold">{f.pagan}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
