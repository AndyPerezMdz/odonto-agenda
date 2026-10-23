"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePersonal } from "@/lib/usePersonal";
import { aISO, deISO, diasDelMes, DIAS_CORTOS_LUNES, hoyISO, MESES } from "@/lib/fechas";
import { sumarDias, diasEntre } from "@/lib/pagos";
import { entregasPendientes, expandir, fechasQueVienen, hm, ICONO_TIPO, TIPOS, type Ocurrencia, type PCategoria, type PEvento, type PHabito, type PMarca, type PPendiente, type TipoEvento } from "@/lib/personal";
import { PagoModal, RenglonPago, SeccionPagos, useAccionesVP, ViajeDetalle, type AccionesVP } from "@/components/personal/ViajesPagos";
import { gastadoViaje, maletaViaje, pagosPorAtender, vencimientosEntre, type PCosa, type PPagoFijo, type PPagoHecho } from "@/lib/viajesPagos";
import { pesos } from "@/lib/pagos";
import { FechasQueVienen, HabitoModal, HabitosHoy, ICONO_LISTAS, Palomita, PendienteModal, SeccionHabitos, SeccionPendientes, useAccionesListas, type AccionesListas } from "@/components/personal/Listas";
import EventoModal from "@/components/personal/EventoModal";
import BotonActivar from "@/components/personal/BotonActivar";
import ProbarMi from "@/components/personal/ProbarMi";
import { BENEFICIOS_MI_PRO, type EstadoMi } from "@/lib/planMi";
import { fechaLarga } from "@/lib/fechas";

// 2.3 · Mi agenda con cara de agenda de papel: Hoy (línea del tiempo), Semana (o mes) y Viajes (pases de abordar).
// 2.5 · + Viajes completos (itinerario, maleta, reservas, gastos) y Pagos fijos (Pro).
// 2.4 · + Pendientes (por hacer / algún día) y Hábitos con racha; "cada año" y fechas que vienen.

type Modal = { evento: PEvento | Ocurrencia | null; fecha: string; tipo?: TipoEvento };
type Seccion = "hoy" | "semana" | "pendientes" | "habitos" | "viajes" | "pagos";

const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MES_CORTO = (iso: string) => MESES[deISO(iso).getMonth()].slice(0, 3).toLowerCase();
const corta = (iso: string) => `${deISO(iso).getDate()} ${MES_CORTO(iso)}`;
const lunesDe = (iso: string) => sumarDias(iso, -((deISO(iso).getDay() + 6) % 7));
const ahoraHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const cuando = (hoy: string, f: string) => {
  const n = diasEntre(hoy, f);
  return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n < 0 ? `hace ${-n} días` : `en ${n} días`;
};

