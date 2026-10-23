"use client";

import { useEffect, useState } from "react";
import type { PerfilPersonal } from "@/lib/personal";

// 2.9 · Ajustes de Mi agenda: para quién es, invita a un amigo, y tus datos (descargar o borrar).

export function ParaQuien({ perfil: inicial }: { perfil: PerfilPersonal }) {
  const [perfil, setPerfil] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  async function cambiar(p: PerfilPersonal) {
    if (p === perfil) return;
    setGuardando(true);
    const r = await fetch("/api/personal/perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perfil: p }) });
    setGuardando(false);
    if (r.ok) setPerfil(p);
  }
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="serif text-xl">Tu agenda es para…</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">Cambia los ejemplos y algunos textos. Tus cosas no se tocan.</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Para quién es">
        {([["general", "Mi día a día", "Cualquier persona"], ["odonto", "La escuela de odonto", "Casos, entregas, clínicas"]] as const).map(([id, t, d]) => (
          <button key={id} type="button" role="radio" aria-checked={perfil === id} disabled={guardando} onClick={() => cambiar(id)} className={`rounded-xl border px-3 py-2.5 text-left ${perfil === id ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2"}`}>
            <span className={`block text-sm font-semibold ${perfil === id ? "text-accent" : ""}`}>{t}</span>
            <span className="text-xs text-muted">{d}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function InvitaAmigo() {
  const [d, setD] = useState<{ codigo: string; invitados: number; ganados: number; max: number; listo: boolean } | null>(null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    fetch("/api/personal/invitar", { cache: "no-store" }).then(async (r) => r.ok && setD(await r.json()));
  }, []);
  if (!d || !d.listo) return null;
  const url = `${window.location.origin}/mi-agenda/registro?inv=${d.codigo}`;
  const texto = "Te paso mi agenda: pendientes, hábitos con racha, viajes y pagos. Si la creas con mi link, los dos ganamos un mes de Pro 🎁";
  async function compartir() {
    try {
      if (navigator.share) return await navigator.share({ title: "Mi agenda", text: texto, url });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  }
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="serif text-xl">Invita a un amigo</h2>
        <span className="text-xs text-muted">{d.ganados} de {d.max} meses ganados</span>
      </div>
      <p className="mb-3 mt-0.5 text-sm text-muted">Si alguien crea su Mi agenda con tu link, <b className="text-ink">los dos ganan 1 mes de Pro</b>. Hasta {d.max} meses para ti.</p>
      <div className="flex gap-2">
        <input readOnly className="campo min-w-0 flex-1 text-sm text-muted" value={url} onFocus={(e) => e.target.select()} aria-label="Tu link para invitar" />
        <button className="btn btn-primario shrink-0 rounded-full" onClick={compartir}>{copiado ? "¡Copiado!" : "Compartir"}</button>
      </div>
      {d.invitados > 0 && <p className="mt-2 text-xs text-accent">Ya se registraron {d.invitados} con tu link. 🙌</p>}
    </section>
  );
}

export function TusDatos({ tieneClinica }: { tieneClinica: boolean }) {
  const [borrar, setBorrar] = useState(false);
  const [texto, setTexto] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirmarBorrado() {
    setTrabajando(true);
    setError(null);
    const r = await fetch("/api/personal/datos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmar: texto.trim().toUpperCase() }) });
    const d = await r.json().catch(() => ({}));
    setTrabajando(false);
    if (!r.ok) return setError(d.error ?? "No se pudo borrar.");
    window.location.href = d.cuentaBorrada ? "/mi-agenda" : "/";
  }
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="serif text-xl">Tus datos</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">Son tuyos: llévatelos cuando quieras, o bórralos.</p>
      <div className="flex flex-wrap gap-2">
        <a href="/api/personal/datos" className="btn btn-sec rounded-full text-sm" download>Descargar mis datos</a>
        {!borrar && <button className="btn btn-sec rounded-full text-sm text-danger" onClick={() => setBorrar(true)}>Borrar mi agenda…</button>}
      </div>
      {borrar && (
        <div className="mt-3 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">
          <p className="mb-2">
            Se borra <b>todo</b> lo de tu Mi agenda: eventos, pendientes, hábitos, viajes y pagos.{" "}
            {tieneClinica ? "Tu agenda de clínicas no se toca." : "También se borra tu cuenta."} <b>No se puede deshacer</b>; si quieres, descarga tus datos antes.
          </p>
          <label className="mb-2 block">
            Para confirmar, escribe <b>BORRAR</b>:
            <input className="campo mt-1" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
          </label>
          {error && <p className="mb-2 text-danger">{error}</p>}
          <div className="flex gap-2">
            <button className="btn rounded-full bg-danger px-4 text-white" disabled={texto.trim().toUpperCase() !== "BORRAR" || trabajando} onClick={confirmarBorrado}>{trabajando ? "Borrando…" : "Borrar para siempre"}</button>
            <button className="btn btn-sec rounded-full" onClick={() => { setBorrar(false); setTexto(""); }}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}
