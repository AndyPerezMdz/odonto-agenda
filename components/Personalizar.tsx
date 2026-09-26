"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCatalogos } from "@/lib/useDatos";
import { prefs, type Preferencias } from "@/lib/types";

const PALETA = ["#2f5d50", "#6366f1", "#db2777", "#ea580c", "#0891b2", "#65a30d", "#9333ea", "#b45309"];

export default function Personalizar({ userId }: { userId: string }) {
  const { supabase, perfiles, clinicas, materias, recargar } = useCatalogos();
  const yo = perfiles.find((p) => p.id === userId);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="btn btn-sec px-2.5" aria-label="Volver">‹</Link>
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Personalizar</h1>
          <p className="text-sm text-muted">Ajusta la agenda sin tocar código.</p>
        </div>
        <Link href="/nueva-contrasena" className="btn btn-sec" title="Cambiar contraseña">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="hidden sm:inline">Cambiar contraseña</span>
        </Link>
      </header>

      <div className="flex flex-col gap-5">
        {yo && <MiPerfil key={yo.id} supabase={supabase} yo={yo} onGuardado={recargar} />}

        <Catalogo
          titulo="Clínicas"
          descripcion="Número o nombre de cada clínica física. Compartidas entre los dos."
          placeholder="Ej. Clínica 3"
          items={clinicas.map((c) => ({ id: c.id, nombre: c.numero, activo: c.activo }))}
          onAgregar={(nombre) => supabase.from("clinicas").insert({ numero: nombre })}
          onRenombrar={(id, nombre) => supabase.from("clinicas").update({ numero: nombre }).eq("id", id)}
          onToggle={(id, activo) => supabase.from("clinicas").update({ activo }).eq("id", id)}
          onBorrar={(id) => supabase.from("clinicas").delete().eq("id", id)}
          onCambio={recargar}
        />

        <Catalogo
          titulo="Materias"
          descripcion="Cada materia puede tener su color para distinguirla en las citas."
          placeholder="Ej. Prostodoncia"
          conColor
          items={materias.map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo, color: m.color }))}
          onAgregar={(nombre) =>
            supabase.from("materias").insert({ nombre, color: PALETA[materias.length % PALETA.length] })
          }
          onRenombrar={(id, nombre) => supabase.from("materias").update({ nombre }).eq("id", id)}
          onColor={(id, color) => supabase.from("materias").update({ color }).eq("id", id)}
          onToggle={(id, activo) => supabase.from("materias").update({ activo }).eq("id", id)}
          onBorrar={(id) => supabase.from("materias").delete().eq("id", id)}
          onCambio={recargar}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Tarjeta({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <h2 className="font-semibold">{titulo}</h2>
      {descripcion && <p className="mb-4 mt-0.5 text-sm text-muted">{descripcion}</p>}
      {children}
    </section>
  );
}

type Resultado = PromiseLike<{ error: { message: string; code?: string } | null }>;

