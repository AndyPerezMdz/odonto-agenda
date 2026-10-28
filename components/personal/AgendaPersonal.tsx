"use client";

import { EsqueletoDia } from "@/components/Esqueletos";
import Anuncios from "@/components/Anuncios";
import AvisoMudanza from "@/components/AvisoMudanza";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePersonal } from "@/lib/usePersonal";
import { deISO, hoyISO } from "@/lib/fechas";
import { sumarDias } from "@/lib/pagos";
import { ICONO_TIPO, TIPOS, type Ocurrencia, type PEvento, type PHabito, type PPendiente, type TipoEvento } from "@/lib/personal";
import { PagoModal, SeccionPagos, useAccionesVP, ViajeDetalle } from "@/components/personal/ViajesPagos";
import type { PPagoFijo } from "@/lib/viajesPagos";
import { HabitoModal, ICONO_LISTAS, PendienteModal, SeccionHabitos, SeccionPendientes, useAccionesListas } from "@/components/personal/Listas";
import EventoModal from "@/components/personal/EventoModal";
import AnotarRapido from "@/components/personal/AnotarRapido";
import { Bienvenida, Novedades } from "@/components/personal/Bienvenida";
import { novedadesSinVer, ULTIMA_MI } from "@/lib/novedadesMi";
import type { Borrador } from "@/lib/anotarRapido";
import ProbarMi from "@/components/personal/ProbarMi";
import { BENEFICIOS_MI_PRO, type EstadoMi } from "@/lib/planMi";
import { corta, DIAS_LARGOS, Ico, I } from "@/components/personal/comun";
import { SeccionHoy } from "@/components/personal/SeccionHoy";
import { SeccionSemana } from "@/components/personal/SeccionSemana";
import { SeccionViajes } from "@/components/personal/SeccionViajes";
import { AvisoPlan, BannerDemo } from "@/components/personal/AvisosAgenda";
import { aMin, deMin, huecosLibres, ocupadoDe } from "@/lib/bloques";
import { expandir } from "@/lib/personal";
import { Compartir, InvitacionesHabitos, ParejaCopia, VerCompartido, useCompartidos } from "@/components/personal/Compartir";
import Buscador from "@/components/personal/Buscador";

// 2.3 · Mi agenda con cara de agenda de papel: Hoy (línea del tiempo), Semana (o mes) y Viajes (pases de abordar).
// 2.5 · + Viajes completos (itinerario, maleta, reservas, gastos) y Pagos fijos (Pro).
// 2.4 · + Pendientes (por hacer / algún día) y Hábitos con racha; "cada año" y fechas que vienen.

// 2.9 · Bloques de Hoy que se pueden ocultar (Personalizar Hoy)
const BLOQUES_HOY = [
  { id: "domingo", t: "Aviso del domingo", x: "“Mañana empieza tu semana” (Pro)" },
  { id: "habitos", t: "Tus hábitos", x: "Para palomear de un toque" },
  { id: "atajos", t: "Viajes y Pagos", x: "Los dos atajos" },
  { id: "postit", t: "No se te olvide", x: "Entregas, pendientes y pagos de hoy" },
  { id: "viaje", t: "Tu próximo viaje", x: "El pase de abordar" },
  { id: "fechas", t: "Fechas que vienen", x: "Cumpleaños y aniversarios" },
  { id: "viene", t: "Lo que viene", x: "Los próximos 6 días" },
] as const;

type Modal = { evento: PEvento | Ocurrencia | null; fecha: string; tipo?: TipoEvento; borrador?: Borrador };
type Seccion = "hoy" | "semana" | "pendientes" | "habitos" | "viajes" | "pagos";

