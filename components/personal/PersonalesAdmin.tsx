"use client";

import { useCallback, useEffect, useState } from "react";
import type { PersonalAdmin, SolicitudAdmin } from "@/lib/personalServer";
import type { AvisoMiAdmin } from "@/lib/planMiServer";
import { normalizarPlanesMi, type EstadoMi, type PlanMi } from "@/lib/planMi";
import { pesos } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";

const hace = (iso: string | null) => {
  if (!iso) return "nunca";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
};

/** Panel de staff → Personales: quién tiene agenda personal (sólo invitados). */
export default function PersonalesAdmin({ onAviso }: { onAviso: (m: string) => void }) {
  const [lista, setLista] = useState<PersonalAdmin[] | null>(null);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviar, setEnviar] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudAdmin[]>([]);
  const [avisos, setAvisos] = useState<AvisoMiAdmin[]>([]);
  const [pago, setPago] = useState<{ id: string; meses: number; monto: string } | null>(null);
  const [perfil, setPerfil] = useState<"" | "odonto" | "general">("");

  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/personales", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setLista(d.personales);
    else setError(d.error ?? "No se pudo cargar.");
    const rs = await fetch("/api/admin/personales/solicitudes", { cache: "no-store" });
    if (rs.ok) setSolicitudes((await rs.json()).solicitudes ?? []);
    const ra = await fetch("/api/admin/personales/avisos", { cache: "no-store" });
    if (ra.ok) setAvisos((await ra.json()).avisos ?? []);
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function llamar(url: string, method: string, body: unknown, ok: string, clave: string) {
    setOcupado(clave);
    setError(null);
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    setOcupado(null);
    if (!r.ok || d.error) setError(d.error ?? `Error ${r.status}`);
    if (r.ok) onAviso(ok);
    cargar();
    return r.ok;
  }

  async function alta(e: React.FormEvent) {
    e.preventDefault();
    const ok = await llamar("/api/admin/personales", "POST", { email, nombre, enviar, perfil: perfil || undefined }, enviar ? `Alta lista y link enviado a ${email.trim()}.` : `Alta lista: ${email.trim()}.`, "alta");
    if (ok) {
      setEmail("");
      setNombre("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {avisos.length > 0 && (
        <section className="rounded-2xl border-2 border-accent bg-panel p-4 sm:p-5">
          <h2 className="font-semibold">Pagos por confirmar <span className="ml-1 rounded-full bg-danger px-1.5 text-[11px] text-panel">{avisos.length}</span></h2>
          <p className="mb-3 mt-0.5 text-sm text-muted">Dijeron “Ya pagué” en su Mi agenda. Revisa tu banco (concepto MI-…) y confirma: se les suma el tiempo y les llega el correo.</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {avisos.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{x.nombre || x.email} · <span className="tabular-nums">{pesos(x.monto)}</span> <span className="text-xs font-normal text-muted">({x.meses === 12 ? "1 año" : `${x.meses} mes${x.meses === 1 ? "" : "es"}`})</span></p>
                  <p className="truncate text-xs text-muted">{x.email} · concepto <b className="consola-mono">{x.codigo}</b>{x.referencia ? ` · rastreo ${x.referencia}` : ""} · avisó {hace(x.created_at)}</p>
                </div>
                <button className="btn btn-primario py-1 text-xs" disabled={!!ocupado} onClick={() => llamar("/api/admin/personales/avisos", "POST", { id: x.id, accion: "confirmar" }, `Pago confirmado: ${x.email} ya tiene Pro.`, x.id)}>Confirmar</button>
                <button className="btn btn-sec py-1 text-xs" disabled={!!ocupado} onClick={() => llamar("/api/admin/personales/avisos", "POST", { id: x.id, accion: "rechazar" }, "Le avisamos que no llegó.", x.id)}>No llegó</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {solicitudes.length > 0 && (
        <section className="rounded-2xl border-2 border-accent bg-panel p-4 sm:p-5">
          <h2 className="font-semibold">Quieren Mi agenda <span className="ml-1 rounded-full bg-danger px-1.5 text-[11px] text-panel">{solicitudes.length}</span></h2>
          <p className="mb-3 mt-0.5 text-sm text-muted">Lo pidieron desde su agenda de clínicas (“La quiero”). Al aprobar se les activa y les llega su link.</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {solicitudes.map((x) => (
              <li key={x.user_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{x.nombre || x.email}</p>
                  <p className="truncate text-xs text-muted">{x.email} · pidió {hace(x.created_at)}{x.tieneClinica ? " · usa clínicas" : ""}</p>
                </div>
                <button className="btn btn-primario py-1 text-xs" disabled={!!ocupado} onClick={() => llamar("/api/admin/personales/solicitudes", "POST", { user_id: x.user_id, accion: "aprobar" }, `Aprobada: le llegó su link a ${x.email}.`, x.user_id)}>Aprobar</button>
                <button className="btn btn-sec py-1 text-xs" disabled={!!ocupado} onClick={() => llamar("/api/admin/personales/solicitudes", "POST", { user_id: x.user_id, accion: "descartar" }, "Solicitud descartada.", x.user_id)}>Descartar</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="font-semibold">Dar de alta una agenda personal (cortesía)</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">
          Cualquiera puede crear su Mi agenda en /mi-agenda (con su prueba de Pro). Aquí das de alta a mano: esas nacen de <b>cortesía</b> (Pro sin fecha). Si el correo ya tiene cuenta de clínicas, es la misma cuenta y cambia entre sus dos agendas. “Automático” = odonto si ya usa clínicas; general si no.
        </p>
        <form onSubmit={alta} className="flex flex-wrap items-center gap-2">
          <input type="email" required className="campo min-w-0 flex-[2]" style={{ width: "auto" }} placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="campo min-w-0 flex-1" style={{ width: "auto" }} placeholder="Nombre (opcional)" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <select className="campo py-2 text-sm" style={{ width: "auto" }} value={perfil} onChange={(e) => setPerfil(e.target.value as "" | "odonto" | "general")} title="Para quién es: cambia las categorías y los ejemplos" aria-label="Tipo de agenda">
            <option value="">Tipo: automático</option>
            <option value="odonto">Estudiante de odonto</option>
            <option value="general">General (cualquier persona)</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" checked={enviar} onChange={(e) => setEnviar(e.target.checked)} /> Mandarle su link ya
          </label>
          <button className="btn btn-primario" disabled={ocupado === "alta"}>{ocupado === "alta" ? "Dando de alta…" : "Dar de alta"}</button>
        </form>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Agendas personales</h2>
          <span className="text-xs tabular-nums text-muted">{lista?.length ?? "…"}</span>
        </div>
        {!lista ? (
          <p className="p-4 text-sm text-muted">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Nadie todavía. Da de alta el primer correo arriba.</p>
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((p) => (
              <li key={p.user_id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${p.activo ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p.nombre || p.email}
                    {!p.activo && <span className="ml-2 rounded bg-panel-2 px-1.5 py-px text-[10px] font-semibold uppercase text-muted">Pausada</span>}
                    {p.tieneClinica && <span className="ml-2 rounded bg-panel-2 px-1.5 py-px text-[10px] font-semibold uppercase text-muted">También clínicas</span>}
                    <button
                      className="ml-2 rounded bg-panel-2 px-1.5 py-px text-[10px] font-semibold uppercase text-muted hover:text-ink"
                      title="Cambiar: odonto ↔ general (textos y ejemplos de su agenda)"
                      disabled={!!ocupado}
                      onClick={() => llamar(`/api/admin/personales/${p.user_id}`, "PATCH", { perfil: p.perfil === "odonto" ? "general" : "odonto" }, "Tipo cambiado.", p.user_id)}
                    >
                      {p.perfil === "odonto" ? "Odonto" : "General"} ⇄
                    </button>
                    <InsigniaPlan e={p.estado} />
                  </p>
                  <p className="truncate text-xs text-muted">
                    {p.email} · <span className="tabular-nums">{p.eventos}</span> en su agenda · {p.password ? "ya tiene contraseña" : <span className="text-danger">sin contraseña</span>} · entró {hace(p.ultimo_acceso ?? p.ultimoLogin)}
                    {p.enlace_at && <> · último link {hace(p.enlace_at)}</>}
                  </p>
                </div>
                {borrar === p.user_id ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-danger">¿Borrar su agenda y todo lo que tiene{p.tieneClinica ? "" : " (y su cuenta)"}?</span>
                    <button className="btn btn-peligro py-1" disabled={!!ocupado} onClick={() => llamar(`/api/admin/personales/${p.user_id}`, "DELETE", null, "Agenda personal borrada.", p.user_id).then(() => setBorrar(null))}>Sí, borrar</button>
                    <button className="btn btn-sec py-1" onClick={() => setBorrar(null)}>No</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {p.activo && (
                      <button className="btn btn-sec py-1 text-xs" disabled={ocupado === p.user_id} onClick={() => llamar(`/api/admin/personales/${p.user_id}`, "POST", null, `Link enviado a ${p.email}.`, p.user_id)}>
                        Mandar link
                      </button>
                    )}
                    <button className="btn btn-sec py-1 text-xs" disabled={ocupado === p.user_id} onClick={() => llamar(`/api/admin/personales/${p.user_id}`, "PATCH", { activo: !p.activo }, p.activo ? "Pausada: ya no puede entrar." : "Reactivada.", p.user_id)}>
                      {p.activo ? "Pausar" : "Reactivar"}
                    </button>
                    <button className="btn btn-sec py-1 text-xs" onClick={() => setPago(pago?.id === p.user_id ? null : { id: p.user_id, meses: 1, monto: "" })}>+ Pago</button>
                    {p.estado.tipo === "cortesia" ? (
                      <button className="btn btn-sec py-1 text-xs" disabled={!!ocupado} title="Queda en Gratis desde hoy (o en Pro si su agenda de clínicas lo es)" onClick={() => llamar(`/api/admin/personales/${p.user_id}`, "PATCH", { cortesia: false }, "Cortesía quitada.", p.user_id)}>Quitar cortesía</button>
                    ) : (
                      <button className="btn btn-sec py-1 text-xs" disabled={!!ocupado} title="Pro sin fecha de vencimiento" onClick={() => llamar(`/api/admin/personales/${p.user_id}`, "PATCH", { cortesia: true }, "Ahora es de cortesía.", p.user_id)}>Cortesía</button>
                    )}
                    <button className="btn btn-sec py-1 text-xs text-danger" onClick={() => setBorrar(p.user_id)}>Borrar</button>
                  </div>
                )}
                {pago?.id === p.user_id && (
                  <form
                    className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-sm"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await llamar(`/api/admin/personales/${p.user_id}`, "PUT", { meses: pago.meses, monto: Number(pago.monto || 0) }, "Pago registrado.", p.user_id);
                      if (ok) setPago(null);
                    }}
                  >
                    <span className="text-muted">Registrar pago a mano:</span>
                    <select className="campo py-1" style={{ width: "auto" }} value={pago.meses} onChange={(e) => setPago({ ...pago, meses: Number(e.target.value) })}>
                      {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m === 12 ? "1 año" : `${m} mes${m === 1 ? "" : "es"}`}</option>)}
                    </select>
                    <span className="flex items-center gap-1 text-muted">$<input type="number" min={0} required className="campo py-1" style={{ width: "6rem" }} value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} placeholder="Monto" /></span>
                    <button className="btn btn-primario py-1 text-xs" disabled={!!ocupado}>Registrar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PreciosMi onAviso={onAviso} />
    </div>
  );
}

/** Su plan de Mi agenda, en chiquito. */
function InsigniaPlan({ e }: { e: EstadoMi }) {
  const t =
    e.tipo === "cortesia" ? "Cortesía" :
    e.tipo === "clinicas" ? "Pro por clínicas" :
    e.tipo === "prueba" ? `Prueba · ${e.dias} d` :
    e.tipo === "pro" ? `Pro hasta ${fechaLarga(e.hasta)}` : "Gratis";
  const color = e.tipo === "gratis" ? "bg-panel-2 text-muted" : "bg-accent-soft text-accent";
  return <span className={`ml-2 rounded px-1.5 py-px text-[10px] font-semibold uppercase ${color}`}>{t}</span>;
}

/** Precios de Mi agenda (se guardan en configuracion.planes_mi). */
function PreciosMi({ onAviso }: { onAviso: (m: string) => void }) {
  const [p, setP] = useState<PlanMi[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" }).then(async (r) => setP(normalizarPlanesMi((await r.json().catch(() => ({}))).planesMi)));
  }, []);
  if (!p) return null;
  const mensual = p[0].precio;
  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planesMi: p }) });
    setGuardando(false);
    if (!r.ok) return setError((await r.json().catch(() => ({}))).error ?? "No se pudo guardar.");
    onAviso("Precios de Mi agenda guardados.");
  }
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="font-semibold">Planes de Mi agenda</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">Lo que paga cada persona por su <b>Pro</b> de Mi agenda. Quien tiene Pro en su agenda de clínicas no paga esto. Se ven en la página pública y en “Tu plan”.</p>
      <table className="w-full max-w-md text-sm">
        <tbody>
          {p.map((x) => (
            <tr key={x.id} className={x.activo ? "" : "opacity-50"}>
              <td className="py-1 pr-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={x.activo} disabled={x.id === "mes"} onChange={(e) => setP(p.map((y) => (y.id === x.id ? { ...y, activo: e.target.checked } : y)))} />
                  {x.nombre} <span className="text-xs text-muted">· {x.meses} m</span>
                </label>
              </td>
              <td className="py-1 pr-2">
                <span className="flex items-center gap-1 text-muted">$<input type="number" min={1} className="campo py-1" style={{ width: "6.5rem" }} value={x.precio} onChange={(e) => setP(p.map((y) => (y.id === x.id ? { ...y, precio: Number(e.target.value) } : y)))} /></span>
              </td>
              <td className="py-1 text-right text-xs tabular-nums text-muted">{x.id === "mes" ? "—" : `ahorran ${pesos(Math.max(0, mensual * x.meses - x.precio))}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button className="btn btn-primario mt-3" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar precios"}</button>
    </section>
  );
}
