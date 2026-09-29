"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgendaAdmin, AvisoAdmin, Miembro, ResumenAdmin } from "@/lib/admin";
import { Saludo, Numeros, Totales, HoyTeToca, Ingresos, PorCodigo, hace, diasSinEntrar, enPruebaViva, pagando, DIAS_FANTASMA } from "@/components/TableroAdmin";
import type { CodigoAdmin } from "@/app/api/admin/codigos/route";
import { estadoPago, pesos, codigoAgenda, sumarDias } from "@/lib/pagos";
import { fechaLarga, hoyISO } from "@/lib/fechas";

async function api(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error ?? `Error ${res.status}`;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

export default function PanelAdmin({ email }: { email: string }) {
  const router = useRouter();
  const [agendas, setAgendas] = useState<AgendaAdmin[] | null>(null);
  const [avisos, setAvisos] = useState<AvisoAdmin[]>([]);
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pestana, setPestana] = useState<"agendas" | "codigos" | "ajustes">("agendas");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const res = await fetch("/api/admin/agendas", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAgendas(data.agendas);
      setAvisos(data.avisos ?? []);
      setResumen(data.resumen ?? null);
      setError(null);
    } else setError(data.error ?? "No se pudo cargar.");
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function salir() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function verAgenda(id: string) {
    setPestana("agendas");
    setFiltro("todas");
    setBusca("");
    setAbierta(id);
    setTimeout(() => document.getElementById(`agenda-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const q = busca.trim().toLowerCase();
  const visibles = (agendas ?? []).filter(
    (a) =>
      (filtro === "todas" || grupoPago(a) === filtro) &&
      (!q || a.nombre.toLowerCase().includes(q) || a.miembros.some((m) => `${m.email} ${m.nombre}`.toLowerCase().includes(q)))
  );

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-panel">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Sólo tú ves esto
          </p>
          <Saludo />
        </div>
        <span className="hidden text-sm text-muted sm:inline">{email}</span>
        <button onClick={salir} className="btn btn-sec">Salir</button>
      </header>

      {agendas && resumen ? (
        <div className="mb-6">
          <Numeros agendas={agendas} resumen={resumen} />
          <Totales agendas={agendas} />
        </div>
      ) : (
        !error && <p className="mb-6 text-sm text-muted">Cargando…</p>
      )}

      {aviso && <p className="sticky top-2 z-20 mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent shadow-sm">{aviso}</p>}
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {agendas && resumen && (
        <div className="mb-6 grid items-start gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="flex min-w-0 flex-col gap-4">
            {avisos.length > 0 && (
              <AvisosPago
                avisos={avisos}
                agendas={agendas}
                onCambio={(msg) => {
                  setAviso(msg);
                  recargar();
                }}
              />
            )}
            <HoyTeToca agendas={agendas} avisosPendientes={avisos.length} onVer={verAgenda} onAviso={setAviso} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Ingresos resumen={resumen} />
            <PorCodigo agendas={agendas} resumen={resumen} onVerTodos={() => setPestana("codigos")} />
          </div>
        </div>
      )}

      {/* Pestañas */}
      <nav className="mb-5 flex gap-1 rounded-xl border border-line bg-panel p-1 text-sm font-medium">
        {(
          [
            ["agendas", `Agendas${agendas ? ` (${agendas.length})` : ""}`],
            ["codigos", "Códigos"],
            ["ajustes", "Datos de pago"],
          ] as const
        ).map(([id, t]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs transition sm:px-3 sm:text-sm ${pestana === id ? "bg-accent text-panel" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </nav>


      {pestana === "ajustes" && <DatosBancarios onAviso={setAviso} />}

      {pestana === "codigos" && <Codigos onAviso={setAviso} />}

      {pestana === "agendas" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              className="campo min-w-0 flex-1 py-2 text-sm sm:max-w-xs"
              placeholder="Buscar por nombre o correo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {FILTROS.map(([id, t]) => {
                const n = agendas?.filter((a) => grupoPago(a) === id).length ?? 0;
                if (id !== "todas" && n === 0) return null;
                return (
                  <button
                    key={id}
                    onClick={() => setFiltro(id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${filtro === id ? "border-ink bg-ink text-panel" : "border-line text-muted hover:text-ink"}`}
                  >
                    {t}
                    {id !== "todas" && ` · ${n}`}
                  </button>
                );
              })}
            </div>
          </div>

          {!agendas && !error && <p className="text-sm text-muted">Cargando…</p>}
          {agendas?.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
              Aún no hay agendas. Cuando alguien se registre en <b>/registro</b>, aparece aquí.
            </p>
          )}
          {agendas && agendas.length > 0 && visibles.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Ninguna agenda coincide.</p>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-panel">
            {visibles.map((a, i) => (
              <FilaAgenda
                key={a.id}
                agenda={a}
                primera={i === 0}
                abierta={abierta === a.id}
                onToggle={() => setAbierta(abierta === a.id ? null : a.id)}
                onCambio={recargar}
                onAviso={setAviso}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const FILTROS = [
  ["todas", "Todas"],
  ["atencion", "Por vencer / vencidas"],
  ["prueba", "Mes gratis"],
  ["activa", "Al corriente"],
  ["cortesia", "Cortesía"],
] as const;
type Filtro = (typeof FILTROS)[number][0];

function grupoPago(a: AgendaAdmin): Filtro {
  const t = estadoPago(a.pagado_hasta, hoyISO()).tipo;
  if (t === "cortesia") return "cortesia";
  if (a.enPrueba && (t === "activa" || t === "por_vencer")) return "prueba";
  if (t === "activa") return "activa";
  return "atencion";
}

function FilaAgenda({
  agenda, primera, abierta, onToggle, onCambio, onAviso,
}: { agenda: AgendaAdmin; primera: boolean; abierta: boolean; onToggle: () => void; onCambio: () => void; onAviso: (m: string) => void }) {
  const hoy = hoyISO();
  const ins = insigniaPago(agenda.pagado_hasta);
  const dueno = agenda.miembros.find((m) => m.rol === "owner");
  const compa = agenda.miembros.find((m) => m.rol !== "owner");
  const sinDueno = !dueno && !agenda.invitacionPendiente;
  const dias = diasSinEntrar(agenda);
  const fantasma = (pagando(agenda, hoy) || enPruebaViva(agenda, hoy)) && dias != null && dias >= DIAS_FANTASMA;
  return (
    <div id={`agenda-${agenda.id}`} className={`scroll-mt-4 ${primera ? "" : "border-t border-line"}`}>
      <button onClick={onToggle} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-2 ${abierta ? "bg-panel-2" : ""}`}>
        <span className="flex shrink-0 -space-x-1.5" aria-hidden>
          {agenda.miembros.length ? (
            agenda.miembros.map((m) => (
              <span key={m.id} className="h-6 w-6 rounded-full border-2 border-panel" style={{ background: m.color ?? "#9a968d" }} title={m.nombre} />
            ))
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-dashed border-line text-[10px] text-muted">?</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{agenda.nombre}</span>
            <span className="block truncate text-xs text-muted">
              {dueno ? dueno.email : agenda.invitacionPendiente ? `Invitación a ${agenda.invitacionPendiente}` : <b className="font-semibold text-danger">Sin dueño</b>}
              {compa ? ` · ${compa.nombre}` : ""} · {agenda.citas} cita{agenda.citas === 1 ? "" : "s"}
              {agenda.codigo ? ` · código ${agenda.codigo}` : ""}
            </span>
            {!sinDueno && (
              <span className={`block text-xs ${fantasma ? "font-medium text-danger" : "text-muted"}`}>
                {hace(agenda.ultimoAcceso)[0].toUpperCase() + hace(agenda.ultimoAcceso).slice(1)}
                {agenda.citasSemana > 0 && <span className="text-accent"> · {agenda.citasSemana} cita{agenda.citasSemana === 1 ? "" : "s"} esta semana</span>}
              </span>
            )}
          </span>
          <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium sm:self-auto ${ins.c}`}>{agenda.enPrueba ? ins.t.replace("Pagada hasta", "Mes gratis hasta") : ins.t}</span>
        </span>
        <svg className={`shrink-0 text-muted transition ${abierta ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {abierta && <TarjetaAgenda agenda={agenda} onCambio={onCambio} onAviso={onAviso} />}
    </div>
  );
}

function Codigos({ onAviso }: { onAviso: (m: string) => void }) {
  const [lista, setLista] = useState<CodigoAdmin[] | null>(null);
  const [codigo, setCodigo] = useState("");
  const [creador, setCreador] = useState("");
  const [meses, setMeses] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const d = await fetch("/api/admin/codigos", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setLista(d.codigos ?? []);
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const err = await api("/api/admin/codigos", "POST", { codigo, creador, meses_extra: meses });
    setEnviando(false);
    if (err) return setError(err);
    onAviso(`Código ${codigo.trim().toUpperCase()} creado.`);
    setCodigo("");
    setCreador("");
    setMeses(1);
    cargar();
  }

  async function alternar(c: CodigoAdmin) {
    const err = await api("/api/admin/codigos", "PATCH", { codigo: c.codigo, activo: !c.activo });
    if (err) return setError(err);
    cargar();
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={crear} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="font-semibold">Nuevo código de creador</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted">
          Quien lo use al crear su cuenta recibe meses gratis extra (sólo si su agenda empieza con mes gratis). Aquí ves cuántos llegan por cada creador.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Código</span>
            <input required className="campo uppercase placeholder:normal-case" placeholder="JENRRY" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\s+/g, ""))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">De quién es</span>
            <input required className="campo" placeholder="Jenrry · @suinstagram" value={creador} onChange={(e) => setCreador(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Meses extra</span>
            <select className="campo" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button className="btn btn-primario" disabled={enviando}>{enviando ? "Creando…" : "Crear código"}</button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        {!lista && <p className="p-4 text-sm text-muted">Cargando…</p>}
        {lista?.length === 0 && <p className="p-6 text-center text-sm text-muted">Aún no hay códigos.</p>}
        {lista?.map((c, i) => (
          <div key={c.codigo} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${i ? "border-t border-line" : ""} ${c.activo ? "" : "opacity-50"}`}>
            <span className="min-w-0 flex-1">
              <span className="block font-mono font-semibold">{c.codigo}</span>
              <span className="block truncate text-xs text-muted">{c.creador} · +{c.meses_extra} mes{c.meses_extra === 1 ? "" : "es"}</span>
            </span>
            <span className="text-sm tabular-nums">
              <b>{c.agendas}</b> <span className="text-muted">agenda{c.agendas === 1 ? "" : "s"} ·</span> <b>{c.enPrueba}</b> <span className="text-muted">en mes gratis ·</span> <b>{c.pagando}</b> <span className="text-muted">pagando</span>
              {c.agendas > 0 && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{Math.round((c.pagando / c.agendas) * 100)}% paga</span>}
            </span>
            <button className="btn btn-sec py-1 text-xs" onClick={() => alternar(c)}>{c.activo ? "Desactivar" : "Activar"}</button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TarjetaAgenda({ agenda, onCambio, onAviso }: { agenda: AgendaAdmin; onCambio: () => void; onAviso: (m: string) => void }) {
  const [nombre, setNombre] = useState(agenda.nombre);
  const [notas, setNotas] = useState(agenda.notas ?? "");
  const [borrando, setBorrando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dueno = agenda.miembros.find((m) => m.rol === "owner");

  async function guardar(cambios: { nombre?: string; notas?: string }) {
    const err = await api(`/api/admin/agendas/${agenda.id}`, "PATCH", cambios);
    if (err) setError(err);
    else onCambio();
  }

  async function accion(fn: () => Promise<string | null>, ok: string) {
    setTrabajando(true);
    setError(null);
    const err = await fn();
    setTrabajando(false);
    if (err) return setError(err);
    onAviso(ok);
    onCambio();
  }

  return (
    <section className="border-t border-line bg-panel-2/40 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0 flex-1">
          <input
            className="w-full rounded-md bg-transparent text-lg font-semibold outline-none focus:bg-panel-2 focus:px-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => nombre.trim() && nombre !== agenda.nombre && guardar({ nombre })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            title="Clic para renombrar"
          />
          <p className="text-xs text-muted">
            Creada el {fechaCorta(agenda.created_at)} · {agenda.citas} cita{agenda.citas === 1 ? "" : "s"}
          </p>
        </div>
        {!borrando && (
          <button className="btn btn-peligro text-xs" onClick={() => setBorrando(true)}>Eliminar agenda</button>
        )}
      </div>

      <input
        className="campo mb-4 text-sm"
        placeholder="Notas internas…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        onBlur={() => notas !== (agenda.notas ?? "") && guardar({ notas })}
      />

      <Suscripcion agenda={agenda} onCambio={onCambio} onAviso={onAviso} />

      <ul className="divide-y divide-line rounded-xl border border-line">
        {agenda.miembros.map((m) => (
          <FilaMiembro
            key={m.id}
            m={m}
            trabajando={trabajando}
            onHacerDueno={() => accion(() => api(`/api/admin/agendas/${agenda.id}/dueno`, "POST", { userId: m.id }), `${m.nombre} ahora es el dueño.`)}
            onReenviar={() => accion(() => api(`/api/admin/agendas/${agenda.id}/reenviar`, "POST", { userId: m.id }), `Invitación reenviada a ${m.email}.`)}
          />
        ))}
        {agenda.miembros.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin miembros.</li>}
      </ul>

      {!dueno && (
        <div className="mt-3 rounded-xl bg-[#fdf6e3] p-3 text-sm text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]">
          <p className="font-medium">Esta agenda no tiene dueño.</p>
          <p className="mt-1">
            {agenda.miembros.some((m) => !m.pendiente)
              ? "Usa “Hacer dueño” en la persona correcta."
              : "Ya nadie la usa: puedes eliminarla. Las cuentas nuevas se registran solas en /registro."}
          </p>
        </div>
      )}

      {borrando && (
        <div className="mt-4 rounded-xl bg-[#fbecea] p-4 text-sm text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]">
          <p className="mb-2">
            Se borrarán <b>las cuentas de sus {agenda.miembros.length} miembro{agenda.miembros.length === 1 ? "" : "s"}</b>, sus <b>{agenda.citas} citas</b>, clínicas y materias. No se puede deshacer.
          </p>
          <p className="mb-2">Escribe <b>{agenda.nombre}</b> para confirmar:</p>
          <input className="campo mb-3" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
          <div className="flex gap-2">
            <button
              className="btn bg-danger text-panel"
              disabled={confirmacion !== agenda.nombre || trabajando}
              onClick={() => accion(() => api(`/api/admin/agendas/${agenda.id}`, "DELETE"), `Agenda “${agenda.nombre}” eliminada.`)}
            >
              {trabajando ? "Borrando…" : "Eliminar para siempre"}
            </button>
            <button className="btn btn-sec" onClick={() => { setBorrando(false); setConfirmacion(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}

function FilaMiembro({ m, trabajando, onHacerDueno, onReenviar }: { m: Miembro; trabajando: boolean; onHacerDueno: () => void; onReenviar: () => void }) {
  const esDueno = m.rol === "owner";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${esDueno ? "bg-accent text-panel" : "bg-panel-2 text-muted"}`}>
        {esDueno ? "Dueño" : "Compañero"}
      </span>
      <div className="mr-auto min-w-0">
        <p className="truncate text-sm font-medium">{m.pendiente ? m.email : m.nombre}</p>
        <p className="truncate text-xs text-muted">
          {m.pendiente ? "Invitación pendiente" : `${m.email} · ${m.citas} cita${m.citas === 1 ? "" : "s"} · ${hace(m.ultimoAcceso)}`}
        </p>
      </div>
      {m.pendiente && (
        <button className="btn btn-sec py-1 text-xs" disabled={trabajando} onClick={onReenviar}>Reenviar invitación</button>
      )}
      {!esDueno && !m.pendiente && (
        <button className="btn btn-sec py-1 text-xs" disabled={trabajando} onClick={onHacerDueno}>Hacer dueño</button>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* PAGOS                                                                */
/* ------------------------------------------------------------------ */

function insigniaPago(pagadoHasta: string | null) {
  const e = estadoPago(pagadoHasta, hoyISO());
  switch (e.tipo) {
    case "cortesia":
      return { t: "Cortesía", c: "bg-panel-2 text-muted" };
    case "activa":
      return { t: `Pagada hasta ${fechaLarga(e.vence)}`, c: "bg-accent-soft text-accent" };
    case "por_vencer":
      return { t: e.dias === 0 ? "Vence hoy" : `Vence en ${e.dias} día${e.dias === 1 ? "" : "s"}`, c: "bg-[#fdf6e3] text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]" };
    case "gracia":
      return { t: `Vencida · se bloquea el ${fechaLarga(e.bloqueo)}`, c: "bg-[#fbecea] text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]" };
    default:
      return { t: "Vencida · sólo lectura", c: "bg-[#fbecea] text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]" };
  }
}

function AvisosPago({ avisos, agendas, onCambio }: { avisos: AvisoAdmin[]; agendas: AgendaAdmin[]; onCambio: (m: string) => void }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porDescartar, setPorDescartar] = useState<string | null>(null);

  async function confirmar(v: AvisoAdmin) {
    if (trabajando) return; // evita doble clic
    const agenda = agendas.find((a) => a.id === v.agenda_id);
    setTrabajando(v.id);
    setError(null);
    const err = await api(`/api/admin/agendas/${v.agenda_id}/pagos`, "POST", {
      monto: v.monto ?? agenda?.precio_mensual ?? 0,
      meses: 1,
      metodo: "spei",
      referencia: v.referencia,
      avisoId: v.id,
    });
    setTrabajando(null);
    if (err) return setError(err);
    onCambio(`Pago de “${v.agenda}” confirmado: +1 mes. Le avisamos por correo.`);
  }

  async function descartar(v: AvisoAdmin) {
    if (trabajando) return;
    setTrabajando(v.id);
    const err = await api(`/api/admin/avisos/${v.id}`, "PATCH");
    setTrabajando(null);
    if (err) return setError(err);
    setPorDescartar(null);
    onCambio(`Le avisamos a “${v.agenda}” que su pago no se ha reflejado.`);
  }

  return (
    <section className="mb-5 rounded-2xl border-2 border-accent bg-panel p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs text-panel">{avisos.length}</span>
        Avisos de pago por confirmar
      </h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">Revisa en tu banco que haya llegado la transferencia (busca el concepto) y confírmala.</p>
      <ul className="flex flex-col gap-2">
        {avisos.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
            <div className="mr-auto min-w-0">
              <p className="font-medium">
                {v.agenda} <span className="text-xs font-normal text-muted">· concepto {codigoAgenda(v.agenda_id)}</span>
              </p>
              <p className="text-sm text-muted">
                {v.quien ?? "El dueño"} · {v.monto != null ? pesos(v.monto) : "monto no indicado"} · {fechaLarga(v.created_at.slice(0, 10))}
                {v.referencia ? ` · rastreo ${v.referencia}` : ""}
              </p>
            </div>
            <button className="btn btn-primario py-1.5 text-sm" disabled={trabajando === v.id} onClick={() => confirmar(v)}>
              Confirmar (+1 mes)
            </button>
            {porDescartar === v.id ? (
              <>
                <button className="btn bg-danger py-1.5 text-sm text-panel" disabled={trabajando === v.id} onClick={() => descartar(v)}>
                  Sí, avisarle que no llegó
                </button>
                <button className="btn btn-sec py-1.5 text-sm" onClick={() => setPorDescartar(null)}>Cancelar</button>
              </>
            ) : (
              <button className="btn btn-sec py-1.5 text-sm" disabled={trabajando === v.id} onClick={() => setPorDescartar(v.id)}>
                No llegó
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function DatosBancarios({ onAviso }: { onAviso: (m: string) => void }) {
  const [abierto, setAbierto] = useState(true);
  const [d, setD] = useState({ banco: "", clabe: "", titular: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const p = j.pago ?? {};
        setD({ banco: p.banco ?? "", clabe: p.clabe ?? "", titular: p.titular ?? "" });
        if (!p.clabe) setAbierto(true);
      })
      .catch(() => {});
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = await api("/api/admin/config", "PUT", d);
    if (err) return setError(err);
    onAviso("Datos bancarios guardados. Tus clientes ya los ven en su agenda.");
    setAbierto(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setAbierto(!abierto)}>
        <span>
          <span className="block font-semibold">Datos para recibir pagos</span>
          <span className="block text-sm text-muted">
            {d.clabe ? `${d.banco || "Banco"} · CLABE terminación ${d.clabe.slice(-4)} · ${d.titular}` : "Aún no los configuras: tus clientes no verán a dónde transferir."}
          </span>
        </span>
        <span className="text-muted">{abierto ? "▲" : "▼"}</span>
      </button>
      {abierto && (
        <form onSubmit={guardar} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Banco</span>
            <input className="campo" value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })} placeholder="Ej. BBVA" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">CLABE (18 dígitos)</span>
            <input className="campo tabular-nums" inputMode="numeric" value={d.clabe} onChange={(e) => setD({ ...d, clabe: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Beneficiario</span>
            <input className="campo" value={d.titular} onChange={(e) => setD({ ...d, titular: e.target.value })} placeholder="Nombre como aparece en tu banco" />
          </label>
          {error && <p className="text-sm text-danger sm:col-span-3">{error}</p>}
          <div className="flex justify-end sm:col-span-3">
            <button className="btn btn-primario">Guardar</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Suscripcion({ agenda, onCambio, onAviso }: { agenda: AgendaAdmin; onCambio: () => void; onAviso: (m: string) => void }) {
  const [registrando, setRegistrando] = useState(false);
  const [monto, setMonto] = useState(agenda.precio_mensual);
  const [meses, setMeses] = useState(1);
  const [metodo, setMetodo] = useState("efectivo");
  const [referencia, setReferencia] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const ins = insigniaPago(agenda.pagado_hasta);
  const corta = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]}`;
  };

  async function correr(fn: () => Promise<string | null>, ok: string): Promise<boolean> {
    if (trabajando) return false; // evita doble clic
    setTrabajando(true);
    setError(null);
    const err = await fn();
    setTrabajando(false);
    if (err) {
      setError(err);
      return false;
    }
    onAviso(ok);
    onCambio();
    return true;
  }

  return (
    <div className="mb-4 rounded-xl border border-line p-3">
      {/* Encabezado: estado */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Suscripción</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ins.c}`}>{ins.t}</span>
        <span className="text-xs text-muted">
          {pesos(agenda.precio_mensual)}/mes · concepto {codigoAgenda(agenda.id)}
        </span>
      </div>

      {/* Acciones, con explicación */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-panel-2 p-2.5">
          <button className="btn btn-primario w-full py-1.5 text-sm" disabled={registrando} onClick={() => setRegistrando(true)}>
            Registrar pago
          </button>
          <p className="mt-1.5 text-xs text-muted">
            Sólo si te pagan <b>por fuera</b> del botón “Ya pagué” (efectivo, o varios meses de golpe). Los avisos “Ya pagué” se confirman arriba.
          </p>
        </div>
        <div className="rounded-lg bg-panel-2 p-2.5">
          {agenda.pagado_hasta ? (
            <button
              className="btn btn-sec w-full py-1.5 text-sm"
              disabled={trabajando}
              onClick={() => correr(() => api(`/api/admin/agendas/${agenda.id}`, "PATCH", { pagado_hasta: null }), `“${agenda.nombre}” ahora es cortesía.`)}
            >
              Hacer cortesía
            </button>
          ) : (
            <button
              className="btn btn-sec w-full py-1.5 text-sm"
              disabled={trabajando}
              onClick={() =>
                correr(
                  () => api(`/api/admin/agendas/${agenda.id}`, "PATCH", { pagado_hasta: sumarDias(hoyISO(), 7) }),
                  `“${agenda.nombre}” ahora cobra: vence en 7 días.`
                )
              }
            >
              Empezar a cobrar
            </button>
          )}
          <p className="mt-1.5 text-xs text-muted">
            {agenda.pagado_hasta
              ? "La agenda deja de vencer y nunca se le cobra (amigos, familia…)."
              : "Quita la cortesía: le da 7 días y después empieza a vencer normal."}
          </p>
        </div>
      </div>

      {registrando && (
        <form
          className="mt-3 grid gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            correr(
              () => api(`/api/admin/agendas/${agenda.id}/pagos`, "POST", { monto, meses, metodo, referencia }),
              `Pago registrado para “${agenda.nombre}”. Le avisamos por correo.`
            ).then((ok) => ok && setRegistrando(false));
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Monto</span>
            <input type="number" min={0} className="campo py-1.5" value={monto} onChange={(e) => setMonto(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Meses que paga</span>
            <input type="number" min={1} max={24} className="campo py-1.5" value={meses} onChange={(e) => setMeses(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Método</span>
            <select className="campo py-1.5" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="spei">SPEI</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Referencia</span>
            <input className="campo py-1.5" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" />
          </label>
          <div className="flex items-end gap-2">
            <button className="btn btn-primario flex-1 py-1.5 text-sm" disabled={trabajando}>{trabajando ? "…" : "Guardar"}</button>
            <button type="button" className="btn btn-sec py-1.5 text-sm" onClick={() => setRegistrando(false)}>✕</button>
          </div>
        </form>
      )}

      {/* Historial */}
      <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted">Historial de pagos</p>
      {agenda.pagos.length === 0 ? (
        <p className="text-xs text-muted">Todavía no hay pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {agenda.pagos.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-medium tabular-nums">{pesos(p.monto)}</span>
              <span className="text-muted">
                {p.meses} mes{p.meses === 1 ? "" : "es"} · cubre del {corta(p.cubre_desde)} al {corta(p.cubre_hasta)}
              </span>
              <span className="text-xs text-muted">
                · {p.metodo.toUpperCase()} · registrado el {corta(p.created_at.slice(0, 10))}
                {p.referencia ? ` · ${p.referencia}` : ""}
              </span>
              {i === 0 && (
                <span className="ml-auto">
                  {anulando === p.id ? (
                    <>
                      <button
                        className="btn btn-peligro py-0.5 text-xs"
                        disabled={trabajando}
                        onClick={() =>
                          correr(
                            () => api(`/api/admin/agendas/${agenda.id}/pagos?pago=${p.id}`, "DELETE"),
                            `Pago anulado. “${agenda.nombre}” vuelve a vencer el ${fechaLarga(sumarDias(p.cubre_desde, -1))}.`
                          ).then(() => setAnulando(null))
                        }
                      >
                        ¿Anular? Sí
                      </button>
                      <button className="btn btn-sec ml-1 py-0.5 text-xs" onClick={() => setAnulando(null)}>No</button>
                    </>
                  ) : (
                    <button className="btn btn-peligro py-0.5 text-xs" title="Deshacer este pago (por si fue un error)" onClick={() => setAnulando(p.id)}>
                      Anular
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
