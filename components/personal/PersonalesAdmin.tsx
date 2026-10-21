"use client";

import { useCallback, useEffect, useState } from "react";
import type { PersonalAdmin, SolicitudAdmin } from "@/lib/personalServer";

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

  const cargar = useCallback(async () => {
    const r = await fetch("/api/admin/personales", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setLista(d.personales);
    else setError(d.error ?? "No se pudo cargar.");
    const rs = await fetch("/api/admin/personales/solicitudes", { cache: "no-store" });
    if (rs.ok) setSolicitudes((await rs.json()).solicitudes ?? []);
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
    const ok = await llamar("/api/admin/personales", "POST", { email, nombre, enviar }, enviar ? `Alta lista y link enviado a ${email.trim()}.` : `Alta lista: ${email.trim()}.`, "alta");
    if (ok) {
      setEmail("");
      setNombre("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
        <h2 className="font-semibold">Dar de alta una agenda personal</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">
          Sólo quien esté aquí tiene Mi agenda. Entra por el mismo login (o con “Entrar con un link a mi correo”). Si el correo ya tiene cuenta de clínicas, es la misma cuenta y cambia entre sus dos agendas.
        </p>
        <form onSubmit={alta} className="flex flex-wrap items-center gap-2">
          <input type="email" required className="campo min-w-0 flex-[2]" style={{ width: "auto" }} placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="campo min-w-0 flex-1" style={{ width: "auto" }} placeholder="Nombre (opcional)" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
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
                    <button className="btn btn-sec py-1 text-xs text-danger" onClick={() => setBorrar(p.user_id)}>Borrar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
