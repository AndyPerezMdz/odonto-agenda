"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { numerosCuatri, periodoParaPresumir, vale, type CitaNum, type NumerosCuatri } from "@/lib/cuatriNumeros";
import { palabraPeriodo } from "@/lib/cuatrimestre";
import { deISO, MESES } from "@/lib/fechas";

// 3.2 · "Tu cuatri en números": tarjeta en Hoy al cierre del periodo, vista con los números y la story para Instagram.

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const corta = (iso: string) => `${deISO(iso).getDate()} de ${MESES[deISO(iso).getMonth()].toLowerCase()}`;
type PeriodoN = { id: string; nombre: string; desde: string; hasta: string; cerrado?: boolean };

/** En Hoy: aparece las últimas 2 semanas del periodo y las primeras 3 del siguiente. Se puede cerrar. */
export function TarjetaTuCuatri({ userId, supabase, materias, tipo, hoy, nombre }: { userId: string; supabase: SupabaseClient; materias: Map<string, string>; tipo?: string | null; hoy: string; nombre: string }) {
  const periodo = useMemo(() => periodoParaPresumir(hoy, tipo), [hoy, tipo]);
  const [n, setN] = useState<NumerosCuatri | null>(null);
  const [cerrada, setCerrada] = useState(true);
  const [abierta, setAbierta] = useState(false);
  const llave = periodo ? `cuatri-numeros-${periodo.id}` : "";
  useEffect(() => {
    if (!periodo) return;
    try { setCerrada(localStorage.getItem(llave) === "1"); } catch { setCerrada(false); }
    supabase
      .from("citas")
      .select("fecha,hora_inicio,hora_fin,paciente,materia_id,estado,confirmacion")
      .eq("owner_id", userId)
      .gte("fecha", periodo.desde)
      .lte("fecha", periodo.cerrado ? periodo.hasta : hoy)
      .then(({ data }) => setN(numerosCuatri((data ?? []) as CitaNum[], materias)));
  }, [periodo, supabase, userId, materias, hoy, llave]);
  if (!periodo || !n || !vale(n) || cerrada) return null;
  const palabra = palabraPeriodo(tipo, true).toLowerCase();
  const cerrar = () => {
    try { localStorage.setItem(llave, "1"); } catch {}
    setCerrada(true);
  };
  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent-soft to-panel p-4">
        <button onClick={cerrar} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-ink" aria-label="Cerrar">✕</button>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{periodo.cerrado ? `Se acabó el ${palabra}` : `Tu ${palabra} hasta hoy`}</p>
        <p className="mt-1 pr-6 text-lg font-semibold leading-snug">
          {n.pacientes} paciente{n.pacientes === 1 ? "" : "s"}, {n.horas} h en clínica{n.materiaTop ? ` y mucha ${n.materiaTop.nombre}` : ""}. 🦷
        </p>
        <button onClick={() => setAbierta(true)} className="btn btn-primario mt-3 px-4 py-2 text-sm">Ver mis números y presumirlos</button>
      </section>
      {abierta && <VistaCuatri n={n} periodo={periodo} tipo={tipo} nombre={nombre} onClose={() => setAbierta(false)} />}
    </>
  );
}

