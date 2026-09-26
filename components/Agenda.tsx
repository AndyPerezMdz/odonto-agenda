"use client";

import { useEffect, useMemo, useState } from "react";
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
import { aplicarTema, type MarcadorId } from "@/lib/tema";
import MarcadorHoy from "@/components/MarcadorHoy";
import CuatriModal from "@/components/CuatriModal";
import BannerPago from "@/components/BannerPago";
import AceptarTerminos from "@/components/AceptarTerminos";
import { estadoPago, sumarDias } from "@/lib/pagos";
import TarjetaCita from "@/components/TarjetaCita";
import BuscarPaciente from "@/components/BuscarPaciente";
import InstalarApp, { VentanaInstalar } from "@/components/InstalarApp";
import Novedades from "@/components/Novedades";
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
  const [buscando, setBuscando] = useState(false);
  const [vista, setVista] = useState<"mes" | "lista">("mes");

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
    if (vista === "lista") cambiarVista("mes");
  }

  const { supabase, perfiles, clinicas, materias, nombreAgenda, pagadoHasta, recargar: recargarCatalogos } = useCatalogos();
  const yo = perfiles.find((p) => p.id === userId);
  const p = prefs(yo?.preferencias);
  const sinLeer = !!yo && pendientes(yo.version_vista).length > 0;
  const CLAVE_DESPUES = `novedades-despues-${APP_VERSION}`;

  // Novedades: se abren solas una vez por actualización (después de términos y de la pregunta del cuatri)
  useEffect(() => {
    if (!yo || !yo.acepto_terminos_at || !sinLeer) return;
    if (yo.rol === "owner" && cuatriAbierto !== false) return;
    let pospuesta = false;
    try { pospuesta = sessionStorage.getItem(CLAVE_DESPUES) === "1"; } catch {}
    if (!pospuesta) setNovedades("nuevas");
  }, [yo, sinLeer, cuatriAbierto, CLAVE_DESPUES]);

  function cerrarNovedades() {
    // Si no le dio "¡Entendido!", no vuelve a saltar en esta visita: queda el puntito para leerla después
    try { sessionStorage.setItem(CLAVE_DESPUES, "1"); } catch {}
    setNovedades(null);
  }

  // Suscripción: si venció (pasada la gracia) la agenda queda en sólo lectura
  const pago = estadoPago(pagadoHasta, hoyISO());
  const soloLectura = pago.tipo === "vencida";

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

  const { citas, recargar: recargarCitas } = useCitas(aISO(dias[0]), aISO(dias[dias.length - 1]));

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
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{nombreAgenda || "Agenda"}</h1>
          {yo && <p className="text-sm text-muted">Hola, {yo.nombre}</p>}
        </div>
        {yo?.rol === "owner" && pago.tipo !== "cortesia" && (
          <span className="hidden sm:contents">
          <Link
            href="/personalizar#suscripcion"
            className={`btn btn-sec ${pago.tipo === "activa" ? "" : "border-danger text-danger"}`}
            title="Suscripción y pagos"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            {pago.tipo === "activa"
              ? `Suscripción · ${fechaCorta(pago.vence)}`
              : pago.tipo === "por_vencer"
                ? pago.dias === 0 ? "Vence hoy" : `Vence en ${pago.dias} d`
                : "Pagar suscripción"}
          </Link>
          </span>
        )}
        {sinLeer && (
          <span className="hidden sm:contents">
            <button onClick={() => setNovedades("nuevas")} className="btn btn-sec relative border-accent text-accent" title="Lo nuevo de la agenda">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>
              Novedades
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />
            </button>
          </span>
        )}
        <button onClick={() => setBuscando(true)} className="btn btn-sec" title="Buscar paciente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span className="hidden sm:inline">Buscar</span>
        </button>
        <Link href="/avance" className="btn btn-sec" title="Mi avance por materia">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
          <span className="hidden sm:inline">Mi avance</span>
        </Link>
        <span className="hidden sm:contents">
        <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer" className="btn btn-sec" title="Manual de usuario">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>
          Manual
        </a>
        <Link href="/personalizar" className="btn btn-sec">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>
          Personalizar
        </Link>
        <button onClick={salir} className="btn btn-sec" title="Cerrar sesión">Salir</button>
        </span>

        {/* Celular: lo demás va en un menú */}
        <div className="relative sm:hidden">
          <button onClick={() => setMenu(!menu)} className="btn btn-sec relative" aria-label="Más opciones" aria-expanded={menu}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            {yo?.rol === "owner" && pago.tipo !== "cortesia" && pago.tipo !== "activa" ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger" />
            ) : sinLeer ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent" />
            ) : null}
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-panel py-1 text-sm shadow-xl">
                {yo?.rol === "owner" && pago.tipo !== "cortesia" && (
                  <Link href="/personalizar#suscripcion" className={`block px-4 py-2.5 hover:bg-panel-2 ${pago.tipo === "activa" ? "" : "text-danger"}`}>
                    {pago.tipo === "activa" ? `Suscripción · ${fechaCorta(pago.vence)}` : pago.tipo === "por_vencer" ? (pago.dias === 0 ? "Suscripción · vence hoy" : `Suscripción · vence en ${pago.dias} d`) : "Pagar suscripción"}
                  </Link>
                )}
                <button onClick={() => { setMenu(false); setNovedades(sinLeer ? "nuevas" : "todas"); }} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-panel-2">
                  Novedades
                  {sinLeer && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-panel">Nuevo</span>}
                </button>
                <Link href="/personalizar" className="block px-4 py-2.5 hover:bg-panel-2">Personalizar</Link>
                <button onClick={() => { setMenu(false); setVerInstalar(true); }} className="block w-full px-4 py-2.5 text-left hover:bg-panel-2">Instalar como app</button>
                <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 hover:bg-panel-2">Manual</a>
                <button onClick={salir} className="block w-full border-t border-line px-4 py-2.5 text-left text-danger hover:bg-panel-2">Salir</button>
              </div>
            </>
          )}
        </div>
      </header>

      <BannerPago estado={pago} esDueno={yo?.rol === "owner"} />
      <InstalarApp />

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
            {vista === "lista" && !soloLectura && (
              <button className="btn btn-primario py-1 text-xs" onClick={() => setModal({ cita: null, fecha: hoyStr })}>+ Cita</button>
            )}

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
                  onAbrir={() => setModal({ cita: c, fecha: c.fecha })}
                  onCambio={recargarCitas}
                />
              )}
              onNueva={soloLectura ? undefined : (iso) => setModal({ cita: null, fecha: iso })}
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

                  {/* Móvil: puntitos */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
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
            <button className="btn btn-primario shrink-0" disabled={soloLectura} title={soloLectura ? "Agenda en sólo lectura" : undefined} onClick={() => setModal({ cita: null, fecha: seleccionado })}>
              + Cita
            </button>
          </div>

          {citasDelDia.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              {filtro === "todos" ? "Nadie tiene citas este día." : "Sin citas este día."}
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

      {/* Pie: versión, novedades e instalar (siempre a la mano) */}
      <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>Agenda de clínicas · versión {APP_VERSION}</span>
        <span aria-hidden>·</span>
        <button onClick={() => setNovedades(sinLeer ? "nuevas" : "todas")} className="inline-flex items-center gap-1 hover:text-ink">
          Novedades
          {sinLeer && <span className="h-2 w-2 rounded-full bg-accent" />}
        </button>
        <span aria-hidden>·</span>
        <button onClick={() => setVerInstalar(true)} className="hover:text-ink">Instalar como app</button>
      </footer>

      {yo && !yo.acepto_terminos_at && (
        <AceptarTerminos supabase={supabase} userId={userId} onAceptado={recargarCatalogos} />
      )}

      {yo?.acepto_terminos_at && yo.rol === "owner" && (
        <CuatriModal yo={yo} onVisible={setCuatriAbierto} onCambio={() => { recargarCatalogos(); recargarCitas(); }} />
      )}

      {novedades && yo && (
        <Novedades
          supabase={supabase}
          userId={userId}
          vista={yo.version_vista}
          todas={novedades === "todas" && !sinLeer}
          onLeido={recargarCatalogos}
          onClose={cerrarNovedades}
        />
      )}

      {verInstalar && <VentanaInstalar onClose={() => setVerInstalar(false)} />}

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
          onOtraSesion={(c) => setModal({ cita: null, fecha: sumarDias(c.fecha, 7), plantilla: c })}
          perfiles={perfiles}
          clinicas={clinicas}
          materias={materias}
          preferencias={p}
          soloLectura={soloLectura}
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

function VistaLista({
  dias, porDia, hoy, render, onNueva,
}: {
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
          <div className="flex flex-col gap-2">{(porDia.get(iso) ?? []).map(render)}</div>
        </section>
      ))}
    </div>
  );
}
