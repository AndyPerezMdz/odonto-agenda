"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCatalogos, usePacientes } from "@/lib/useDatos";
import { prefs, type Cita, type EstadoPaciente, type Paciente } from "@/lib/types";
import { aplicarTema } from "@/lib/tema";
import { hoyISO, sumarMinutos } from "@/lib/fechas";
import { estadoPago } from "@/lib/pagos";
import { enlaceWhatsApp, mensajeInvitarPaciente, IcoWhatsApp } from "@/lib/whatsapp";
import CitaModal from "@/components/CitaModal";

const ESTADOS: { id: EstadoPaciente; t: string; c: string }[] = [
  { id: "pendiente", t: "Por contactar", c: "bg-panel-2 text-muted" },
  { id: "contactado", t: "Contactado", c: "bg-[#fdf6e3] text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]" },
  { id: "agendado", t: "Agendado", c: "bg-[#e6f4ea] text-[#1e6b3a] dark:bg-[#1a3324] dark:text-[#9fdcb3]" },
  { id: "descartado", t: "Descartado", c: "bg-panel-2 text-muted line-through" },
];
const estadoP = (e: EstadoPaciente) => ESTADOS.find((x) => x.id === e) ?? ESTADOS[0];

// Banco de pacientes: gente por conseguir o en espera, por materia. Para cuando falta un caso o se cae una cita.
export default function BancoPacientes({ userId, embebido = false }: { userId: string; embebido?: boolean }) {
  const { supabase, perfiles, clinicas, materias, pagadoHasta } = useCatalogos();
  const { pacientes, recargar } = usePacientes();
  const yo = perfiles.find((p) => p.id === userId);
  const p = prefs(yo?.preferencias);
  const soloLectura = estadoPago(pagadoHasta, hoyISO()).tipo === "vencida";
  useEffect(() => {
    if (yo) aplicarTema(p.tema);
  }, [yo, p.tema]);

  const [vista, setVista] = useState<"activos" | "agendado" | "descartado">("activos");
  const [materia, setMateria] = useState<string>("todas");
  const [deQuien, setDeQuien] = useState<string>(userId);
  const [agendar, setAgendar] = useState<Paciente | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Alta rápida
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [materiaNueva, setMateriaNueva] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);

  const materiaPorId = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias]);
  const esMio = deQuien === userId;

  const visibles = (pacientes ?? []).filter(
    (x) =>
      x.owner_id === deQuien &&
      (materia === "todas" || (materia === "sin" ? !x.materia_id : x.materia_id === materia)) &&
      (vista === "activos" ? x.estado === "pendiente" || x.estado === "contactado" : x.estado === vista)
  );
  const cuenta = (v: typeof vista) =>
    (pacientes ?? []).filter((x) => x.owner_id === deQuien && (v === "activos" ? x.estado === "pendiente" || x.estado === "contactado" : x.estado === v)).length;

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) return setError("Escribe el nombre.");
    const { error } = await supabase.from("pacientes").insert({
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      materia_id: materiaNueva || null,
      notas: notas.trim() || null,
    });
    if (error) return setError("No se pudo guardar: " + error.message);
    setNombre("");
    setTelefono("");
    setNotas("");
    recargar();
  }

  async function cambiarEstado(x: Paciente, estado: EstadoPaciente) {
    await supabase.from("pacientes").update({ estado }).eq("id", x.id);
    recargar();
  }

  async function borrar(x: Paciente) {
    await supabase.from("pacientes").delete().eq("id", x.id);
    recargar();
  }

  // Para "Agendar": una cita "plantilla" con sus datos
  const plantilla = (x: Paciente): Cita => ({
    id: "",
    owner_id: userId,
    paciente: x.nombre,
    fecha: hoyISO(),
    hora_inicio: p.horaInicio,
    hora_fin: sumarMinutos(p.horaInicio, p.duracionMin),
    clinica_id: null,
    materia_id: x.materia_id,
    notas: null,
    telefono: x.telefono,
  });

  return (
    <div className={embebido ? "" : "mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6"}>
      {!embebido && (
        <header className="mb-5 flex items-center gap-3">
          <Link href="/" className="btn btn-sec px-2.5" aria-label="Volver">‹</Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Banco de pacientes</h1>
            <p className="text-sm text-muted">Gente por conseguir o en espera, para cuando te falte un caso.</p>
          </div>
        </header>
      )}

      {aviso && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{aviso}</p>}

      {esMio && !soloLectura && (
        <form onSubmit={agregar} className="mb-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Agregar paciente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="campo" placeholder="Nombre (ej. Tía de Karla)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <input className="campo" type="tel" inputMode="tel" placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            <select className="campo" value={materiaNueva} onChange={(e) => setMateriaNueva(e.target.value)}>
              <option value="">¿Para qué materia?</option>
              {materias.filter((m) => m.activo).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <input className="campo" placeholder="Nota corta (ej. puede en las tardes)" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <p className="mt-2 text-xs text-muted">Sin diagnósticos ni datos clínicos: sólo lo necesario para contactarlo.</p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button className="btn btn-primario">Agregar</button>
          </div>
        </form>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium">
          {(["activos", "agendado", "descartado"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className={`rounded-md px-2.5 py-1 ${vista === v ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>
              {v === "activos" ? "Por conseguir" : v === "agendado" ? "Agendados" : "Descartados"} · {cuenta(v)}
            </button>
          ))}
        </div>
        {perfiles.length > 1 && (
          <div className="ml-auto flex gap-1.5">
            {perfiles.map((pf) => (
              <button
                key={pf.id}
                onClick={() => setDeQuien(pf.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${deQuien === pf.id ? "border-ink bg-ink text-panel" : "border-line hover:bg-panel-2"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: pf.color }} />
                {pf.id === userId ? "Míos" : pf.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ id: "todas", nombre: "Todas", color: "" }, ...materias.filter((m) => m.activo), { id: "sin", nombre: "Sin materia", color: "" }].map((m) => (
          <button
            key={m.id}
            onClick={() => setMateria(m.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${materia === m.id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}
          >
            {m.color && <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />}
            {m.nombre}
          </button>
        ))}
      </div>

      {!pacientes && <p className="text-sm text-muted">Cargando…</p>}
      {pacientes && visibles.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          {vista === "activos" ? (esMio ? "Aún no tienes pacientes por conseguir. Agrega a los que te recomienden." : "No tiene pacientes por conseguir.") : "No hay nada aquí."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visibles.map((x) => {
          const m = x.materia_id ? materiaPorId.get(x.materia_id) : null;
          const est = estadoP(x.estado);
          const wa = esMio ? enlaceWhatsApp(x.telefono, mensajeInvitarPaciente(x, yo?.nombre, m?.nombre)) : null;
          return (
            <li key={x.id} className="rounded-xl border border-line bg-panel p-3" style={{ borderLeft: `4px solid ${m?.color ?? "#94a3b8"}` }}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium">{x.nombre}</span>
                {m && <span className="text-xs" style={{ color: m.color }}>{m.nombre}</span>}
                <span className={`ml-auto rounded-md px-1.5 py-0.5 text-xs font-medium ${est.c}`}>{est.t}</span>
              </div>
              {(x.telefono || x.notas) && (
                <p className="mt-1 text-xs text-muted">
                  {x.telefono}
                  {x.telefono && x.notas ? " · " : ""}
                  {x.notas}
                </p>
              )}
              {esMio && !soloLectura && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  {wa && x.estado !== "descartado" && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => x.estado === "pendiente" && cambiarEstado(x, "contactado")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-2.5 py-1 font-medium text-white"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d={IcoWhatsApp} /></svg>
                      Escribirle
                    </a>
                  )}
                  {x.estado !== "agendado" && x.estado !== "descartado" && (
                    <button onClick={() => setAgendar(x)} className="rounded-full bg-accent px-2.5 py-1 font-medium text-panel">Agendar</button>
                  )}
                  {x.estado === "pendiente" && (
                    <button onClick={() => cambiarEstado(x, "contactado")} className="rounded-full border border-line px-2.5 py-1 font-medium hover:bg-panel-2">Ya lo contacté</button>
                  )}
                  {x.estado !== "descartado" ? (
                    <button onClick={() => cambiarEstado(x, "descartado")} className="ml-auto rounded-full px-2.5 py-1 text-muted hover:text-ink">Descartar</button>
                  ) : (
                    <>
                      <button onClick={() => cambiarEstado(x, "pendiente")} className="rounded-full border border-line px-2.5 py-1 font-medium hover:bg-panel-2">Recuperar</button>
                      <button onClick={() => borrar(x)} className="ml-auto rounded-full px-2.5 py-1 text-danger hover:underline">Borrar</button>
                    </>
                  )}
                  {x.estado === "agendado" && (
                    <button onClick={() => setAgendar(x)} className="rounded-full border border-line px-2.5 py-1 font-medium hover:bg-panel-2">Otra cita</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {agendar && (
        <CitaModal
          key={agendar.id}
          supabase={supabase}
          userId={userId}
          cita={null}
          fechaInicial={hoyISO()}
          plantilla={plantilla(agendar)}
          pacienteOrigen={agendar.id}
          pacientes={pacientes ?? []}
          perfiles={perfiles}
          clinicas={clinicas}
          materias={materias}
          preferencias={p}
          onClose={() => setAgendar(null)}
          onGuardado={() => {
            setAviso(`${agendar.nombre} quedó agendado. Lo ves en tu agenda.`);
            setAgendar(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}