/** Los números en grande + compartir la story. */
export function VistaCuatri({ n, periodo, tipo, nombre, onClose }: { n: NumerosCuatri; periodo: PeriodoN; tipo?: string | null; nombre: string; onClose: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const palabra = palabraPeriodo(tipo, true);
  const datos = tarjetas(n);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Tu ${palabra} en números`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{palabra} {periodo.nombre}</p>
        <h2 className="mb-4 text-2xl font-bold leading-tight">Tu {palabra.toLowerCase()} en números</h2>
        <div className="grid grid-cols-2 gap-2">
          {datos.map((d) => (
            <div key={d.t} className={`rounded-2xl border border-line bg-panel-2/50 p-3 ${d.ancho ? "col-span-2" : ""}`}>
              <p className="text-3xl font-bold leading-none text-accent">{d.n}</p>
              <p className="mt-1 text-xs text-muted">{d.t}</p>
            </div>
          ))}
        </div>
        {msg && <p className="mt-3 text-center text-sm text-muted">{msg}</p>}
        <button
          className="btn btn-primario mt-4 w-full py-2.5"
          onClick={async () => {
            const r = await presumirCuatri({ n, periodo: `${palabra} ${periodo.nombre}`, nombre, palabra });
            setMsg(r === "descargada" ? "Se descargó la imagen: súbela a tu story." : r === "error" ? "No se pudo armar la imagen." : null);
          }}
        >
          📸 Compartir en mi story
        </button>
        <button className="btn btn-sec mt-2 w-full" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

function tarjetas(n: NumerosCuatri) {
  const out: { n: string; t: string; ancho?: boolean }[] = [
    { n: String(n.pacientes), t: n.pacientes === 1 ? "paciente atendido" : "pacientes atendidos" },
    { n: `${n.horas} h`, t: "en clínica" },
    { n: String(n.atendidas), t: n.atendidas === 1 ? "cita atendida" : "citas atendidas" },
    { n: `${n.confirmaron}%`, t: "confirmaron con tu link" },
  ];
  if (n.materiaTop) out.push({ n: n.materiaTop.nombre, t: `tu materia top (${n.materiaTop.n})`, ancho: true });
  if (n.semanaPesada && n.semanaPesada.n > 1) out.push({ n: `${n.semanaPesada.n} citas`, t: `tu semana más pesada (la del ${corta(n.semanaPesada.lunes)})`, ancho: true });
  if (n.diaFuerte) out.push({ n: DIAS[n.diaFuerte.dia], t: "tu día más clínico", ancho: true });
  return out;
}

/** Imagen tipo story (1080×1920) con los números; la comparte o la descarga. */
export async function presumirCuatri({ n, periodo, nombre, palabra = "Cuatri" }: { n: NumerosCuatri; periodo: string; nombre: string; palabra?: string }) {
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return "error" as const;
  const sans = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  try { await document.fonts?.ready; } catch {}
  const verde = "#2f5d50";

  // Fondo
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#2f5d50");
  grad.addColorStop(1, "#1d3b33");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.06)";
  for (let y = 40; y < H; y += 60) for (let x = 40; x < W; x += 60) g.fillRect(x, y, 5, 5);

  g.textAlign = "left";
  g.fillStyle = "#cfe6dc";
  g.font = `600 40px ${sans}`;
  g.fillText(periodo.toUpperCase(), 90, 200);
  g.fillStyle = "#ffffff";
  g.font = `800 96px ${sans}`;
  g.fillText(`Mi ${palabra.toLowerCase()}`, 90, 320);
  g.fillText("en números 🦷", 90, 430);

  // Tarjetas
  const datos = tarjetas(n).slice(0, 7);
  let y = 520;
  const caja = (x: number, w: number, h: number, num: string, txt: string) => {
    g.fillStyle = "#fbfaf7";
    g.beginPath();
    g.roundRect(x, y, w, h, 40);
    g.fill();
    g.fillStyle = verde;
    let tam = 104;
    g.font = `800 ${tam}px ${sans}`;
    while (g.measureText(num).width > w - 80 && tam > 48) g.font = `800 ${(tam -= 4)}px ${sans}`;
    g.fillText(num, x + 40, y + 130);
    g.fillStyle = "#5b5f58";
    let t2 = 36;
    g.font = `500 ${t2}px ${sans}`;
    while (g.measureText(txt).width > w - 70 && t2 > 24) g.font = `500 ${(t2 -= 2)}px ${sans}`;
    let txt2 = txt;
    while (g.measureText(txt2).width > w - 70 && txt2.length > 4) txt2 = txt2.slice(0, -2) + "…";
    g.fillText(txt2, x + 40, y + h - 40);
  };
  const cortas = datos.filter((d) => !d.ancho);
  const anchas = datos.filter((d) => d.ancho);
  for (let i = 0; i < cortas.length; i += 2) {
    caja(90, 435, 230, cortas[i].n, cortas[i].t);
    if (cortas[i + 1]) caja(555, 435, 230, cortas[i + 1].n, cortas[i + 1].t);
    y += 260;
  }
  for (const d of anchas.slice(0, 2)) {
    caja(90, 900, 230, d.n, d.t);
    y += 260;
  }

  g.textAlign = "center";
  g.fillStyle = "#ffffff";
  g.font = `600 44px ${sans}`;
  g.fillText(nombre ? `— ${nombre.split(" ")[0]}` : "", W / 2, H - 260);
  g.fillStyle = "#cfe6dc";
  g.font = `700 52px ${sans}`;
  g.fillText("Agenda de clínicas", W / 2, H - 170);
  g.font = `500 38px ${sans}`;
  g.fillText(location.host, W / 2, H - 110);

  const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
  if (!blob) return "error" as const;
  const archivo = new File([blob], `mi-cuatri-en-numeros.png`, { type: "image/png" });
  const texto = `Mi ${periodo} en números: ${n.pacientes} pacientes y ${n.horas} h en clínica 🦷 ${location.origin}`;
  try {
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], text: texto });
      return "compartida" as const;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "cancelada" as const;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "descargada" as const;
}
