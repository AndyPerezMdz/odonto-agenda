"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cita, Clinica, Materia, Perfil } from "@/lib/types";
import { CAMPOS_CITA } from "@/lib/useDatos";
import { hoyISO, MESES } from "@/lib/fechas";
import { estadoDe } from "@/lib/estados";
import { enlaceWhatsApp, IcoWhatsApp } from "@/lib/whatsapp";

type Paciente = {
  clave: string;
  nombre: string;
  telefono: string | null;
  historias: string[]; // normalmente una; si hay varias distintas, se avisa
  citas: Cita[]; // de la más reciente a la más vieja
  atendidas: number;
  sinFolio: number; // atendidas sin folio
  ultima: string;
};

const clave = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3).toLowerCase()} ${y}`;
};

function agrupar(citas: Cita[]): Paciente[] {
  const mapa = new Map<string, Paciente>();
  for (const c of citas) {
    const k = clave(c.paciente);
    let p = mapa.get(k);
    if (!p) {
      p = { clave: k, nombre: c.paciente.trim(), telefono: null, historias: [], citas: [], atendidas: 0, sinFolio: 0, ultima: c.fecha };
      mapa.set(k, p);
    }
    p.citas.push(c);
    if (!p.telefono && c.telefono) p.telefono = c.telefono;
    if (c.historia && !p.historias.includes(c.historia)) p.historias.push(c.historia);
    if (c.estado === "asistio") {
      p.atendidas++;
      if (!c.folio) p.sinFolio++;
    }
    if (c.fecha > p.ultima) p.ultima = c.fecha;
  }
  for (const p of mapa.values()) p.citas.sort((a, z) => z.fecha.localeCompare(a.fecha) || z.hora_inicio.localeCompare(a.hora_inicio));
  for (const p of mapa.values()) p.citas.sort((a, z) => z.fecha.localeCompare(a.fecha) || z.hora_inicio.localeCompare(a.hora_inicio));
  return [...mapa.values()].sort((a, z) => z.ultima.localeCompare(a.ultima));
}

// Todos tus pacientes con sus números a la mano: No. de historia clínica y el folio de cada tratamiento.
export default function MisPacientes({
  supabase, userId, perfiles, clinicas, materias, soloLectura,
}: { supabase: SupabaseClient; userId: string; perfiles: Perfil[]; clinicas: Clinica[]; materias: Materia[]; soloLectura: boolean }) {
  const [deQuien, setDeQuien] = useState(userId);
  const [citas, setCitas] = useState<Cita[] | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"atendidos" | "todos" | "sinfolio">("atendidos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const esMio = deQuien === userId && !soloLectura;

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("citas").select(CAMPOS_CITA).eq("owner_id", deQuien).order("fecha", { ascending: false }).order("hora_inicio", { ascending: false }).limit(3000);
    setCitas((data as Cita[]) ?? []);
  }, [supabase, deQuien]);
  useEffect(() => {
    setCitas(null);
    cargar();
  }, [cargar]);

  const pacientes = useMemo(() => agrupar((citas ?? []).filter((c) => c.estado !== "cancelo")), [citas]);
  const q = clave(busca);
  const visibles = pacientes.filter((p) => {
    if (q && !p.clave.includes(q) && !p.historias.some((h) => h.includes(q)) && !p.citas.some((c) => c.folio?.includes(q))) return false;
    if (filtro === "atendidos") return p.atendidas > 0;
    if (filtro === "sinfolio") return p.sinFolio > 0;
    return true;
  });
  const totalSinFolio = pacientes.reduce((n, p) => n + p.sinFolio, 0);
  const atendidos = pacientes.filter((p) => p.atendidas > 0).length;

  const materia = new Map(materias.map((m) => [m.id, m]));
  const clinica = new Map(clinicas.map((c) => [c.id, c.numero]));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="campo min-w-0 flex-1 py-2 text-sm sm:max-w-xs" placeholder="Buscar por nombre, historia o folio…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {perfiles.length > 1 && (
          <div className="ml-auto flex gap-1.5">
            {perfiles.map((pf) => (
              <button key={pf.id} onClick={() => setDeQuien(pf.id)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${deQuien === pf.id ? "border-ink bg-ink text-panel" : "border-line text-muted hover:text-ink"}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: pf.color }} />
                {pf.id === userId ? "Míos" : pf.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 text-xs font-medium">
        {([
          ["atendidos", `Atendidos · ${atendidos}`],
          ["todos", `Todos · ${pacientes.length}`],
          ["sinfolio", `Sin folio · ${totalSinFolio}`],
        ] as const).map(([id, t]) => (
          <button key={id} onClick={() => setFiltro(id)} className={`rounded-full border px-3 py-1 ${filtro === id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"} ${id === "sinfolio" && totalSinFolio > 0 && filtro !== id ? "border-[#e0c070] text-[#8a6a14] dark:text-[#ecd9a4]" : ""}`}>
            {t}
          </button>
        ))}
      </div>

      {!citas && <p className="text-sm text-muted">Cargando…</p>}
      {citas && visibles.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          {filtro === "sinfolio" ? "¡Todos tus tratamientos tienen folio!" : busca ? "Nadie coincide con esa búsqueda." : filtro === "atendidos" ? "Aquí aparecen tus pacientes cuando marques una cita como Asistió." : "Aún no tienes pacientes."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visibles.map((p) => (
          <FichaPaciente
            key={p.clave}
            p={p}
            abierto={abierto === p.clave || !!q || visibles.length === 1}
            onToggle={() => setAbierto(abierto === p.clave ? null : p.clave)}
            editable={esMio}
            supabase={supabase}
            userId={userId}
            materia={materia}
            clinica={clinica}
            onCambio={cargar}
          />
        ))}
      </ul>
    </div>
  );
}

