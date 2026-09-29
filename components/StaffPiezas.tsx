"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgendaAdmin } from "@/lib/admin";
import type { AnuncioAdmin, CuentaAdmin, SugerenciaAdmin } from "@/lib/staff";
import type { Precios } from "@/lib/precios";
import { diasEntre, estadoPago, pesos, sumarDias } from "@/lib/pagos";
import { fechaLarga, hoyISO } from "@/lib/fechas";
import { diasSinEntrar, enPruebaViva, hace, InsigniaUni, pagando, DIAS_FANTASMA } from "@/components/TableroAdmin";

// Piezas nuevas del panel de staff (1.8): embudo, cuentas a medias, cobros que vienen, buzón, anuncios y precios.

async function api(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: Record<string, unknown> }> {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  return { error: r.ok ? null : (data.error as string) ?? "Algo falló.", data };
}

const Tarjeta = ({ titulo, extra, children, className = "" }: { titulo: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-semibold">{titulo}</h2>
      {extra}
    </div>
    {children}
  </section>
);

function Chips<T extends string>({ opciones, valor, onCambio }: { opciones: [T, string][]; valor: T; onCambio: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(([id, t]) => (
        <button
          key={id}
          type="button"
          onClick={() => onCambio(id)}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${valor === id ? "border-ink bg-ink text-panel" : "border-line text-muted hover:text-ink"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ---------------- embudo ---------------- */

/** De registrarse a pagar: dónde se cae la gente. */
export function Embudo({ cuentas, agendas }: { cuentas: CuentaAdmin[]; agendas: AgendaAdmin[] }) {
  const [periodo, setPeriodo] = useState<"30" | "90" | "todo">("30");
  const pasos = useMemo(() => {
    const desde = periodo === "todo" ? "" : new Date(Date.now() - Number(periodo) * 86400000).toISOString();
    const gente = cuentas.filter((c) => c.created_at >= desde);
    const agenda = new Map(agendas.map((a) => [a.id, a]));
    const miembro = new Map(agendas.flatMap((a) => a.miembros.map((m) => [m.id, m] as const)));
    const conAgenda = gente.filter((c) => c.agenda_id && agenda.has(c.agenda_id));
    const primeraCita = conAgenda.filter((c) => (miembro.get(c.id)?.citas ?? 0) > 0);
    const conPareja = conAgenda.filter((c) => (agenda.get(c.agenda_id!)?.miembros.length ?? 0) >= 2);
    const pagaron = conAgenda.filter((c) => agenda.get(c.agenda_id!)?.pagada);
    return [
      { t: "Se registraron", n: gente.length, d: "Crearon su cuenta" },
      { t: "Confirmaron su correo", n: gente.filter((c) => c.confirmada).length, d: "Metieron el código de 6 dígitos" },
      { t: "Entraron a una agenda", n: conAgenda.length, d: "La suya o la de su compa" },
      { t: "Agendaron su 1ª cita", n: primeraCita.length, d: "Ya la están usando" },
      { t: "Su agenda tiene pareja", n: conPareja.length, d: "Invitaron (o se unieron) a su compa" },
      { t: "Su agenda ya pagó", n: pagaron.length, d: "Al menos un pago registrado" },
    ];
  }, [cuentas, agendas, periodo]);
  const base = pasos[0].n || 1;
  // El salto más grande (sin contar el primero): ahí hay que meterle
  let peor = -1;
  let peorCaida = 0;
  for (let i = 1; i < pasos.length; i++) {
    const caida = pasos[i - 1].n - pasos[i].n;
    if (caida > peorCaida) { peorCaida = caida; peor = i; }
  }
  return (
    <Tarjeta
      titulo="Embudo: de registrarse a pagar"
      extra={<Chips opciones={[["30", "30 días"], ["90", "90 días"], ["todo", "Todo"]]} valor={periodo} onCambio={setPeriodo} />}
    >
      {pasos[0].n === 0 ? (
        <p className="text-sm text-muted">Nadie se ha registrado en este periodo.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {pasos.map((p, i) => {
            const pct = Math.round((p.n / base) * 100);
            const caida = i > 0 ? pasos[i - 1].n - p.n : 0;
            return (
              <li key={p.t}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{p.t}</span>
                  <span className="tabular-nums">
                    <b>{p.n}</b> <span className="text-muted">· {pct}%</span>
                    {caida > 0 && <span className={`ml-1.5 text-xs ${i === peor ? "font-semibold text-danger" : "text-muted"}`}>−{caida}</span>}
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-panel-2">
                  <div className={`h-full rounded-full ${i === peor ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.max(pct, p.n ? 2 : 0)}%` }} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted">{p.d}</p>
              </li>
            );
          })}
        </ol>
      )}
      {peor > 0 && (
        <p className="mt-3 rounded-xl bg-[#fbecea] px-3 py-2 text-xs text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]">
          Donde más se caen: entre <b>{pasos[peor - 1].t.toLowerCase()}</b> y <b>{pasos[peor].t.toLowerCase()}</b> ({peorCaida} persona{peorCaida === 1 ? "" : "s"}).
        </p>
      )}
    </Tarjeta>
  );
}

/* ---------------- cuentas a medias ---------------- */

export const cuentasAMedias = (cuentas: CuentaAdmin[]) => cuentas.filter((c) => !c.agenda_id);

/** Gente que ya casi era cliente: no metió su código o no tiene agenda. */
export function CuentasAMedias({ cuentas, onCambio, onAviso }: { cuentas: CuentaAdmin[]; onCambio: () => void; onAviso: (m: string) => void }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const medias = cuentasAMedias(cuentas);
  const sinCodigo = medias.filter((c) => !c.confirmada);
  const sinAgenda = medias.filter((c) => c.confirmada);

  async function recordar(c: CuentaAdmin) {
    setTrabajando(c.id);
    setError(null);
    const r = await api(`/api/admin/cuentas/${c.id}`, "POST");
    setTrabajando(null);
    if (r.error) return setError(r.error);
    onAviso(r.data.tipo === "codigo" ? `Le reenviamos su código a ${c.email}.` : `Le escribimos a ${c.email} para que termine su agenda.`);
    onCambio();
  }
  async function eliminar(c: CuentaAdmin) {
    setTrabajando(c.id);
    const r = await api(`/api/admin/cuentas/${c.id}`, "DELETE");
    setTrabajando(null);
    setBorrar(null);
    if (r.error) return setError(r.error);
    onAviso(`Cuenta de ${c.email} borrada.`);
    onCambio();
  }

  const Grupo = ({ titulo, detalle, lista, boton }: { titulo: string; detalle: string; lista: CuentaAdmin[]; boton: string }) => (
    <Tarjeta titulo={<>{titulo} <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-xs text-panel tabular-nums">{lista.length}</span></>}>
      <p className="-mt-2 mb-3 text-sm text-muted">{detalle}</p>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Nadie. Bien.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {lista.map((c) => {
            const dias = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <div className="mr-auto min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{c.nombre}</span>
                    {c.universidad && <InsigniaUni uni={c.universidad} />}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {c.email} · se registró {dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`}
                    {c.recordadoAt && ` · le recordaste ${hace(c.recordadoAt).replace("entró ", "")}`}
                  </p>
                </div>
                {borrar === c.id ? (
                  <>
                    <button className="btn bg-danger py-1 text-xs text-panel" disabled={trabajando === c.id} onClick={() => eliminar(c)}>Sí, borrar</button>
                    <button className="btn btn-sec py-1 text-xs" onClick={() => setBorrar(null)}>No</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sec py-1 text-xs" disabled={trabajando === c.id} onClick={() => recordar(c)}>{trabajando === c.id ? "…" : boton}</button>
                    <button className="px-1.5 text-xs text-muted hover:text-danger" onClick={() => setBorrar(c.id)} title="Borrar la cuenta (su mes gratis queda registrado)">Borrar</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <Grupo titulo="No metieron su código" detalle="Se registraron pero nunca confirmaron su correo. “Reenviar código” les manda uno nuevo." lista={sinCodigo} boton="Reenviar código" />
      <Grupo titulo="Confirmaron pero no tienen agenda" detalle="Tienen cuenta y no terminaron (o los quitaron de una agenda). “Recordarle” les manda un correo para que la terminen." lista={sinAgenda} boton="Recordarle" />
    </div>
  );
}

/* ---------------- cobros que vienen ---------------- */

type Cobro = { agenda: AgendaAdmin; fecha: string; monto: number; tipo: "renueva" | "prueba" | "gracia"; riesgo: boolean };

/** Lo que deberías cobrar en los próximos 30 días. */
export function CobrosQueVienen({ agendas, onVer }: { agendas: AgendaAdmin[]; onVer: (id: string) => void }) {
  const hoy = hoyISO();
  const limite = sumarDias(hoy, 30);
  const cobros: Cobro[] = [];
  for (const a of agendas) {
    if (!a.pagado_hasta) continue; // cortesía
    const t = estadoPago(a.pagado_hasta, hoy).tipo;
    const dias = diasSinEntrar(a);
    const riesgo = dias != null && dias >= DIAS_FANTASMA;
    if (t === "gracia") cobros.push({ agenda: a, fecha: hoy, monto: a.precio_mensual, tipo: "gracia", riesgo });
    else if (a.pagado_hasta >= hoy && a.pagado_hasta <= limite) {
      if (enPruebaViva(a, hoy)) cobros.push({ agenda: a, fecha: sumarDias(a.pagado_hasta, 1), monto: a.precio_mensual, tipo: "prueba", riesgo });
      else if (pagando(a, hoy)) cobros.push({ agenda: a, fecha: sumarDias(a.pagado_hasta, 1), monto: a.precio_mensual, tipo: "renueva", riesgo });
    }
  }
  cobros.sort((x, y) => x.fecha.localeCompare(y.fecha));
  const suma = (f: (c: Cobro) => boolean) => cobros.filter(f).reduce((n, c) => n + c.monto, 0);
  const TIPO = { renueva: "Renueva", prueba: "Termina su mes gratis", gracia: "Vencida (en gracia)" };

  return (
    <Tarjeta titulo="Cobros que vienen (30 días)">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Renovaciones", suma((c) => c.tipo !== "prueba"), "text-accent"],
          ["Si pagan tras su prueba", suma((c) => c.tipo === "prueba"), ""],
          ["En riesgo", suma((c) => c.riesgo), "text-danger"],
        ].map(([t, v, c]) => (
          <div key={t as string} className="rounded-xl bg-panel-2 px-2 py-2">
            <p className={`text-lg font-semibold tabular-nums ${c}`}>{pesos(v as number)}</p>
            <p className="text-[11px] text-muted">{t}</p>
          </div>
        ))}
      </div>
      {cobros.length === 0 ? (
        <p className="text-sm text-muted">Nada que cobrar en los próximos 30 días.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
          {cobros.map((c) => (
            <li key={c.agenda.id}>
              <button onClick={() => onVer(c.agenda.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-panel-2">
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted">{c.tipo === "gracia" ? "ya" : diasEntre(hoy, c.fecha) === 0 ? "hoy" : `en ${diasEntre(hoy, c.fecha)} d`}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="truncate font-medium">{c.agenda.nombre}</span><InsigniaUni uni={c.agenda.universidad} /></span>
                  <span className={`block text-xs ${c.riesgo ? "font-medium text-danger" : "text-muted"}`}>
                    {TIPO[c.tipo]}{c.riesgo ? ` · no entran hace ${diasSinEntrar(c.agenda)} días` : ""}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{pesos(c.monto)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ---------------- buzón ---------------- */

export function Buzon({ sugerencias, onCambio }: { sugerencias: SugerenciaAdmin[]; onCambio: () => void }) {
  const [filtro, setFiltro] = useState<"nueva" | "todas" | "hecha">("nueva");
  const [error, setError] = useState<string | null>(null);
  const lista = sugerencias.filter((s) => filtro === "todas" || s.estado === filtro || (filtro === "nueva" && s.estado === "nueva"));
  const n = (e: string) => sugerencias.filter((s) => s.estado === e).length;

  async function estado(s: SugerenciaAdmin, e: SugerenciaAdmin["estado"]) {
    const r = await api(`/api/admin/sugerencias/${s.id}`, "PATCH", { estado: e });
    if (r.error) return setError(r.error);
    onCambio();
  }
  async function borrar(s: SugerenciaAdmin) {
    const r = await api(`/api/admin/sugerencias/${s.id}`, "DELETE");
    if (r.error) return setError(r.error);
    onCambio();
  }

  return (
    <Tarjeta
      titulo="Buzón: ¿qué le falta a su agenda?"
      extra={<Chips opciones={[["nueva", `Nuevas · ${n("nueva")}`], ["hecha", `Hechas · ${n("hecha")}`], ["todas", `Todas · ${sugerencias.length}`]]} valor={filtro} onCambio={setFiltro} />}
    >
      <p className="-mt-2 mb-3 text-sm text-muted">Lo que escriben desde “¿Qué le falta a tu agenda?”, abajo de su agenda o en el menú del celular.</p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{filtro === "nueva" ? "Nada nuevo en el buzón." : "Vacío."}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((s) => (
            <li key={s.id} className={`rounded-xl border p-3 ${s.estado === "nueva" ? "border-accent bg-accent-soft/40" : "border-line"}`}>
              <p className="whitespace-pre-line text-sm">{s.texto}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                {s.universidad && <InsigniaUni uni={s.universidad} />}
                <span>{s.nombre}{s.agenda ? ` · ${s.agenda}` : ""} · {fechaLarga(s.created_at.slice(0, 10))}</span>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {s.email && (
                    <a className="btn btn-sec px-2 py-0.5 text-xs" href={`mailto:${s.email}?subject=${encodeURIComponent("Sobre tu sugerencia para la Agenda de clínicas")}&body=${encodeURIComponent(`Hola ${s.nombre.split(" ")[0]}:\n\nGracias por escribirnos. Sobre lo que nos dijiste:\n“${s.texto.slice(0, 300)}”\n\n`)}`}>
                      Responder
                    </a>
                  )}
                  {s.estado !== "hecha" && <button className="btn btn-sec px-2 py-0.5 text-xs" onClick={() => estado(s, "hecha")}>Ya lo hice</button>}
                  {s.estado === "nueva" && <button className="btn btn-sec px-2 py-0.5 text-xs" onClick={() => estado(s, "leida")}>Leída</button>}
                  {s.estado !== "nueva" && <button className="btn btn-sec px-2 py-0.5 text-xs" onClick={() => estado(s, "nueva")}>Marcar nueva</button>}
                  <button className="px-1 text-xs text-muted hover:text-danger" onClick={() => borrar(s)}>Borrar</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ---------------- anuncios ---------------- */

export function AnunciosAdmin({ agendas, onAviso }: { agendas: AgendaAdmin[]; onAviso: (m: string) => void }) {
  const [lista, setLista] = useState<AnuncioAdmin[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [uni, setUni] = useState<"todas" | "upp" | "uady">("todas");
  const [hasta, setHasta] = useState("");
  const [correo, setCorreo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    const r = await api("/api/admin/anuncios", "GET");
    setLista((r.data.anuncios as AnunciosAdminLista) ?? []);
  };
  useEffect(() => {
    cargar();
  }, []);

  const alcance = agendas.filter((a) => uni === "todas" || a.universidad === uni).reduce((n, a) => n + a.miembros.filter((m) => !m.pendiente).length, 0);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await api("/api/admin/anuncios", "POST", { titulo, texto, universidad: uni, hasta: hasta || null, correo });
    setEnviando(false);
    if (r.error) return setError(r.error);
    onAviso(r.data.errorCorreo ? `Publicado, pero el correo falló: ${r.data.errorCorreo}` : correo ? `Publicado y enviado a ${r.data.correos} persona${r.data.correos === 1 ? "" : "s"}.` : "Publicado en las agendas.");
    setTitulo("");
    setTexto("");
    setHasta("");
    setCorreo(false);
    cargar();
  }
  async function alternar(a: AnuncioAdmin) {
    const r = await api(`/api/admin/anuncios/${a.id}`, "PATCH", { activo: !a.activo });
    if (r.error) return setError(r.error);
    cargar();
  }
  async function borrar(a: AnuncioAdmin) {
    const r = await api(`/api/admin/anuncios/${a.id}`, "DELETE");
    if (r.error) return setError(r.error);
    cargar();
  }
  const hoy = hoyISO();

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
      <Tarjeta titulo="Nuevo anuncio">
        <form onSubmit={publicar} className="flex flex-col gap-2.5">
          <input className="campo" placeholder="Título (ej. ¡Ya salió la versión 1.9!)" maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <textarea className="campo min-h-[100px]" placeholder="Qué les quieres decir…" maxLength={600} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div>
            <p className="mb-1 text-xs font-medium text-muted">¿A quién?</p>
            <Chips opciones={[["todas", "Todas"], ["upp", "Sólo UPP"], ["uady", "Sólo UADY"]]} valor={uni} onCambio={setUni} />
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Se quita solo el</span>
            <input type="date" className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-sm" min={hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <span className="text-xs text-muted">(vacío = hasta que lo apagues)</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={correo} onChange={(e) => setCorreo(e.target.checked)} />
            <span>También mandarlo por <b>correo</b> <span className="text-muted">({alcance} persona{alcance === 1 ? "" : "s"})</span></span>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="btn btn-primario" disabled={enviando || !titulo.trim() || !texto.trim()}>{enviando ? "Publicando…" : "Publicar"}</button>
          <p className="text-xs text-muted">Sale arriba de su agenda hasta que lo cierren. Cada quien lo cierra una vez.</p>
        </form>
      </Tarjeta>
      <Tarjeta titulo="Publicados">
        {!lista ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted">Aún no publicas nada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((a) => {
              const vencido = !!a.hasta && a.hasta < hoy;
              const vivo = a.activo && !vencido;
              return (
                <li key={a.id} className={`rounded-xl border p-3 ${vivo ? "border-accent" : "border-line opacity-70"}`}>
                  <p className="flex items-center gap-1.5 font-medium">
                    {a.titulo}
                    {a.universidad !== "todas" && <InsigniaUni uni={a.universidad} />}
                  </p>
                  <p className="whitespace-pre-line text-sm text-muted">{a.texto}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{vivo ? "Visible" : vencido ? "Vencido" : "Apagado"} · {fechaLarga(a.created_at.slice(0, 10))}{a.hasta ? ` · hasta ${fechaLarga(a.hasta)}` : ""}{a.correos ? ` · ${a.correos} correos` : ""}</span>
                    <span className="ml-auto flex gap-1.5">
                      {!vencido && <button className="btn btn-sec px-2 py-0.5 text-xs" onClick={() => alternar(a)}>{a.activo ? "Apagar" : "Prender"}</button>}
                      <button className="px-1 text-xs hover:text-danger" onClick={() => borrar(a)}>Borrar</button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
type AnunciosAdminLista = AnuncioAdmin[];

/* ---------------- precios ---------------- */

export function PreciosUni({ agendas, onAviso, onCambio }: { agendas: AgendaAdmin[]; onAviso: (m: string) => void; onCambio: () => void }) {
  const [p, setP] = useState<Precios | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aplicar, setAplicar] = useState<"upp" | "uady" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/admin/config", "GET").then((r) => setP(r.data.precios as Precios));
  }, []);

  if (!p) return <Tarjeta titulo="Precios por universidad"><p className="text-sm text-muted">Cargando…</p></Tarjeta>;

  const cambiar = (u: "upp" | "uady", campo: "mensual" | "anual", v: string) =>
    setP({ ...p, [u]: { ...p[u], [campo]: campo === "anual" && v === "" ? null : Number(v) } });

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await api("/api/admin/config", "PUT", { precios: p });
    setGuardando(false);
    if (r.error) return setError(r.error);
    onAviso("Precios guardados. Las agendas nuevas ya los toman.");
  }
  async function aplicarA(u: "upp" | "uady") {
    const r = await api("/api/admin/precios", "POST", { universidad: u });
    setAplicar(null);
    if (r.error) return setError(r.error);
    onAviso(`${r.data.agendas} agenda${r.data.agendas === 1 ? "" : "s"} de la ${u.toUpperCase()} ahora pagan ${pesos(r.data.precio as number)} al mes.`);
    onCambio();
  }

  return (
    <Tarjeta titulo="Precios por universidad">
      <p className="-mt-2 mb-3 text-sm text-muted">Las agendas <b>nuevas</b> toman el mensual de su universidad. Si activas el plan anual, el dueño puede pagar 12 meses de un jalón.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["upp", "uady"] as const).map((u) => {
          const existentes = agendas.filter((a) => a.universidad === u && a.pagado_hasta);
          const distintas = existentes.filter((a) => a.precio_mensual !== p[u].mensual).length;
          const ahorro = p[u].anual ? p[u].mensual * 12 - p[u].anual! : 0;
          return (
            <div key={u} className="rounded-xl border border-line p-3">
              <p className="mb-2"><InsigniaUni uni={u} /></p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <span className="w-20 text-muted">Mensual</span>
                <span className="text-muted">$</span>
                <input type="number" min={0} className="campo py-1" style={{ width: "7rem" }} value={p[u].mensual} onChange={(e) => cambiar(u, "mensual", e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={p[u].anual != null} onChange={(e) => cambiar(u, "anual", e.target.checked ? String(p[u].mensual * 10) : "")} />
                <span className="w-16 text-muted">Anual</span>
                {p[u].anual != null && (
                  <>
                    <span className="text-muted">$</span>
                    <input type="number" min={1} className="campo py-1" style={{ width: "7rem" }} value={p[u].anual ?? ""} onChange={(e) => cambiar(u, "anual", e.target.value)} />
                  </>
                )}
              </label>
              {p[u].anual != null && <p className="mt-1 text-xs text-muted">{ahorro > 0 ? `Se ahorran ${pesos(ahorro)} contra pagar mes por mes.` : "Ojo: no sale más barato que pagar mes por mes."}</p>}
              {distintas > 0 && (
                <div className="mt-3 border-t border-line pt-2 text-xs">
                  {aplicar === u ? (
                    <span className="flex flex-wrap items-center gap-2">
                      ¿Cambiar a {pesos(p[u].mensual)} las {distintas} agenda{distintas === 1 ? "" : "s"}? (guarda primero)
                      <button className="btn bg-danger px-2 py-0.5 text-xs text-panel" onClick={() => aplicarA(u)}>Sí</button>
                      <button className="btn btn-sec px-2 py-0.5 text-xs" onClick={() => setAplicar(null)}>No</button>
                    </span>
                  ) : (
                    <button className="text-accent hover:underline" onClick={() => setAplicar(u)}>
                      {distintas} agenda{distintas === 1 ? "" : "s"} de ya paga{distintas === 1 ? "" : "n"} otro precio · aplicar este
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button className="btn btn-primario mt-3" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar precios"}</button>
    </Tarjeta>
  );
}
