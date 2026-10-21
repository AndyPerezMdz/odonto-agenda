"use client";

import Shell from "@/components/Shell";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCatalogos, useHorarios } from "@/lib/useDatos";
import MiHorario from "@/components/MiHorario";
import AjustesCalendario from "@/components/AjustesCalendario";
import { DURACIONES, esUady, textoDuracion } from "@/lib/universidades";
import { prefs, type Preferencias } from "@/lib/types";
import { TEMAS, MARCADORES, aplicarTema, type MarcadorId } from "@/lib/tema";
import MarcadorHoy from "@/components/MarcadorHoy";
import TarjetaCompanero from "@/components/TarjetaCompanero";
import TarjetaSuscripcion from "@/components/TarjetaSuscripcion";
import TarjetaAvisos from "@/components/TarjetaAvisos";
import Candado from "@/components/Candado";
import GanchoMiAgenda from "@/components/personal/GanchoMiAgenda";

const PALETA = ["#2f5d50", "#6366f1", "#db2777", "#ea580c", "#0891b2", "#65a30d", "#9333ea", "#b45309"];

export default function Personalizar({ userId }: { userId: string }) {
  const { supabase, perfiles, clinicas, materias, ajustes, recargar, pro, nombreAgenda } = useCatalogos();
  const yo = perfiles.find((p) => p.id === userId);
  const { horarios, recargar: recargarHorarios } = useHorarios();
  const esDueno = yo?.rol === "owner";
  const uady = esUady(ajustes.universidad); // duración por materia, materia en el horario, turnos
  const [panel, setPanelEstado] = useState<Panel | null>(null);

  // /personalizar#suscripcion, #avisos, … abre directo esa sección (los links viejos #yo y #agenda también sirven)
  useEffect(() => {
    const leer = () => {
      const h = window.location.hash.replace("#", "");
      const alias: Record<string, Panel> = { yo: "perfil", agenda: "clinicas" };
      const v = (alias[h] ?? h) as Panel;
      setPanelEstado(PANELES.includes(v) ? v : null);
    };
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, []);

  function abrir(p: Panel | null) {
    setPanelEstado(p);
    history.replaceState(null, "", p ? `#${p}` : "/personalizar");
    window.scrollTo({ top: 0 });
  }

  const menu: { id: Panel; t: string; d: string; ico: string; solo?: boolean }[] = [
    { id: "perfil", t: "Mi perfil y apariencia", d: "Tu nombre, tu color, el tema y los recordatorios por correo", ico: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
    { id: "avisos", t: "Notificaciones y calendario", d: "Avisos en tu cel y tus citas en Google o iPhone", ico: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" },
    { id: "horario", t: "Mi horario de clínica", d: "Tus bloques fijos de cada semana", ico: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
    { id: "clinicas", t: uady ? "Clínicas, materias y turnos" : "Clínicas y materias", d: uady ? "Catálogos, duración por materia y cómo se turnan" : "Los catálogos que comparten tú y tu compa", ico: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" },
    { id: "companero", t: "Compañero/a", d: "Invita o cambia a quien comparte tu agenda", ico: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c.7-3.8 3.6-6 7-6s6.3 2.2 7 6M19 8v6M16 11h6", solo: true },
    { id: "suscripcion", t: "Suscripción", d: pro ? "Tu plan Pro y tus pagos" : "Planes de Pro y cómo pagar", ico: "M2 7h20v12H2zM2 11h20", solo: true },
    { id: "personal", t: "Mi agenda personal", d: "Viajes, cursos y entregas, en otra agenda que sólo tú ves", ico: "M7 16 3 12l4-4M3 12h13M17 8l4 4-4 4" },
  ];
  const visibles = menu.filter((m) => !m.solo || esDueno);
  const actual = visibles.find((m) => m.id === panel);

  return (
    <Shell actual="personalizar" titulo={actual ? actual.t : "Personalizar"} nombreAgenda={nombreAgenda} uady={uady} esDueno={esDueno}>
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      {!actual ? (
        <>
          <ul className="overflow-hidden rounded-2xl border border-line bg-panel">
            {visibles.map((m, i) => (
              <li key={m.id} className={i ? "border-t border-line" : ""}>
                <button onClick={() => abrir(m.id)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-panel-2">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${m.id === "personal" ? "bg-[#eceafe] text-[#4f46e5]" : "bg-accent-soft text-accent"}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m.ico} /></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.t}{m.id === "personal" && <span className="ml-2 rounded-full bg-[#4f46e5] px-1.5 py-px align-middle text-[10px] font-bold text-white">NUEVO</span>}</span>
                    <span className="block truncate text-sm text-muted">{m.d}</span>
                  </span>
                  <span className="text-muted" aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
          <Link href="/nueva-contrasena" className="mt-3 flex items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-3.5 hover:bg-panel-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-muted">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <span className="flex-1 font-medium">Cambiar contraseña</span>
            <span className="text-muted" aria-hidden>›</span>
          </Link>
          <p className="mt-8 text-center text-xs text-muted">
            <Link href="/privacidad" className="hover:text-ink">Aviso de privacidad</Link> ·{" "}
            <Link href="/terminos" className="hover:text-ink">Términos y condiciones</Link>
          </p>
        </>
      ) : (
        <>
          <button onClick={() => abrir(null)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">‹ Personalizar</button>
          <div className="flex flex-col gap-5">
            {panel === "perfil" && yo && <MiPerfil key={yo.id} supabase={supabase} yo={yo} onGuardado={recargar} pro={pro} esDueno={esDueno} />}
            {panel === "avisos" && <TarjetaAvisos pro={pro} esDueno={esDueno} />}
            {panel === "horario" && <MiHorario supabase={supabase} userId={userId} horarios={horarios} clinicas={clinicas} materias={materias} conMateria={uady} onCambio={recargarHorarios} />}
            {panel === "companero" && esDueno && <TarjetaCompanero onCambio={recargar} />}
            {panel === "suscripcion" && esDueno && <TarjetaSuscripcion />}
            {panel === "personal" && <GanchoMiAgenda />}
            {panel === "clinicas" && (
              <>
                {uady && <AjustesCalendario ajustes={ajustes} perfiles={perfiles} userId={userId} onCambio={recargar} pro={pro} esDueno={esDueno} />}
                <Catalogo
                  titulo="Clínicas"
                  descripcion="Número o nombre de cada clínica física. Compartidas entre los dos."
                  placeholder="Ej. Clínica 3"
                  items={clinicas.map((c) => ({ id: c.id, nombre: c.numero, activo: c.activo }))}
                  onAgregar={(nombre) => supabase.from("clinicas").insert({ numero: nombre })}
                  onRenombrar={(id, nombre) => supabase.from("clinicas").update({ numero: nombre }).eq("id", id)}
                  onToggle={(id, activo) => supabase.from("clinicas").update({ activo }).eq("id", id)}
                  tipo="clinica"
                  onCambio={recargar}
                />
                <Catalogo
                  titulo="Materias"
                  descripcion={uady ? "Cada materia puede tener su color, cuánto dura una cita y su lista de material (qué llevar a sus citas)." : "Cada materia puede tener su color y su lista de material (qué llevar a sus citas)."}
                  placeholder="Ej. Prostodoncia"
                  conColor
                  items={materias.map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo, color: m.color, material: m.material, duracion: m.duracion_min ?? null }))}
                  onAgregar={(nombre) => supabase.from("materias").insert({ nombre, color: PALETA[materias.length % PALETA.length] })}
                  onRenombrar={(id, nombre) => supabase.from("materias").update({ nombre }).eq("id", id)}
                  onColor={(id, color) => supabase.from("materias").update({ color }).eq("id", id)}
                  onMaterial={(id, material) => supabase.from("materias").update({ material }).eq("id", id)}
                  onDuracion={uady ? (id, duracion_min) => supabase.from("materias").update({ duracion_min }).eq("id", id) : undefined}
                  onToggle={(id, activo) => supabase.from("materias").update({ activo }).eq("id", id)}
                  tipo="materia"
                  onCambio={recargar}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
    </Shell>
  );
}

type Panel = "perfil" | "avisos" | "horario" | "clinicas" | "companero" | "suscripcion" | "personal";
const PANELES: Panel[] = ["perfil", "avisos", "horario", "clinicas", "companero", "suscripcion", "personal"];

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
  supabase, yo, onGuardado, pro, esDueno,
}: {
  pro: boolean;
  esDueno: boolean;
  supabase: ReturnType<typeof useCatalogos>["supabase"];
  yo: { id: string; nombre: string; color: string; preferencias: Preferencias };
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(yo.nombre);
  const [color, setColor] = useState(yo.color);
  const [p, setP] = useState(prefs(yo.preferencias));
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | string>("");

  // Vista previa en vivo del tema (se guarda hasta "Guardar cambios")
  useEffect(() => {
    aplicarTema(p.tema);
  }, [p.tema]);

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

      {/* Apariencia */}
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-semibold">Apariencia</h3>
        <p className="mb-3 mt-0.5 text-sm text-muted">Sólo cambia cómo ves tú la agenda. Se ve al instante; guarda para conservarlo.</p>

        <span className="mb-2 block text-sm font-medium">Colores</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TEMAS.map((t) => {
            const activo = p.tema === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={activo}
                onClick={() => setP({ ...p, tema: t.id })}
                className={`rounded-xl border p-2.5 text-left transition ${activo ? "border-accent ring-2 ring-accent/30" : "border-line hover:bg-panel-2"}`}
              >
                <span className="mb-2 flex h-8 overflow-hidden rounded-lg border border-black/5">
                  <span className="w-1/2" style={{ background: t.muestra[0] }} />
                  <span className="w-1/4" style={{ background: t.muestra[1] }} />
                  <span className="w-1/4" style={{ background: t.muestra[2] }} />
                </span>
                <span className="flex items-center justify-between text-sm">
                  {t.nombre}
                  {activo && <span className="text-accent">✓</span>}
                </span>
              </button>
            );
          })}
        </div>

        <span className="mb-2 mt-4 block text-sm font-medium">Forma del día de hoy</span>
        <div className="flex flex-wrap gap-2">
          {MARCADORES.map((m) => {
            const activo = p.marcadorHoy === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={activo}
                onClick={() => setP({ ...p, marcadorHoy: m.id })}
                className={`flex w-[76px] flex-col items-center gap-1.5 rounded-xl border px-2 pb-2 pt-3 text-xs transition ${
                  activo ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:bg-panel-2"
                }`}
              >
                <MarcadorHoy forma={m.id as MarcadorId} dia={new Date().getDate()} />
                {m.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recordatorios por correo (Pro) */}
      {!pro ? (
        <div className="mt-6 border-t border-line pt-5">
          <Candado compacto titulo="Recordatorios por correo" texto="Un correo cada madrugada con tus citas próximas." esDueno={esDueno} />
        </div>
      ) : (
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
      )}

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

type Item = { id: string; nombre: string; activo: boolean; color?: string; material?: string | null; duracion?: number | null };

function Catalogo({
  titulo, descripcion, placeholder, items, conColor,
  onAgregar, onRenombrar, onToggle, tipo, onColor, onMaterial, onDuracion, onCambio,
}: {
  tipo: "clinica" | "materia";
  onDuracion?: (id: string, min: number | null) => Resultado;
  titulo: string;
  descripcion: string;
  placeholder: string;
  items: Item[];
  conColor?: boolean;
  onAgregar: (nombre: string) => Resultado;
  onRenombrar: (id: string, nombre: string) => Resultado;
  onToggle: (id: string, activo: boolean) => Resultado;
  onColor?: (id: string, color: string) => Resultado;
  onMaterial?: (id: string, material: string | null) => Resultado;
  onCambio: () => void;
}) {
  const [material, setMaterial] = useState<{ id: string; texto: string } | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);
  // 2.3 · Borrar sin dejar citas huérfanas: primero se ve cuántas la usan y a cuál pasarlas
  const [borrando, setBorrando] = useState<{ id: string; citas: number | null; pasarA: string; enviando?: boolean } | null>(null);
  const sin = tipo === "clinica" ? "clínica" : "materia";

  async function empezarBorrar(id: string) {
    setError(null);
    const otra = items.find((x) => x.id !== id && x.activo)?.id ?? "";
    setBorrando({ id, citas: null, pasarA: otra });
    const r = await fetch(`/api/catalogo?tipo=${tipo}&id=${id}`).then((r) => r.json()).catch(() => null);
    if (typeof r?.citas !== "number") {
      setBorrando(null);
      setError(r?.error ?? "No se pudo revisar. Intenta de nuevo.");
      return;
    }
    setBorrando((b) => (b?.id === id ? { ...b, citas: r.citas } : b));
  }
  async function borrar() {
    if (!borrando) return;
    setBorrando({ ...borrando, enviando: true });
    const res = await fetch("/api/catalogo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, id: borrando.id, pasarA: borrando.citas ? borrando.pasarA || null : null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "No se pudo borrar.");
      setBorrando({ ...borrando, enviando: false });
      return;
    }
    setBorrando(null);
    onCambio();
  }

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
            <li key={it.id} className={`px-3 py-2 ${it.activo ? "" : "opacity-50"}`}>
             <div className="flex items-center gap-2">
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
                <span className="mr-auto flex min-w-0 items-center gap-1">
                  <button className="truncate text-left text-sm" onClick={() => setEditando({ id: it.id, nombre: it.nombre })} title="Cambiar nombre">
                    {it.nombre}
                  </button>
                  <button
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                    onClick={() => setEditando({ id: it.id, nombre: it.nombre })}
                    title="Cambiar nombre"
                    aria-label={`Cambiar nombre de ${it.nombre}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                  </button>
                </span>
              )}
              <button
                className="btn btn-sec shrink-0 px-2 py-1 text-xs"
                onClick={() => correr(onToggle(it.id, !it.activo))}
                title={it.activo ? "Ocultar de las opciones (sin borrar citas viejas)" : "Volver a mostrar"}
              >
                {it.activo ? "Ocultar" : "Mostrar"}
              </button>
              {onDuracion && (
                <select
                  className="w-[5.5rem] shrink-0 rounded-lg border border-line bg-panel px-1.5 py-1 text-xs"
                  value={it.duracion ?? ""}
                  onChange={(e) => correr(onDuracion(it.id, e.target.value ? Number(e.target.value) : null))}
                  title="Cuánto dura una cita de esta materia"
                  aria-label={`Duración de ${it.nombre}`}
                >
                  <option value="">Dura…</option>
                  {[...new Set([...DURACIONES, ...(it.duracion ? [it.duracion] : [])])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{textoDuracion(d)}</option>)}
                </select>
              )}
              {onMaterial && (
                <button
                  className={`btn btn-sec shrink-0 px-2 py-1 text-xs ${it.material?.trim() ? "text-accent" : ""}`}
                  onClick={() => setMaterial(material?.id === it.id ? null : { id: it.id, texto: it.material ?? "" })}
                  title="Qué llevar a las citas de esta materia"
                >
                  Material{it.material?.trim() ? ` · ${it.material.split("\n").filter((x) => x.trim()).length}` : ""}
                </button>
              )}
              <button className="btn btn-peligro shrink-0 px-2 py-1 text-xs" onClick={() => (borrando?.id === it.id ? setBorrando(null) : empezarBorrar(it.id))}>
                Borrar
              </button>
             </div>
              {borrando?.id === it.id && (
                <div className="mt-2 rounded-xl border border-danger/40 bg-panel-2 p-3 text-sm">
                  {borrando.citas === null ? (
                    <p className="text-muted">Revisando qué citas la usan…</p>
                  ) : borrando.citas === 0 ? (
                    <p>Ninguna cita usa <b>{it.nombre}</b>. ¿La borro?</p>
                  ) : (
                    <>
                      <p className="mb-2">
                        <b>{borrando.citas} cita{borrando.citas === 1 ? "" : "s"}</b> (tuyas y de tu compa) usa{borrando.citas === 1 ? "" : "n"} <b>{it.nombre}</b>. ¿A cuál {tipo === "clinica" ? "clínica" : "materia"} las paso?
                      </p>
                      <select className="campo py-2 text-sm" value={borrando.pasarA} onChange={(e) => setBorrando({ ...borrando, pasarA: e.target.value })}>
                        {items.filter((x) => x.id !== it.id).map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.activo ? "" : " (oculta)"}</option>)}
                        <option value="">Dejarlas sin {sin}</option>
                      </select>
                      {!borrando.pasarA && <p className="mt-1.5 text-xs text-danger">Esas citas quedarán sin {sin} y tendrías que ponérsela una por una.</p>}
                      <p className="mt-1.5 text-xs text-muted">¿Sólo ya no la usan? Mejor <b>Ocultar</b>: no se borra nada.</p>
                    </>
                  )}
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button className="btn btn-sec px-3 py-1.5 text-xs" onClick={() => setBorrando(null)}>Cancelar</button>
                    <button className="btn btn-peligro px-3 py-1.5 text-xs" disabled={borrando.citas === null || borrando.enviando} onClick={borrar}>
                      {borrando.enviando ? "Borrando…" : borrando.citas && borrando.pasarA ? "Pasar citas y borrar" : "Borrar"}
                    </button>
                  </div>
                </div>
              )}
              {onMaterial && material?.id === it.id && (
                <div className="mt-2">
                  <textarea
                    className="campo min-h-[90px] text-sm"
                    autoFocus
                    value={material.texto}
                    onChange={(e) => setMaterial({ ...material, texto: e.target.value })}
                    placeholder={"Una cosa por renglón:\nKit de endodoncia\nRadiografías\nAislamiento"}
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Sale en cada cita de {it.nombre} y en tu recordatorio. Es compartido con tu compa.</span>
                    <button
                      className="btn btn-primario shrink-0 px-3 py-1 text-xs"
                      onClick={async () => (await correr(onMaterial(it.id, material.texto.trim() || null))) && setMaterial(null)}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
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
