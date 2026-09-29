"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCatalogos, useCitas, useHorarios, usePacientes } from "@/lib/useDatos";
import { prefs, type Cita, type Materia } from "@/lib/types";
import { aplicarTema } from "@/lib/tema";
import { deISO, fechaLarga, hhmm, hoyISO } from "@/lib/fechas";
import { palabraPeriodo, rangoDe } from "@/lib/cuatrimestre";
import { esUady, periodosDe } from "@/lib/universidades";
import { finClinicas, inicioClinicas, ocurrencias, rolesDe, ritmoDe, type Ritmo, type Turnos } from "@/lib/ritmo";
import { pesos, sumarDias } from "@/lib/pagos";

// "Mi avance": cuántos casos lleva cada quien por materia en el cuatrimestre, contra la meta.
export default function Avance({ userId }: { userId: string }) {
  const { supabase, perfiles, materias, ajustes, recargar: recargarCatalogos } = useCatalogos();
  const { horarios } = useHorarios();
  const [fechaRef, setFechaRef] = useState(hoyISO());
  const [persona, setPersona] = useState(userId);
  const [todo, setTodo] = useState(false);
  const tipo = periodosDe(ajustes.universidad);
  const uady = esUady(ajustes.universidad); // ritmo y clínicas restantes: sólo UADY
  const rango = rangoDe(deISO(fechaRef), tipo);
  const { citas, recargar } = useCitas(todo ? "2000-01-01" : rango.desde, todo ? "2100-12-31" : rango.hasta);
  const [metas, setMetas] = useState<Map<string, number>>(new Map());
  const { pacientes } = usePacientes();

  // Metas: cada quien tiene las suyas (clave = persona:materia)
  const cargarMetas = useCallback(async () => {
    const { data } = await supabase.from("metas").select("perfil_id,materia_id,meta");
    setMetas(new Map((data ?? []).map((m) => [`${m.perfil_id}:${m.materia_id}`, m.meta as number])));
  }, [supabase]);
  useEffect(() => {
    cargarMetas();
  }, [cargarMetas]);
  const hoy = hoyISO();

  const yo = perfiles.find((p) => p.id === userId);
  useEffect(() => {
    if (yo) aplicarTema(prefs(yo.preferencias).tema);
  }, [yo]);

  const esMio = persona === userId;
  const quienPerfil = perfiles.find((p) => p.id === persona);

  // Clínicas del periodo: desde la semana en que empiezan hasta tu fecha de fin (o el fin del periodo)
  const inicio = inicioClinicas(rango.desde, ajustes.semana_clinicas);
  const fin = finClinicas(quienPerfil?.fin_clinicas, rango.desde, rango.hasta);
  const conRitmo = uady && !todo && hoy <= fin;
  const turnos: Turnos = {
    modo: uady && perfiles.length >= 2 ? ajustes.turnos : "ninguno",
    inicia: ajustes.turnos_inicia ?? perfiles.find((p) => p.rol === "owner")?.id ?? null,
  };
  const clinicas = useMemo(() => {
    const mios = horarios.filter((h) => h.owner_id === persona);
    const desde = hoy > inicio ? hoy : inicio;
    const roles = rolesDe(turnos, persona, mios, inicio, fin);
    const todas = ocurrencias(mios, desde, fin);
    return { total: todas.length, opera: todas.filter((o) => roles.get(`${o.fecha}|${o.bloque.id}`) !== "asiste").length, hayHorario: mios.length > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarios, persona, hoy, inicio, fin, turnos.modo, turnos.inicia]);
  const mias = useMemo(() => citas.filter((c) => c.owner_id === persona), [citas, persona]);

  const filas = useMemo(() => {
    const porMateria = new Map<string, Cita[]>();
    for (const c of mias) {
      const k = c.materia_id ?? "";
      porMateria.set(k, [...(porMateria.get(k) ?? []), c]);
    }
    const lista = materias
      .filter((m) => m.activo || porMateria.has(m.id))
      .map((m) => ({ materia: m as Materia | null, citas: porMateria.get(m.id) ?? [] }));
    if (porMateria.has("")) lista.push({ materia: null, citas: porMateria.get("")! });
    return lista.map(({ materia, citas: deMateria }) => ({
      materia,
      meta: materia ? metas.get(`${persona}:${materia.id}`) ?? null : null,
      enBanco: (pacientes ?? []).filter((x) => x.owner_id === persona && (x.materia_id ?? "") === (materia?.id ?? "") && (x.estado === "pendiente" || x.estado === "contactado")).length,
      pacientes: deMateria.filter((c) => c.estado === "asistio").sort((a, b) => a.fecha.localeCompare(b.fecha)),
      asistio: deMateria.filter((c) => c.estado === "asistio").length,
      falto: deMateria.filter((c) => c.estado === "falto").length,
      agendadas: deMateria.filter((c) => !c.estado && c.fecha >= hoy).length,
      sinMarcar: deMateria.filter((c) => !c.estado && c.fecha < hoy).length,
    })).map((f) => ({
      ...f,
      ritmo: conRitmo && f.materia
        ? ritmoDe({ meta: f.meta, asistio: f.asistio, agendadas: f.agendadas, persona, materiaId: f.materia.id, horarios, citas, turnos, inicio, fin, hoy })
        : null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mias, materias, hoy, metas, persona, pacientes, conRitmo, horarios, citas, inicio, fin, turnos.modo, turnos.inicia]);

  async function guardarFin(v: string) {
    await supabase.from("perfiles").update({ fin_clinicas: v || null }).eq("id", userId);
    recargarCatalogos();
  }

  const total = filas.reduce((n, f) => n + f.asistio, 0);
  const faltas = filas.reduce((n, f) => n + f.falto, 0);
  const asistencia = total + faltas > 0 ? Math.round((total / (total + faltas)) * 100) : null;
  const pendientesDeMarcar = mias.filter((c) => !c.estado && c.fecha < hoy);
  // Cobros de material (sólo los tuyos: es tu dinero)
  const conCobro = mias.filter((c) => (c.cobro ?? 0) > 0 && c.estado !== "cancelo");
  const cobrado = conCobro.filter((c) => c.cobrado).reduce((n, c) => n + Number(c.cobro), 0);
  const porCobrar = conCobro.filter((c) => !c.cobrado);
  const totalPorCobrar = porCobrar.reduce((n, c) => n + Number(c.cobro), 0);

  async function marcarCobrado(id: string) {
    await supabase.from("citas").update({ cobrado: true }).eq("id", id);
    recargar();
  }
  const quien = perfiles.find((p) => p.id === persona);

  async function marcar(id: string, estado: "asistio" | "falto") {
    await supabase.from("citas").update({ estado }).eq("id", id);
    recargar();
  }

  async function guardarMeta(materiaId: string, meta: number | null) {
    if (meta === null) await supabase.from("metas").delete().eq("perfil_id", userId).eq("materia_id", materiaId);
    else await supabase.from("metas").upsert({ perfil_id: userId, materia_id: materiaId, meta });
    cargarMetas();
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="no-imprimir mb-5 flex items-center gap-3">
        <Link href="/" className="btn btn-sec px-2.5" aria-label="Volver">‹</Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mi avance</h1>
          <p className="text-sm text-muted">Casos atendidos por materia.</p>
        </div>
        <button onClick={() => window.print()} className="btn btn-sec ml-auto" title="Imprime o guarda en PDF la lista de casos atendidos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>
          <span className="hidden sm:inline">PDF</span>
        </button>
      </header>

      <div className="no-imprimir mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium">
          {[false, true].map((v) => (
            <button key={String(v)} onClick={() => setTodo(v)} className={`rounded-md px-2.5 py-1 ${todo === v ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>
              {v ? "Todo" : palabraPeriodo(tipo, true)}
            </button>
          ))}
        </div>
        {!todo && (
          <>
            <div className="flex items-center gap-1">
              <button className="btn btn-sec px-2.5" onClick={() => setFechaRef(sumarDias(rango.desde, -1))} aria-label={`${palabraPeriodo(tipo)} anterior`}>‹</button>
              <button className="btn btn-sec px-2.5" onClick={() => setFechaRef(sumarDias(rango.hasta, 1))} aria-label={`${palabraPeriodo(tipo)} siguiente`}>›</button>
            </div>
            <h2 className="font-semibold first-letter:uppercase">{rango.nombre}</h2>
          </>
        )}
        {todo && <h2 className="font-semibold">Desde el principio</h2>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {perfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${persona === p.id ? "border-ink bg-ink text-panel" : "border-line hover:bg-panel-2"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.id === userId ? "Yo" : p.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="no-imprimir mb-5 grid grid-cols-3 gap-3">
        {[
          ["Casos atendidos", String(total)],
          ["Faltas de pacientes", String(faltas)],
          ["Asistencia", asistencia === null ? "—" : `${asistencia}%`],
        ].map(([t, v]) => (
          <div key={t} className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
            <p className="text-xs text-muted">{t}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {conRitmo && (
        <section className="no-imprimir mb-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
          {clinicas.hayHorario ? (
            <p className="text-sm">
              {esMio ? "Te quedan" : `A ${quienPerfil?.nombre ?? ""} le quedan`}{" "}
              <b className="text-lg tabular-nums">{clinicas.total}</b> clínica{clinicas.total === 1 ? "" : "s"}
              {turnos.modo !== "ninguno" && clinicas.opera !== clinicas.total && <> (<b>{clinicas.opera}</b> operando)</>}
              {hoy < inicio && <span className="text-muted"> · empiezan el {fechaLarga(inicio)}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {esMio ? <>Agrega tu horario de clínica en <Link href="/personalizar" className="font-medium text-accent">Personalizar</Link> y te digo cuántas clínicas te quedan.</> : `${quienPerfil?.nombre ?? ""} aún no pone su horario de clínica.`}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Terminan el</span>
            {esMio ? (
              <input
                type="date"
                className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-xs text-ink"
                min={rango.desde}
                max={rango.hasta}
                value={quienPerfil?.fin_clinicas && quienPerfil.fin_clinicas >= rango.desde && quienPerfil.fin_clinicas <= rango.hasta ? quienPerfil.fin_clinicas : ""}
                onChange={(e) => guardarFin(e.target.value)}
                aria-label="Último día de clínicas"
              />
            ) : (
              <span className="text-ink">{fechaLarga(fin)}</span>
            )}
            {esMio && !(quienPerfil?.fin_clinicas && quienPerfil.fin_clinicas >= rango.desde && quienPerfil.fin_clinicas <= rango.hasta) && <span>(si no lo pones, cuento hasta el {fechaLarga(rango.hasta)})</span>}
          </div>
        </section>
      )}

      {esMio && pendientesDeMarcar.length > 0 && (
        <section className="no-imprimir mb-5 rounded-2xl border-2 border-accent bg-panel p-4">
          <h3 className="font-semibold">Tienes {pendientesDeMarcar.length} cita{pendientesDeMarcar.length === 1 ? "" : "s"} sin marcar</h3>
          <p className="mb-3 text-sm text-muted">Sólo cuentan los casos marcados como <b>Asistió</b>.</p>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {pendientesDeMarcar.slice(0, 8).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="font-medium">{c.paciente}</span>
                <span className="text-xs text-muted first-letter:uppercase">{fechaLarga(c.fecha)} · {hhmm(c.hora_inicio)}</span>
                <span className="ml-auto flex gap-1.5">
                  <button onClick={() => marcar(c.id, "asistio")} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-[#e6f4ea] hover:text-[#1e6b3a]">Asistió</button>
                  <button onClick={() => marcar(c.id, "falto")} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-[#fbecea] hover:text-[#7a1f1a]">Faltó</button>
                </span>
              </li>
            ))}
          </ul>
          {pendientesDeMarcar.length > 8 && <p className="mt-2 text-xs text-muted">…y {pendientesDeMarcar.length - 8} más. Márcalas desde la agenda.</p>}
        </section>
      )}

      {esMio && conCobro.length > 0 && (
        <section className="no-imprimir mb-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Cobros a pacientes</h3>
            <span className="text-sm tabular-nums">
              <b>{pesos(cobrado)}</b> <span className="text-muted">cobrado ·</span>{" "}
              <b className={totalPorCobrar ? "text-[#8a6a12] dark:text-[#ecd9a4]" : ""}>{pesos(totalPorCobrar)}</b> <span className="text-muted">por cobrar</span>
            </span>
          </div>
          {porCobrar.length === 0 ? (
            <p className="text-sm text-muted">Nadie te debe nada.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {porCobrar.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="font-medium">{c.paciente}</span>
                  <span className="text-xs text-muted first-letter:uppercase">{fechaLarga(c.fecha)}</span>
                  <span className="ml-auto font-medium tabular-nums">{pesos(Number(c.cobro))}</span>
                  <button onClick={() => marcarCobrado(c.id)} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-[#e6f4ea] hover:text-[#1e6b3a]">Ya me pagó</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="no-imprimir rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{esMio ? "Tus casos por materia" : `Casos de ${quien?.nombre ?? ""}`}</h3>
          <span className="text-xs text-muted">{esMio ? "Toca el número para poner tu meta." : "Cada quien pone sus propias metas."}</span>
        </div>
        {filas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Aún no hay materias. Agrégalas en <Link href="/personalizar" className="font-medium text-accent">Personalizar</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {filas.map((f) => (
              <FilaMateria key={`${persona}-${f.materia?.id ?? "sin"}`} {...f} editable={esMio} onMeta={guardarMeta} />
            ))}
          </ul>
        )}
      </section>

      {/* Sólo al imprimir / guardar como PDF */}
      <div className="solo-imprimir">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Casos atendidos — {quien?.nombre}</h1>
        <p style={{ margin: "4px 0 16px", color: "#555" }}>
          {todo ? "Todos los registros" : `${palabraPeriodo(tipo)} ${rango.nombre}`} · generado el {fechaLarga(hoy)}
        </p>
        {filas.filter((f) => f.asistio > 0 || f.meta).map((f) => (
          <div key={f.materia?.id ?? "sin"} style={{ marginBottom: 16, breakInside: "avoid" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: "1px solid #999", paddingBottom: 2 }}>
              {f.materia?.nombre ?? "Sin materia"} — {f.asistio}{f.meta ? ` de ${f.meta}` : ""} caso{(f.meta || f.asistio) === 1 ? "" : "s"}
            </h2>
            {f.pacientes.length === 0 ? (
              <p style={{ fontSize: 12, color: "#777" }}>Sin casos atendidos.</p>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 4, tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ color: "#777", fontSize: 10, textAlign: "left" }}>
                    <th style={{ padding: "2px 6px", width: 28 }} />
                    <th style={{ padding: "2px 6px", fontWeight: 600, width: "38%" }}>Paciente</th>
                    <th style={{ padding: "2px 6px", fontWeight: 600, width: "16%" }}>Historia</th>
                    <th style={{ padding: "2px 6px", fontWeight: 600, width: "16%" }}>Folio</th>
                    <th style={{ padding: "2px 6px", fontWeight: 600, textAlign: "right" }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {f.pacientes.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ padding: "2px 6px", width: 28, color: "#777" }}>{i + 1}.</td>
                      <td style={{ padding: "2px 6px" }}>{c.paciente}</td>
                      <td style={{ padding: "2px 6px", fontVariantNumeric: "tabular-nums" }}>{c.historia ?? "—"}</td>
                      <td style={{ padding: "2px 6px", fontVariantNumeric: "tabular-nums" }}>{c.folio ?? "—"}</td>
                      <td style={{ padding: "2px 6px", textAlign: "right", whiteSpace: "nowrap" }}>{fechaLarga(c.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        <p style={{ fontSize: 10, color: "#999", marginTop: 24 }}>Generado con Agenda de clínicas. Sólo incluye citas marcadas como “Asistió”.</p>
      </div>
    </div>
  );
}

const SEMAFORO: Record<Ritmo["semaforo"], string> = {
  cumplida: "#2f5d50",
  verde: "#1e8e3e",
  amarillo: "#d4a106",
  rojo: "#d93025",
  sinmeta: "#9ca3af",
  sinhorario: "#9ca3af",
};

const diaCorto = (iso: string) => {
  const d = deISO(iso);
  return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()]} ${d.getDate()}`;
};

function FilaMateria({
  materia, meta, asistio, falto, agendadas, sinMarcar, enBanco, editable, onMeta, ritmo,
}: {
  ritmo: Ritmo | null;
  enBanco: number;
  materia: Materia | null;
  meta: number | null;
  editable: boolean;
  asistio: number;
  falto: number;
  agendadas: number;
  sinMarcar: number;
  onMeta: (id: string, meta: number | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(meta ?? ""));
  const color = materia?.color ?? "#94a3b8";
  const pct = meta ? Math.min(100, (asistio / meta) * 100) : 0;
  const pctAgendadas = meta ? Math.min(100 - pct, (agendadas / meta) * 100) : 0;
  const cumplida = meta !== null && asistio >= meta;

  function guardar() {
    setEditando(false);
    const n = parseInt(valor, 10);
    const nueva = Number.isFinite(n) && n > 0 ? Math.min(n, 999) : null;
    if (materia && nueva !== meta) onMeta(materia.id, nueva);
  }

  return (
    <li>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="h-2.5 w-2.5 shrink-0 self-center rounded-full" style={{ background: color }} />
        <span className="font-medium">{materia?.nombre ?? "Sin materia"}</span>
        {cumplida && <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-medium text-[#1e6b3a]">¡Meta cumplida!</span>}
        <span className="ml-auto text-sm tabular-nums">
          <b>{asistio}</b>
          {materia && (
            <>
              <span className="text-muted"> de </span>
              {!editable ? (
                <span className="text-muted">{meta ?? "—"}</span>
              ) : editando ? (
                <input
                  autoFocus
                  type="number"
                  min={1}
                  max={999}
                  className="campo inline-block w-16 px-2 py-0.5 text-sm"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onFocus={() => setValor(String(meta ?? ""))}
                  onBlur={guardar}
                  onKeyDown={(e) => e.key === "Enter" && guardar()}
                />
              ) : (
                <button onClick={() => setEditando(true)} className="rounded-md border border-dashed border-line px-1.5 text-muted hover:border-accent hover:text-accent" title="Cambiar meta">
                  {meta ?? "meta"}
                </button>
              )}
            </>
          )}
        </span>
      </div>
      {meta ? (
        <div className="flex h-2.5 overflow-hidden rounded-full bg-panel-2">
          <div style={{ width: `${pct}%`, background: color }} />
          <div style={{ width: `${pctAgendadas}%`, background: `${color}55` }} />
        </div>
      ) : (
        <div className="h-2.5 rounded-full bg-panel-2" />
      )}
      <p className="mt-1 text-xs text-muted">
        {agendadas > 0 ? `${agendadas} agendada${agendadas === 1 ? "" : "s"}` : "Nada agendado"}
        {falto > 0 && ` · ${falto} falta${falto === 1 ? "" : "s"}`}
        {sinMarcar > 0 && ` · ${sinMarcar} sin marcar`}
        {meta && !cumplida && ` · te faltan ${meta - asistio}`}
        {editable && enBanco > 0 && (
          <>
            {" · "}
            <Link href="/pacientes#banco" className="text-accent hover:underline">{enBanco} en tu banco de pacientes</Link>
          </>
        )}
      </p>
      {ritmo && (
        <div className="mt-2 rounded-xl bg-panel-2 px-3 py-2 text-xs">
          <p className="flex items-start gap-2">
            <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEMAFORO[ritmo.semaforo] }} aria-hidden />
            <span>
              {ritmo.restantes > 0 && ritmo.semaforo !== "sinmeta" && (
                <b>{ritmo.restantes} clínica{ritmo.restantes === 1 ? "" : "s"} de {materia?.nombre} · </b>
              )}
              {ritmo.mensaje}
            </span>
          </p>
          {editable && ritmo.libres.length > 0 && ritmo.semaforo !== "cumplida" && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[18px]">
              <span className="text-muted">Sin paciente:</span>
              {ritmo.libres.slice(0, 4).map((f) => (
                <Link key={f} href={`/?dia=${f}`} className="rounded-full border border-dashed border-accent px-2 py-0.5 font-medium text-accent hover:bg-accent-soft">
                  {diaCorto(f)}
                </Link>
              ))}
              {ritmo.libres.length > 4 && <span className="text-muted">+{ritmo.libres.length - 4}</span>}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
