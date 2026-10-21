"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCatalogos, useCitas, useHorarios, usePacientes } from "@/lib/useDatos";
import { bloquesDelDia, huecos } from "@/lib/horario";
import { prefs, type Cita, type Clinica, type Horario, type Materia, type Perfil } from "@/lib/types";
import { rangoDe } from "@/lib/cuatrimestre";
import { inicioClinicas, rolDelBloque, tramosPorHora, type Turnos } from "@/lib/ritmo";
import AvisosMaterial from "@/components/AvisosMaterial";
import Anuncios from "@/components/Anuncios";
import Sugerencia from "@/components/Sugerencia";
import { esUady, periodosDe } from "@/lib/universidades";
import {
  aISO, deISO, diasDelMes, esFinDeSemana, fechaLarga, hhmm, hoyISO, sumarMinutos,
  MESES, DIAS_CORTOS_LUNES, DIAS_CORTOS_DOMINGO,
} from "@/lib/fechas";
import CitaModal from "@/components/CitaModal";
import { manualDe } from "@/lib/manual";
import { aplicarTema, type MarcadorId } from "@/lib/tema";
import MarcadorHoy from "@/components/MarcadorHoy";
import CuatriModal from "@/components/CuatriModal";
import BannerPlan from "@/components/BannerPlan";
import Shell from "@/components/Shell";
import PanelHoy from "@/components/PanelHoy";
import AceptarTerminos from "@/components/AceptarTerminos";
import { sumarDias } from "@/lib/pagos";
import TarjetaCita from "@/components/TarjetaCita";
import BuscarPaciente from "@/components/BuscarPaciente";
import InstalarApp, { VentanaInstalar } from "@/components/InstalarApp";
import Novedades from "@/components/Novedades";
import InvitacionPendiente from "@/components/InvitacionPendiente";
import { APP_VERSION, pendientes } from "@/lib/novedades";

const CLAVE_VISTA = "vista-agenda";

type Filtro = "todos" | string; // "todos" o id de perfil

const fechaCorta = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `hasta ${d} ${MESES[m - 1].slice(0, 3).toLowerCase()}`;
};

