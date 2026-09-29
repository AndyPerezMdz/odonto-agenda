"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCatalogos, useHorarios, useMaterial } from "@/lib/useDatos";
import { prefs, type EstadoMaterial, type Material, type NivelMaterial } from "@/lib/types";
import { aplicarTema } from "@/lib/tema";
import AvisosMaterial from "@/components/AvisosMaterial";
import { HORAS_CEYE, hora, SUGERENCIAS_COMPARTIDAS, SUGERENCIAS_MIAS } from "@/lib/material";

const ESTADOS: { id: EstadoMaterial; nombre: string }[] = [
  { id: "listo", nombre: "Listo" },
  { id: "usado", nombre: "Usado" },
  { id: "ceye", nombre: "En CEyE" },
];
const NIVELES: { id: NivelMaterial; nombre: string }[] = [
  { id: "hay", nombre: "Hay" },
  { id: "poco", nombre: "Poco" },
  { id: "nada", nombre: "Se acabó" },
];

// Mi material: tu instrumental (listo / usado / en la CEyE) y los consumibles que compran entre los dos.
export default function MiMaterial({ userId }: { userId: string }) {
  const { supabase, perfiles, materias } = useCatalogos();
  const { horarios } = useHorarios();
  const { material, recargar } = useMaterial();
  const [error, setError] = useState<string | null>(null);
  const yo = perfiles.find((p) => p.id === userId);
  useEffect(() => {
    if (yo) aplicarTema(prefs(yo.preferencias).tema);
  }, [yo]);

  const mios = (material ?? []).filter((m) => !m.compartido && m.owner_id === userId);
  const compartidos = (material ?? []).filter((m) => m.compartido);
  const hayPareja = perfiles.length >= 2;

  async function correr(p: PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    const { error } = await p;
    if (error) setError(error.message.includes("row-level") ? "Tu agenda está en sólo lectura." : error.message);
    recargar();
  }

  const ahoraISO = () => new Date().toISOString();
  const cambiarEstado = (ids: string[], estado: EstadoMaterial) =>
    correr(supabase.from("material").update({ estado, en_ceye_desde: estado === "ceye" ? ahoraISO() : null, cambiado_por: userId, updated_at: ahoraISO() }).in("id", ids));
  const cambiarNivel = (id: string, nivel: NivelMaterial) =>
    correr(supabase.from("material").update({ nivel, cambiado_por: userId, updated_at: ahoraISO() }).eq("id", id));
  const agregar = (nombre: string, compartido: boolean, materia_id: string | null) =>
    correr(supabase.from("material").insert({ nombre: nombre.trim().slice(0, 80), compartido, materia_id }));
  const borrar = (id: string) => correr(supabase.from("material").delete().eq("id", id));

  const usados = mios.filter((m) => m.estado === "usado").map((m) => m.id);
  const enCeye = mios.filter((m) => m.estado === "ceye").map((m) => m.id);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 flex items-center gap-3">
        <Link href="/" className="btn btn-sec px-2.5" aria-label="Volver">‹</Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mi material</h1>
          <p className="text-sm text-muted">Tu instrumental y la CEyE, y lo que compran entre los dos.</p>
        </div>
      </header>

      {material && <AvisosMaterial userId={userId} horarios={horarios} perfiles={perfiles} material={material} />}
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <section className="mb-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Mi instrumental</h2>
          <span className="ml-auto flex flex-wrap gap-1.5">
            {usados.length > 0 && (
              <button className="btn btn-sec px-2.5 py-1 text-xs" onClick={() => cambiarEstado(usados, "ceye")}>
                Metí lo usado a la CEyE ({usados.length})
              </button>
            )}
            {enCeye.length > 0 && (
              <button className="btn btn-sec px-2.5 py-1 text-xs" onClick={() => cambiarEstado(enCeye, "listo")}>
                Ya me regresaron todo
              </button>
            )}
          </span>
        </div>
        <p className="mb-3 text-sm text-muted">
          Lo que es de cada quien. Márcalo <b className="text-ink">Usado</b> al salir de clínica y <b className="text-ink">En CEyE</b> cuando lo entregues: te aviso si no alcanza a salir antes de tu próxima clínica (tardan como {HORAS_CEYE} h).
        </p>
        {material === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          <>
            {mios.length > 0 && (
              <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
                {mios.map((m) => (
                  <FilaInstrumento key={m.id} m={m} materia={materias.find((x) => x.id === m.materia_id)} onEstado={(e) => cambiarEstado([m.id], e)} onBorrar={() => borrar(m.id)} />
                ))}
              </ul>
            )}
            <FormAgregar
              placeholder="Ej. Kit de endodoncia"
              sugerencias={SUGERENCIAS_MIAS.filter((s) => !mios.some((m) => m.nombre.toLowerCase() === s.toLowerCase()))}
              materias={materias.filter((m) => m.activo)}
              onAgregar={(n, mat) => agregar(n, false, mat)}
            />
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="font-semibold">{hayPareja ? "De los dos" : "Consumibles"}</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">
          {hayPareja
            ? "Lo que compran entre los dos (alginato, yeso, silicona…). Cualquiera puede marcar que se está acabando y al otro le sale el aviso."
            : "Alginato, yeso, silicona… Márcalo cuando se esté acabando para que no te agarre en clínica."}
        </p>
        {compartidos.length > 0 && (
          <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
            {compartidos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="mr-auto min-w-0">
                  <p className="text-sm font-medium">{m.nombre}</p>
                  {m.nivel !== "hay" && m.cambiado_por && (
                    <p className="text-xs text-muted">lo marcó {m.cambiado_por === userId ? "tú" : perfiles.find((p) => p.id === m.cambiado_por)?.nombre}</p>
                  )}
                </div>
                <Segmentos
                  opciones={NIVELES}
                  valor={m.nivel}
                  tono={(id) => (id === "nada" ? "bg-[#fbecea] text-[#7a1f1a]" : id === "poco" ? "bg-[#fdf6e3] text-[#6b4f0c]" : "bg-accent-soft text-accent")}
                  onCambio={(v) => cambiarNivel(m.id, v)}
                  etiqueta={m.nombre}
                />
                <BotonQuitar onClick={() => borrar(m.id)} nombre={m.nombre} />
              </li>
            ))}
          </ul>
        )}
        <FormAgregar
          placeholder="Ej. Alginato"
          sugerencias={SUGERENCIAS_COMPARTIDAS.filter((s) => !compartidos.some((m) => m.nombre.toLowerCase() === s.toLowerCase()))}
          onAgregar={(n) => agregar(n, true, null)}
        />
      </section>

      <p className="mt-5 text-center text-xs text-muted">
        La lista de qué llevar a cada materia está en <Link href="/personalizar#agenda" className="text-accent hover:underline">Personalizar → Materias</Link>.
      </p>
    </div>
  );
}

