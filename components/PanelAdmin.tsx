"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgendaAdmin, AvisoAdmin, Miembro, ResumenAdmin } from "@/lib/admin";
import { FiltroUniversidad, InsigniaUni, UsoUady, type FiltroUni, Saludo, Numeros, Totales, HoyTeToca, Ingresos, PorCodigo, hace, diasSinEntrar, enPruebaViva, pagando, DIAS_FANTASMA } from "@/components/TableroAdmin";
import type { CodigoAdmin } from "@/app/api/admin/codigos/route";
import type { CuentaAdmin, SugerenciaAdmin } from "@/lib/staff";
import { AnunciosAdmin, Buzon, CobrosQueVienen, CuentasAMedias, cuentasAMedias, Embudo, PreciosUni } from "@/components/StaffPiezas";
import { estadoPago, pesos, codigoAgenda, sumarDias } from "@/lib/pagos";
import PersonasMi, { PreciosMi } from "@/components/personal/PersonalesAdmin";
import { DesgloseDinero, DineroMi, HoyMi, IngresosJuntos, UsoMi } from "@/components/MiAdmin";
import type { ResumenMiAdmin } from "@/lib/miAdmin";
import type { AvisoMiAdmin } from "@/lib/planMiServer";
import SaludAdmin, { useSalud } from "@/components/SaludAdmin";
import BuscadorAdmin from "@/components/BuscadorAdmin";
import { fechaLarga, hoyISO } from "@/lib/fechas";

