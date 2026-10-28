"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePersonal } from "@/lib/usePersonal";
import { PALETA_P, type PCategoria } from "@/lib/personal";
import { Calendario, Notificaciones } from "@/components/TarjetaAvisos";
import TarjetaPlanMi from "@/components/personal/TarjetaPlanMi";
import { InvitaAmigo, ParaQuien, TusDatos } from "@/components/personal/AjustesCuenta";
import type { PerfilPersonal } from "@/lib/personal";

export default function AjustesPersonal({ userId, email, pro = true, perfil = "general", tieneClinica = false }: { userId: string; email: string; pro?: boolean; perfil?: PerfilPersonal; tieneClinica?: boolean }) {
  const { supabase, categorias, prefs, recargar } = usePersonal();
  async function guardarPref(k: "dia" | "correo" | "semana" | "aviso_def", v: boolean | number | null) {
    await supabase.from("personales").update({ prefs: { ...prefs, [k]: v } }).eq("user_id", userId);
    recargar();
  }

  // 3.0 · Ajustes por secciones (antes era un scroll infinito). El #hash elige la sección (#plan, #avisos…)
  const [seccion, setSeccion] = useState<SeccionAjustes>("plan");
  useEffect(() => {
    const leer = () => setSeccion(deHash(window.location.hash));
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, []);
  const ir = (x: SeccionAjustes) => {
    setSeccion(x);
    history.replaceState(null, "", `#${x}`);
    window.scrollTo({ top: 0 });
  };
  const actual = SECCIONES.find((x) => x.id === seccion)!;
  // En el cel, que la pestaña elegida quede a la vista
  useEffect(() => {
    document.querySelector<HTMLElement>('nav[aria-label="Secciones de ajustes"] [aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [seccion]);

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <Link href="/personal" className="btn btn-sec px-2.5" aria-label="Volver">‹</Link>
        <div className="min-w-0">
          <h1 className="serif text-4xl leading-none">Ajustes</h1>
          <p className="truncate text-sm text-muted">{email}</p>
        </div>
      </header>

      <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
        {/* Secciones: arriba en el cel (se desliza), a la izquierda en la compu */}
        <nav aria-label="Secciones de ajustes" className="sticky top-[env(safe-area-inset-top)] z-10 -mx-3 mb-4 bg-bg/95 px-3 py-2 backdrop-blur md:static md:mx-0 md:mb-0 md:bg-transparent md:p-0">
          <ul className="flex gap-1.5 overflow-x-auto md:sticky md:top-6 md:flex-col md:gap-0.5 md:overflow-visible">
            {SECCIONES.map((x) => (
              <li key={x.id} className="shrink-0">
                <button
                  onClick={() => ir(x.id)}
                  aria-current={seccion === x.id ? "page" : undefined}
                  className={`flex w-full items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium md:rounded-lg md:border-0 md:px-3 md:py-2 md:text-left ${seccion === x.id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink md:hover:bg-panel-2"}`}
                >
                  <span aria-hidden>{x.e}</span> {x.t}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 hidden md:block">
            <h2 className="serif text-3xl leading-none">{actual.t}</h2>
            <p className="mt-1 text-sm text-muted">{actual.x}</p>
          </div>
          <div className="flex flex-col gap-5">
            {seccion === "plan" && (
              <>
                <TarjetaPlanMi />
                <InvitaAmigo />
              </>
            )}

            {seccion === "avisos" && (
              <>
                <section id="avisos" className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
                  <h2 className="serif text-xl">Avisos</h2>
                  <p className="mb-4 mt-0.5 text-sm text-muted">Qué te llega y cuándo. Lo del cel se activa en cada celular o compu por separado.</p>
                  <div className="rounded-xl border border-line p-3">
                    <Notificaciones descripcion={<>A la hora de tus <b>recordatorios</b> (o los minutos antes que elijas), de los <b>eventos con aviso</b>, de tus <b>hábitos con hora</b> y de tus <b>bloques de tiempo</b>. Gratis.</>} />
                  </div>
                  <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                    <Interruptor titulo="“Tu día” en el cel" detalle="Cada mañana: lo que tienes hoy, entregas y pagos." on={prefs.dia !== false} pro={pro} onCambio={(v) => guardarPref("dia", v)} />
                    <Interruptor titulo="Correo de la mañana" detalle="Lo mismo, por correo. Si no hay nada, no llega." on={prefs.correo !== false} pro={pro} onCambio={(v) => guardarPref("correo", v)} />
                    <Interruptor titulo="“Tu semana” cada domingo" detalle="Correo y aviso en el cel con lo que viene de lunes a domingo." on={prefs.semana !== false} pro={pro} onCambio={(v) => guardarPref("semana", v)} />
                  </ul>
                  <label className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                    <span><b className="font-medium">Aviso para eventos nuevos</b><span className="block text-xs text-muted">Lo que trae puesto cada evento con hora que crees. Lo cambias en cada uno.</span></span>
                    <select className="campo" style={{ width: "auto" }} value={prefs.aviso_def === undefined ? "30" : prefs.aviso_def === null ? "" : String(prefs.aviso_def)} onChange={(e) => guardarPref("aviso_def", e.target.value === "" ? null : Number(e.target.value))}>
                      <option value="">Sin aviso</option>
                      <option value="0">A la hora</option>
                      {[10, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min antes` : m === 60 ? "1 hora antes" : "2 horas antes"}</option>)}
                    </select>
                  </label>
                  {!pro && <p className="mt-2 text-xs text-muted">Los de la mañana y del domingo son de Pro. <a href="#plan" className="font-medium text-accent hover:underline">Ver planes</a></p>}
                </section>
                {pro ? (
                  <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
                    <Calendario descripcion="Todo lo de tu agenda (también pendientes con fecha, pagos fijos, planes de viaje y lo que te compartieron) aparece solo en Google Calendar o en el calendario del iPhone, con alarma 1 hora antes (y un día antes para las entregas). Se actualiza cada pocas horas (lo decide tu calendario)." />
                  </section>
                ) : (
                  <SoloPro titulo="Tu agenda en el calendario del cel" texto="Todo lo de tu agenda en Google Calendar o en el del iPhone, con alarmas." />
                )}
              </>
            )}

            {seccion === "categorias" &&
              (pro ? (
                <Categorias supabase={supabase} userId={userId} categorias={categorias} onCambio={recargar} />
              ) : (
                <SoloPro titulo="Tus categorías y colores" texto="Crea las tuyas (Trabajo, Gym, Viajes…) con el color que quieras. Las que ya tienes se siguen viendo." />
              ))}

            {seccion === "cuenta" && (
              <>
                <ParaQuien perfil={perfil} tieneClinica={tieneClinica} />
                <CambiarPassword />
                <TusDatos tieneClinica={tieneClinica} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type SeccionAjustes = "plan" | "avisos" | "categorias" | "cuenta";
const SECCIONES: { id: SeccionAjustes; e: string; t: string; x: string }[] = [
  { id: "plan", e: "⭐", t: "Tu plan", x: "Gratis o Pro, pagos e invitar a un amigo." },
  { id: "avisos", e: "🔔", t: "Avisos y calendario", x: "Notificaciones, correos y tu agenda en el calendario del cel." },
  { id: "categorias", e: "🎨", t: "Categorías", x: "Los colores de tu agenda." },
  { id: "cuenta", e: "👤", t: "Tu cuenta", x: "Para quién es, contraseña y tus datos." },
];
/** El #hash de los links viejos (#plan, #avisos, #datos…) a su sección. */
function deHash(h: string): SeccionAjustes {
  const x = h.replace(/^#/, "");
  if (x === "avisos" || x === "calendario" || x === "notificaciones") return "avisos";
  if (x === "categorias") return "categorias";
  if (x === "cuenta" || x === "datos" || x === "password" || x === "perfil") return "cuenta";
  return "plan";
}

function Interruptor({ titulo, detalle, on, pro, onCambio }: { titulo: string; detalle: string; on: boolean; pro: boolean; onCambio: (v: boolean) => void }) {
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${pro ? "" : "opacity-60"}`}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">{titulo}{!pro && <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-bold uppercase text-accent">Pro</span>}</span>
        <span className="block text-xs text-muted">{detalle}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={pro && on}
        aria-label={titulo}
        disabled={!pro}
        onClick={() => onCambio(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${pro && on ? "bg-accent" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-panel shadow transition-all ${pro && on ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </li>
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