function FilaInstrumento({ m, materia, onEstado, onBorrar }: { m: Material; materia?: { nombre: string; color: string }; onEstado: (e: EstadoMaterial) => void; onBorrar: () => void }) {
  const desde = m.en_ceye_desde ? new Date(m.en_ceye_desde) : null;
  const sale = desde ? new Date(desde.getTime() + HORAS_CEYE * 3600000) : null;
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="mr-auto min-w-0">
        <p className="text-sm font-medium">{m.nombre}</p>
        <p className="text-xs text-muted">
          {materia && <span style={{ color: materia.color }}>● </span>}
          {materia?.nombre ?? "Para todas"}
          {m.estado === "ceye" && desde && sale && ` · entregado ${hora(desde)}, sale como a las ${hora(sale)}`}
        </p>
      </div>
      <Segmentos
        opciones={ESTADOS}
        valor={m.estado}
        tono={(id) => (id === "usado" ? "bg-[#fdf6e3] text-[#6b4f0c]" : id === "ceye" ? "bg-[#e7eefb] text-[#1f3f7a]" : "bg-accent-soft text-accent")}
        onCambio={onEstado}
        etiqueta={m.nombre}
      />
      <BotonQuitar onClick={onBorrar} nombre={m.nombre} />
    </li>
  );
}

function Segmentos<T extends string>({
  opciones, valor, tono, onCambio, etiqueta,
}: { opciones: { id: T; nombre: string }[]; valor: T; tono: (id: T) => string; onCambio: (v: T) => void; etiqueta: string }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium" role="group" aria-label={`Estado de ${etiqueta}`}>
      {opciones.map((o) => (
        <button
          key={o.id}
          onClick={() => o.id !== valor && onCambio(o.id)}
          aria-pressed={o.id === valor}
          className={`rounded-md px-2 py-1 ${o.id === valor ? tono(o.id) : "text-muted hover:text-ink"}`}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

function BotonQuitar({ onClick, nombre }: { onClick: () => void; nombre: string }) {
  const [seguro, setSeguro] = useState(false);
  useEffect(() => {
    if (!seguro) return;
    const t = setTimeout(() => setSeguro(false), 3000);
    return () => clearTimeout(t);
  }, [seguro]);
  return (
    <button
      onClick={() => (seguro ? onClick() : setSeguro(true))}
      className={`rounded-md px-1.5 py-1 text-xs ${seguro ? "text-danger" : "text-muted hover:text-danger"}`}
      aria-label={`Quitar ${nombre}`}
      title="Quitar"
    >
      {seguro ? "¿Quitar?" : "✕"}
    </button>
  );
}

function FormAgregar({
  placeholder, sugerencias, materias, onAgregar,
}: { placeholder: string; sugerencias: string[]; materias?: { id: string; nombre: string }[]; onAgregar: (nombre: string, materiaId: string | null) => void }) {
  const [nombre, setNombre] = useState("");
  const [materia, setMateria] = useState("");
  return (
    <>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nombre.trim()) return;
          onAgregar(nombre, materia || null);
          setNombre("");
        }}
      >
        <input className={`campo min-w-0 flex-1 ${materias?.length ? "basis-full sm:basis-0" : ""}`} placeholder={placeholder} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
        {materias && materias.length > 0 && (
          <select className="campo flex-1 sm:flex-none" style={{ width: "auto" }} value={materia} onChange={(e) => setMateria(e.target.value)} aria-label="Materia">
            <option value="">Para todas</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}
        <button className="btn btn-primario">Agregar</button>
      </form>
      {sugerencias.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sugerencias.map((s) => (
            <button key={s} onClick={() => onAgregar(s, materia || null)} className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent">
              + {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
