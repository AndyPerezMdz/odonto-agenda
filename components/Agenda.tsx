"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCatalogos, useCitas } from "@/lib/useDatos";
import { prefs, type Cita } from "@/lib/types";
import {
  aISO, deISO, diasDelMes, esFinDeSemana, fechaLarga, hhmm, hoyISO,
  MESES, DIAS_CORTOS_LUNES, DIAS_CORTOS_DOMINGO,
} from "@/lib/fechas";
import CitaModal from "@/components/CitaModal";
import { MANUAL_URL } from "@/lib/manual";

type Filtro = "todos" | string; // "todos" o id de perfil

export default function Agenda({ userId }: { userId: string }) {
  const router = useRouter();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [seleccionado, setSeleccionado] = useState(hoyISO());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [modal, setModal] = useState<{ cita: Cita | null; fecha: string } | null>(null);

  const { supabase, perfiles, clinicas, materias } = useCatalogos();
  const yo = perfiles.find((p) => p.id === userId);
  const p = prefs(yo?.preferencias);

  const dias = useMemo(
    () => diasDelMes(anio, mes, p.semanaEmpiezaLunes),
    [anio, mes, p.semanaEmpiezaLunes]
  );
  const diasVisibles = p.ocultarFinDeSemana ? dias.filter((d) => !esFinDeSemana(d)) : dias;
  const encabezados = (p.semanaEmpiezaLunes ? DIAS_CORTOS_LUNES : DIAS_CORTOS_DOMINGO).filter(
    (d) => !p.ocultarFinDeSemana || (d !== "Sáb" && d !== "Dom")
  );
  const columnas = p.ocultarFinDeSemana ? 5 : 7;

  const { citas } = useCitas(aISO(dias[0]), aISO(dias[dias.length - 1]));

  const perfilPorId = useMemo(() => new Map(perfiles.map((x) => [x.id, x])), [perfiles]);
  const clinicaPorId = useMemo(() => new Map(clinicas.map((x) => [x.id, x])), [clinicas]);
  const materiaPorId = useMemo(() => new Map(materias.map((x) => [x.id, x])), [materias]);

  const citasFiltradas = filtro === "todos" ? citas : citas.filter((c) => c.owner_id === filtro);
  const porDia = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of citasFiltradas) {
      const arr = m.get(c.fecha) ?? [];
      arr.push(c);
      m.set(c.fecha, arr);
    }
    return m;
  }, [citasFiltradas]);

  const citasDelDia = porDia.get(seleccionado) ?? [];

  function moverMes(delta: number) {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  }

  function irAHoy() {
    setAnio(hoy.getFullYear());
    setMes(hoy.getMonth());
    setSeleccionado(hoyISO());
  }

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const hoyStr = hoyISO();

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Encabezado */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Agenda</h1>
          {yo && <p className="text-sm text-muted">Hola, {yo.nombre}</p>}
        </div>
        <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer" className="btn btn-sec" title="Manual de usuario">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>
          <span className="hidden sm:inline">Manual</span>
        </a>
        <Link href="/personalizar" className="btn btn-sec">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>
          Personalizar
        </Link>
        <button onClick={salir} className="btn btn-sec" title="Cerrar sesión">Salir</button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Calendario */}
        <section className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button className="btn btn-sec px-2.5" onClick={() => moverMes(-1)} aria-label="Mes anterior">‹</button>
              <button className="btn btn-sec px-2.5" onClick={() => moverMes(1)} aria-label="Mes siguiente">›</button>
            </div>
            <h2 className="text-lg font-semibold">{MESES[mes]} {anio}</h2>
            <button className="btn btn-sec ml-1 py-1 text-xs" onClick={irAHoy}>Hoy</button>

            {/* Filtro por persona */}
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Chip activo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos</Chip>
              {perfiles.map((pf) => (
                <Chip key={pf.id} activo={filtro === pf.id} onClick={() => setFiltro(pf.id)} color={pf.color}>
                  {pf.id === userId ? "Yo" : pf.nombre}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
            {encabezados.map((d) => (
              <div key={d} className="bg-panel-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
                {d}
              </div>
            ))}
            {diasVisibles.map((d) => {
              const iso = aISO(d);
              const delMes = d.getMonth() === mes;
              const lista = porDia.get(iso) ?? [];
              const esHoy = iso === hoyStr;
              const esSel = iso === seleccionado;
              const pasado = iso < hoyStr;
              return (
                <button
                  key={iso}
                  onClick={() => setSeleccionado(iso)}
                  onDoubleClick={() => setModal({ cita: null, fecha: iso })}
                  className={`group relative flex min-h-[74px] flex-col items-stretch gap-1 p-1.5 text-left transition sm:min-h-[104px] sm:p-2 ${
                    delMes ? "bg-panel" : "bg-panel-2/60"
                  } ${esSel ? "ring-2 ring-inset ring-accent" : "hover:bg-panel-2"}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-medium sm:text-sm ${
                        esHoy ? "bg-accent text-panel" : delMes ? "" : "text-muted/60"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {delMes && !pasado && lista.length === 0 && (
                      <span className="hidden rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent sm:inline">
                        Libre
                      </span>
                    )}
                  </div>

                  {/* Móvil: puntitos */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {lista.slice(0, 6).map((c) => (
                      <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: perfilPorId.get(c.owner_id)?.color }} />
                    ))}
                  </div>

                  {/* Escritorio: pastillas */}
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {lista.slice(0, 3).map((c) => (
                      <span
                        key={c.id}
                        className="truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight"
                        style={{
                          background: `${perfilPorId.get(c.owner_id)?.color ?? "#888"}22`,
                          borderLeft: `3px solid ${perfilPorId.get(c.owner_id)?.color ?? "#888"}`,
                        }}
                      >
                        <span className="font-medium">{hhmm(c.hora_inicio)}</span> {c.paciente}
                      </span>
                    ))}
                    {lista.length > 3 && <span className="px-1 text-[11px] text-muted">+{lista.length - 3} más</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 hidden text-xs text-muted sm:block">Tip: doble clic en un día para agendar directo.</p>
        </section>

        {/* Panel del día */}
        <aside className="rounded-2xl border border-line bg-panel p-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Día seleccionado</p>
              <h3 className="text-lg font-semibold first-letter:uppercase">{fechaLarga(seleccionado)}</h3>
            </div>
            <button className="btn btn-primario shrink-0" onClick={() => setModal({ cita: null, fecha: seleccionado })}>
              + Cita
            </button>
          </div>

          {citasDelDia.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              {filtro === "todos" ? "Nadie tiene citas este día." : "Sin citas este día."}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {citasDelDia.map((c) => {
                const dueno = perfilPorId.get(c.owner_id);
                const clinica = c.clinica_id ? clinicaPorId.get(c.clinica_id) : null;
                const materia = c.materia_id ? materiaPorId.get(c.materia_id) : null;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setModal({ cita: c, fecha: c.fecha })}
                      className="w-full rounded-xl border border-line p-3 text-left transition hover:bg-panel-2"
                      style={{ borderLeft: `4px solid ${dueno?.color ?? "#888"}` }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{c.paciente}</span>
                        <span className="shrink-0 text-sm tabular-nums text-muted">
                          {hhmm(c.hora_inicio)}–{hhmm(c.hora_fin)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {clinica && <Etiqueta>{clinica.numero}</Etiqueta>}
                        {materia && <Etiqueta color={materia.color}>{materia.nombre}</Etiqueta>}
                        <span className="ml-auto text-muted">{dueno?.id === userId ? "Tú" : dueno?.nombre}</span>
                      </div>
                      {c.notas && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{c.notas}</p>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {modal && (
        <CitaModal
          supabase={supabase}
          userId={userId}
          cita={modal.cita}
          fechaInicial={modal.fecha}
          perfiles={perfiles}
          clinicas={clinicas}
          materias={materias}
          preferencias={p}
          onClose={() => setModal(null)}
          onGuardado={(fecha) => {
            setModal(null);
            setSeleccionado(fecha);
            const d = deISO(fecha);
            setAnio(d.getFullYear());
            setMes(d.getMonth());
          }}
        />
      )}
    </div>
  );
}

function Chip({
  activo, onClick, color, children,
}: { activo: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        activo ? "border-ink bg-ink text-panel" : "border-line hover:bg-panel-2"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

function Etiqueta({ color, children }: { color?: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-md bg-panel-2 px-1.5 py-0.5"
      style={color ? { background: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  );
}
