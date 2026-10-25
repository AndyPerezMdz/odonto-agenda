"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { manualDe } from "@/lib/manual";
import { VentanaInstalar } from "@/components/InstalarApp";
import Sugerencia from "@/components/Sugerencia";

/*
  2.2 · Navegación única de la agenda de clínicas.
  - Celular: barra abajo  →  Hoy · Agenda · [+] · Pacientes · Más
  - Compu:   barra lateral con lo mismo
  - Arriba sólo: título, buscar y la campanita (anuncios y novedades).
*/

export type Seccion = "hoy" | "agenda" | "pacientes" | "avance" | "material" | "personalizar";

type Props = {
  actual: Seccion;
  titulo: string;
  nombreAgenda?: string;
  uady: boolean;
  esDueno: boolean;
  /** Sólo en "/": cambia entre Hoy y Agenda sin recargar */
  onSeccion?: (s: "hoy" | "agenda") => void;
  /** Sólo en "/": abre "Nueva cita" ahí mismo */
  onNueva?: () => void;
  /** Sólo en "/": abre el buscador ahí mismo */
  onBuscar?: () => void;
  /** Hay novedades sin leer (se abren en la campanita) */
  novedadesSinLeer?: boolean;
  onNovedades?: () => void;
  /** Ya se puede mostrar el recorrido de bienvenida (sin otras ventanas encima) */
  tourListo?: boolean;
  children: React.ReactNode;
};

type Anuncio = { id: string; titulo: string; texto: string };
const CLAVE_ANUNCIO = (id: string) => `anuncio-cerrado-${id}`;
const CLAVE_TOUR = "recorrido-2.2-visto";