function Ico({ d, size = 18, w = 1.9 }: { d: string; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  hoy: "M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  semana: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2",
  viajes: ICONO_TIPO.viaje,
  pendientes: ICONO_LISTAS.pendiente,
  habitos: ICONO_LISTAS.habito,
  pagos: "M3 7h18v12H3zM3 11h18M7 15h3",
  mas: "M5 12h.01M12 12h.01M19 12h.01",
  mas1: "M12 5v14M5 12h14",
  clinicas: "M7 16 3 12l4-4M3 12h13M17 8l4 4-4 4",
  ajustes: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  salir: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  lugar: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  repite: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  estrella: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
  candado: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
};

export default function AgendaPersonal({
  userId, nombre, tieneClinica, demo = false, odonto = true, publico = false, estado = null, pruebaDisponible = false,
}: { userId: string; nombre: string; tieneClinica: boolean; demo?: boolean; odonto?: boolean; publico?: boolean; estado?: EstadoMi | null; pruebaDisponible?: boolean }) {
  // 2.3 · Gratis / Pro (la demo enseña todo)
  const pro = demo || !estado || estado.pro;
  // odonto: textos y ejemplos de estudiante de odonto; si no, de cualquier persona. publico: demo sin cuenta (/mi-agenda/demo).
  const {
    supabase, eventos, categorias, pendientes, habitos, marcas, error, recargar, setEventos, setPendientes, setHabitos, setMarcas,
    cosas, setCosas, presupuestos, setPresupuestos, pagosFijos, setPagosFijos, pagosHechos, setPagosHechos,
  } = usePersonal(demo, odonto ? "odonto" : "general");
  const acciones = useAccionesListas({ supabase, demo, setPendientes, setHabitos, setMarcas, recargar });
  const [modalPend, setModalPend] = useState<{ p: PPendiente | null; fecha?: string | null; lista?: PPendiente["lista"] } | null>(null);
  const [modalHab, setModalHab] = useState<{ h: PHabito | null } | null>(null);
  const [hoja, setHoja] = useState<"nuevo" | "mas" | "pro" | null>(null);
  const accionesVP = useAccionesVP({ supabase, demo, setCosas, setPresupuestos, setPagosFijos, setPagosHechos, recargar, onPro: () => setHoja("pro") });
  const [viajeAbierto, setViajeAbierto] = useState<string | null>(null);
  const [modalPago, setModalPago] = useState<{ p: PPagoFijo | null } | null>(null);
  const hoy = hoyISO();
  const [seccion, setSeccion] = useState<Seccion>("hoy");
  const [modal, setModal] = useState<Modal | null>(null);
  const [fechaNuevo, setFechaNuevo] = useState(hoy);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!demo) document.cookie = "ultima_agenda=personal; path=/; max-age=31536000; samesite=lax";
  }, [demo]);
  const aClinicas = () => { document.cookie = "ultima_agenda=clinicas; path=/; max-age=31536000; samesite=lax"; };

  // Escape cierra las hojas
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setHoja(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const visibles = useMemo(() => (eventos ?? []).filter((e) => !e.categoria_id || !ocultas.has(e.categoria_id)), [eventos, ocultas]);

  function nuevo(fecha = hoy) {
    setFechaNuevo(fecha < hoy ? hoy : fecha);
    setHoja("nuevo");
  }
  function guardado() {
    setModal(null);
    recargar();
  }
  async function marcar(e: PEvento, hecho: boolean) {
    if (demo) {
      setEventos((l) => (l ?? []).map((x) => (x.id === e.id ? { ...x, hecho } : x)));
      return;
    }
    await supabase.from("p_eventos").update({ hecho, hecho_at: hecho ? new Date().toISOString() : null }).eq("id", e.id);
    recargar();
  }
  // Los viajes se abren en su detalle (itinerario, maleta, reservas, gastos)
  const abrir = (o: Ocurrencia) => (o.tipo === "viaje" ? setViajeAbierto(o.id) : setModal({ evento: o, fecha: o.dia }));
  const viaje = viajeAbierto ? eventos?.find((e) => e.id === viajeAbierto && e.tipo === "viaje") : undefined;

  const nav: { id: Seccion; t: string; d: string }[] = [
    { id: "hoy", t: "Hoy", d: I.hoy },
    { id: "semana", t: "Semana", d: I.semana },
    { id: "pendientes", t: "Pendientes", d: I.pendientes },
    { id: "habitos", t: "Hábitos", d: I.habitos },
    { id: "viajes", t: "Viajes", d: I.viajes },
    { id: "pagos", t: "Pagos", d: I.pagos },
  ];
  const ir = (x: Seccion) => {
    setSeccion(x);
    setHoja(null);
    window.scrollTo({ top: 0 });
  };

  const extras = !demo && (
    <>
      {tieneClinica && <ItemMenu href="/" onClick={aClinicas} d={I.clinicas} t="Agenda de clínicas" />}
      <ItemMenu href="/personal/ajustes#plan" d={I.estrella} t={estado?.tipo === "gratis" ? "Pásate a Pro" : "Tu plan"} />
      <ItemMenu href="/personal/ajustes" d={I.ajustes} t="Ajustes y categorías" />
      <form action="/auth/salir" method="post">
        <input type="hidden" name="a" value="mi" />
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-danger hover:bg-panel-2">
          <Ico d={I.salir} /> Salir
        </button>
      </form>
    </>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* ---------- Barra lateral (compu) ---------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-panel/80 px-4 py-6 backdrop-blur lg:flex">
        <p className="serif px-2 text-3xl leading-none">Mi agenda</p>
        <p className="mb-5 mt-1 px-2 text-xs text-muted">{demo ? "Demo · no se guarda nada" : "Sólo tú la ves"}</p>
        <button onClick={() => nuevo()} className="btn btn-primario mb-4 w-full rounded-full">
          <Ico d={I.mas1} w={2.4} /> Anotar algo
        </button>
        <nav className="flex flex-col gap-0.5">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => ir(n.id)}
              aria-current={seccion === n.id ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${seccion === n.id ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
            >
              <Ico d={n.d} /> {n.t}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-3">{extras}</div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-3 sm:px-6 lg:pb-12 lg:pt-8">
        {/* Cel: marca y menú arriba (abajo van las secciones) */}
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <span className="serif text-lg leading-none text-muted">Mi agenda</span>
          <button onClick={() => setHoja("mas")} aria-label="Más opciones" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-muted hover:text-ink">
            <Ico d={I.mas} size={20} w={3} />
          </button>
        </div>
        {demo && <BannerDemo publico={publico} />}
        {!demo && estado && <AvisoPlan e={estado} prueba={pruebaDisponible} />}
        {error && <p className="mb-4 rounded-xl bg-panel-2 p-3 text-sm text-danger">No se pudo cargar tu agenda: {error}</p>}
        {(acciones.error || accionesVP.error) && <p className="mb-4 rounded-xl bg-panel-2 p-3 text-sm text-danger">No se pudo guardar: {acciones.error || accionesVP.error}</p>}
        {!eventos ? (
          <p className="serif py-24 text-center text-2xl text-muted">Abriendo tu agenda…</p>
        ) : seccion === "hoy" ? (
          <SeccionHoy
            odonto={odonto} eventos={visibles} todos={eventos} hoy={hoy} nombre={nombre} catPorId={catPorId} onAbrir={abrir} onMarcar={marcar} onNuevo={nuevo}
            onSemana={() => ir("semana")} onViajes={() => ir("viajes")} onPendientes={() => ir("pendientes")} onHabitos={() => ir("habitos")}
            pendientes={pendientes} habitos={habitos} marcas={marcas} acciones={acciones}
            cosas={cosas} pagosFijos={pagosFijos} pagosHechos={pagosHechos} accionesVP={accionesVP}
            onEditarPendiente={(p) => setModalPend({ p })} onNuevoHabito={() => setModalHab({ h: null })}
          />
        ) : seccion === "semana" ? (
          <SeccionSemana eventos={visibles} hoy={hoy} categorias={categorias} ocultas={ocultas} setOcultas={setOcultas} catPorId={catPorId} onAbrir={abrir} onMarcar={marcar} onNuevo={nuevo} pendientes={pendientes} acciones={acciones} onEditarPendiente={(p) => setModalPend({ p })} pagosFijos={pagosFijos} pagosHechos={pagosHechos} accionesVP={accionesVP} />
        ) : seccion === "pendientes" ? (
          <SeccionPendientes pendientes={pendientes} hoy={hoy} acciones={acciones} onEditar={(p) => setModalPend({ p })} onNuevo={(lista) => setModalPend({ p: null, lista })} />
        ) : seccion === "pagos" ? (
          <SeccionPagos pagos={pagosFijos} hechos={pagosHechos} hoy={hoy} pro={pro} acciones={accionesVP} onEditar={(p) => setModalPago({ p })} onNuevo={() => setModalPago({ p: null })} onPro={() => setHoja("pro")} />
        ) : seccion === "habitos" ? (
          <SeccionHabitos habitos={habitos} marcas={marcas} hoy={hoy} acciones={acciones} onEditar={(h) => setModalHab({ h })} onNuevo={() => setModalHab({ h: null })} />
        ) : (
          <SeccionViajes eventos={eventos} hoy={hoy} catPorId={catPorId} cosas={cosas} onAbrir={(e) => abrir({ ...e, dia: e.fecha, serie: false })} onNuevo={() => (pro ? setModal({ evento: null, fecha: hoy, tipo: "viaje" }) : setHoja("pro"))} />
        )}
        <p className="serif mt-12 text-center text-sm italic text-muted">{demo ? "Demo con datos de ejemplo" : "Mi agenda · sólo tú la ves"}</p>
      </main>

      {/* ---------- Barra de abajo (cel) ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegación">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          {nav.slice(0, 2).map((n) => <BotonNav key={n.id} activo={seccion === n.id} d={n.d} t={n.t} onClick={() => ir(n.id)} />)}
          <div className="grid place-items-center">
            <button onClick={() => nuevo()} aria-label="Anotar algo" className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-accent text-panel shadow-lg ring-4 ring-bg">
              <Ico d={I.mas1} size={26} w={2.4} />
            </button>
          </div>
          {nav.slice(2, 4).map((n) => <BotonNav key={n.id} activo={seccion === n.id} d={n.d} t={n.t} onClick={() => ir(n.id)} />)}
        </div>
      </nav>

      {/* ---------- Hojas ---------- */}
      {hoja === "nuevo" && (
        <Hoja onClose={() => setHoja(null)} titulo="¿Qué anotamos?">
          <div className="grid grid-cols-2 gap-2.5">
            {TIPOS.map((t) => {
              const candado = !pro && t.id === "viaje";
              return (
                <button
                  key={t.id}
                  onClick={() => (candado ? setHoja("pro") : (setHoja(null), setModal({ evento: null, fecha: fechaNuevo, tipo: t.id })))}
                  className={`relative flex flex-col items-start gap-2 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent hover:bg-accent-soft/40 ${candado ? "opacity-70" : ""}`}
                >
                  {candado && <span className="versalitas absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-accent"><Ico d={I.candado} size={11} />Pro</span>}
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={ICONO_TIPO[t.id]} size={20} /></span>
                  <span className="serif text-xl leading-none">{t.nombre}</span>
                  <span className="text-xs text-muted">{t.detalle}</span>
                </button>
              );
            })}
            <button onClick={() => { setHoja(null); setModalPend({ p: null, fecha: fechaNuevo !== hoy ? fechaNuevo : null }); }} className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent hover:bg-accent-soft/40">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={ICONO_LISTAS.pendiente} size={20} /></span>
              <span className="serif text-xl leading-none">Pendiente</span>
              <span className="text-xs text-muted">Algo por hacer, con o sin fecha</span>
            </button>
            <button onClick={() => { setHoja(null); setModalHab({ h: null }); }} className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent hover:bg-accent-soft/40">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={ICONO_LISTAS.habito} size={20} /></span>
              <span className="serif text-xl leading-none">Hábito</span>
              <span className="text-xs text-muted">Lo palomeas y sube tu racha</span>
            </button>
          </div>
          {fechaNuevo !== hoy && <p className="mt-3 text-center text-xs text-muted">Para el {DIAS_LARGOS[deISO(fechaNuevo).getDay()].toLowerCase()} {corta(fechaNuevo)}</p>}
        </Hoja>
      )}
      {hoja === "pro" && (
        <Hoja onClose={() => setHoja(null)} titulo="Eso es de Pro">
          <p className="-mt-2 mb-3 text-sm text-muted">Estás en <b className="text-ink">Gratis</b>: eventos, pendientes, hábitos, recordatorios y repetir. Con Pro también tienes:</p>
          <ul className="mb-5 flex flex-col gap-1.5 text-sm">
            {BENEFICIOS_MI_PRO.map((b) => <li key={b} className="flex gap-2"><span className="text-accent">✓</span>{b}</li>)}
          </ul>
          {pruebaDisponible ? (
            <div className="flex flex-col gap-2">
              <ProbarMi />
              <Link href="/personal/ajustes#plan" className="btn btn-sec w-full rounded-full py-2">Ver planes</Link>
            </div>
          ) : (
            <Link href="/personal/ajustes#plan" className="btn btn-primario w-full rounded-full py-2.5">Ver planes</Link>
          )}
          {tieneClinica && <p className="mt-3 text-center text-xs text-muted">Si tu agenda de clínicas es Pro, tu Mi agenda también, sin pagar extra.</p>}
        </Hoja>
      )}
      {hoja === "mas" && (
        <Hoja onClose={() => setHoja(null)} titulo="Mi agenda">
          {nav.slice(4).map((n) => (
            <button key={n.id} onClick={() => ir(n.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted hover:bg-panel-2 hover:text-ink">
              <Ico d={n.d} /> {n.t} {!pro && <Ico d={I.candado} size={13} />}
            </button>
          ))}
          {demo ? (
            <p className="mt-2 text-sm text-muted">Es una demo: arriba está el botón para pedir la tuya.</p>
          ) : (
            <div className="flex flex-col">{extras}</div>
          )}
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Esta agenda es sólo tuya: ni tu compa ni nadie más la ve.</p>
        </Hoja>
      )}

      {viaje && (
        <ViajeDetalle
          viaje={viaje} cosas={cosas.filter((c) => c.viaje_id === viaje.id)} todas={cosas} viajes={(eventos ?? []).filter((e) => e.tipo === "viaje")}
          presupuesto={presupuestos[viaje.id] ?? null} hoy={hoy} pro={pro} acciones={accionesVP}
          onEditar={() => setModal({ evento: { ...viaje, dia: viaje.fecha, serie: false }, fecha: viaje.fecha })} onClose={() => setViajeAbierto(null)} onPro={() => setHoja("pro")}
        />
      )}
      {modalPago && <PagoModal key={modalPago.p?.id ?? "nuevo"} pago={modalPago.p} acciones={accionesVP} onClose={() => setModalPago(null)} />}
      {modalPend && <PendienteModal key={modalPend.p?.id ?? "nuevo"} pendiente={modalPend.p} fechaInicial={modalPend.fecha} listaInicial={modalPend.lista} acciones={acciones} onClose={() => setModalPend(null)} />}
      {modalHab && <HabitoModal key={modalHab.h?.id ?? "nuevo"} habito={modalHab.h} acciones={acciones} onClose={() => setModalHab(null)} />}

      {modal && (
        <EventoModal
          key={`${modal.evento?.id ?? "nuevo"}-${modal.fecha}-${modal.tipo ?? ""}`}
          supabase={supabase}
          userId={userId}
          evento={modal.evento}
          fechaInicial={modal.fecha}
          tipoInicial={modal.tipo}
          categorias={categorias}
          onClose={() => setModal(null)}
          onGuardado={guardado}
          demo={demo}
          odonto={odonto}
          pro={pro}
          onPro={() => { setModal(null); setHoja("pro"); }}
        />
      )}
    </div>
  );
}

/* ================================================================ */

function BotonNav({ activo, d, t, onClick, aria }: { activo: boolean; d: string; t: string; onClick: () => void; aria?: string }) {
  return (
    <button onClick={onClick} aria-label={aria} aria-current={activo ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${activo ? "text-accent" : "text-muted"}`}>
      <Ico d={d} size={21} />
      {t}
    </button>
  );
}

function ItemMenu({ href, onClick, d, t }: { href: string; onClick?: () => void; d: string; t: string }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-panel-2 hover:text-ink">
      <Ico d={d} /> {t}
    </Link>
  );
}

function Hoja({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border border-line bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <p className="serif mb-4 text-2xl">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

const colorDe = (o: { categoria_id: string | null }, catPorId: Map<string, PCategoria>) => (o.categoria_id ? catPorId.get(o.categoria_id)?.color : undefined) ?? "#8a7f70";

/* ------------------------------ HOY ------------------------------ */

function SeccionHoy({
  odonto, eventos, todos, hoy, nombre, catPorId, onAbrir, onMarcar, onNuevo, onSemana, onViajes, onPendientes, onHabitos,
  pendientes, habitos, marcas, acciones, onEditarPendiente, onNuevoHabito, cosas, pagosFijos, pagosHechos, accionesVP,
}: {
  odonto: boolean; eventos: PEvento[]; todos: PEvento[]; hoy: string; nombre: string; catPorId: Map<string, PCategoria>;
  onAbrir: (o: Ocurrencia) => void; onMarcar: (e: PEvento, h: boolean) => void; onNuevo: (f?: string) => void; onSemana: () => void; onViajes: () => void;
  onPendientes: () => void; onHabitos: () => void;
  pendientes: PPendiente[]; habitos: PHabito[]; marcas: PMarca[]; acciones: AccionesListas; onEditarPendiente: (p: PPendiente) => void; onNuevoHabito: () => void;
  cosas: PCosa[]; pagosFijos: PPagoFijo[]; pagosHechos: PPagoHecho[]; accionesVP: AccionesVP;
}) {
  const [ahora, setAhora] = useState(ahoraHM);
  useEffect(() => {
    const t = setInterval(() => setAhora(ahoraHM()), 60_000);
    return () => clearInterval(t);
  }, []);
  const d = deISO(hoy);
  const deHoy = expandir(eventos, hoy, hoy);
  const viaje = deHoy.find((o) => o.tipo === "viaje");
  const linea = deHoy.filter((o) => o.tipo === "evento" || o.tipo === "recordatorio");
  const todoElDia = linea.filter((o) => !o.hora_inicio);
  const conHora = linea.filter((o) => o.hora_inicio);
  const iAhora = conHora.findIndex((o) => hm(o.hora_inicio) > ahora);
  const { vencidas, proximas } = entregasPendientes(todos, hoy, 7);
  // Pendientes con fecha de hoy o atrasados (los de "algún día" no estorban aquí)
  const pendHoy = pendientes.filter((p) => !p.padre_id && p.lista === "hacer" && p.fecha && p.fecha <= hoy && (!p.hecho || (p.hecho_at ?? "").slice(0, 10) === hoy)).sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
  const sinFecha = pendientes.filter((p) => !p.padre_id && p.lista === "hacer" && !p.hecho && !p.fecha).length;
  const fechas = fechasQueVienen(eventos, hoy, 14);
  const pagosHoy = pagosPorAtender(pagosFijos, pagosHechos, hoy);
  const planesHoy = viaje ? cosas.filter((c) => c.viaje_id === viaje.id && (c.tipo === "itinerario" || c.tipo === "reserva") && c.fecha === hoy).sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99")) : [];
  const proximoViaje = !viaje ? todos.filter((e) => e.tipo === "viaje" && e.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] : undefined;
  const semana = expandir(eventos, sumarDias(hoy, 1), sumarDias(hoy, 6)).filter((o) => o.tipo !== "viaje" || o.dia === o.fecha);
  const porDia = new Map<string, Ocurrencia[]>();
  for (const o of semana) porDia.set(o.dia, [...(porDia.get(o.dia) ?? []), o]);

  return (
    <div>
      {/* Encabezado tipo página de agenda */}
      <header className="mb-6 flex items-end gap-4 border-b border-line pb-4">
        <div className="mr-auto min-w-0">
          <p className="versalitas text-muted">{nombre ? `Hola, ${nombre}` : "Tu agenda"}</p>
          <h1 className="serif mt-1 text-5xl leading-[0.95] sm:text-6xl">{DIAS_LARGOS[d.getDay()]}</h1>
          <p className="serif mt-1 text-xl italic text-accent">
            {d.getDate()} de {MESES[d.getMonth()].toLowerCase()}
          </p>
        </div>
        <div className="grid h-[72px] w-[72px] shrink-0 -rotate-6 place-items-center rounded-full border-2 border-dashed border-accent/60 text-center text-accent">
          <span className="leading-none">
            <span className="serif block text-3xl">{linea.length}</span>
            <span className="versalitas text-[0.55rem]">hoy</span>
          </span>
        </div>
      </header>

      {viaje && <Boleto e={viaje} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(viaje)} enCurso extra={extraViaje(cosas, viaje.id)} />}
      {planesHoy.length > 0 && (
        <ul className="-mt-3 mb-6 rounded-b-2xl border border-t-0 border-line bg-panel/70 px-4 py-2 text-sm">
          {planesHoy.map((c) => (
            <li key={c.id} className="flex gap-3 py-0.5">
              <span className="w-11 shrink-0 tabular-nums text-muted">{c.hora ? hm(c.hora) : "—"}</span>
              <span className="min-w-0 flex-1 truncate">{c.tipo === "reserva" ? "📌 " : ""}{c.titulo}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Línea del tiempo */}
      <section className="mb-8">
        {todoElDia.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1.5">
            {todoElDia.map((o) => (
              <li key={`${o.id}-${o.dia}`}>
                <button onClick={() => onAbrir(o)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-left hover:bg-panel-2">
                  <span className="versalitas w-14 shrink-0 text-muted">Todo el día</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorDe(o, catPorId) }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{o.titulo}</span>
                  {o.tipo === "recordatorio" && <span className="text-muted"><Ico d={ICONO_TIPO.recordatorio} size={15} /></span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {conHora.length === 0 && todoElDia.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
            <p className="serif text-2xl">Día libre.</p>
            <p className="mt-1 text-sm text-muted">{odonto ? "Disfrútalo… o adelanta ese caso clínico." : "Disfrútalo… o adelanta pendientes. Tú sabes."}</p>
            <button onClick={() => onNuevo()} className="btn btn-sec mt-4 rounded-full">Anotar algo para hoy</button>
          </div>
        ) : (
          <ol className="relative">
            {conHora.map((o, i) => {
              const paso = (hm(o.hora_fin) || hm(o.hora_inicio)) <= ahora;
              const color = colorDe(o, catPorId);
              return (
                <li key={`${o.id}-${o.dia}`}>
                  {i === iAhora && <MarcaAhora ahora={ahora} />}
                  <div className={`grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] items-stretch ${paso ? "opacity-55" : ""}`}>
                    <span className="serif pt-2.5 text-lg leading-none tabular-nums">{hm(o.hora_inicio)}</span>
                    <span className="relative flex justify-center">
                      <span className="absolute inset-y-0 w-px bg-line" />
                      <span className="relative mt-3 h-3 w-3 rounded-full ring-4 ring-bg" style={{ background: color }} />
                    </span>
                    <button onClick={() => onAbrir(o)} className="mb-2.5 min-w-0 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-left shadow-[0_1px_0_var(--line)] transition hover:-translate-y-px hover:bg-panel-2">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{o.titulo}</span>
                        {o.tipo === "recordatorio" && <span className="text-muted"><Ico d={ICONO_TIPO.recordatorio} size={15} /></span>}
                        {o.serie && <span className="text-muted" title="Se repite"><Ico d={I.repite} size={14} /></span>}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        {o.hora_fin && <span>hasta las {hm(o.hora_fin)}</span>}
                        {o.lugar && <span className="inline-flex min-w-0 items-center gap-1 truncate"><Ico d={I.lugar} size={12} />{o.lugar}</span>}
                        {o.categoria_id && catPorId.get(o.categoria_id) && <span style={{ color }}>{catPorId.get(o.categoria_id)!.nombre}</span>}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
            {iAhora === -1 && conHora.length > 0 && <MarcaAhora ahora={ahora} fin />}
          </ol>
        )}
      </section>

      <HabitosHoy habitos={habitos} marcas={marcas} hoy={hoy} acciones={acciones} onVer={onHabitos} onNuevo={onNuevoHabito} />

      {/* Pendientes y entregas: post-it */}
      <section className="nota mb-8 -rotate-[0.6deg] rounded-sm p-5 shadow-[0_10px_20px_-12px_rgba(60,45,10,0.45)]">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="serif text-2xl">No se te olvide</h2>
          <button onClick={onPendientes} className="text-xs underline-offset-2 opacity-75 hover:underline">{sinFecha ? `+${sinFecha} sin fecha →` : "Pendientes →"}</button>
        </div>
        {vencidas.length + proximas.length + pendHoy.length + pagosHoy.length === 0 ? (
          <p className="serif text-lg italic opacity-80">Nada pendiente. Milagro.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pagosHoy.map((v) => <RenglonPago key={`${v.pago.id}-${v.fecha}`} v={v} hoy={hoy} acciones={accionesVP} />)}
            {pendHoy.map((p) => (
              <li key={p.id} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--nota-ink)]" checked={p.hecho} onChange={(x) => acciones.marcarPendiente(p, x.target.checked)} aria-label={`Hecho: ${p.titulo}`} />
                <button onClick={() => onEditarPendiente(p)} className={`min-w-0 flex-1 text-left leading-snug ${p.hecho ? "line-through opacity-60" : ""}`}>{p.titulo}</button>
                <span className={`shrink-0 text-xs ${p.fecha! < hoy ? "font-bold text-danger" : "opacity-75"}`}>{p.fecha! < hoy ? `atrasado ${diasEntre(p.fecha!, hoy)} d` : "hoy"}</span>
              </li>
            ))}
            {[...vencidas, ...proximas].map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--nota-ink)]" checked={e.hecho} onChange={(x) => onMarcar(e, x.target.checked)} aria-label={`Entregada: ${e.titulo}`} />
                <button onClick={() => onAbrir({ ...e, dia: e.fecha, serie: false })} className="min-w-0 flex-1 text-left leading-snug">{e.titulo}</button>
                <span className={`shrink-0 text-xs ${e.fecha < hoy ? "font-bold text-danger" : e.fecha === hoy ? "font-bold" : "opacity-75"}`}>
                  {e.fecha < hoy ? `entrega atrasada ${diasEntre(e.fecha, hoy)} d` : `entrega ${cuando(hoy, e.fecha)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {proximoViaje && (
        <div className="mb-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="serif text-2xl">Tu próximo viaje</h2>
            <button onClick={onViajes} className="text-sm font-medium text-accent hover:underline">Todos</button>
          </div>
          <Boleto e={{ ...proximoViaje, dia: proximoViaje.fecha, serie: false }} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir({ ...proximoViaje, dia: proximoViaje.fecha, serie: false })} extra={extraViaje(cosas, proximoViaje.id)} />
        </div>
      )}

      <FechasQueVienen fechas={fechas} hoy={hoy} onAbrir={onAbrir} />

      {/* Lo que viene */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="serif text-2xl">Lo que viene</h2>
          <button onClick={onSemana} className="text-sm font-medium text-accent hover:underline">Ver la semana</button>
        </div>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
          {Array.from({ length: 6 }, (_, i) => sumarDias(hoy, i + 1)).map((dia) => {
            const os = porDia.get(dia) ?? [];
            const dd = deISO(dia);
            return (
              <li key={dia}>
                <button onClick={() => (os[0] ? onAbrir(os[0]) : onNuevo(dia))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel-2">
                  <span className="w-12 shrink-0">
                    <span className="versalitas block text-muted">{DIAS_CORTOS_LUNES[(dd.getDay() + 6) % 7]}</span>
                    <span className="serif block text-xl leading-none">{dd.getDate()}</span>
                  </span>
                  {os.length === 0 ? (
                    <span className="text-sm italic text-muted">libre</span>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {os.slice(0, 3).map((o) => (
                        <span key={o.id} className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs" style={{ background: `${colorDe(o, catPorId)}1f`, color: colorDe(o, catPorId) }}>
                          {o.tipo === "viaje" ? "✈" : o.hora_inicio ? hm(o.hora_inicio) : o.tipo === "entrega" ? "Entrega" : ""} <span className="truncate">{o.titulo}</span>
                        </span>
                      ))}
                      {os.length > 3 && <span className="text-xs text-muted">+{os.length - 3}</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function MarcaAhora({ ahora, fin = false }: { ahora: string; fin?: boolean }) {
  return (
    <div className={`grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] items-center ${fin ? "mt-1" : "mb-2.5"}`}>
      <span className="versalitas text-accent">{ahora}</span>
      <span className="flex justify-center"><span className="h-2 w-2 rounded-full bg-accent" /></span>
      <span className="h-px bg-accent/70" />
    </div>
  );
}

/* --------------------------- PASE DE ABORDAR --------------------------- */

/** "Maleta 2/6 · $8,840" debajo del pase de abordar */
function extraViaje(cosas: PCosa[], id: string) {
  const mias = cosas.filter((c) => c.viaje_id === id);
  const m = maletaViaje(mias);
  const g = gastadoViaje(mias);
  return [m.total ? `Maleta ${m.listas}/${m.total}` : "", g ? `${pesos(g)} gastado` : ""].filter(Boolean).join(" · ");
}

function Boleto({ e, hoy, catPorId, onAbrir, enCurso = false, extra }: { e: Ocurrencia; hoy: string; catPorId: Map<string, PCategoria>; onAbrir: () => void; enCurso?: boolean; extra?: string }) {
  const fin = e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : e.fecha;
  const dias = diasEntre(e.fecha, fin) + 1;
  const falta = diasEntre(hoy, e.fecha);
  const pasado = fin < hoy;
  const color = colorDe(e, catPorId);
  return (
    <button onClick={onAbrir} className={`mb-6 flex w-full overflow-hidden rounded-2xl border border-line bg-panel text-left shadow-[0_12px_24px_-18px_rgba(40,30,20,0.6)] transition hover:-translate-y-0.5 ${pasado ? "opacity-60" : ""}`}>
      <span className="w-1.5 shrink-0" style={{ background: color }} />
      <span className="min-w-0 flex-1 px-4 py-3.5">
        <span className="versalitas flex items-center gap-1.5 text-muted"><Ico d={ICONO_TIPO.viaje} size={13} /> {enCurso ? "Estás de viaje" : "Pase de abordar"}</span>
        <span className="serif mt-1 block truncate text-3xl uppercase leading-none tracking-wide">{e.titulo}</span>
        <span className="mt-2 flex items-center gap-2 text-sm">
          <span><span className="versalitas block text-muted">Ida</span>{corta(e.fecha)}</span>
          <span className="mx-1 text-muted">→</span>
          <span><span className="versalitas block text-muted">Regreso</span>{corta(fin)}</span>
        </span>
        {e.lugar && <span className="mt-2 flex items-center gap-1 truncate text-xs text-muted"><Ico d={I.lugar} size={12} />{e.lugar}</span>}
        {extra && <span className="versalitas mt-1.5 block text-accent">{extra}</span>}
      </span>
      <span className="boleto-corte grid w-24 shrink-0 place-items-center px-2 text-center">
        <span>
          {enCurso ? (
            <>
              <span className="versalitas block text-muted">Día</span>
              <span className="serif block text-4xl leading-none text-accent">{diasEntre(e.fecha, hoy) + 1}</span>
              <span className="text-xs text-muted">de {dias}</span>
            </>
          ) : pasado ? (
            <>
              <span className="serif block text-3xl leading-none">{dias}</span>
              <span className="text-xs text-muted">día{dias === 1 ? "" : "s"}</span>
            </>
          ) : (
            <>
              <span className="versalitas block text-muted">Faltan</span>
              <span className="serif block text-4xl leading-none text-accent">{falta}</span>
              <span className="text-xs text-muted">día{falta === 1 ? "" : "s"}</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------ SEMANA / MES ------------------------------ */

function SeccionSemana({
  eventos, hoy, categorias, ocultas, setOcultas, catPorId, onAbrir, onMarcar, onNuevo, pendientes, acciones, onEditarPendiente, pagosFijos, pagosHechos, accionesVP,
}: {
  eventos: PEvento[]; hoy: string; categorias: PCategoria[]; ocultas: Set<string>; setOcultas: (s: Set<string>) => void; catPorId: Map<string, PCategoria>;
  onAbrir: (o: Ocurrencia) => void; onMarcar: (e: PEvento, h: boolean) => void; onNuevo: (f?: string) => void;
  pendientes: PPendiente[]; acciones: AccionesListas; onEditarPendiente: (p: PPendiente) => void;
  pagosFijos: PPagoFijo[]; pagosHechos: PPagoHecho[]; accionesVP: AccionesVP;
}) {
  const [vista, setVista] = useState<"semana" | "mes">("semana");
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const [mes, setMes] = useState(() => ({ a: deISO(hoy).getFullYear(), m: deISO(hoy).getMonth() }));
  const domingo = sumarDias(lunes, 6);
  const os = useMemo(() => expandir(eventos, lunes, domingo), [eventos, lunes, domingo]);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const porDia = new Map<string, Ocurrencia[]>();
  for (const o of os) porDia.set(o.dia, [...(porDia.get(o.dia) ?? []), o]);
  const pendPorDia = new Map<string, PPendiente[]>();
  for (const p of pendientes) if (!p.padre_id && p.lista === "hacer" && p.fecha && p.fecha >= lunes && p.fecha <= domingo) pendPorDia.set(p.fecha, [...(pendPorDia.get(p.fecha) ?? []), p]);

  const pagosSemana = vencimientosEntre(pagosFijos, pagosHechos, lunes, domingo);

  function moverMes(n: number) {
    const d = new Date(mes.a, mes.m + n, 1);
    setMes({ a: d.getFullYear(), m: d.getMonth() });
  }
  function toggle(id: string) {
    const s = new Set(ocultas);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setOcultas(s);
  }
  const titulo =
    vista === "semana"
      ? deISO(lunes).getMonth() === deISO(domingo).getMonth()
        ? `${deISO(lunes).getDate()} – ${deISO(domingo).getDate()} de ${MESES[deISO(domingo).getMonth()].toLowerCase()}`
        : `${corta(lunes)} – ${corta(domingo)}`
      : `${MESES[mes.m]} ${mes.a}`;
  const esEstaSemana = lunes === lunesDe(hoy);

  return (
    <div>
      <header className="mb-4 border-b border-line pb-4">
        <div className="flex items-end gap-3">
          <div className="mr-auto min-w-0">
            <p className="versalitas text-muted">{vista === "semana" ? (esEstaSemana ? "Esta semana" : "Semana") : "Mes"}</p>
            <h1 className="serif mt-1 text-4xl leading-none first-letter:uppercase">{titulo}</h1>
          </div>
          <div className="flex rounded-full border border-line bg-panel p-0.5 text-xs font-medium">
            {(["semana", "mes"] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)} className={`rounded-full px-3 py-1 ${vista === v ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}>{v === "semana" ? "Semana" : "Mes"}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <button className="btn btn-sec rounded-full px-3 py-1" onClick={() => (vista === "semana" ? setLunes(sumarDias(lunes, -7)) : moverMes(-1))} aria-label="Anterior">‹</button>
          <button className="btn btn-sec rounded-full px-3 py-1" onClick={() => (vista === "semana" ? setLunes(sumarDias(lunes, 7)) : moverMes(1))} aria-label="Siguiente">›</button>
          <button className="btn btn-sec rounded-full px-3 py-1 text-xs" onClick={() => { setLunes(lunesDe(hoy)); setMes({ a: deISO(hoy).getFullYear(), m: deISO(hoy).getMonth() }); }}>Hoy</button>
          {categorias.length > 0 && (
            <div className="ml-auto flex min-w-0 gap-1 overflow-x-auto">
              {categorias.map((c) => (
                <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={!ocultas.has(c.id)} title={ocultas.has(c.id) ? "Mostrar" : "Ocultar"} className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] ${ocultas.has(c.id) ? "text-muted line-through opacity-50" : ""}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {vista === "semana" ? (
        <ol className="flex flex-col gap-2.5">
          {dias.map((dia) => {
            const d = deISO(dia);
            const lista = porDia.get(dia) ?? [];
            const pends = pendPorDia.get(dia) ?? [];
            const pagos = pagosSemana.filter((v) => v.fecha === dia);
            const esHoy = dia === hoy;
            return (
              <li key={dia} className={`grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 rounded-2xl border bg-panel p-3 ${esHoy ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line"} ${dia < hoy ? "opacity-70" : ""}`}>
                <button onClick={() => onNuevo(dia)} className="text-left" title="Anotar algo este día">
                  <span className={`versalitas block ${esHoy ? "text-accent" : "text-muted"}`}>{DIAS_CORTOS_LUNES[(d.getDay() + 6) % 7]}</span>
                  <span className={`serif block text-4xl leading-none ${esHoy ? "text-accent" : ""}`}>{d.getDate()}</span>
                </button>
                {lista.length + pends.length + pagos.length === 0 ? (
                  <button onClick={() => onNuevo(dia)} className="self-center text-left text-sm italic text-muted hover:text-ink">— libre</button>
                ) : (
                  <ul className="flex min-w-0 flex-col gap-1">
                    {lista.map((o) => <Renglon key={`${o.id}-${o.dia}`} o={o} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(o)} onMarcar={onMarcar} />)}
                    {pends.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-panel-2">
                        <Palomita chica checked={p.hecho} onChange={(v) => acciones.marcarPendiente(p, v)} etiqueta={`Hecho: ${p.titulo}`} />
                        <button onClick={() => onEditarPendiente(p)} className={`min-w-0 flex-1 truncate text-left ${p.hecho ? "text-muted line-through" : ""}`}>{p.titulo}</button>
                        <span className="versalitas shrink-0 text-muted">pendiente</span>
                      </li>
                    ))}
                    {pagos.map((v) => (
                      <li key={`${v.pago.id}-${v.fecha}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-panel-2">
                        <Palomita chica checked={v.pagado} onChange={(x) => accionesVP.marcarPagado(v.pago, v.fecha, x)} etiqueta={`Ya pagué: ${v.pago.nombre}`} />
                        <span className={`min-w-0 flex-1 truncate ${v.pagado ? "text-muted line-through" : ""}`}>{v.pago.nombre}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{pesos(v.pago.monto)}</span>
                        <span className={`versalitas shrink-0 ${!v.pagado && v.fecha < hoy ? "text-danger" : "text-muted"}`}>pago</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <Mes eventos={eventos} hoy={hoy} anio={mes.a} mes={mes.m} catPorId={catPorId} onDia={(dia) => { setLunes(lunesDe(dia)); setVista("semana"); }} />
      )}
    </div>
  );
}

function Renglon({ o, hoy, catPorId, onAbrir, onMarcar }: { o: Ocurrencia; hoy: string; catPorId: Map<string, PCategoria>; onAbrir: () => void; onMarcar: (e: PEvento, h: boolean) => void }) {
  const color = colorDe(o, catPorId);
  if (o.tipo === "viaje") {
    const fin = o.fecha_fin ?? o.fecha;
    return (
      <li>
        <button onClick={onAbrir} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm font-medium text-white" style={{ background: color }}>
          <Ico d={ICONO_TIPO.viaje} size={14} />
          <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
          <span className="shrink-0 text-xs opacity-85">día {diasEntre(o.fecha, o.dia) + 1} de {diasEntre(o.fecha, fin) + 1}</span>
        </button>
      </li>
    );
  }
  if (o.tipo === "entrega") {
    const atrasada = !o.hecho && o.fecha < hoy;
    return (
      <li className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-panel-2">
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--accent)]" checked={o.hecho} onChange={(x) => onMarcar(o, x.target.checked)} aria-label={`Entregada: ${o.titulo}`} />
        <button onClick={onAbrir} className={`min-w-0 flex-1 truncate text-left ${o.hecho ? "text-muted line-through" : ""}`}>{o.titulo}</button>
        <span className={`versalitas shrink-0 ${atrasada ? "text-danger" : "text-muted"}`}>{atrasada ? "atrasada" : "entrega"}</span>
      </li>
    );
  }
  return (
    <li>
      <button onClick={onAbrir} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-panel-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="w-11 shrink-0 tabular-nums text-muted">{o.hora_inicio ? hm(o.hora_inicio) : "—"}</span>
        <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
        {o.tipo === "recordatorio" && <span className="text-muted"><Ico d={ICONO_TIPO.recordatorio} size={14} /></span>}
      </button>
    </li>
  );
}

function Mes({ eventos, hoy, anio, mes, catPorId, onDia }: { eventos: PEvento[]; hoy: string; anio: number; mes: number; catPorId: Map<string, PCategoria>; onDia: (dia: string) => void }) {
  const dias = useMemo(() => diasDelMes(anio, mes, true), [anio, mes]);
  const desde = aISO(dias[0]);
  const hasta = aISO(dias[dias.length - 1]);
  const porDia = useMemo(() => {
    const m = new Map<string, Ocurrencia[]>();
    for (const o of expandir(eventos, desde, hasta)) m.set(o.dia, [...(m.get(o.dia) ?? []), o]);
    return m;
  }, [eventos, desde, hasta]);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="grid grid-cols-7 border-b border-line">
        {DIAS_CORTOS_LUNES.map((d) => <span key={d} className="versalitas py-2 text-center text-muted">{d.slice(0, 2)}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const iso = aISO(d);
          const os = porDia.get(iso) ?? [];
          const fuera = d.getMonth() !== mes;
          const viaje = os.find((o) => o.tipo === "viaje");
          return (
            <button key={iso} onClick={() => onDia(iso)} className={`flex min-h-[64px] flex-col items-center gap-1 border-line p-1.5 sm:min-h-[84px] ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${fuera ? "opacity-35" : ""} hover:bg-panel-2`}>
              <span className={`serif grid h-8 w-8 place-items-center rounded-full text-lg leading-none ${iso === hoy ? "bg-accent text-panel" : ""}`}>{d.getDate()}</span>
              {viaje && <span className="h-1 w-full rounded-full" style={{ background: colorDe(viaje, catPorId) }} title={viaje.titulo} />}
              <span className="flex flex-wrap justify-center gap-0.5">
                {os.filter((o) => o.tipo !== "viaje").slice(0, 4).map((o) => <span key={o.id} className="h-1.5 w-1.5 rounded-full" style={{ background: colorDe(o, catPorId) }} />)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ VIAJES ------------------------------ */

function SeccionViajes({ eventos, hoy, catPorId, cosas, onAbrir, onNuevo }: { eventos: PEvento[]; hoy: string; catPorId: Map<string, PCategoria>; cosas: PCosa[]; onAbrir: (e: PEvento) => void; onNuevo: () => void }) {
  const viajes = eventos.filter((e) => e.tipo === "viaje");
  const fin = (e: PEvento) => (e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : e.fecha);
  const proximos = viajes.filter((e) => fin(e) >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasados = viajes.filter((e) => fin(e) < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const [verPasados, setVerPasados] = useState(false);
  const diasFuera = proximos.reduce((n, e) => n + diasEntre(e.fecha, fin(e)) + 1, 0);

  return (
    <div>
      <header className="mb-5 flex items-end gap-3 border-b border-line pb-4">
        <div className="mr-auto">
          <p className="versalitas text-muted">Bitácora</p>
          <h1 className="serif mt-1 text-5xl leading-none">Viajes</h1>
          {proximos.length > 0 && <p className="mt-1.5 text-sm text-muted">{proximos.length} por venir · {diasFuera} día{diasFuera === 1 ? "" : "s"} fuera</p>}
        </div>
        <button onClick={onNuevo} className="btn btn-primario rounded-full"><Ico d={I.mas1} w={2.4} /> Viaje</button>
      </header>

      {proximos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center">
          <p className="serif text-2xl">Sin viajes a la vista.</p>
          <p className="mt-1 text-sm text-muted">Anota el próximo y aquí te cuenta los días que faltan.</p>
        </div>
      ) : (
        proximos.map((e) => <Boleto key={e.id} e={{ ...e, dia: e.fecha, serie: false }} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(e)} enCurso={e.fecha <= hoy} extra={extraViaje(cosas, e.id) || "Itinerario, maleta, reservas y gastos →"} />)
      )}

      {pasados.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setVerPasados(!verPasados)} className="text-sm font-medium text-muted hover:text-ink">
            {verPasados ? "Ocultar" : "Ver"} viajes pasados ({pasados.length})
          </button>
          {verPasados && <div className="mt-3">{pasados.map((e) => <Boleto key={e.id} e={{ ...e, dia: e.fecha, serie: false }} hoy={hoy} catPorId={catPorId} onAbrir={() => onAbrir(e)} />)}</div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ DEMO ------------------------------ */

/** Barra de la demo: es de mentiritas, y el botón para tenerla de verdad (2.3: al instante). */
function BannerDemo({ publico = false }: { publico?: boolean }) {
  return (
    <div className="nota sticky top-2 z-20 mb-6 flex flex-wrap items-center gap-3 rounded-sm px-4 py-3 text-sm shadow-[0_10px_20px_-14px_rgba(60,45,10,0.5)]">
      <p className="w-full sm:w-auto sm:flex-1">
        <b>Esto es una demo</b> con datos de ejemplo: pícale a todo, no se guarda nada.
      </p>
      {publico ? (
        <a href="/mi-agenda/registro" className="btn btn-primario rounded-full py-1.5 text-xs">La quiero</a>
      ) : (
        <span><BotonActivar texto="La quiero" className="btn btn-primario rounded-full py-1.5 text-xs" /></span>
      )}
      <a href={publico ? "/mi-agenda" : "/personalizar#personal"} className="btn btn-sec rounded-full py-1.5 text-xs">Salir de la demo</a>
    </div>
  );
}

/** 2.3 · Aviso del plan arriba de todo: últimos días de Pro, o que está en Gratis. */
function AvisoPlan({ e, prueba }: { e: EstadoMi; prueba: boolean }) {
  let texto: React.ReactNode = null;
  if ((e.tipo === "prueba" || e.tipo === "pro") && e.dias <= 3)
    texto = e.dias === 0 ? <>Hoy es tu <b>último día de {e.tipo === "prueba" ? "prueba de " : ""}Pro</b>. Mañana sigues en Gratis.</> : <>Te quedan <b>{e.dias} día{e.dias === 1 ? "" : "s"} de {e.tipo === "prueba" ? "prueba de " : ""}Pro</b> (hasta el {fechaLarga(e.hasta)}).</>;
  else if (e.tipo === "gratis")
    texto = prueba
      ? <>Estás en <b>Gratis</b>. ¿Quieres probar los viajes completos, los pagos fijos y el resumen de cada mañana? Tienes <b>15 días de Pro gratis</b> cuando quieras.</>
      : <>Estás en <b>Gratis</b>: tus cosas siguen aquí. Viajes, pagos fijos, tus colores y los avisos de la mañana vuelven con Pro.</>;
  if (!texto) return null;
  return (
    <div className="nota mb-6 flex flex-wrap items-center gap-3 rounded-sm px-4 py-3 text-sm shadow-[0_10px_20px_-14px_rgba(60,45,10,0.5)]">
      <p className="w-full min-w-0 sm:w-auto sm:flex-1">{texto}</p>
      {e.tipo === "gratis" && prueba ? <ProbarMi compacto /> : <Link href="/personal/ajustes#plan" className="btn btn-primario shrink-0 rounded-full py-1.5 text-xs">{e.tipo === "gratis" ? "Pásate a Pro" : "Elegir plan"}</Link>}
    </div>
  );
}