export default function AgendaPersonal({
  userId, nombre, tieneClinica, demo = false, odonto = true, publico = false, estado = null, pruebaDisponible = false,
}: { userId: string; nombre: string; tieneClinica: boolean; demo?: boolean; odonto?: boolean; publico?: boolean; estado?: EstadoMi | null; pruebaDisponible?: boolean }) {
  // 2.3 · Gratis / Pro (la demo enseña todo)
  const pro = demo || !estado || estado.pro;
  // odonto: textos y ejemplos de estudiante de odonto; si no, de cualquier persona. publico: demo sin cuenta (/mi-agenda/demo).
  const {
    supabase, eventos, categorias, pendientes, habitos, marcas, error, recargar, setEventos, setPendientes, setHabitos, setMarcas, prefs, prefsCargadas, guardarPrefs,
    cosas, setCosas, presupuestos, setPresupuestos, pagosFijos, setPagosFijos, pagosHechos, setPagosHechos,
  } = usePersonal(demo, odonto ? "odonto" : "general");
  const acciones0 = useAccionesListas({ supabase, demo, setPendientes, setHabitos, setMarcas, recargar });
  // 3.0 · Lo que te compartieron: se junta con lo tuyo (eventos para ver, pendientes para palomear)
  const comp = useCompartidos(demo);
  function marcarCompartido(p: PPendiente, v: boolean) {
    if (p.compartido) comp.marcarLocal(p.compartido.id, v);
    return acciones0.marcarPendiente(p, v);
  }
  const quitarCompartido = (id: string) => comp.quitar(id);
  const acciones = {
    ...acciones0,
    marcarPendiente: marcarCompartido,
    // 3.2 · al palomear un hábito que haces con alguien, le avisa (si no lo ha hecho hoy)
    async marcarHabito(h: PHabito, fecha: string, si: boolean) {
      await acciones0.marcarHabito(h, fecha, si);
      if (si && fecha === hoyISO()) comp.palomee(h.id);
    },
  };
  const todosEventos = useMemo(() => (eventos ? [...eventos, ...comp.recibidos.eventos] : null), [eventos, comp.recibidos.eventos]);
  const todosPend = useMemo(() => [...pendientes, ...comp.recibidos.pendientes], [pendientes, comp.recibidos.pendientes]);
  const [verEv, setVerEv] = useState<{ e: PEvento; dia: string } | null>(null);
  const [buscando, setBuscando] = useState(false); // 3.0 · buscador
  const [modalPend, setModalPend] = useState<{ p: PPendiente | null; fecha?: string | null; lista?: PPendiente["lista"]; titulo?: string; bloque?: boolean; extra?: Parameters<typeof PendienteModal>[0]["extra"] } | null>(null);
  const [modalHab, setModalHab] = useState<{ h: PHabito | null; invitar?: boolean } | null>(null);
  const [hoja, setHoja] = useState<"nuevo" | "mas" | "pro" | "personalizar" | null>(null);
  // 2.9 · Bienvenida (primera vez) y "¿Qué hay de nuevo?"
  const [aviso, setAviso] = useState<"bienvenida" | "novedades" | null>(null);
  const [verNovedades, setVerNovedades] = useState<ReturnType<typeof novedadesSinVer>>([]);
  useEffect(() => {
    if (demo || !prefsCargadas || !eventos || aviso) return;
    if (!prefs.bienvenida) setAviso("bienvenida");
    else if (prefs.novedades !== ULTIMA_MI && novedadesSinVer(prefs.novedades).length) {
      setVerNovedades(novedadesSinVer(prefs.novedades));
      setAviso("novedades");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, prefsCargadas, eventos === null]);
  // 3.5 · La zona horaria del cel (para que los avisos lleguen a TU hora aunque no estés en Mérida)
  useEffect(() => {
    if (demo || !prefsCargadas) return;
    let zona = "";
    try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
    if (zona && zona !== (prefs.zona ?? "America/Merida")) guardarPrefs({ zona });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, prefsCargadas]);
  const ocultos = useMemo(() => new Set(prefs.hoy_ocultos ?? []), [prefs.hoy_ocultos]);
  const accionesVP = useAccionesVP({ supabase, demo, setCosas, setPresupuestos, setPagosFijos, setPagosHechos, recargar, onPro: () => setHoja("pro") });
  const [viajeAbierto, setViajeAbierto] = useState<string | null>(null);
  const [lunesSemana, setLunesSemana] = useState<string | null>(null); // 2.6 · el domingo, "Ver" abre la semana que viene
  const [modalPago, setModalPago] = useState<{ p: PPagoFijo | null; borrador?: Parameters<typeof PagoModal>[0]["borrador"] } | null>(null);
  const hoy = hoyISO();
  const [seccion, setSeccion] = useState<Seccion>("hoy");
  const [direccion, setDireccion] = useState(0);
  const [modal, setModal] = useState<Modal | null>(null);
  const [fechaNuevo, setFechaNuevo] = useState(hoy);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!demo) document.cookie = "ultima_agenda=personal; path=/; max-age=31536000; samesite=lax";
  }, [demo]);
  const aClinicas = () => { document.cookie = "ultima_agenda=clinicas; path=/; max-age=31536000; samesite=lax"; };

  // 2.8 · Atajos del ícono de la app (manifest): ?nuevo=1 abre "¿Qué anotamos?"; ?ver=habitos|pendientes|viajes|pagos|semana
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ver = q.get("ver") as Seccion | null;
    if (ver && ["semana", "pendientes", "habitos", "viajes", "pagos"].includes(ver)) setSeccion(ver);
    if (q.get("nuevo") === "1") setHoja("nuevo");
    if (q.has("ver") || q.has("nuevo")) history.replaceState(null, "", window.location.pathname);
  }, []);

  // Escape cierra las hojas; "/" o Ctrl+K abre el buscador
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHoja(null);
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "") || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "/" && !enCampo) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setBuscando(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  // 3.0 · Listas de pendientes que ya usas y huecos libres para los bloques
  const etiquetas = useMemo(() => [...new Set(pendientes.filter((p) => p.etiqueta && !p.compartido).map((p) => p.etiqueta!))].sort((a, b) => a.localeCompare(b)), [pendientes]);
  const sugerir = (fecha: string, dur: number, sinId?: string) => {
    const ahora = new Date();
    const desde = fecha === hoy ? ahora.getHours() * 60 + ahora.getMinutes() + 5 : 8 * 60;
    return huecosLibres(ocupadoDe(expandir(todosEventos ?? [], fecha, fecha), todosPend, fecha, sinId), dur, desde).map(deMin);
  };
  const visibles = useMemo(() => (todosEventos ?? []).filter((e) => !e.categoria_id || !ocultas.has(e.categoria_id)), [todosEventos, ocultas]);

  function nuevo(fecha = hoy) {
    setFechaNuevo(fecha < hoy ? hoy : fecha);
    setHoja("nuevo");
  }
  /** 2.6 · De "Anotar rápido" a revisar: pendiente, viaje (Pro) o evento/entrega/recordatorio */
  function revisarBorrador(b: Borrador) {
    setHoja(null);
    if (b.clase === "pendiente") {
      const dur = b.hora_inicio && b.hora_fin ? Math.max(15, aMin(b.hora_fin) - aMin(b.hora_inicio)) : null;
      return setModalPend({ p: null, fecha: b.fecha, titulo: b.titulo, extra: { prioridad: b.prioridad, etiqueta: b.etiqueta, hora: b.hora_inicio, duracion: dur } });
    }
    if (b.clase === "pago") {
      if (!pro) return setHoja("pro");
      const f = b.fecha ? deISO(b.fecha) : deISO(hoy);
      return setModalPago({ p: null, borrador: { nombre: b.titulo, monto: b.monto, frecuencia: b.repetir === "anual" ? "anual" : "mensual", dia: f.getDate(), mes: f.getMonth() + 1 } });
    }
    if (b.tipo === "viaje" && !pro) return setHoja("pro");
    const f = b.fecha ?? fechaNuevo;
    setModal({ evento: null, fecha: f, tipo: b.tipo, borrador: { ...b, fecha: f } });
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
  const abrir = (o: Ocurrencia) => (o.compartido ? setVerEv({ e: o, dia: o.dia }) : o.tipo === "viaje" ? setViajeAbierto(o.id) : setModal({ evento: o, fecha: o.dia }));
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
    // 3.6 · Para deslizar hacia el lado correcto (a la derecha si vas "adelante" en la barra)
    const orden = nav.map((n) => n.id);
    setDireccion(Math.sign(orden.indexOf(x) - orden.indexOf(seccion)));
    setSeccion(x);
    setHoja(null);
    window.scrollTo({ top: 0 });
  };

  const extras = !demo && (
    <>
      {tieneClinica && <ItemMenu href="/" onClick={aClinicas} d={I.clinicas} t="Agenda de clínicas" />}
      {/* 3.1 · De odonto sin agenda de clínicas: abrirla con la misma cuenta */}
      {!tieneClinica && odonto && <ItemMenu href="/clinicas/nueva" d={I.clinicas} t="Abrir agenda de clínicas" />}
      <ItemMenu href="/personal/ajustes#plan" d={I.estrella} t={estado?.tipo === "gratis" ? "Pásate a Pro" : "Tu plan"} />
      <ItemMenu href="/personal/ajustes" d={I.ajustes} t="Ajustes y categorías" />
      <button onClick={() => { setHoja(null); setVerNovedades([]); setAviso("novedades"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted hover:bg-panel-2 hover:text-ink">
        <Ico d={I.nuevo} /> ¿Qué hay de nuevo?
      </button>
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
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto overscroll-contain border-r border-line bg-panel/80 px-4 py-5 backdrop-blur lg:flex">
        <p className="serif px-2 text-3xl leading-none">Mi agenda</p>
        <p className="mb-4 mt-1 px-2 text-xs text-muted">{demo ? "Demo · no se guarda nada" : "Sólo tú la ves"}</p>
        <button onClick={() => nuevo()} className="btn btn-primario mb-2 w-full rounded-full">
          <Ico d={I.mas1} w={2.4} /> Anotar algo
        </button>
        <button onClick={() => setBuscando(true)} className="mb-4 flex w-full items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-sm text-muted hover:text-ink">
          🔍 Buscar <kbd className="ml-auto rounded border border-line px-1.5 text-[10px]">/</kbd>
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
        <div className="mt-auto border-t border-line pt-2 [&_a]:py-2 [&_button]:py-2">{extras}</div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-3 sm:px-6 lg:pb-12 lg:pt-8">
        {/* Cel: marca y menú arriba (abajo van las secciones) */}
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <span className="serif text-lg leading-none text-muted">Mi agenda</span>
          <span className="flex gap-2">
            <button onClick={() => setBuscando(true)} aria-label="Buscar" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-muted hover:text-ink">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </button>
            <button onClick={() => setHoja("mas")} aria-label="Más opciones" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-muted hover:text-ink">
              <Ico d={I.mas} size={20} w={3} />
            </button>
          </span>
        </div>
        {demo && <BannerDemo publico={publico} />}
        {!demo && <AvisoMudanza />}
        {!demo && <Anuncios supabase={supabase} para="mi" />}
        {!demo && estado && <AvisoPlan e={estado} prueba={pruebaDisponible} />}
        {error && <p className="mb-4 rounded-xl bg-panel-2 p-3 text-sm text-danger">No se pudo cargar tu agenda: {error}</p>}
        {(acciones.error || accionesVP.error) && <p className="mb-4 rounded-xl bg-panel-2 p-3 text-sm text-danger">No se pudo guardar: {acciones.error || accionesVP.error}</p>}
        <div key={eventos ? seccion : "cargando"} className={!eventos ? "" : direccion > 0 ? "entrar-der" : direccion < 0 ? "entrar-izq" : "entrar"}>
        {!eventos ? (
          <EsqueletoDia />
        ) : seccion === "hoy" ? (
          <SeccionHoy
            odonto={odonto} eventos={visibles} todos={todosEventos ?? []} hoy={hoy} nombre={nombre} catPorId={catPorId} onAbrir={abrir} onMarcar={marcar} onNuevo={nuevo}
            onSemana={() => ir("semana")} onViajes={() => ir("viajes")} onPendientes={() => ir("pendientes")} onHabitos={() => ir("habitos")}
            pendientes={todosPend} habitos={habitos} marcas={marcas} acciones={acciones}
            cosas={cosas} pagosFijos={pagosFijos} pagosHechos={pagosHechos} accionesVP={accionesVP} pro={pro}
            onTuSemana={() => { setLunesSemana(sumarDias(hoy, 1)); ir("semana"); }} onPagos={() => ir("pagos")}
            ocultos={ocultos} onPersonalizar={() => setHoja("personalizar")} onAgendar={(p) => setModalPend({ p, bloque: true })}
            onEditarPendiente={(p) => setModalPend({ p })} onNuevoHabito={() => setModalHab({ h: null })}
          />
        ) : seccion === "semana" ? (
          <SeccionSemana key={lunesSemana ?? "hoy"} lunesInicial={lunesSemana} pro={pro} onPro={() => setHoja("pro")} eventos={visibles} hoy={hoy} categorias={categorias} ocultas={ocultas} setOcultas={setOcultas} catPorId={catPorId} onAbrir={abrir} onMarcar={marcar} onNuevo={nuevo} pendientes={todosPend} acciones={acciones} onEditarPendiente={(p) => setModalPend({ p })} pagosFijos={pagosFijos} pagosHechos={pagosHechos} accionesVP={accionesVP} cosas={cosas} />
        ) : seccion === "pendientes" ? (
          <SeccionPendientes pendientes={todosPend} hoy={hoy} acciones={acciones} onEditar={(p) => setModalPend({ p })} onNuevo={(lista, etiqueta) => setModalPend({ p: null, lista, extra: etiqueta ? { etiqueta } : undefined })} onAgendar={(p) => setModalPend({ p, bloque: true })} onCompartido={marcarCompartido} />
        ) : seccion === "pagos" ? (
          <SeccionPagos pagos={pagosFijos} hechos={pagosHechos} hoy={hoy} pro={pro} acciones={accionesVP} onEditar={(p) => setModalPago({ p })} onNuevo={() => setModalPago({ p: null })} onPro={() => setHoja("pro")} />
        ) : seccion === "habitos" ? (
          <SeccionHabitos
            pro={pro} parejas={comp.parejas}
            amigos={<InvitacionesHabitos lista={comp.recibidos.habitos} onAceptar={async (id) => { const ok = await comp.aceptar(id); recargar(); return ok; }} onNo={(id) => comp.quitar(id)} />}
            onInvitar={demo ? undefined : (h) => setModalHab({ h, invitar: true })}
            habitos={habitos} marcas={marcas} hoy={hoy} acciones={acciones} onEditar={(h) => setModalHab({ h })} onNuevo={() => setModalHab({ h: null })} />
        ) : (
          <SeccionViajes eventos={todosEventos ?? []} hoy={hoy} catPorId={catPorId} cosas={cosas} onAbrir={(e) => abrir({ ...e, dia: e.fecha, serie: false })} onNuevo={() => (pro ? setModal({ evento: null, fecha: hoy, tipo: "viaje" }) : setHoja("pro"))} />
        )}
        </div>
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
          <AnotarRapido hoy={hoy} fechaDefault={fechaNuevo} odonto={odonto} onRevisar={revisarBorrador} />
          <p className="versalitas mb-2 text-center text-muted">o elige qué es</p>
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
            <button onClick={() => { if (!pro) return setHoja("pro"); setHoja(null); setModalPago({ p: null }); }} className={`relative flex flex-col items-start gap-2 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent hover:bg-accent-soft/40 ${pro ? "" : "opacity-70"}`}>
              {!pro && <span className="versalitas absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-accent"><Ico d={I.candado} size={11} />Pro</span>}
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={I.pagos} size={20} /></span>
              <span className="serif text-xl leading-none">Pago fijo</span>
              <span className="text-xs text-muted">Renta, tarjeta, Netflix…</span>
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
      {buscando && (
        <Buscador
          hoy={hoy}
          datos={{ eventos: todosEventos ?? [], pendientes: todosPend, habitos, cosas, pagos: pagosFijos }}
          onClose={() => setBuscando(false)}
          onElegir={(r) => {
            setBuscando(false);
            if (r.clase === "evento") abrir({ ...r.e, dia: r.fecha ?? r.e.fecha, serie: r.e.repetir !== "nunca" });
            else if (r.clase === "pendiente") setModalPend({ p: r.p });
            else if (r.clase === "habito") { ir("habitos"); setModalHab({ h: r.h }); }
            else if (r.clase === "cosa" && r.viaje) setViajeAbierto(r.viaje.id);
            else if (r.clase === "pago") { ir("pagos"); setModalPago({ p: r.pago }); }
          }}
        />
      )}
      {verEv && <VerCompartido e={verEv.e} dia={verEv.dia} onQuitar={() => quitarCompartido(verEv.e.compartido!.id)} onClose={() => setVerEv(null)} />}
      {aviso === "bienvenida" && (
        <Bienvenida nombre={nombre} odonto={odonto} onListo={() => { setAviso(null); guardarPrefs({ bienvenida: true, novedades: ULTIMA_MI }); }} />
      )}
      {aviso === "novedades" && <Novedades versiones={verNovedades} pro={pro} onListo={() => { setAviso(null); guardarPrefs({ novedades: ULTIMA_MI }); }} />}
      {hoja === "personalizar" && (
        <Hoja onClose={() => setHoja(null)} titulo="Personalizar Hoy">
          <p className="-mt-2 mb-3 text-sm text-muted">Elige qué ves en Hoy. Tu línea del tiempo siempre está.</p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
            {BLOQUES_HOY.map((b) => {
              const visible = !ocultos.has(b.id);
              return (
                <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{b.t}</span>
                    <span className="block text-xs text-muted">{b.x}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={visible}
                    aria-label={b.t}
                    onClick={() => guardarPrefs({ hoy_ocultos: visible ? [...ocultos, b.id] : [...ocultos].filter((x) => x !== b.id) })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${visible ? "bg-accent" : "bg-line"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-panel shadow transition-all ${visible ? "left-[1.375rem]" : "left-0.5"}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Hoja>
      )}
      {modalPago && <PagoModal key={modalPago.p?.id ?? "nuevo"} pago={modalPago.p} borrador={modalPago.borrador} acciones={accionesVP} onClose={() => setModalPago(null)} />}
      {modalPend && (modalPend.p?.compartido ? (
        <VerCompartido p={modalPend.p} onMarcar={(v) => marcarCompartido(modalPend.p!, v)} onQuitar={() => quitarCompartido(modalPend.p!.compartido!.id)} onClose={() => setModalPend(null)} />
      ) : (
        <PendienteModal
          key={modalPend.p?.id ?? "nuevo"} pendiente={modalPend.p} fechaInicial={modalPend.fecha} listaInicial={modalPend.lista} tituloInicial={modalPend.titulo} acciones={acciones} onClose={() => setModalPend(null)}
          etiquetas={etiquetas} sugerir={sugerir} bloqueInicial={modalPend.bloque} extra={modalPend.extra}
          compartir={modalPend.p && !modalPend.p.padre_id && !demo ? <Compartir tipo="pendiente" id={modalPend.p.id} /> : null}
        />
      ))}
      {modalHab && (
        <HabitoModal
          key={modalHab.h?.id ?? "nuevo"} habito={modalHab.h} acciones={acciones} onClose={() => setModalHab(null)}
          extra={
            modalHab.h && !demo ? (
              modalHab.h.compartido_id ? (
                <ParejaCopia h={modalHab.h} parejas={comp.parejas} onDejar={(cid) => { comp.quitar(cid); setModalHab(null); }} />
              ) : (
                <Compartir tipo="habito" id={modalHab.h.id} abierto={modalHab.invitar} />
              )
            ) : null
          }
        />
      )}

      {modal && (
        <EventoModal
          key={`${modal.evento?.id ?? "nuevo"}-${modal.fecha}-${modal.tipo ?? ""}`}
          supabase={supabase}
          userId={userId}
          evento={modal.evento}
          fechaInicial={modal.fecha}
          tipoInicial={modal.tipo}
          borrador={modal.borrador}
          categorias={categorias}
          onClose={() => setModal(null)}
          onGuardado={guardado}
          demo={demo}
          odonto={odonto}
          pro={pro}
          onPro={() => { setModal(null); setHoja("pro"); }}
          compartir={modal.evento && !demo ? <Compartir tipo="evento" id={modal.evento.id} /> : null}
          avisoDefecto={prefs.aviso_def === undefined ? 30 : prefs.aviso_def}
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
    <div className="hoja-fondo fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <p className="serif mb-4 text-2xl">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