function FichaPaciente({
  p, abierto, onToggle, editable, supabase, userId, materia, clinica, onCambio,
}: {
  p: Paciente; abierto: boolean; onToggle: () => void; editable: boolean; supabase: SupabaseClient; userId: string;
  materia: Map<string, Materia>; clinica: Map<string, string>; onCambio: () => void;
}) {
  const [historia, setHistoria] = useState(p.historias[0] ?? "");
  const [guardando, setGuardando] = useState(false);
  const hoy = hoyISO();

  // Agrupar por materia (las sin materia al final)
  const porMateria = new Map<string, Cita[]>();
  for (const c of p.citas) {
    const k = c.materia_id ?? "";
    porMateria.set(k, [...(porMateria.get(k) ?? []), c]);
  }
  const grupos = [...porMateria.entries()].sort(([a], [z]) => (a === "" ? 1 : z === "" ? -1 : (materia.get(a)?.nombre ?? "").localeCompare(materia.get(z)?.nombre ?? "")));

  async function guardarHistoria(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    // La historia es del paciente: se pone en todas sus citas
    await supabase.from("citas").update({ historia: historia.trim() || null }).in("id", p.citas.map((c) => c.id)).eq("owner_id", userId);
    setGuardando(false);
    onCambio();
  }

  const wa = enlaceWhatsApp(p.telefono, "");
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-panel">
      <button onClick={onToggle} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-2 ${abierto ? "bg-panel-2" : ""}`}>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{p.nombre}</span>
          <span className="block truncate text-xs text-muted">
            {p.historias.length ? `Historia ${p.historias.join(" / ")}` : "Sin No. de historia"} · {p.atendidas} atendida{p.atendidas === 1 ? "" : "s"} · última {fechaCorta(p.ultima)}
          </span>
        </span>
        {p.sinFolio > 0 && <span className="shrink-0 rounded-full bg-[#fdf6e3] px-2 py-0.5 text-xs font-medium text-[#8a6a14] dark:bg-[#2a2415] dark:text-[#ecd9a4]">{p.sinFolio} sin folio</span>}
        <svg className={`shrink-0 text-muted transition ${abierto ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {abierto && (
        <div className="border-t border-line px-4 py-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <form onSubmit={guardarHistoria} className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">No. de historia clínica</label>
              <div className="flex gap-2">
                <input className="campo py-2 tabular-nums" inputMode="numeric" maxLength={30} value={historia} onChange={(e) => setHistoria(e.target.value)} disabled={!editable} placeholder="Sin capturar" />
                {editable && historia.trim() !== (p.historias[0] ?? "") && (
                  <button className="btn btn-primario shrink-0 py-2 text-sm" disabled={guardando}>{guardando ? "…" : "Guardar"}</button>
                )}
              </div>
              {p.historias.length > 1 && <p className="mt-1 text-xs text-danger">Tiene números distintos en sus citas; guarda el correcto y se corrigen todas.</p>}
            </form>
            {p.telefono && (
              <div className="text-sm">
                <p className="mb-1 text-xs font-medium text-muted">Teléfono</p>
                <p className="flex items-center gap-2 tabular-nums">
                  {p.telefono}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="grid h-7 w-7 place-items-center rounded-full bg-[#25D366] text-white" aria-label="WhatsApp">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={IcoWhatsApp} /></svg>
                    </a>
                  )}
                </p>
              </div>
            )}
          </div>

          {grupos.map(([mid, cs]) => {
            const m = mid ? materia.get(mid) : null;
            return (
              <div key={mid || "sin"} className="mb-3 last:mb-0">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: m?.color ?? "#9a968d" }} />
                  {m?.nombre ?? "Sin materia"}
                </p>
                <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                  {cs.map((c) => (
                    <FilaCita key={c.id} c={c} editable={editable} futura={c.fecha > hoy} clinica={c.clinica_id ? clinica.get(c.clinica_id) : undefined} supabase={supabase} onCambio={onCambio} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

function FilaCita({
  c, editable, futura, clinica, supabase, onCambio,
}: { c: Cita; editable: boolean; futura: boolean; clinica?: string; supabase: SupabaseClient; onCambio: () => void }) {
  const [folio, setFolio] = useState(c.folio ?? "");
  const [guardando, setGuardando] = useState(false);
  const est = estadoDe(c.estado);
  const cambio = folio.trim() !== (c.folio ?? "");
  const falta = c.estado === "asistio" && !c.folio;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    await supabase.from("citas").update({ folio: folio.trim() || null }).eq("id", c.id);
    setGuardando(false);
    onCambio();
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
      <span className="w-24 shrink-0 tabular-nums">{fechaCorta(c.fecha)}</span>
      <span className="text-xs text-muted">{clinica ?? ""}</span>
      <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${c.estado ? est.clase : "bg-panel-2 text-muted"}`}>{c.estado ? est.corto : futura ? "Próxima" : "Sin marcar"}</span>
      <form onSubmit={guardar} className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-muted">Folio</span>
        <input
          className={`w-24 rounded-lg border px-2 py-1 text-center text-sm tabular-nums ${falta ? "border-[#e0c070] bg-[#fdf6e3] dark:bg-[#2a2415]" : "border-line bg-panel"}`}
          inputMode="numeric"
          maxLength={20}
          value={folio}
          onChange={(e) => setFolio(e.target.value.replace(/\s/g, ""))}
          disabled={!editable}
          placeholder={falta ? "falta" : "—"}
          aria-label={`Folio del ${c.fecha}`}
        />
        {editable && cambio && <button className="rounded-lg border border-line px-2 py-1 text-xs font-medium hover:bg-panel-2" disabled={guardando}>{guardando ? "…" : "Guardar"}</button>}
      </form>
    </li>
  );
}