async function api(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error ?? `Error ${res.status}`;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

// Panel por producto: General (lo de las dos), Clínicas, Mi agenda y Ajustes.
type Pestana = "hoy" | "dinero" | "buzon" | "anuncios" | "agendas" | "cuentas" | "uady" | "personas" | "uso" | "planes" | "ajustes";
const PESTANAS: Pestana[] = ["hoy", "dinero", "buzon", "anuncios", "agendas", "cuentas", "uady", "personas", "uso", "planes", "ajustes"];
const ALIAS: Record<string, Pestana> = { negocio: "dinero", personales: "personas" }; // links viejos
type GrupoId = "general" | "clinicas" | "mi" | "ajustes";
const GRUPOS: { id: GrupoId; titulo: string; items: Pestana[] }[] = [
  { id: "general", titulo: "General", items: ["hoy", "dinero", "buzon", "anuncios"] },
  { id: "clinicas", titulo: "Clínicas", items: ["agendas", "cuentas", "uady"] },
  { id: "mi", titulo: "Mi agenda", items: ["personas", "uso", "planes"] },
  { id: "ajustes", titulo: "Ajustes", items: ["ajustes"] },
];
const NOMBRE: Record<Pestana, string> = {
  hoy: "Hoy", dinero: "Dinero", buzon: "Buzón", anuncios: "Anuncios", agendas: "Agendas", cuentas: "Cuentas a medias", uady: "Uso UADY",
  personas: "Personas", uso: "Uso", planes: "Planes y precios", ajustes: "Salud y precios",
};
type VistaDinero = "todo" | "clinicas" | "mi";

export default function PanelAdmin({ email }: { email: string }) {
  const router = useRouter();
  const [agendas, setAgendas] = useState<AgendaAdmin[] | null>(null);
  const [avisos, setAvisos] = useState<AvisoAdmin[]>([]);
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null);
  const [cuentas, setCuentas] = useState<CuentaAdmin[]>([]);
  const [sugerencias, setSugerencias] = useState<SugerenciaAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pestana, setPestanaEstado] = useState<Pestana>("hoy");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<string | null>(null);
  // Universidad: filtra TODO el panel (se recuerda en este navegador)
  const [uni, setUniEstado] = useState<FiltroUni>("todas");
  const [mi, setMi] = useState<ResumenMiAdmin | null>(null);
  const [vistaDinero, setVistaDinero] = useState<VistaDinero>("todo");
  const [buscaMi, setBuscaMi] = useState("");
  const { salud } = useSalud();
  useEffect(() => {
    try {
      const g = localStorage.getItem("admin-universidad");
      if (g === "upp" || g === "uady") setUniEstado(g);
    } catch {}
    const leer = () => {
      const crudo = window.location.hash.replace("#", "");
      const h = (ALIAS[crudo] ?? crudo) as Pestana;
      if (PESTANAS.includes(h)) setPestanaEstado(h);
    };
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, []);
  // Consola: oscura por defecto (se recuerda en este navegador)
  const [modo, setModoEstado] = useState<"oscuro" | "claro">("oscuro");
  useEffect(() => {
    try { if (localStorage.getItem("admin-modo") === "claro") setModoEstado("claro"); } catch {}
  }, []);
  function cambiarModo() {
    const m = modo === "oscuro" ? "claro" : "oscuro";
    setModoEstado(m);
    try { localStorage.setItem("admin-modo", m); } catch {}
  }
  function setUni(v: FiltroUni) {
    setUniEstado(v);
    try { localStorage.setItem("admin-universidad", v); } catch {}
  }
  function setPestana(p: Pestana) {
    setPestanaEstado(p);
    history.replaceState(null, "", `#${p}`);
  }

  const recargar = useCallback(async () => {
    const [res, rc, rs, rm] = await Promise.all([
      fetch("/api/admin/agendas", { cache: "no-store" }),
      fetch("/api/admin/cuentas", { cache: "no-store" }),
      fetch("/api/admin/sugerencias", { cache: "no-store" }),
      fetch("/api/admin/mi", { cache: "no-store" }),
    ]);
    if (rm.ok) setMi(await rm.json().catch(() => null));
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAgendas(data.agendas);
      setAvisos(data.avisos ?? []);
      setResumen(data.resumen ?? null);
      setError(null);
    } else setError(data.error ?? "No se pudo cargar.");
    if (rc.ok) setCuentas((await rc.json().catch(() => ({}))).cuentas ?? []);
    if (rs.ok) setSugerencias((await rs.json().catch(() => ({}))).sugerencias ?? []);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function salir() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function verPersona(q: string) {
    setBuscaMi(q);
    setPestana("personas");
  }

  function verAgenda(id: string) {
    const a = agendas?.find((x) => x.id === id);
    if (a && uni !== "todas" && a.universidad !== uni) setUni("todas");
    setPestana("agendas");
    setFiltro("todas");
    setBusca("");
    setAbierta(id);
    setTimeout(() => document.getElementById(`agenda-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  // Lo que se ve según la universidad elegida
  const delaUni = (agendas ?? []).filter((a) => uni === "todas" || a.universidad === uni);
  const avisosUni = avisos.filter((v) => uni === "todas" || v.universidad === uni);
  const resumenUni = resumen && uni !== "todas" ? { ...resumen, meses: resumen.mesesUni[uni] } : resumen;
  const cuentasUni = cuentas.filter((c) => uni === "todas" || c.universidad === uni);
  const sugerenciasUni = sugerencias.filter((x) => uni === "todas" || x.universidad === uni);
  const medias = cuentasAMedias(cuentasUni).length;
  const nuevas = sugerenciasUni.filter((x) => x.estado === "nueva").length;
  const hayUady = (agendas ?? []).some((a) => a.universidad === "uady");

  const q = busca.trim().toLowerCase();
  const visibles = delaUni.filter(
    (a) =>
      (filtro === "todas" || grupoPago(a) === filtro) &&
      (!q || a.nombre.toLowerCase().includes(q) || a.miembros.some((m) => `${m.email} ${m.nombre}`.toLowerCase().includes(q)))
  );

  const pendientesMi = mi?.pendientes.avisos ?? 0;
  const insignia: Partial<Record<Pestana, number>> = { hoy: avisosUni.length + pendientesMi || undefined, cuentas: medias || undefined, buzon: nuevas || undefined };
  const cuenta: Partial<Record<Pestana, number>> = { agendas: agendas ? delaUni.length : undefined, personas: mi?.personas.total };
  const grupos = GRUPOS.map((g) => ({ ...g, items: g.items.filter((p) => p !== "uady" || hayUady) }));
  const actual = pestana === "uady" && !hayUady ? "hoy" : pestana;
  const grupoActual = GRUPOS.find((g) => g.items.includes(actual))?.id ?? "general";
  // El filtro de universidad sólo aplica a lo de Clínicas
  const usaUni = grupoActual === "clinicas" || actual === "hoy" || (actual === "dinero" && vistaDinero !== "mi");

  const nUni = (u: "upp" | "uady") => (agendas ?? []).filter((a) => a.universidad === u).length;
  const opcionesUni: [FiltroUni, string, number][] = [["todas", "Todas", agendas?.length ?? 0], ["upp", "UPP", nUni("upp")], ["uady", "UADY", nUni("uady")]];

  return (
    <div className="consola min-h-screen" data-modo={modo}>
    <div className="lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* Barra lateral (compu) */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-panel lg:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-panel" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-6-6-6M12 19h8"/></svg>
          </span>
          <div className="min-w-0 leading-tight">
            <p className="consola-mono truncate text-[13px] font-semibold">agenda/staff</p>
            <p className="consola-mono flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Sólo tú ves esto
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {grupos.map((g) => (
            <div key={g.id} className="mt-4">
              <p className="consola-etiqueta mb-1.5 px-1">{g.titulo}</p>
              {g.id === "clinicas" && (
                <div className="mb-1.5 grid grid-cols-3 gap-0.5 rounded-md border border-line bg-bg p-0.5 text-xs font-medium" role="tablist" aria-label="Universidad">
                  {opcionesUni.map(([id, t, n]) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={uni === id}
                      onClick={() => setUni(id)}
                      className={`rounded px-1 py-1 transition ${uni === id ? "bg-panel-2 text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-ink"}`}
                    >
                      {t} <span className="consola-mono text-[10px] opacity-70">{n}</span>
                    </button>
                  ))}
                </div>
              )}
              <ul className="flex flex-col gap-px text-sm">
                {g.items.map((id) => (
                  <li key={id}>
                    <button
                      onClick={() => setPestana(id)}
                      className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition ${actual === id ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONO_PESTANA[id]} /></svg>
                      <span className="mr-auto truncate">{NOMBRE[id]}</span>
                      {insignia[id] ? (
                        <span className="consola-mono rounded bg-danger px-1.5 text-[10px] font-semibold leading-4 text-panel">{insignia[id]}</span>
                      ) : cuenta[id] != null ? (
                        <span className="consola-mono text-[11px] opacity-70">{cuenta[id]}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-3 py-3">
          <p className="consola-mono mb-2 truncate px-1 text-[11px] text-muted" title={email}>{email}</p>
          <div className="flex gap-1.5">
            <button onClick={cambiarModo} className="btn btn-sec flex-1 py-1.5 text-xs" title={modo === "oscuro" ? "Modo claro" : "Modo oscuro"} aria-label={modo === "oscuro" ? "Modo claro" : "Modo oscuro"}>
              {modo === "oscuro" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
              )}
            </button>
            <button onClick={salir} className="btn btn-sec flex-[2] py-1.5 text-xs">Salir</button>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
      {/* Barra superior */}
      <header className="border-b border-line bg-panel/60 px-3 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="mr-auto min-w-0">
            <p className="consola-mono mb-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted lg:hidden">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Sólo tú ves esto
            </p>
            <Saludo />
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={cambiarModo} className="btn btn-sec px-2.5" aria-label={modo === "oscuro" ? "Modo claro" : "Modo oscuro"}>{modo === "oscuro" ? "☀" : "☾"}</button>
            <button onClick={salir} className="btn btn-sec">Salir</button>
          </div>
          {agendas && <div className="order-last w-full sm:order-none sm:w-auto"><BuscadorAdmin agendas={agendas} onAgenda={verAgenda} onPersona={verPersona} /></div>}
          <span className="consola-mono hidden rounded border border-line px-2 py-1 text-[11px] text-muted xl:inline">
            {grupoActual === "clinicas" || (usaUni && uni !== "todas") ? `${uni} / ` : ""}{GRUPOS.find((g) => g.id === grupoActual)?.titulo.toLowerCase()} / {actual}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 lg:px-8">
      {/* Celular: universidad y pestañas arriba (se deslizan de lado) */}
      <div className="lg:hidden">
        <nav className="-mx-3 mb-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="flex min-w-max items-center gap-1 rounded-md border border-line bg-panel p-1 text-sm font-medium">
            {grupos.map((g, gi) => (
              <div key={g.id} className="flex items-center gap-1">
                {gi > 0 && <span className="consola-etiqueta mx-1 border-l border-line pl-2">{g.titulo}</span>}
                {g.items.map((id) => (
                  <button
                    key={id}
                    onClick={() => setPestana(id)}
                    className={`relative whitespace-nowrap rounded px-3 py-1.5 transition ${actual === id ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
                  >
                    {NOMBRE[id]}
                    {insignia[id] ? <span className="consola-mono ml-1.5 rounded bg-danger px-1.5 py-px text-[10px] font-semibold text-panel">{insignia[id]}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>
        {agendas && usaUni && <FiltroUniversidad valor={uni} agendas={agendas} onCambio={setUni} />}
      </div>

      {aviso && <p className="sticky top-2 z-20 mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent shadow-sm">{aviso}</p>}
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {!agendas && !error && <p className="mb-6 text-sm text-muted">Cargando…</p>}

      {/* HOY: lo que hay que hacer */}
      {actual === "hoy" && agendas && (
        <div className="flex flex-col gap-4">
          {(medias > 0 || nuevas > 0 || !!salud?.problemas) && (
            <div className="flex flex-wrap gap-2">
              {!!salud?.problemas && (
                <button onClick={() => setPestana("ajustes")} className="rounded-full border border-danger bg-danger/10 px-3 py-1.5 text-sm text-danger hover:bg-danger/20">
                  ⚠ <b>{salud.problemas}</b> cosa{salud.problemas === 1 ? "" : "s"} por revisar en la salud del sistema →
                </button>
              )}
              {medias > 0 && (
                <button onClick={() => setPestana("cuentas")} className="rounded-full border border-line bg-panel px-3 py-1.5 text-sm hover:bg-panel-2">
                  <b>{medias}</b> cuenta{medias === 1 ? "" : "s"} sin terminar su registro →
                </button>
              )}
              {nuevas > 0 && (
                <button onClick={() => setPestana("buzon")} className="rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-sm text-accent hover:bg-accent-soft/70">
                  <b>{nuevas}</b> sugerencia{nuevas === 1 ? "" : "s"} nueva{nuevas === 1 ? "" : "s"} en el buzón →
                </button>
              )}
            </div>
          )}
          <AvisosPago
            avisos={avisosUni}
            agendas={agendas}
            onCambio={(msg) => {
              setAviso(msg);
              recargar();
            }}
          />
          <HoyTeToca agendas={delaUni} avisosPendientes={avisosUni.length} onVer={verAgenda} onAviso={setAviso} />
          {mi && <HoyMi r={mi} onVer={verPersona} />}
        </div>
      )}

      {/* NEGOCIO: números, cobros, embudo */}
      {actual === "dinero" && agendas && resumen && resumenUni && (
        <div className="mb-4 flex rounded-md border border-line bg-panel p-1 text-sm font-medium sm:w-fit" role="tablist" aria-label="Producto">
          {([["todo", "Todo junto"], ["clinicas", "Clínicas"], ["mi", "Mi agenda"]] as [VistaDinero, string][]).map(([id, t]) => (
            <button key={id} role="tab" aria-selected={vistaDinero === id} onClick={() => setVistaDinero(id)} className={`flex-1 whitespace-nowrap rounded px-4 py-1.5 ${vistaDinero === id ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>{t}</button>
          ))}
        </div>
      )}

      {actual === "dinero" && vistaDinero === "todo" && agendas && resumen && resumenUni && (
        <div className="flex flex-col gap-4">
          <DesgloseDinero agendas={delaUni} resumen={resumenUni} mi={mi} etiquetaClinicas={uni === "todas" ? "Clínicas" : `Clínicas (${uni.toUpperCase()})`} />
          <IngresosJuntos clinicas={resumenUni.meses} mi={mi?.meses ?? null} />
        </div>
      )}

      {actual === "dinero" && vistaDinero === "mi" && (mi ? <DineroMi r={mi} onVer={verPersona} /> : <p className="text-sm text-muted">Cargando…</p>)}

      {actual === "dinero" && vistaDinero === "clinicas" && agendas && resumen && resumenUni && (
        <div className="flex flex-col gap-4">
          <div>
            <Numeros agendas={delaUni} resumen={resumenUni} />
            <Totales agendas={delaUni} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <CobrosQueVienen agendas={delaUni} onVer={verAgenda} />
              <Embudo cuentas={cuentasUni} agendas={delaUni} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <Ingresos key={uni} resumen={resumenUni} />
              <PorCodigo agendas={delaUni} resumen={resumenUni} onVerTodos={() => setPestana("ajustes")} />
            </div>
          </div>
        </div>
      )}

      {actual === "cuentas" && <CuentasAMedias cuentas={cuentasUni} onCambio={recargar} onAviso={setAviso} />}

      {actual === "uady" && agendas && <UsoUady agendas={agendas.filter((a) => a.universidad === "uady")} onVer={verAgenda} />}

      {actual === "personas" && <PersonasMi key={buscaMi} buscaInicial={buscaMi} onAviso={(m) => { setAviso(m); recargar(); }} />}
      {actual === "uso" && (mi ? <UsoMi r={mi} /> : <p className="text-sm text-muted">Cargando…</p>)}
      {actual === "planes" && <PreciosMi onAviso={setAviso} />}

      {actual === "buzon" && <Buzon sugerencias={sugerenciasUni} onCambio={recargar} />}

      {actual === "anuncios" && agendas && <AnunciosAdmin agendas={agendas} onAviso={setAviso} />}

      {actual === "ajustes" && agendas && (
        <div className="flex flex-col gap-5">
          <SaludAdmin onAviso={setAviso} />
          <PreciosUni agendas={agendas} onAviso={setAviso} onCambio={recargar} />
          <DatosBancarios onAviso={setAviso} />
          <Codigos onAviso={setAviso} />
        </div>
      )}

      {actual === "agendas" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              className="campo min-w-0 flex-1 py-2 text-sm sm:max-w-xs"
              placeholder="Buscar por nombre o correo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {FILTROS.map(([id, t]) => {
                const n = delaUni.filter((a) => grupoPago(a) === id).length;
                if (id !== "todas" && n === 0) return null;
                return (
                  <button
                    key={id}
                    onClick={() => setFiltro(id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${filtro === id ? "border-ink bg-ink text-panel" : "border-line text-muted hover:text-ink"}`}
                  >
                    {t}
                    {id !== "todas" && ` · ${n}`}
                  </button>
                );
              })}
            </div>
          </div>

          {agendas?.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
              Aún no hay agendas. Cuando alguien se registre en <b>/registro</b>, aparece aquí.
            </p>
          )}
          {agendas && agendas.length > 0 && visibles.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Ninguna agenda coincide.</p>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-panel">
            {visibles.map((a, i) => (
              <FilaAgenda
                key={a.id}
                agenda={a}
                primera={i === 0}
                abierta={abierta === a.id}
                onToggle={() => setAbierta(abierta === a.id ? null : a.id)}
                onCambio={recargar}
                onAviso={setAviso}
              />
            ))}
          </div>
        </>
      )}
      </div>
      </main>
    </div>
    </div>
  );
}

const ICONO_PESTANA: Record<Pestana, string> = {
  hoy: "M3 12h4l3 8 4-16 3 8h4",
  dinero: "M3 3v18h18M7 15l4-4 3 3 6-6",
  agendas: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  cuentas: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6",
  uady: "M4 20V10l8-6 8 6v10M9 20v-6h6v6",
  personas: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  uso: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  planes: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  buzon: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7z",
  anuncios: "M3 11l15-6v14L3 13zM7 12v6a2 2 0 0 0 4 0v-4",
  ajustes: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
};

const FILTROS = [
  ["todas", "Todas"],
  ["atencion", "Por vencer / en Gratis"],
  ["prueba", "En prueba"],
  ["activa", "Pro"],
  ["cortesia", "Cortesía"],
] as const;
type Filtro = (typeof FILTROS)[number][0];

function grupoPago(a: AgendaAdmin): Filtro {
  const t = estadoPago(a.pagado_hasta, hoyISO()).tipo;
  if (t === "cortesia") return "cortesia";
  if (a.enPrueba && (t === "activa" || t === "por_vencer")) return "prueba";
  if (t === "activa") return "activa";
  return "atencion";
}

function FilaAgenda({
  agenda, primera, abierta, onToggle, onCambio, onAviso,
}: { agenda: AgendaAdmin; primera: boolean; abierta: boolean; onToggle: () => void; onCambio: () => void; onAviso: (m: string) => void }) {
  const hoy = hoyISO();
  const ins = insigniaPago(agenda.pagado_hasta);
  const dueno = agenda.miembros.find((m) => m.rol === "owner");
  const compa = agenda.miembros.find((m) => m.rol !== "owner");
  const sinDueno = !dueno && !agenda.invitacionPendiente;
  const dias = diasSinEntrar(agenda);
  const fantasma = (pagando(agenda, hoy) || enPruebaViva(agenda, hoy)) && dias != null && dias >= DIAS_FANTASMA;
  return (
    <div id={`agenda-${agenda.id}`} className={`scroll-mt-4 ${primera ? "" : "border-t border-line"}`}>
      <button onClick={onToggle} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-2 ${abierta ? "bg-panel-2" : ""}`}>
        <span className="flex shrink-0 -space-x-1.5" aria-hidden>
          {agenda.miembros.length ? (
            agenda.miembros.map((m) => (
              <span key={m.id} className="h-6 w-6 rounded-full border-2 border-panel" style={{ background: m.color ?? "#9a968d" }} title={m.nombre} />
            ))
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-dashed border-line text-[10px] text-muted">?</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5"><span className="truncate font-semibold">{agenda.nombre}</span><InsigniaUni uni={agenda.universidad} /></span>
            <span className="block truncate text-xs text-muted">
              {dueno ? dueno.email : agenda.invitacionPendiente ? `Invitación a ${agenda.invitacionPendiente}` : <b className="font-semibold text-danger">Sin dueño</b>}
              {compa ? ` · ${compa.nombre}` : ""} · {agenda.citas} cita{agenda.citas === 1 ? "" : "s"}
              {agenda.codigo ? ` · código ${agenda.codigo}` : ""}
            </span>
            {!sinDueno && (
              <span className={`block text-xs ${fantasma ? "font-medium text-danger" : "text-muted"}`}>
                {hace(agenda.ultimoAcceso)[0].toUpperCase() + hace(agenda.ultimoAcceso).slice(1)}
                {agenda.citasSemana > 0 && <span className="text-accent"> · {agenda.citasSemana} cita{agenda.citasSemana === 1 ? "" : "s"} esta semana</span>}
              </span>
            )}
          </span>
          <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium sm:self-auto ${ins.c}`}>{agenda.enPrueba ? ins.t.replace("Pagada hasta", "Prueba Pro hasta") : ins.t}</span>
        </span>
        <svg className={`shrink-0 text-muted transition ${abierta ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {abierta && <TarjetaAgenda agenda={agenda} onCambio={onCambio} onAviso={onAviso} />}
    </div>
  );
}

function Codigos({ onAviso }: { onAviso: (m: string) => void }) {
  const [lista, setLista] = useState<CodigoAdmin[] | null>(null);
  const [codigo, setCodigo] = useState("");
  const [creador, setCreador] = useState("");
  const [dias, setDias] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const d = await fetch("/api/admin/codigos", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setLista(d.codigos ?? []);
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const err = await api("/api/admin/codigos", "POST", { codigo, creador, dias_extra: dias });
    setEnviando(false);
    if (err) return setError(err);
    onAviso(`Código ${codigo.trim().toUpperCase()} creado.`);
    setCodigo("");
    setCreador("");
    setDias(15);
    cargar();
  }

  async function alternar(c: CodigoAdmin) {
    const err = await api("/api/admin/codigos", "PATCH", { codigo: c.codigo, activo: !c.activo });
    if (err) return setError(err);
    cargar();
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={crear} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="font-semibold">Nuevo código de creador</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted">
          Quien lo use al crear su cuenta recibe días extra de Pro (sólo si su agenda empieza con prueba). Aquí ves cuántos llegan por cada creador.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Código</span>
            <input required className="campo uppercase placeholder:normal-case" placeholder="JENRRY" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\s+/g, ""))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">De quién es</span>
            <input required className="campo" placeholder="Jenrry · @suinstagram" value={creador} onChange={(e) => setCreador(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Días extra de Pro</span>
            <select className="campo" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              {[7, 15, 30].map((n) => <option key={n} value={n}>{n} días</option>)}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button className="btn btn-primario" disabled={enviando}>{enviando ? "Creando…" : "Crear código"}</button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        {!lista && <p className="p-4 text-sm text-muted">Cargando…</p>}
        {lista?.length === 0 && <p className="p-6 text-center text-sm text-muted">Aún no hay códigos.</p>}
        {lista?.map((c, i) => (
          <div key={c.codigo} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${i ? "border-t border-line" : ""} ${c.activo ? "" : "opacity-50"}`}>
            <span className="min-w-0 flex-1">
              <span className="block font-mono font-semibold">{c.codigo}</span>
              <span className="block truncate text-xs text-muted">{c.creador} · +{c.dias_extra ?? 15} días</span>
            </span>
            <span className="text-sm tabular-nums">
              <b>{c.agendas}</b> <span className="text-muted">agenda{c.agendas === 1 ? "" : "s"} ·</span> <b>{c.enPrueba}</b> <span className="text-muted">en prueba ·</span> <b>{c.pagando}</b> <span className="text-muted">pagando</span>
              {c.agendas > 0 && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{Math.round((c.pagando / c.agendas) * 100)}% paga</span>}
            </span>
            <button className="btn btn-sec py-1 text-xs" onClick={() => alternar(c)}>{c.activo ? "Desactivar" : "Activar"}</button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TarjetaAgenda({ agenda, onCambio, onAviso }: { agenda: AgendaAdmin; onCambio: () => void; onAviso: (m: string) => void }) {
  const [nombre, setNombre] = useState(agenda.nombre);
  const [notas, setNotas] = useState(agenda.notas ?? "");
  const [borrando, setBorrando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dueno = agenda.miembros.find((m) => m.rol === "owner");

  async function guardar(cambios: { nombre?: string; notas?: string }) {
    const err = await api(`/api/admin/agendas/${agenda.id}`, "PATCH", cambios);
    if (err) setError(err);
    else onCambio();
  }

  async function accion(fn: () => Promise<string | null>, ok: string) {
    setTrabajando(true);
    setError(null);
    const err = await fn();
    setTrabajando(false);
    if (err) return setError(err);
    onAviso(ok);
    onCambio();
  }

  return (
    <section className="border-t border-line bg-panel-2/40 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0 flex-1">
          <input
            className="w-full rounded-md bg-transparent text-lg font-semibold outline-none focus:bg-panel-2 focus:px-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => nombre.trim() && nombre !== agenda.nombre && guardar({ nombre })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            title="Clic para renombrar"
          />
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <InsigniaUni uni={agenda.universidad} /> Creada el {fechaCorta(agenda.created_at)} · {agenda.citas} cita{agenda.citas === 1 ? "" : "s"}
          </p>
          {agenda.universidad === "uady" && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
              {([["Horario con materia", agenda.uso.horarioMateria], ["Metas", agenda.uso.metas], ["Turnos", agenda.uso.turnos], ["Mi material", agenda.uso.material]] as const).map(([t, ok]) => (
                <span key={t} className={ok ? "text-accent" : ""}>{ok ? "✓" : "○"} {t}</span>
              ))}
            </p>
          )}
        </div>
        {!borrando && (
          <button className="btn btn-peligro text-xs" onClick={() => setBorrando(true)}>Eliminar agenda</button>
        )}
      </div>

      <input
        className="campo mb-4 text-sm"
        placeholder="Notas internas…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        onBlur={() => notas !== (agenda.notas ?? "") && guardar({ notas })}
      />

      <Suscripcion agenda={agenda} onCambio={onCambio} onAviso={onAviso} />

      <ul className="divide-y divide-line rounded-xl border border-line">
        {agenda.miembros.map((m) => (
          <FilaMiembro
            key={m.id}
            m={m}
            trabajando={trabajando}
            onHacerDueno={() => accion(() => api(`/api/admin/agendas/${agenda.id}/dueno`, "POST", { userId: m.id }), `${m.nombre} ahora es el dueño.`)}
            onReenviar={() => accion(() => api(`/api/admin/agendas/${agenda.id}/reenviar`, "POST", { userId: m.id }), `Invitación reenviada a ${m.email}.`)}
          />
        ))}
        {agenda.miembros.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin miembros.</li>}
      </ul>

      {!dueno && (
        <div className="mt-3 rounded-xl bg-[#fdf6e3] p-3 text-sm text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]">
          <p className="font-medium">Esta agenda no tiene dueño.</p>
          <p className="mt-1">
            {agenda.miembros.some((m) => !m.pendiente)
              ? "Usa “Hacer dueño” en la persona correcta."
              : "Ya nadie la usa: puedes eliminarla. Las cuentas nuevas se registran solas en /registro."}
          </p>
        </div>
      )}

      {borrando && (
        <div className="mt-4 rounded-xl bg-[#fbecea] p-4 text-sm text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]">
          <p className="mb-2">
            Se borrarán <b>las cuentas de sus {agenda.miembros.length} miembro{agenda.miembros.length === 1 ? "" : "s"}</b>, sus <b>{agenda.citas} citas</b>, clínicas y materias. No se puede deshacer.
          </p>
          <p className="mb-2">Escribe <b>{agenda.nombre}</b> para confirmar:</p>
          <input className="campo mb-3" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
          <div className="flex gap-2">
            <button
              className="btn bg-danger text-panel"
              disabled={confirmacion !== agenda.nombre || trabajando}
              onClick={() => accion(() => api(`/api/admin/agendas/${agenda.id}`, "DELETE"), `Agenda “${agenda.nombre}” eliminada.`)}
            >
              {trabajando ? "Borrando…" : "Eliminar para siempre"}
            </button>
            <button className="btn btn-sec" onClick={() => { setBorrando(false); setConfirmacion(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}

function FilaMiembro({ m, trabajando, onHacerDueno, onReenviar }: { m: Miembro; trabajando: boolean; onHacerDueno: () => void; onReenviar: () => void }) {
  const esDueno = m.rol === "owner";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${esDueno ? "bg-accent text-panel" : "bg-panel-2 text-muted"}`}>
        {esDueno ? "Dueño" : "Compañero"}
      </span>
      <div className="mr-auto min-w-0">
        <p className="truncate text-sm font-medium">{m.pendiente ? m.email : m.nombre}</p>
        <p className="truncate text-xs text-muted">
          {m.pendiente ? "Invitación pendiente" : `${m.email} · ${m.citas} cita${m.citas === 1 ? "" : "s"} · ${hace(m.ultimoAcceso)}`}
        </p>
      </div>
      {m.pendiente && (
        <button className="btn btn-sec py-1 text-xs" disabled={trabajando} onClick={onReenviar}>Reenviar invitación</button>
      )}
      {!esDueno && !m.pendiente && (
        <button className="btn btn-sec py-1 text-xs" disabled={trabajando} onClick={onHacerDueno}>Hacer dueño</button>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* PAGOS                                                                */
/* ------------------------------------------------------------------ */

function insigniaPago(pagadoHasta: string | null) {
  const e = estadoPago(pagadoHasta, hoyISO());
  switch (e.tipo) {
    case "cortesia":
      return { t: "Cortesía", c: "bg-panel-2 text-muted" };
    case "activa":
      return { t: `Pro hasta ${fechaLarga(e.vence)}`, c: "bg-accent-soft text-accent" };
    case "por_vencer":
      return { t: e.dias === 0 ? "Vence hoy" : `Vence en ${e.dias} día${e.dias === 1 ? "" : "s"}`, c: "bg-[#fdf6e3] text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]" };
    case "gracia":
      return { t: `Vencida · se bloquea el ${fechaLarga(e.bloqueo)}`, c: "bg-[#fbecea] text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]" };
    default:
      return { t: `En Gratis desde el ${fechaLarga(sumarDias(e.vence, 1))}`, c: "bg-[#fbecea] text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]" };
  }
}

/** 2.8 · Pagos por confirmar de las dos agendas en una sola lista (de lo más viejo a lo más nuevo). */
function AvisosPago({ avisos, agendas, onCambio }: { avisos: AvisoAdmin[]; agendas: AgendaAdmin[]; onCambio: (m: string) => void }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porDescartar, setPorDescartar] = useState<string | null>(null);
  const [mi, setMi] = useState<AvisoMiAdmin[]>([]);
  const cargarMi = useCallback(async () => {
    const r = await fetch("/api/admin/personales/avisos", { cache: "no-store" });
    if (r.ok) setMi((await r.json().catch(() => ({}))).avisos ?? []);
  }, []);
  useEffect(() => {
    cargarMi();
  }, [cargarMi]);

  const plan = (meses: number) => (meses === 12 ? "1 año" : `${meses} mes${meses === 1 ? "" : "es"}`);

  async function confirmar(v: AvisoAdmin) {
    if (trabajando) return; // evita doble clic
    const agenda = agendas.find((a) => a.id === v.agenda_id);
    setTrabajando(v.id);
    setError(null);
    const err = await api(`/api/admin/agendas/${v.agenda_id}/pagos`, "POST", {
      monto: v.monto ?? agenda?.precio_mensual ?? 0,
      meses: v.meses,
      metodo: "spei",
      referencia: v.referencia,
      avisoId: v.id,
    });
    setTrabajando(null);
    if (err) return setError(err);
    onCambio(`Pago de “${v.agenda}” confirmado: +${plan(v.meses)}. Le avisamos por correo.`);
  }
  async function descartar(v: AvisoAdmin) {
    if (trabajando) return;
    setTrabajando(v.id);
    const err = await api(`/api/admin/avisos/${v.id}`, "PATCH");
    setTrabajando(null);
    if (err) return setError(err);
    setPorDescartar(null);
    onCambio(`Le avisamos a “${v.agenda}” que su pago no se ha reflejado.`);
  }
  async function resolverMi(v: AvisoMiAdmin, accion: "confirmar" | "rechazar") {
    if (trabajando) return;
    setTrabajando(v.id);
    setError(null);
    const err = await api("/api/admin/personales/avisos", "POST", { id: v.id, accion });
    setTrabajando(null);
    if (err) return setError(err);
    setPorDescartar(null);
    await cargarMi();
    onCambio(accion === "confirmar" ? `Pago confirmado: ${v.nombre || v.email} ya tiene Pro de Mi agenda.` : `Le avisamos a ${v.nombre || v.email} que no llegó.`);
  }

  type Fila = { tipo: "clinicas"; v: AvisoAdmin } | { tipo: "mi"; v: AvisoMiAdmin };
  const filas: Fila[] = [...avisos.map((v) => ({ tipo: "clinicas" as const, v })), ...mi.map((v) => ({ tipo: "mi" as const, v }))].sort((a, b) => a.v.created_at.localeCompare(b.v.created_at));
  if (!filas.length) return null;

  return (
    <section className="rounded-2xl border-2 border-accent bg-panel p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs text-panel">{filas.length}</span>
        Pagos por confirmar
      </h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">Revisa en tu banco que haya llegado la transferencia (busca el concepto) y confírmala. Al confirmar se suma el tiempo y les llega el correo.</p>
      <ul className="flex flex-col gap-2">
        {filas.map((f) => {
          const id = f.v.id;
          const etiqueta = (
            <span className={`mr-1.5 rounded px-1.5 py-px align-middle text-[10px] font-bold uppercase ${f.tipo === "mi" ? "bg-[#d9a441]/20 text-[#d9a441]" : "bg-accent-soft text-accent"}`}>
              {f.tipo === "mi" ? "Mi agenda" : "Clínicas"}
            </span>
          );
          return (
            <li key={`${f.tipo}-${id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <div className="mr-auto min-w-0">
                {f.tipo === "clinicas" ? (
                  <>
                    <p className="font-medium">{etiqueta}{f.v.agenda} <span className="text-xs font-normal text-muted">· concepto {codigoAgenda(f.v.agenda_id)}</span></p>
                    <p className="text-sm text-muted">
                      {f.v.quien ?? "El dueño"} · {f.v.monto != null ? pesos(f.v.monto) : "monto no indicado"}{f.v.meses > 1 ? ` · plan de ${plan(f.v.meses)}` : ""} · {fechaLarga(f.v.created_at.slice(0, 10))}
                      {f.v.referencia ? ` · rastreo ${f.v.referencia}` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">{etiqueta}{f.v.nombre || f.v.email} <span className="text-xs font-normal text-muted">· concepto {f.v.codigo}</span></p>
                    <p className="text-sm text-muted">
                      {f.v.email} · {pesos(f.v.monto)} · plan de {plan(f.v.meses)} · {fechaLarga(f.v.created_at.slice(0, 10))}
                      {f.v.referencia ? ` · rastreo ${f.v.referencia}` : ""}
                    </p>
                  </>
                )}
              </div>
              <button className="btn btn-primario py-1.5 text-sm" disabled={trabajando === id} onClick={() => (f.tipo === "clinicas" ? confirmar(f.v) : resolverMi(f.v, "confirmar"))}>
                Confirmar (+{plan(f.v.meses)})
              </button>
              {porDescartar === id ? (
                <>
                  <button className="btn bg-danger py-1.5 text-sm text-panel" disabled={trabajando === id} onClick={() => (f.tipo === "clinicas" ? descartar(f.v) : resolverMi(f.v, "rechazar"))}>
                    Sí, avisarle que no llegó
                  </button>
                  <button className="btn btn-sec py-1.5 text-sm" onClick={() => setPorDescartar(null)}>Cancelar</button>
                </>
              ) : (
                <button className="btn btn-sec py-1.5 text-sm" disabled={trabajando === id} onClick={() => setPorDescartar(id)}>
                  No llegó
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function DatosBancarios({ onAviso }: { onAviso: (m: string) => void }) {
  const [abierto, setAbierto] = useState(true);
  const [d, setD] = useState({ banco: "", clabe: "", titular: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const p = j.pago ?? {};
        setD({ banco: p.banco ?? "", clabe: p.clabe ?? "", titular: p.titular ?? "" });
        if (!p.clabe) setAbierto(true);
      })
      .catch(() => {});
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = await api("/api/admin/config", "PUT", d);
    if (err) return setError(err);
    onAviso("Datos bancarios guardados. Tus clientes ya los ven en su agenda.");
    setAbierto(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setAbierto(!abierto)}>
        <span>
          <span className="block font-semibold">Datos para recibir pagos</span>
          <span className="block text-sm text-muted">
            {d.clabe ? `${d.banco || "Banco"} · CLABE terminación ${d.clabe.slice(-4)} · ${d.titular}` : "Aún no los configuras: tus clientes no verán a dónde transferir."}
          </span>
        </span>
        <span className="text-muted">{abierto ? "▲" : "▼"}</span>
      </button>
      {abierto && (
        <form onSubmit={guardar} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Banco</span>
            <input className="campo" value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })} placeholder="Ej. BBVA" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">CLABE (18 dígitos)</span>
            <input className="campo tabular-nums" inputMode="numeric" value={d.clabe} onChange={(e) => setD({ ...d, clabe: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Beneficiario</span>
            <input className="campo" value={d.titular} onChange={(e) => setD({ ...d, titular: e.target.value })} placeholder="Nombre como aparece en tu banco" />
          </label>
          {error && <p className="text-sm text-danger sm:col-span-3">{error}</p>}
          <div className="flex justify-end sm:col-span-3">
            <button className="btn btn-primario">Guardar</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Suscripcion({ agenda, onCambio, onAviso }: { agenda: AgendaAdmin; onCambio: () => void; onAviso: (m: string) => void }) {
  const [registrando, setRegistrando] = useState(false);
  const [monto, setMonto] = useState(agenda.precio_mensual);
  const [meses, setMeses] = useState(1);
  const [metodo, setMetodo] = useState("efectivo");
  const [referencia, setReferencia] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const ins = insigniaPago(agenda.pagado_hasta);
  const corta = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]}`;
  };

  async function correr(fn: () => Promise<string | null>, ok: string): Promise<boolean> {
    if (trabajando) return false; // evita doble clic
    setTrabajando(true);
    setError(null);
    const err = await fn();
    setTrabajando(false);
    if (err) {
      setError(err);
      return false;
    }
    onAviso(ok);
    onCambio();
    return true;
  }

  return (
    <div className="mb-4 rounded-xl border border-line p-3">
      {/* Encabezado: estado */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Suscripción</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ins.c}`}>{ins.t}</span>
        <span className="text-xs text-muted">
          {pesos(agenda.precio_mensual)}/mes · concepto {codigoAgenda(agenda.id)}
        </span>
      </div>

      {/* Acciones, con explicación */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-panel-2 p-2.5">
          <button className="btn btn-primario w-full py-1.5 text-sm" disabled={registrando} onClick={() => setRegistrando(true)}>
            Registrar pago
          </button>
          <p className="mt-1.5 text-xs text-muted">
            Sólo si te pagan <b>por fuera</b> del botón “Ya pagué” (efectivo, o varios meses de golpe). Los avisos “Ya pagué” se confirman arriba.
          </p>
        </div>
        <div className="rounded-lg bg-panel-2 p-2.5">
          {agenda.pagado_hasta ? (
            <button
              className="btn btn-sec w-full py-1.5 text-sm"
              disabled={trabajando}
              onClick={() => correr(() => api(`/api/admin/agendas/${agenda.id}`, "PATCH", { pagado_hasta: null }), `“${agenda.nombre}” ahora es cortesía.`)}
            >
              Hacer cortesía
            </button>
          ) : (
            <button
              className="btn btn-sec w-full py-1.5 text-sm"
              disabled={trabajando}
              onClick={() =>
                correr(
                  () => api(`/api/admin/agendas/${agenda.id}`, "PATCH", { pagado_hasta: sumarDias(hoyISO(), 7) }),
                  `“${agenda.nombre}” ahora cobra: vence en 7 días.`
                )
              }
            >
              Empezar a cobrar
            </button>
          )}
          <p className="mt-1.5 text-xs text-muted">
            {agenda.pagado_hasta
              ? "La agenda deja de vencer y nunca se le cobra (amigos, familia…)."
              : "Quita la cortesía: le da 7 días y después empieza a vencer normal."}
          </p>
        </div>
      </div>

      {registrando && (
        <form
          className="mt-3 grid gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            correr(
              () => api(`/api/admin/agendas/${agenda.id}/pagos`, "POST", { monto, meses, metodo, referencia }),
              `Pago registrado para “${agenda.nombre}”. Le avisamos por correo.`
            ).then((ok) => ok && setRegistrando(false));
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Monto</span>
            <input type="number" min={0} className="campo py-1.5" value={monto} onChange={(e) => setMonto(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Meses que paga</span>
            <input type="number" min={1} max={24} className="campo py-1.5" value={meses} onChange={(e) => setMeses(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Método</span>
            <select className="campo py-1.5" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="spei">SPEI</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Referencia</span>
            <input className="campo py-1.5" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" />
          </label>
          <div className="flex items-end gap-2">
            <button className="btn btn-primario flex-1 py-1.5 text-sm" disabled={trabajando}>{trabajando ? "…" : "Guardar"}</button>
            <button type="button" className="btn btn-sec py-1.5 text-sm" onClick={() => setRegistrando(false)}>✕</button>
          </div>
        </form>
      )}

      {/* Historial */}
      <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted">Historial de pagos</p>
      {agenda.pagos.length === 0 ? (
        <p className="text-xs text-muted">Todavía no hay pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {agenda.pagos.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-medium tabular-nums">{pesos(p.monto)}</span>
              <span className="text-muted">
                {p.meses} mes{p.meses === 1 ? "" : "es"} · cubre del {corta(p.cubre_desde)} al {corta(p.cubre_hasta)}
              </span>
              <span className="text-xs text-muted">
                · {p.metodo.toUpperCase()} · registrado el {corta(p.created_at.slice(0, 10))}
                {p.referencia ? ` · ${p.referencia}` : ""}
              </span>
              {i === 0 && (
                <span className="ml-auto">
                  {anulando === p.id ? (
                    <>
                      <button
                        className="btn btn-peligro py-0.5 text-xs"
                        disabled={trabajando}
                        onClick={() =>
                          correr(
                            () => api(`/api/admin/agendas/${agenda.id}/pagos?pago=${p.id}`, "DELETE"),
                            `Pago anulado. “${agenda.nombre}” vuelve a vencer el ${fechaLarga(sumarDias(p.cubre_desde, -1))}.`
                          ).then(() => setAnulando(null))
                        }
                      >
                        ¿Anular? Sí
                      </button>
                      <button className="btn btn-sec ml-1 py-0.5 text-xs" onClick={() => setAnulando(null)}>No</button>
                    </>
                  ) : (
                    <button className="btn btn-peligro py-0.5 text-xs" title="Deshacer este pago (por si fue un error)" onClick={() => setAnulando(p.id)}>
                      Anular
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
