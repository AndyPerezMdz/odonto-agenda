"use client";

import { useState } from "react";
import Link from "next/link";
import { usePersonal } from "@/lib/usePersonal";
import { PALETA_P, type PCategoria } from "@/lib/personal";
import { Calendario, Notificaciones } from "@/components/TarjetaAvisos";
import TarjetaPlanMi from "@/components/personal/TarjetaPlanMi";

export default function AjustesPersonal({ userId, email, pro = true }: { userId: string; email: string; pro?: boolean }) {
  const { supabase, categorias, prefs, recargar } = usePersonal();

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/personal" className="btn btn-sec px-2.5" aria-label="Volver">‹</Link>
        <div>
          <h1 className="serif text-4xl leading-none">Ajustes</h1>
          <p className="text-sm text-muted">{email}</p>
        </div>
      </header>

      <div className="flex flex-col gap-5">
        <TarjetaPlanMi />

        {pro ? (
          <Categorias supabase={supabase} userId={userId} categorias={categorias} onCambio={recargar} />
        ) : (
          <SoloPro titulo="Tus categorías y colores" texto="Crea las tuyas (Trabajo, Gym, Viajes…) con el color que quieras. Las que ya tienes se siguen viendo." />
        )}

        {!pro && <SoloPro titulo="Avisos" texto="El correo de cada mañana, las notificaciones en tu cel y tu agenda en el calendario del teléfono." />}
        {pro && <>
        <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
          <h2 className="serif text-xl">Correo de la mañana</h2>
          <p className="mb-3 mt-0.5 text-sm text-muted">Cada madrugada, un correo con lo de hoy y lo que tienes por entregar. Si no hay nada, no llega.</p>
          <label className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.correo !== false}
              onChange={async (e) => {
                await supabase.from("personales").update({ prefs: { ...prefs, correo: e.target.checked } }).eq("user_id", userId);
                recargar();
              }}
            />
            Recibir el correo
          </label>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
          <Notificaciones descripcion={<>Cada mañana te llega <b>“Tu día”</b> con lo que tienes y tus entregas pendientes. Se activa en cada celular o compu por separado.</>} />
          <div className="mt-5 border-t border-line pt-5">
            <Calendario descripcion="Todo lo de tu agenda aparece solo en Google Calendar o en el calendario del iPhone, con alarma 1 hora antes (y un día antes para las entregas). Se actualiza cada pocas horas (lo decide tu calendario)." />
          </div>
        </section>
        </>}

        <CambiarPassword />
      </div>
    </div>
  );
}

/** 2.3 · Lo que es de Pro, en Gratis: qué trae y para dónde ir. */
function SoloPro({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-line bg-panel/70 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="serif text-xl">{titulo}</h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase text-accent">Pro</span>
      </div>
      <p className="mb-3 mt-0.5 text-sm text-muted">{texto}</p>
      <a href="#plan" className="text-sm font-medium text-accent hover:underline">Ver planes</a>
    </section>
  );
}

function Categorias({ supabase, userId, categorias, onCambio }: { supabase: ReturnType<typeof usePersonal>["supabase"]; userId: string; categorias: PCategoria[]; onCambio: () => void }) {
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function correr(p: PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    const { error } = await p;
    if (error) setError(error.message);
    onCambio();
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="serif text-xl">Categorías</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">Para darle color a tu agenda. Si borras una, sus eventos se quedan sin categoría.</p>
      <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
        {categorias.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <input
              className="campo w-full min-w-0 py-1.5 sm:w-auto sm:flex-1"
              defaultValue={c.nombre}
              maxLength={40}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.nombre && correr(supabase.from("p_categorias").update({ nombre: e.target.value.trim() }).eq("id", c.id))}
              aria-label="Nombre"
            />
            <div className="flex gap-1">
              {PALETA_P.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => correr(supabase.from("p_categorias").update({ color: col }).eq("id", c.id))}
                  className={`h-6 w-6 rounded-full border-2 ${c.color === col ? "border-ink" : "border-transparent"}`}
                  style={{ background: col }}
                  aria-label={`Color ${col}`}
                />
              ))}
            </div>
            <button type="button" onClick={() => correr(supabase.from("p_categorias").delete().eq("id", c.id))} className="ml-auto text-sm text-danger hover:underline">Borrar</button>
          </li>
        ))}
        {categorias.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin categorías todavía.</li>}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nueva.trim()) return;
          correr(supabase.from("p_categorias").insert({ user_id: userId, nombre: nueva.trim().slice(0, 40), color: PALETA_P[categorias.length % PALETA_P.length], orden: categorias.length }));
          setNueva("");
        }}
      >
        <input className="campo" placeholder="Ej. Gym" value={nueva} maxLength={40} onChange={(e) => setNueva(e.target.value)} />
        <button className="btn btn-primario shrink-0">Agregar</button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function CambiarPassword() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="serif text-xl">Cambiar contraseña</h2>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setGuardando(true);
          const r = await fetch("/api/personal/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
          const d = await r.json().catch(() => ({}));
          setGuardando(false);
          setMsg(r.ok ? { ok: true, t: "Listo, contraseña cambiada." } : { ok: false, t: d.error ?? "No se pudo." });
          if (r.ok) setPw("");
        }}
      >
        <input type="password" autoComplete="new-password" className="campo min-w-0 flex-1" placeholder="Nueva contraseña (8+ caracteres)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn btn-sec shrink-0" disabled={guardando || pw.length < 8}>{guardando ? "Guardando…" : "Cambiar"}</button>
      </form>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-accent" : "text-danger"}`}>{msg.t}</p>}
    </section>
  );
}
