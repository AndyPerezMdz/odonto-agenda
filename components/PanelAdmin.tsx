"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgendaAdmin, Miembro } from "@/lib/admin";

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
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const res = await fetch("/api/admin/agendas", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAgendas(data.agendas);
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

  const usuarios = agendas?.reduce((n, a) => n + a.miembros.filter((m) => !m.pendiente).length, 0) ?? 0;
  const citas = agendas?.reduce((n, a) => n + a.citas, 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-panel">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Sólo tú ves esto
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Panel de administración</h1>
          <p className="text-sm text-muted">{email}</p>
        </div>
        <button onClick={salir} className="btn btn-sec">Salir</button>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ["Agendas", agendas?.length ?? "—"],
          ["Usuarios activos", agendas ? usuarios : "—"],
          ["Citas en total", agendas ? citas : "—"],
        ].map(([t, v]) => (
          <div key={t} className="rounded-2xl border border-line bg-panel p-4">
            <p className="text-xs text-muted">{t}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {aviso && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{aviso}</p>}
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <NuevaAgenda
        onCreada={(msg) => {
          setAviso(msg);
          recargar();
        }}
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Agendas</h2>
      {!agendas && !error && <p className="text-sm text-muted">Cargando…</p>}
      {agendas?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Aún no hay agendas. Crea la primera arriba.</p>
      )}
      <div className="flex flex-col gap-4">
        {agendas?.map((a) => (
          <TarjetaAgenda key={a.id} agenda={a} onCambio={recargar} onAviso={setAviso} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NuevaAgenda({ onCreada }: { onCreada: (msg: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const err = await api("/api/admin/agendas", "POST", { nombre, emailDueno: correo, notas });
    setEnviando(false);
    if (err) return setError(err);
    onCreada(`Agenda “${nombre || "Agenda de clínicas"}” creada. Invitación enviada a ${correo}.`);
    setNombre("");
    setCorreo("");
    setNotas("");
  }

  return (
    <form onSubmit={crear} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="font-semibold">Nueva agenda</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">Para un cliente nuevo. Al dueño le llega un correo para crear su contraseña; después él invita a su compañero.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nombre de la agenda</span>
          <input className="campo" placeholder="Agenda de clínicas" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Correo del dueño</span>
          <input type="email" required className="campo" placeholder="cliente@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Notas internas <span className="font-normal text-muted">(sólo tú las ves)</span></span>
          <input className="campo" placeholder="Ej. Vendida a Ana, Odontología UNICARIBE, pagó $300" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primario" disabled={enviando}>{enviando ? "Creando…" : "Crear agenda e invitar"}</button>
      </div>
    </form>
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
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
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

      <ul className="divide-y divide-line rounded-xl border border-line">
        {agenda.miembros.map((m) => (
          <FilaMiembro
            key={m.id}
            m={m}
            trabajando={trabajando}
            onHacerDueno={() => accion(() => api(`/api/admin/agendas/${agenda.id}/dueno`, "POST", { userId: m.id }), `${m.nombre} ahora es el dueño.`)}
            onReenviar={() => accion(() => api(`/api/admin/agendas/${agenda.id}/dueno`, "POST", { email: m.email }), `Invitación reenviada a ${m.email}.`)}
          />
        ))}
        {agenda.miembros.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin miembros.</li>}
      </ul>

      {!dueno && (
        <div className="mt-3 rounded-xl bg-[#fdf6e3] p-3 text-sm text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]">
          <p className="mb-2 font-medium">Esta agenda no tiene dueño.</p>
          <p className="mb-3">
            {agenda.miembros.some((m) => !m.pendiente)
              ? "Usa “Hacer dueño” en la persona correcta, o invita a alguien nuevo:"
              : "Invita a quien será el dueño:"}
          </p>
          <InvitarDueno
            onEnviar={(email) => accion(() => api(`/api/admin/agendas/${agenda.id}/dueno`, "POST", { email }), `Invitación enviada a ${email}.`)}
            trabajando={trabajando}
          />
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
          {m.pendiente ? "Invitación pendiente" : `${m.email} · ${m.citas} cita${m.citas === 1 ? "" : "s"}`}
        </p>
      </div>
      {esDueno && m.pendiente && (
        <button className="btn btn-sec py-1 text-xs" disabled={trabajando} onClick={onReenviar}>Reenviar invitación</button>
      )}
      {!esDueno && !m.pendiente && (
        <button className="btn btn-sec py-1 text-xs" disabled={trabajando} onClick={onHacerDueno}>Hacer dueño</button>
      )}
    </li>
  );
}

function InvitarDueno({ onEnviar, trabajando }: { onEnviar: (email: string) => void; trabajando: boolean }) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar(email.trim());
      }}
    >
      <input type="email" required className="campo" placeholder="dueño@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-primario shrink-0" disabled={trabajando}>Invitar como dueño</button>
    </form>
  );
}