function MiPerfil({
  supabase, yo, onGuardado,
}: {
  supabase: ReturnType<typeof useCatalogos>["supabase"];
  yo: { id: string; nombre: string; color: string; preferencias: Preferencias };
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(yo.nombre);
  const [color, setColor] = useState(yo.color);
  const [p, setP] = useState(prefs(yo.preferencias));
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | string>("");

  useEffect(() => {
    if (estado === "ok") {
      const t = setTimeout(() => setEstado(""), 2000);
      return () => clearTimeout(t);
    }
  }, [estado]);

  async function guardar() {
    setEstado("guardando");
    const { error } = await supabase
      .from("perfiles")
      .update({ nombre: nombre.trim() || "Sin nombre", color, preferencias: p })
      .eq("id", yo.id);
    if (error) return setEstado("Error: " + error.message);
    setEstado("ok");
    onGuardado();
  }

  return (
    <Tarjeta titulo="Mi perfil" descripcion="Tu nombre y color son los que ve la otra persona en la agenda. Las preferencias sólo aplican para ti.">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nombre</span>
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium">Mi color</span>
          <div className="flex flex-wrap items-center gap-2">
            {PALETA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition ${color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-panel" : ""}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" title="Otro color" />
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Duración por defecto</span>
          <select className="campo" value={p.duracionMin} onChange={(e) => setP({ ...p, duracionMin: Number(e.target.value) })}>
            {[30, 45, 60, 90, 120, 150, 180, 240].map((m) => (
              <option key={m} value={m}>{m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Hora sugerida al crear cita</span>
          <input type="time" className="campo" value={p.horaInicio} onChange={(e) => setP({ ...p, horaInicio: e.target.value })} />
        </label>

        <Interruptor
          label="La semana empieza en lunes"
          valor={p.semanaEmpiezaLunes}
          onChange={(v) => setP({ ...p, semanaEmpiezaLunes: v })}
        />
        <Interruptor
          label="Ocultar sábados y domingos"
          valor={p.ocultarFinDeSemana}
          onChange={(v) => setP({ ...p, ocultarFinDeSemana: v })}
        />
      </div>

      {/* Recordatorios por correo */}
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-semibold">Recordatorios por correo</h3>
        <p className="mb-3 mt-0.5 text-sm text-muted">
          Cada madrugada (entre 4 y 5 a. m.) te llega <b>un solo correo</b> con tus citas próximas. Si no tienes citas, no te llega nada.
        </p>
        <Interruptor
          label="Recibir recordatorios"
          valor={p.recordatorios}
          onChange={(v) => setP({ ...p, recordatorios: v })}
        />
        <div className={`mt-3 flex flex-wrap gap-2 ${p.recordatorios ? "" : "pointer-events-none opacity-40"}`}>
          {[
            { n: 2, label: "2 días antes" },
            { n: 1, label: "1 día antes" },
            { n: 0, label: "El mismo día" },
          ].map(({ n, label }) => {
            const activo = p.recordatorioDias.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  setP({
                    ...p,
                    recordatorioDias: activo ? p.recordatorioDias.filter((x) => x !== n) : [...p.recordatorioDias, n].sort((a, b) => b - a),
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  activo ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:bg-panel-2"
                }`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${activo ? "border-accent bg-accent text-panel" : "border-line"}`}>
                  {activo ? "✓" : ""}
                </span>
                {label}
              </button>
            );
          })}
        </div>
        {p.recordatorios && p.recordatorioDias.length === 0 && (
          <p className="mt-2 text-sm text-danger">Elige al menos una opción o apaga los recordatorios.</p>
        )}
        <BotonPrueba />
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {estado === "ok" && <span className="text-sm text-accent">Guardado ✓</span>}
        {estado.startsWith("Error") && <span className="text-sm text-danger">{estado}</span>}
        <button className="btn btn-primario" onClick={guardar} disabled={estado === "guardando"}>
          {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </Tarjeta>
  );
}

function Interruptor({ label, valor, onChange }: { label: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      onClick={() => onChange(!valor)}
      className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-left text-sm"
    >
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${valor ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-panel shadow transition-all ${valor ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

type Item = { id: string; nombre: string; activo: boolean; color?: string };

function Catalogo({
  titulo, descripcion, placeholder, items, conColor,
  onAgregar, onRenombrar, onToggle, onBorrar, onColor, onCambio,
}: {
  titulo: string;
  descripcion: string;
  placeholder: string;
  items: Item[];
  conColor?: boolean;
  onAgregar: (nombre: string) => Resultado;
  onRenombrar: (id: string, nombre: string) => Resultado;
  onToggle: (id: string, activo: boolean) => Resultado;
  onBorrar: (id: string) => Resultado;
  onColor?: (id: string, color: string) => Resultado;
  onCambio: () => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);

  async function correr(accion: Resultado) {
    setError(null);
    const { error } = await accion;
    if (error) {
      setError(error.code === "23505" ? "Ya existe uno con ese nombre." : error.message);
      return false;
    }
    onCambio();
    return true;
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.trim()) return;
    if (await correr(onAgregar(nuevo.trim()))) setNuevo("");
  }

  async function guardarNombre() {
    if (!editando) return;
    if (editando.nombre.trim()) await correr(onRenombrar(editando.id, editando.nombre.trim()));
    setEditando(null);
  }

  return (
    <Tarjeta titulo={titulo} descripcion={descripcion}>
      <form onSubmit={agregar} className="mb-3 flex gap-2">
        <input className="campo" placeholder={placeholder} value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
        <button className="btn btn-primario shrink-0" type="submit">Agregar</button>
      </form>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">Aún no hay {titulo.toLowerCase()}.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((it) => (
            <li key={it.id} className={`flex items-center gap-2 px-3 py-2 ${it.activo ? "" : "opacity-50"}`}>
              {conColor && onColor && (
                <input
                  type="color"
                  value={it.color}
                  onChange={(e) => correr(onColor(it.id, e.target.value))}
                  className="h-6 w-7 shrink-0 cursor-pointer rounded border border-line bg-transparent"
                  title="Color"
                />
              )}
              {editando?.id === it.id ? (
                <input
                  className="campo py-1"
                  autoFocus
                  value={editando.nombre}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  onBlur={guardarNombre}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") guardarNombre();
                    if (e.key === "Escape") setEditando(null);
                  }}
                />
              ) : (
                <button className="mr-auto truncate text-left text-sm" onClick={() => setEditando({ id: it.id, nombre: it.nombre })} title="Clic para renombrar">
                  {it.nombre}
                </button>
              )}
              <button
                className="btn btn-sec shrink-0 px-2 py-1 text-xs"
                onClick={() => correr(onToggle(it.id, !it.activo))}
                title={it.activo ? "Ocultar de las opciones (sin borrar citas viejas)" : "Volver a mostrar"}
              >
                {it.activo ? "Ocultar" : "Mostrar"}
              </button>
              <BotonBorrar onConfirmar={() => correr(onBorrar(it.id))} />
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function BotonBorrar({ onConfirmar }: { onConfirmar: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    if (!confirmar) return;
    const t = setTimeout(() => setConfirmar(false), 3000);
    return () => clearTimeout(t);
  }, [confirmar]);
  return (
    <button
      className="btn btn-peligro shrink-0 px-2 py-1 text-xs"
      onClick={() => (confirmar ? onConfirmar() : setConfirmar(true))}
      title="Borrar (las citas que la usan se quedan sin ese dato)"
    >
      {confirmar ? "¿Seguro?" : "Borrar"}
    </button>
  );
}

function BotonPrueba() {
  const [estado, setEstado] = useState<"" | "enviando" | string>("");

  async function probar() {
    setEstado("enviando");
    try {
      const res = await fetch("/api/recordatorios/prueba", { method: "POST" });
      const data = await res.json();
      setEstado(res.ok ? `ok:${data.correo}` : `Error: ${data.error ?? res.status}`);
    } catch {
      setEstado("Error: sin conexión");
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-sec" onClick={probar} disabled={estado === "enviando"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
        {estado === "enviando" ? "Enviando…" : "Enviarme una prueba"}
      </button>
      {estado.startsWith("ok:") && (
        <span className="text-sm text-accent">Enviado a {estado.slice(3)}. Si no lo ves, revisa Spam.</span>
      )}
      {estado.startsWith("Error") && <span className="text-sm text-danger">{estado}</span>}
    </div>
  );
}