const I = {
  hoy: "M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  agenda: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  pacientes: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c.7-3.8 3.6-6 7-6s6.3 2.2 7 6M19 8v6M16 11h6",
  avance: "M3 3v18h18M7 15l4-4 3 3 5-6",
  material: "M3 8h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 8V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M12 12v5M9.5 14.5h5",
  personalizar: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  mas: "M5 12h.01M12 12h.01M19 12h.01",
  campana: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  pro: "M2 7h20v12H2zM2 11h20",
  estrella: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  libro: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z",
  cel: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  idea: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  cambiar: "M7 16 3 12l4-4M3 12h13M17 8l4 4-4 4",
  salir: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export function Ico({ d, size = 20, w = 2 }: { d: string; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Shell({ actual, titulo, nombreAgenda, uady, esDueno, onSeccion, onNueva, onBuscar, novedadesSinLeer, onNovedades, tourListo, children }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mas, setMas] = useState(false);
  const [campana, setCampana] = useState(false);
  const [instalar, setInstalar] = useState(false);
  const [sugerir, setSugerir] = useState(false);
  const [tienePersonal, setTienePersonal] = useState(false);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [tour, setTour] = useState(false);

  // Recorrido de bienvenida: una sola vez por navegador (y desde Más → "Cómo se usa")
  useEffect(() => {
    if (!tourListo) return;
    let visto = true;
    try { visto = localStorage.getItem(CLAVE_TOUR) === "1"; } catch {}
    if (!visto) setTour(true);
  }, [tourListo]);
  function cerrarTour() {
    try { localStorage.setItem(CLAVE_TOUR, "1"); } catch {}
    setTour(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("personales").select("activo").eq("user_id", data.user.id).maybeSingle().then(({ data: p }) => setTienePersonal(!!p?.activo));
    });
    supabase
      .from("anuncios")
      .select("id,titulo,texto")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        const cerrado = (id: string) => { try { return localStorage.getItem(CLAVE_ANUNCIO(id)) === "1"; } catch { return false; } };
        setAnuncios(((data as Anuncio[]) ?? []).filter((a) => !cerrado(a.id)));
      });
  }, [supabase]);

  // Escape cierra lo que esté abierto
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setMas(false); setCampana(false); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  function cerrarAnuncio(id: string) {
    try { localStorage.setItem(CLAVE_ANUNCIO(id), "1"); } catch {}
    setAnuncios((l) => l.filter((a) => a.id !== id));
  }

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const pendientesCampana = anuncios.length + (novedadesSinLeer ? 1 : 0);

  // Navegar a Hoy / Agenda: en "/" sin recargar; desde otra página, con link
  const irSeccion = (s: "hoy" | "agenda") => (onSeccion ? () => onSeccion(s) : undefined);
  const hrefSeccion = (s: "hoy" | "agenda") => (s === "hoy" ? "/" : "/?v=agenda");
  const nueva = () => (onNueva ? onNueva() : router.push("/?nueva=1"));
  const buscar = () => (onBuscar ? onBuscar() : router.push("/?buscar=1"));

  const principales: { id: Seccion; t: string; d: string; href: string }[] = [
    { id: "hoy", t: "Hoy", d: I.hoy, href: hrefSeccion("hoy") },
    { id: "agenda", t: "Agenda", d: I.agenda, href: hrefSeccion("agenda") },
    { id: "pacientes", t: "Pacientes", d: I.pacientes, href: "/pacientes" },
    { id: "avance", t: "Mi avance", d: I.avance, href: "/avance" },
    ...(uady ? [{ id: "material" as Seccion, t: "Mi material", d: I.material, href: "/material" }] : []),
    { id: "personalizar", t: "Personalizar", d: I.personalizar, href: "/personalizar" },
  ];

  const enlace = (it: { id: Seccion; t: string; d: string; href: string }, clase: string, activa: string, inactiva: string, children: React.ReactNode) => {
    const activo = actual === it.id;
    const cls = `${clase} ${activo ? activa : inactiva}`;
    if ((it.id === "hoy" || it.id === "agenda") && onSeccion)
      return (
        <button key={it.id} onClick={irSeccion(it.id)} className={cls} aria-current={activo ? "page" : undefined}>
          {children}
        </button>
      );
    return (
      <Link key={it.id} href={it.href} className={cls} aria-current={activo ? "page" : undefined}>
        {children}
      </Link>
    );
  };

  // Lo de uso ocasional (en el cel va en "Más"; en la compu, abajo de la barra lateral)
  const extras = (
    <>
      {esDueno && <ItemMas href="/personalizar#suscripcion" d={I.pro} t="Suscripción" />}
      {tienePersonal ? <ItemMas href="/personal" d={I.cambiar} t="Mi agenda personal" /> : <ItemMas href="/personalizar#personal" d={I.cambiar} t="Mi agenda personal" nuevo />}
      <ItemMas onClick={() => { setMas(false); onNovedades ? onNovedades() : router.push(`/novedades${uady ? "?u=uady" : ""}`); }} d={I.estrella} t="Novedades" punto={novedadesSinLeer} />
      <ItemMas onClick={() => { setMas(false); setTour(true); }} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" t="Cómo se usa" />
      <ItemMas onClick={() => { setMas(false); setInstalar(true); }} d={I.cel} t="Instalar como app" />
      <ItemMas href={manualDe(uady ? "uady" : "upp")} externo d={I.libro} t="Manual" />
      <ItemMas onClick={() => { setMas(false); setSugerir(true); }} d={I.idea} t="¿Qué le falta?" />
      <ItemMas onClick={salir} d={I.salir} t="Salir" peligro />
    </>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* ---------- Barra lateral (compu) ---------- */}
      <aside className="no-imprimir sticky top-0 hidden h-dvh flex-col border-r border-line bg-panel lg:flex">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/clinicas-icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{nombreAgenda || "Agenda"}</p>
            <p className="text-[11px] text-muted">Agenda de clínicas</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <button onClick={nueva} className="btn btn-primario w-full">
            <Ico d="M12 5v14M5 12h14" size={18} w={2.4} /> Nueva cita
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pt-2">
          <ul className="flex flex-col gap-0.5">
            {principales.map((it) => (
              <li key={it.id}>
                {enlace(it, "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", "bg-accent-soft text-accent", "text-muted hover:bg-panel-2 hover:text-ink", <><Ico d={it.d} size={18} />{it.t}</>)}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-3">
            <ul className="flex flex-col gap-0.5 text-sm">{extras}</ul>
          </div>
        </nav>
      </aside>

      <div className="min-w-0">
        {/* ---------- Encabezado: título, buscar, campanita ---------- */}
        <header className="no-imprimir sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-6">
            <div className="mr-auto min-w-0 leading-tight">
              <p className="truncate text-[11px] text-muted lg:hidden">{nombreAgenda || "Agenda de clínicas"}</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{titulo}</h1>
            </div>
            <button onClick={buscar} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink" aria-label="Buscar paciente" title="Buscar paciente">
              <Ico d={I.buscar} />
            </button>
            <div className="relative">
              <button onClick={() => setCampana(!campana)} className="relative grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink" aria-label="Avisos" aria-expanded={campana} title="Avisos">
                <Ico d={I.campana} />
                {pendientesCampana > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-panel">{pendientesCampana}</span>}
              </button>
              {campana && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCampana(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-line bg-panel shadow-xl">
                    <p className="border-b border-line px-4 py-3 text-sm font-semibold">Avisos</p>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {novedadesSinLeer && (
                        <button onClick={() => { setCampana(false); onNovedades ? onNovedades() : router.push("/novedades"); }} className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left hover:bg-panel-2">
                          <span className="mt-0.5 text-accent"><Ico d={I.estrella} size={18} /></span>
                          <span className="text-sm"><b>Hay novedades en tu agenda</b><br /><span className="text-muted">Mira lo nuevo de esta versión.</span></span>
                        </button>
                      )}
                      {anuncios.map((a) => (
                        <div key={a.id} className="flex items-start gap-3 border-b border-line px-4 py-3 text-sm">
                          <span className="mt-0.5 text-accent"><Ico d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8" size={18} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{a.titulo}</p>
                            <p className="whitespace-pre-line text-muted">{a.texto}</p>
                          </div>
                          <button onClick={() => cerrarAnuncio(a.id)} className="shrink-0 rounded-md px-1.5 text-muted hover:text-ink" aria-label="Quitar aviso">✕</button>
                        </div>
                      ))}
                      {pendientesCampana === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No tienes avisos nuevos.</p>}
                    </div>
                    <Link href={`/novedades${uady ? "?u=uady" : ""}`} className="block px-4 py-2.5 text-center text-xs font-medium text-accent hover:bg-panel-2">Ver todas las novedades</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="pb-24 lg:pb-8">{children}</main>
      </div>

      {/* ---------- Barra de abajo (celular) ---------- */}
      <nav className="no-imprimir fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegación">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
          {[principales[0], principales[1]].map((it) =>
            enlace(it, "flex flex-col items-center gap-0.5 text-[11px] font-medium", "text-accent", "text-muted", <><Ico d={it.d} size={22} />{it.t}</>)
          )}
          <div className="grid place-items-center">
            <button onClick={nueva} className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-accent text-panel shadow-lg ring-4 ring-bg" aria-label="Nueva cita">
              <Ico d="M12 5v14M5 12h14" size={26} w={2.6} />
            </button>
          </div>
          {enlace(principales[2], "flex flex-col items-center gap-0.5 text-[11px] font-medium", "text-accent", "text-muted", <><Ico d={principales[2].d} size={22} />{principales[2].t}</>)}
          <button
            onClick={() => setMas(true)}
            className={`relative flex flex-col items-center gap-0.5 text-[11px] font-medium ${["avance", "material", "personalizar"].includes(actual) ? "text-accent" : "text-muted"}`}
            aria-label="Más opciones"
          >
            <Ico d="M4 6h16M4 12h16M4 18h16" size={22} />
            Más
            {novedadesSinLeer && <span className="absolute right-[30%] top-0 h-2 w-2 rounded-full bg-accent" />}
          </button>
        </div>
      </nav>

      {/* ---------- "Más" (celular): hoja desde abajo ---------- */}
      {mas && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden" onClick={() => setMas(false)}>
          <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-panel px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="mb-2 grid grid-cols-3 gap-2">
              {principales.slice(3).map((it) => (
                <Link key={it.id} href={it.href} onClick={() => setMas(false)} className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium ${actual === it.id ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>
                  <Ico d={it.d} size={22} />
                  {it.t}
                </Link>
              ))}
            </div>
            <ul className="flex flex-col">{extras}</ul>
          </div>
        </div>
      )}

      {tour && <Recorrido uady={uady} onClose={cerrarTour} />}
      {instalar && <VentanaInstalar onClose={() => setInstalar(false)} />}
      {sugerir && <Sugerencia onClose={() => setSugerir(false)} />}
    </div>
  );
}

function ItemMas({ d, t, href, onClick, externo, punto, peligro, nuevo }: { d: string; t: string; href?: string; onClick?: () => void; externo?: boolean; punto?: boolean; peligro?: boolean; nuevo?: boolean }) {
  const cls = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-panel-2 lg:py-1.5 ${peligro ? "text-danger" : "text-muted hover:text-ink"}`;
  const cont = (
    <>
      <Ico d={d} size={18} />
      <span className="mr-auto">{t}</span>
      {punto && <span className="h-2 w-2 rounded-full bg-accent" />}
      {nuevo && <span className="rounded-full bg-[#4f46e5] px-1.5 py-px text-[10px] font-bold text-white">NUEVO</span>}
    </>
  );
  return (
    <li>
      {href ? (
        externo ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{cont}</a>
        ) : (
          <Link href={href} className={cls}>{cont}</Link>
        )
      ) : (
        <button onClick={onClick} className={cls}>{cont}</button>
      )}
    </li>
  );
}

/** 2.2 · Recorrido de bienvenida: 4 pasos para entender dónde está cada cosa. */
function Recorrido({ uady, onClose }: { uady: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const pasos = [
    { d: I.hoy, t: "Hoy", x: "Aquí empieza tu día: la cita que sigue, quién confirmó, qué llevar y las citas que te falta marcar." },
    { d: "M12 5v14M5 12h14", t: "El botón +", x: "Agendas una cita desde cualquier pantalla. En la compu es “Nueva cita”, arriba a la izquierda." },
    { d: I.agenda, t: "Agenda", x: "Tu calendario completo, por mes o en lista, con tu horario de clínica y los huecos libres para meter pacientes." },
    { d: "M4 6h16M4 12h16M4 18h16", t: "Pacientes y Más", x: `Tus pacientes y el banco van aparte. En “Más” están Mi avance${uady ? ", Mi material" : ""}, Personalizar, el manual y lo demás.` },
  ];
  const p = pasos[i];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-panel p-6 text-center shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Así se usa · {i + 1} de {pasos.length}</p>
        <span className="mx-auto mt-4 grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent"><Ico d={p.d} size={30} /></span>
        <h2 className="mt-4 text-xl font-semibold">{p.t}</h2>
        <p className="mt-2 text-sm text-muted">{p.x}</p>
        <div className="mt-5 flex justify-center gap-1.5">
          {pasos.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-1.5 bg-line"}`} />)}
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="btn btn-sec flex-1">Saltar</button>
          <button onClick={() => (i + 1 < pasos.length ? setI(i + 1) : onClose())} className="btn btn-primario flex-1">{i + 1 < pasos.length ? "Siguiente" : "¡Listo!"}</button>
        </div>
      </div>
    </div>
  );
}