export default function Agenda({ userId }: { userId: string }) {
  const router = useRouter();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [seleccionado, setSeleccionado] = useState(hoyISO());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [modal, setModal] = useState<{ cita: Cita | null; fecha: string; plantilla?: Cita } | null>(null);
  const [menu, setMenu] = useState(false);
  const [novedades, setNovedades] = useState<null | "nuevas" | "todas">(null);
  const [verInstalar, setVerInstalar] = useState(false);
  const [cuatriAbierto, setCuatriAbierto] = useState<boolean | null>(null);
  const [invitacionAbierta, setInvitacionAbierta] = useState<boolean | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [sugerir, setSugerir] = useState(false);
  const [vista, setVista] = useState<"mes" | "lista">("mes");
  // 2.2: "Hoy" (inicio) y "Agenda" (calendario) viven en la misma página
  const [seccion, setSeccionEstado] = useState<"hoy" | "agenda">("hoy");
  function setSeccion(s: "hoy" | "agenda") {
    setSeccionEstado(s);
    history.replaceState(null, "", s === "agenda" ? "/?v=agenda" : "/");
    window.scrollTo({ top: 0 });
  }

  // Recuerda si prefieres ver el mes o la lista (sólo en este navegador)
  useEffect(() => {
    // Si nunca elegiste, en celular abre en lista (el mes con puntitos casi no se lee)
    let guardada: string | null = null;
    try { guardada = localStorage.getItem(CLAVE_VISTA); } catch {}
    if (guardada === "lista" || (!guardada && window.matchMedia("(max-width: 639px)").matches)) setVista("lista");
  }, []);
  function cambiarVista(v: "mes" | "lista") {
    setVista(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch {}
  }

  // En celular, al tocar un día baja solito a sus citas
  function elegirDia(iso: string) {
    setSeleccionado(iso);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => document.getElementById("panel-dia")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function irAFecha(iso: string) {
    const d = deISO(iso);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
    setSeleccionado(iso);
    setBuscando(false);
    setSeccion("agenda");
    if (vista === "lista") cambiarVista("mes");
  }

  const { supabase, perfiles, clinicas, materias, nombreAgenda, pagadoHasta, ajustes, recargar: recargarCatalogos, pro, quedanPro, cargando } = useCatalogos();
  const yo = perfiles.find((p) => p.id === userId);
  // Recordar que la última agenda que usó fue la de clínicas (para el login único)
  useEffect(() => {
    document.cookie = "ultima_agenda=clinicas; path=/; max-age=31536000; samesite=lax";
  }, []);
  // ¿También tiene agenda personal? (botón para cambiar)
  const [tienePersonal, setTienePersonal] = useState(false);
  useEffect(() => {
    supabase.from("personales").select("activo").eq("user_id", userId).maybeSingle().then(({ data }) => setTienePersonal(!!data?.activo));
  }, [supabase, userId]);
  const p = prefs(yo?.preferencias);
  const sinLeer = !!yo && pendientes(yo.version_vista, ajustes.universidad).length > 0;
  const CLAVE_DESPUES = `novedades-despues-${APP_VERSION}`;

  // Último acceso (para el panel del admin): una vez por hora como mucho, sin esperar respuesta
  useEffect(() => {
    if (!userId) return;
    const clave = `ultimo-acceso-${userId}`;
    try {
      const antes = Number(localStorage.getItem(clave) ?? 0);
      if (Date.now() - antes < 3600000) return;
      localStorage.setItem(clave, String(Date.now()));
    } catch {}
    supabase.from("perfiles").update({ ultimo_acceso: new Date().toISOString() }).eq("id", userId).then(() => {});
  }, [supabase, userId]);

  // Novedades: se abren solas una vez por actualización (después de términos y de la pregunta del cuatri)
  useEffect(() => {
    if (!yo || !yo.acepto_terminos_at || !sinLeer) return;
    if (yo.rol === "owner" && cuatriAbierto !== false) return;
    if (invitacionAbierta !== false) return;
    let pospuesta = false;
    try { pospuesta = sessionStorage.getItem(CLAVE_DESPUES) === "1"; } catch {}
    if (!pospuesta) setNovedades("nuevas");
  }, [yo, sinLeer, cuatriAbierto, invitacionAbierta, CLAVE_DESPUES]);

  function cerrarNovedades() {
    // Si no le dio "¡Entendido!", no vuelve a saltar en esta visita: queda el puntito para leerla después
    try { sessionStorage.setItem(CLAVE_DESPUES, "1"); } catch {}
    setNovedades(null);
  }

  // 2.0: ya no hay sólo lectura. Sin Pro la agenda sigue en Gratis (lo de la uni nunca se bloquea).
  const soloLectura = false;
  const cortesia = !cargando && quedanPro === null && pro;
  const urgePlan = !cargando && !cortesia && (!pro || (quedanPro ?? 99) <= 3);
  const etiquetaPlan = !pro ? "Pásate a Pro" : quedanPro === 0 ? "Pro · último día" : (quedanPro ?? 99) <= 3 ? `Pro · quedan ${quedanPro} d` : `Pro · ${pagadoHasta ? fechaCorta(pagadoHasta) : ""}`;

  // Aplica el tema guardado de quien está viendo
  useEffect(() => {
    if (yo) aplicarTema(p.tema);
  }, [yo, p.tema]);

  const dias = useMemo(
    () => diasDelMes(anio, mes, p.semanaEmpiezaLunes),
    [anio, mes, p.semanaEmpiezaLunes]
  );
  const diasVisibles = p.ocultarFinDeSemana ? dias.filter((d) => !esFinDeSemana(d)) : dias;
  const encabezados = (p.semanaEmpiezaLunes ? DIAS_CORTOS_LUNES : DIAS_CORTOS_DOMINGO).filter(
    (d) => !p.ocultarFinDeSemana || (d !== "Sáb" && d !== "Dom")
  );
  const columnas = p.ocultarFinDeSemana ? 5 : 7;

  // El mes que ves + una semana antes y después de hoy (para "Hoy")
  const hoyRango = hoyISO();
  const desdeC = [aISO(dias[0]), sumarDias(hoyRango, -7)].sort()[0];
  const hastaC = [aISO(dias[dias.length - 1]), sumarDias(hoyRango, 7)].sort()[1];
  const { citas, recargar: recargarCitas } = useCitas(desdeC, hastaC);
  const { horarios } = useHorarios();
  const { pacientes } = usePacientes();
  const duenoFiltro = filtro === "todos" ? undefined : filtro;

  // "+ Cita" en un hueco libre del horario de clínica (ya trae la clínica, la materia y lo que dura)
  function citaEnHueco(fecha: string, inicio: string, fin: string, b: Horario) {
    const dur = (b.materia_id && materias.find((m) => m.id === b.materia_id)?.duracion_min) || p.duracionMin;
    const f = sumarMinutos(inicio, dur);
    setModal({
      cita: null,
      fecha,
      plantilla: { id: "", owner_id: userId, paciente: "", fecha, hora_inicio: inicio, hora_fin: f < fin ? f : fin, clinica_id: b.clinica_id, materia_id: b.materia_id ?? null, notas: null },
    });
  }

  // Abrir un día desde un link (/?dia=2026-10-06), p. ej. desde "clínicas libres" en Mi avance
  useEffect(() => {
    const dia = new URLSearchParams(window.location.search).get("dia");
    if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      const d = deISO(dia);
      setAnio(d.getFullYear());
      setMes(d.getMonth());
      setSeleccionado(dia);
      setVista("mes");
      setSeccionEstado("agenda");
      history.replaceState(null, "", "/?v=agenda");
      return;
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get("v") === "agenda") setSeccionEstado("agenda");
    if (q.get("buscar") === "1") { setBuscando(true); history.replaceState(null, "", "/"); }
    if (q.get("nueva") === "1") { setModal({ cita: null, fecha: hoyISO() }); history.replaceState(null, "", "/"); }
  }, []);

  // Turnos de la pareja: ¿a quién le toca operar en cada bloque?
  const dueno = perfiles.find((x) => x.rol === "owner")?.id ?? null;
  const uady = esUady(ajustes.universidad); // ritmo, turnos y Mi material son sólo de la UADY
  const turnos: Turnos = { modo: uady && pro && perfiles.length >= 2 ? ajustes.turnos : "ninguno", inicia: ajustes.turnos_inicia ?? dueno };
  function rolDe(b: Horario, fecha: string) {
    if (turnos.modo === "ninguno") return null;
    const r = rangoDe(deISO(fecha), periodosDe(ajustes.universidad));
    const inicio = inicioClinicas(r.desde, ajustes.semana_clinicas);
    return rolDelBloque(turnos, b.owner_id, horarios.filter((h) => h.owner_id === b.owner_id), inicio, fecha, b);
  }

  const perfilPorId = useMemo(() => new Map(perfiles.map((x) => [x.id, x])), [perfiles]);
  const clinicaPorId = useMemo(() => new Map(clinicas.map((x) => [x.id, x])), [clinicas]);
  const materiaPorId = useMemo(() => new Map(materias.map((x) => [x.id, x])), [materias]);
  const nombreBloque = (b: Horario) =>
    [b.clinica_id && clinicaPorId.get(b.clinica_id)?.numero, b.materia_id && materiaPorId.get(b.materia_id)?.nombre].filter(Boolean).join(" · ") || b.etiqueta || "Clínica";

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
  const porDiaTodos = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of citas) m.set(c.fecha, [...(m.get(c.fecha) ?? []), c]);
    return m;
  }, [citas]);

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
    <Shell
      actual={seccion}
      titulo={seccion === "hoy" ? "Hoy" : "Agenda"}
      nombreAgenda={nombreAgenda}
      uady={uady}
      esDueno={yo?.rol === "owner"}
      onSeccion={setSeccion}
      onNueva={() => setModal({ cita: null, fecha: seccion === "agenda" && seleccionado >= hoyStr ? seleccionado : hoyStr })}
      onBuscar={() => setBuscando(true)}
      novedadesSinLeer={sinLeer}
      onNovedades={() => setNovedades(sinLeer ? "nuevas" : "todas")}
      tourListo={!!yo?.acepto_terminos_at && !sinLeer && novedades === null && cuatriAbierto !== true && invitacionAbierta !== true && !modal}
    >
      {seccion === "hoy" && yo && (
        <SeccionHoy
          nombre={yo.nombre}
          hoy={hoyStr}
          citas={citas}
          userId={userId}
          porDia={porDiaTodos}
          perfilPorId={perfilPorId}
          clinicaPorId={clinicaPorId}
          materiaPorId={materiaPorId}
          supabase={supabase}
          pro={pro}
          onAbrir={(c) => setModal({ cita: c, fecha: c.fecha })}
          onCambio={recargarCitas}
          onAgenda={() => setSeccion("agenda")}
          ganchoPersonal={!tienePersonal}
          antes={
            <>
              <BannerPlan pro={pro} quedan={quedanPro} esDueno={yo?.rol === "owner"} cargando={cargando} />
              {uady && pro && <AvisosMaterial userId={userId} horarios={horarios} perfiles={perfiles} compacto />}
            </>
          }
          panel={<PanelHoy citas={citas} userId={userId} hoy={hoyStr} clinicaPorId={clinicaPorId} materiaPorId={materiaPorId} onAbrir={(c) => setModal({ cita: c, fecha: c.fecha })} />}
        />
      )}

      {seccion === "agenda" && (
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-5">
      <div className={`grid gap-5 ${vista === "mes" ? "lg:grid-cols-[1fr_340px]" : ""}`}>
        {/* Calendario */}
        <section className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button className="btn btn-sec px-2.5" onClick={() => moverMes(-1)} aria-label="Mes anterior">‹</button>
              <button className="btn btn-sec px-2.5" onClick={() => moverMes(1)} aria-label="Mes siguiente">›</button>
            </div>
            <h2 className="text-lg font-semibold">{MESES[mes]} {anio}</h2>
            <button className="btn btn-sec ml-1 py-1 text-xs" onClick={irAHoy}>Hoy</button>
            <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium">
              {(["mes", "lista"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => cambiarVista(v)}
                  className={`rounded-md px-2.5 py-1 ${vista === v ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
                >
                  {v === "mes" ? "Mes" : "Lista"}
                </button>
              ))}
            </div>

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

          {vista === "lista" && (
            <VistaLista
              dias={diasVisibles.filter((d) => d.getMonth() === mes).map(aISO)}
              porDia={porDia}
              hoy={hoyStr}
              render={(c) => (
                <TarjetaCita
                  key={c.id}
                  cita={c}
                  userId={userId}
                  hoy={hoyStr}
                  dueno={perfilPorId.get(c.owner_id)}
                  clinica={c.clinica_id ? clinicaPorId.get(c.clinica_id) : null}
                  materia={c.materia_id ? materiaPorId.get(c.materia_id) : null}
                  supabase={supabase}
                  soloLectura={soloLectura}
                  pro={pro}
                  onAbrir={() => setModal({ cita: c, fecha: c.fecha })}
                  onCambio={recargarCitas}
                />
              )}
              extra={(iso) =>
                bloquesDelDia(horarios, iso, duenoFiltro).map((b) => (
                  <p key={b.id} className="mb-1.5 flex items-center gap-2 text-xs text-muted">
                    <span className="h-2 w-2 rounded-sm border" style={{ borderColor: perfilPorId.get(b.owner_id)?.color }} />
                    {nombreBloque(b)} · {hhmm(b.hora_inicio)}–{hhmm(b.hora_fin)}
                    {b.owner_id !== userId && ` · ${perfilPorId.get(b.owner_id)?.nombre}`}
                    <ChipTurno rol={rolDe(b, iso)} b={b} mio={b.owner_id === userId} nombre={perfilPorId.get(b.owner_id)?.nombre} inicia={turnos.inicia === b.owner_id} />
                  </p>
                ))
              }
            />
          )}

          {vista === "mes" && (<>
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
              return (
                <button
                  key={iso}
                  onClick={() => elegirDia(iso)}
                  className={`group relative flex min-h-[74px] flex-col items-stretch gap-1 p-1.5 text-left transition sm:min-h-[104px] sm:p-2 ${
                    delMes ? "bg-panel" : "bg-panel-2/60"
                  } ${esSel ? "ring-2 ring-inset ring-accent" : "hover:bg-panel-2"}`}
                >
                  <div className="flex items-center justify-between">
                    {esHoy ? (
                      <MarcadorHoy forma={p.marcadorHoy as MarcadorId} dia={d.getDate()} />
                    ) : (
                      <span
                        className={`grid h-7 w-7 place-items-center text-xs font-medium sm:h-8 sm:w-8 sm:text-sm ${delMes ? "" : "text-muted/60"}`}
                      >
                        {d.getDate()}
                      </span>
                    )}
                  </div>

                  {/* Horario fijo de clínica */}
                  {delMes && bloquesDelDia(horarios, iso, duenoFiltro).map((b) => (
                    <span
                      key={b.id}
                      className="hidden truncate pl-1 text-[10px] leading-tight text-muted sm:block"
                      style={{ borderLeft: `2px dashed ${perfilPorId.get(b.owner_id)?.color ?? "#888"}` }}
                    >
                      {hhmm(b.hora_inicio)}–{hhmm(b.hora_fin)} {nombreBloque(b)}
                    </span>
                  ))}

                  {/* Móvil: puntitos */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {delMes && bloquesDelDia(horarios, iso, duenoFiltro).map((b) => (
                      <span key={b.id} className="h-1.5 w-1.5 rounded-sm border" style={{ borderColor: perfilPorId.get(b.owner_id)?.color }} />
                    ))}
                    {lista.filter((c) => c.estado !== "cancelo").slice(0, 6).map((c) => (
                      <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: perfilPorId.get(c.owner_id)?.color }} />
                    ))}
                  </div>

                  {/* Escritorio: pastillas */}
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {lista.slice(0, 3).map((c) => (
                      <span
                        key={c.id}
                        className={`truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight ${c.estado === "cancelo" ? "line-through opacity-50" : ""}`}
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
          </>)}
        </section>

        {/* Panel del día */}
        {vista === "mes" && (
        <aside id="panel-dia" className="scroll-mt-3 rounded-2xl border border-line bg-panel p-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Día seleccionado</p>
              <h3 className="text-lg font-semibold first-letter:uppercase">{fechaLarga(seleccionado)}</h3>
            </div>
            <button className="btn btn-sec shrink-0 px-2.5" disabled={soloLectura} title="Agendar este día" aria-label="Agendar este día" onClick={() => setModal({ cita: null, fecha: seleccionado })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>

          {bloquesDelDia(horarios, seleccionado, duenoFiltro).length > 0 && (
            <div className="mb-3 rounded-xl bg-panel-2 p-3 text-sm">
              {bloquesDelDia(horarios, seleccionado, duenoFiltro).map((b) => {
                // Si esa clínica te toca asistir, no hay hueco para meter paciente tuyo
                const libres = b.owner_id === userId && seleccionado >= hoyStr && !soloLectura && rolDe(b, seleccionado) !== "asiste" ? huecos(b, citas, seleccionado) : [];
                return (
                  <div key={b.id} className="mb-1 last:mb-0">
                    <p className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm border" style={{ borderColor: perfilPorId.get(b.owner_id)?.color }} />
                      <span className="font-medium">{nombreBloque(b)}</span>
                      <span className="tabular-nums text-muted">{hhmm(b.hora_inicio)}–{hhmm(b.hora_fin)}</span>
                      <span className="ml-auto text-xs text-muted">{b.owner_id === userId ? "Tú" : perfilPorId.get(b.owner_id)?.nombre}</span>
                    </p>
                    <div className="pl-4"><ChipTurno rol={rolDe(b, seleccionado)} b={b} mio={b.owner_id === userId} nombre={perfilPorId.get(b.owner_id)?.nombre} inicia={turnos.inicia === b.owner_id} /></div>
                    {libres.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
                        {libres.map((h) => (
                          <button
                            key={h.inicio}
                            onClick={() => citaEnHueco(seleccionado, h.inicio, h.fin, b)}
                            className="rounded-full border border-dashed border-accent px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
                            title="Agendar en este hueco"
                          >
                            Libre {h.inicio}–{h.fin} +
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {citasDelDia.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              {filtro === "todos" ? "Nadie tiene citas este día." : "Sin citas este día."}
              <br /><span className="text-xs">Toca <b>+</b> para agendar.</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {citasDelDia.map((c) => (
                <li key={c.id}>
                  <TarjetaCita
                    cita={c}
                    userId={userId}
                    hoy={hoyStr}
                    dueno={perfilPorId.get(c.owner_id)}
                    clinica={c.clinica_id ? clinicaPorId.get(c.clinica_id) : null}
                    materia={c.materia_id ? materiaPorId.get(c.materia_id) : null}
                    supabase={supabase}
                    soloLectura={soloLectura}
                    pro={pro}
                    onAbrir={() => setModal({ cita: c, fecha: c.fecha })}
                    onCambio={recargarCitas}
                  />
                </li>
              ))}
            </ul>
          )}
        </aside>
        )}
      </div>

      </div>
      )}

      {yo && !yo.acepto_terminos_at && (
        <AceptarTerminos supabase={supabase} userId={userId} onAceptado={recargarCatalogos} />
      )}

      {yo?.acepto_terminos_at && yo.rol === "owner" && (
        <CuatriModal yo={yo} onVisible={setCuatriAbierto} onCambio={() => { recargarCatalogos(); recargarCitas(); }} />
      )}

      {yo?.acepto_terminos_at && <InvitacionPendiente onVisible={setInvitacionAbierta} />}

      {novedades && yo && (
        <Novedades
          supabase={supabase}
          userId={userId}
          vista={yo.version_vista}
          universidad={ajustes.universidad}
          todas={novedades === "todas" && !sinLeer}
          onLeido={recargarCatalogos}
          onClose={cerrarNovedades}
        />
      )}

      {verInstalar && <VentanaInstalar onClose={() => setVerInstalar(false)} />}
      {sugerir && <Sugerencia onClose={() => setSugerir(false)} />}

      {buscando && (
        <BuscarPaciente
          supabase={supabase}
          userId={userId}
          perfiles={perfiles}
          clinicas={clinicas}
          materias={materias}
          onIr={irAFecha}
          onClose={() => setBuscando(false)}
        />
      )}

      {modal && (
        <CitaModal
          key={`${modal.cita?.id ?? "nueva"}-${modal.fecha}-${modal.plantilla?.id ?? ""}`}
          supabase={supabase}
          userId={userId}
          cita={modal.cita}
          fechaInicial={modal.fecha}
          plantilla={modal.plantilla}
          pacientes={pacientes ?? []}
          onOtraSesion={(c) => setModal({ cita: null, fecha: sumarDias(c.fecha, 7), plantilla: c })}
          perfiles={perfiles}
          clinicas={clinicas}
          materias={materias}
          preferencias={p}
          soloLectura={soloLectura}
          pro={pro}
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
    </Shell>
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

function VistaLista({
  dias, porDia, hoy, render, onNueva, extra,
}: {
  extra?: (iso: string) => React.ReactNode;
  dias: string[];
  porDia: Map<string, Cita[]>;
  hoy: string;
  render: (c: Cita) => React.ReactNode;
  onNueva?: (iso: string) => void;
}) {
  const [verPasados, setVerPasados] = useState(false);
  const esteMes = dias.includes(hoy);
  const conCitas = dias.filter((d) => (porDia.get(d)?.length ?? 0) > 0);
  const pasados = esteMes ? conCitas.filter((d) => d < hoy) : [];
  const visibles = esteMes && !verPasados ? conCitas.filter((d) => d >= hoy) : conCitas;

  return (
    <div className="flex flex-col gap-5">
      {pasados.length > 0 && (
        <button className="self-start text-xs font-medium text-accent hover:underline" onClick={() => setVerPasados(!verPasados)}>
          {verPasados ? "Ocultar días pasados" : `Ver ${pasados.length} día${pasados.length === 1 ? "" : "s"} pasado${pasados.length === 1 ? "" : "s"} de este mes`}
        </button>
      )}
      {visibles.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          {esteMes ? "No hay citas de aquí a fin de mes." : "No hay citas este mes."}
          {onNueva && (
            <button className="btn btn-primario mx-auto mt-3 block" onClick={() => onNueva(esteMes ? hoy : dias[0])}>+ Cita</button>
          )}
        </div>
      )}
      {visibles.map((iso) => (
        <section key={iso}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold first-letter:uppercase">{fechaLarga(iso)}</h3>
            {iso === hoy && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-panel">Hoy</span>}
            {onNueva && (
              <button className="ml-auto text-xs font-medium text-accent hover:underline" onClick={() => onNueva(iso)}>+ Cita</button>
            )}
          </div>
          {extra?.(iso)}
          <div className="flex flex-col gap-2">{(porDia.get(iso) ?? []).map(render)}</div>
        </section>
      ))}
    </div>
  );
}

/** "Operas tú" / "Asistes" / "8–9 tú · 9–10 Diego" según los turnos de la pareja. */
function ChipTurno({ rol, b, mio, nombre, inicia }: { rol: "opera" | "asiste" | "mitad" | null; b: Horario; mio: boolean; nombre?: string; inicia: boolean }) {
  if (!rol) return null;
  const quien = mio ? "tú" : nombre ?? "";
  if (rol === "mitad") {
    const tramos = tramosPorHora(b, inicia);
    return (
      <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
        {tramos.map((t) => (
          <span key={t.inicio} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${t.yo ? "bg-accent-soft text-accent" : "bg-panel-2 text-muted"}`}>
            {t.inicio.replace(/:00$/, "")}–{t.fin.replace(/:00$/, "")} {t.yo ? (mio ? "operas" : `opera ${quien}`) : mio ? "asistes" : "asiste"}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={`ml-1 inline-block rounded-full px-2 py-0.5 align-middle text-[10px] font-medium ${rol === "opera" ? "bg-accent-soft text-accent" : "bg-panel-2 text-muted"}`}>
      {rol === "opera" ? (mio ? "Operas tú" : `Opera ${quien}`) : mio ? "Te toca asistir" : `${quien} asiste`}
    </span>
  );
}

/* ---------------------------------------------------------------- */

/** 2.2 · Inicio: tu día, lo que falta marcar y los próximos días. */
function SeccionHoy({
  nombre, hoy, citas, userId, porDia, perfilPorId, clinicaPorId, materiaPorId, supabase, pro, onAbrir, onCambio, onAgenda, antes, panel, ganchoPersonal,
}: {
  ganchoPersonal: boolean;
  nombre: string;
  hoy: string;
  citas: Cita[];
  userId: string;
  porDia: Map<string, Cita[]>;
  perfilPorId: Map<string, Perfil>;
  clinicaPorId: Map<string, Clinica>;
  materiaPorId: Map<string, Materia>;
  supabase: ReturnType<typeof useCatalogos>["supabase"];
  pro: boolean;
  onAbrir: (c: Cita) => void;
  onCambio: () => void;
  onAgenda: () => void;
  antes: React.ReactNode;
  panel: React.ReactNode;
}) {
  const misHoy = citas.filter((c) => c.fecha === hoy && c.owner_id === userId && c.estado !== "cancelo");
  const sinMarcar = citas
    .filter((c) => c.owner_id === userId && !c.estado && c.fecha < hoy && c.fecha >= sumarDias(hoy, -7))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const proximos = Array.from({ length: 8 }, (_, i) => sumarDias(hoy, i)).filter((d) => (porDia.get(d)?.length ?? 0) > 0);
  const tarjeta = (c: Cita) => (
    <TarjetaCita
      key={c.id}
      cita={c}
      userId={userId}
      hoy={hoy}
      dueno={perfilPorId.get(c.owner_id)}
      clinica={c.clinica_id ? clinicaPorId.get(c.clinica_id) : null}
      materia={c.materia_id ? materiaPorId.get(c.materia_id) : null}
      supabase={supabase}
      pro={pro}
      onAbrir={() => onAbrir(c)}
      onCambio={onCambio}
    />
  );

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-5">
      <p className="mb-4 text-sm text-muted first-letter:uppercase">
        Hola, <b className="text-ink">{nombre.split(" ")[0]}</b> · {fechaLarga(hoy)}
      </p>
      {antes}

      {misHoy.length > 0 ? (
        panel
      ) : (
        <section className="mb-5 rounded-2xl border border-dashed border-line bg-panel p-5 text-center">
          <p className="font-semibold">Hoy no tienes citas</p>
          <p className="mt-1 text-sm text-muted">Toca <b className="text-ink">+</b> abajo para agendar una.</p>
        </section>
      )}

      {sinMarcar.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 font-semibold">Te falta marcar</h2>
          <p className="mb-2 text-sm text-muted">¿Llegaron? Sólo cuentan para tu avance las que marques como <b className="text-ink">Asistió</b>.</p>
          <div className="flex flex-col gap-2">{sinMarcar.slice(0, 5).map(tarjeta)}</div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Próximos días</h2>
          <button onClick={onAgenda} className="text-sm font-medium text-accent hover:underline">Ver la agenda completa</button>
        </div>
        {proximos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Nada agendado esta semana.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {proximos.map((d) => (
              <div key={d}>
                <p className="mb-1.5 text-sm font-semibold first-letter:uppercase">
                  {d === hoy ? "Hoy · " : d === sumarDias(hoy, 1) ? "Mañana · " : ""}
                  {fechaLarga(d)}
                </p>
                <div className="flex flex-col gap-2">{(porDia.get(d) ?? []).map(tarjeta)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      {ganchoPersonal && <PistaMiAgenda />}
    </div>
  );
}

/** De vez en cuando, en Hoy: "¿Tienes entregas esta semana?" → Mi agenda. Se cierra por un mes. */
function PistaMiAgenda() {
  const clave = `pista-mi-agenda-${new Date().toISOString().slice(0, 7)}`;
  const [ver, setVer] = useState(false);
  useEffect(() => {
    try { setVer(localStorage.getItem(clave) !== "1"); } catch { setVer(false); }
  }, [clave]);
  if (!ver) return null;
  return (
    <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[#4f46e5]/30 bg-[#eceafe] px-4 py-3 text-sm text-[#15123a] dark:bg-[#25234a] dark:text-[#e9eaf0]">
      <span className="rounded-full bg-[#4f46e5] px-1.5 py-px text-[10px] font-bold text-white">NUEVO</span>
      <p className="min-w-0 flex-1">¿Tienes entregas o viajes esta semana? Llévalos en <b>Mi agenda</b>, aparte de tus pacientes.</p>
      <Link href="/personalizar#personal" className="shrink-0 font-semibold text-[#4f46e5] hover:underline dark:text-[#b3afff]">Ver</Link>
      <button onClick={() => { try { localStorage.setItem(clave, "1"); } catch {} setVer(false); }} className="shrink-0 px-1 text-lg leading-none opacity-60 hover:opacity-100" aria-label="Cerrar">×</button>
    </div>
  );
}
