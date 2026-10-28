"use client";

import { useCallback, useEffect, useState } from "react";
import { fechaLarga } from "@/lib/fechas";
import { textoHora, type PEvento, type PPendiente } from "@/lib/personal";
import { linksDe, mapsDe } from "@/lib/links";
import { finBloque } from "@/lib/bloques";

// 3.0 · Compartir eventos y pendientes con otra persona (por correo) y ver lo que te compartieron.

export type InvitacionHabito = { id: string; de: string; nombre: string; color: string; dias: number[] };
export type Recibidos = { eventos: PEvento[]; pendientes: PPendiente[]; habitos: InvitacionHabito[] };
export type Pareja = { habito_id: string; compartido_id: string; con: string; racha: number; hoy: boolean; dueno: boolean };

/** Lo que te compartieron (se refresca al volver a la app). */
export function useCompartidos(demo: boolean) {
  const [recibidos, setRecibidos] = useState<Recibidos>({ eventos: [], pendientes: [], habitos: [] });
  const [parejas, setParejas] = useState<Pareja[]>([]); // 3.2 · hábitos con amigos
  const recargar = useCallback(async () => {
    if (demo) return;
    const r = await fetch("/api/personal/compartidos").catch(() => null);
    if (!r?.ok) return;
    const d = (await r.json().catch(() => null)) as Recibidos | null;
    if (d?.eventos) setRecibidos({ eventos: d.eventos, pendientes: d.pendientes ?? [], habitos: d.habitos ?? [] });
    const p = await fetch("/api/personal/compartidos?parejas=1").then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (p?.parejas) setParejas(p.parejas);
  }, [demo]);
  useEffect(() => {
    recargar();
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);
  async function quitar(id: string) {
    setRecibidos((r) => ({ eventos: r.eventos.filter((e) => e.compartido?.id !== id), pendientes: r.pendientes.filter((p) => p.compartido?.id !== id), habitos: r.habitos.filter((h) => h.id !== id) }));
    setParejas((l) => l.filter((x) => x.compartido_id !== id));
    await fetch("/api/personal/compartidos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
  }
  /** 3.2 · Aceptar hacer un hábito juntos (se crea tu copia). */
  async function aceptar(id: string) {
    const r = await fetch("/api/personal/compartidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "aceptar", id }) }).catch(() => null);
    setRecibidos((x) => ({ ...x, habitos: x.habitos.filter((h) => h.id !== id) }));
    await recargar();
    return !!r?.ok;
  }
  /** 3.2 · Ya lo hice: le llega un aviso a tu pareja de hábito (si no lo ha hecho). */
  function palomee(habitoId: string) {
    if (demo || !parejas.some((p) => p.habito_id === habitoId)) return;
    fetch("/api/personal/compartidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "palomee", habito_id: habitoId }) }).catch(() => null);
  }
  function marcarLocal(id: string, hecho: boolean) {
    setRecibidos((r) => ({ ...r, pendientes: r.pendientes.map((p) => (p.compartido?.id === id ? { ...p, hecho, hecho_at: hecho ? new Date().toISOString() : null } : p)) }));
  }
  return { recibidos, parejas, recargar, quitar, marcarLocal, aceptar, palomee };
}

/** "👥 Compartir con…" dentro de un evento o pendiente tuyo (ya guardado). */
export function Compartir({ tipo, id, abierto: abierto0 = false }: { tipo: "evento" | "pendiente" | "habito"; id: string; abierto?: boolean }) {
  const [abierto, setAbierto] = useState(abierto0);
  const [lista, setLista] = useState<{ id: string; correo: string; quito: boolean }[] | null>(null);
  const [correo, setCorreo] = useState("");
  const [msg, setMsg] = useState<{ t: string; error?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto || lista) return;
    fetch(`/api/personal/compartidos?tipo=${tipo}&id=${id}`)
      .then((r) => r.json().then((d) => (r.ok ? setLista(d.lista ?? []) : (setLista([]), setMsg({ t: d.error ?? "No se pudo cargar.", error: true })))))
      .catch(() => setLista([]));
  }, [abierto, lista, tipo, id]);

  async function enviar() {
    if (!correo.trim()) return;
    setEnviando(true);
    setMsg(null);
    const r = await fetch("/api/personal/compartidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, id, correo }) });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setMsg({ t: d.error ?? "No se pudo.", error: true });
    setLista(d.lista ?? []);
    setMsg({ t: d.nuevo ? (tipo === "habito" ? `Listo. Le mandamos la invitación a ${correo.trim()}.` : `Listo. Le avisamos a ${correo.trim()} por correo.`) : "Ya lo tenía." });
    setCorreo("");
  }
  async function quitar(x: { id: string; correo: string }) {
    setLista((l) => (l ?? []).filter((y) => y.id !== x.id));
    await fetch("/api/personal/compartidos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: x.id }) });
    setMsg({ t: `${x.correo} ya no lo ve.` });
  }

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mb-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-sm text-muted hover:border-accent hover:text-accent">
        👥 <span className="font-medium">{tipo === "habito" ? "Hazlo con alguien" : "Compartir con alguien"}</span>
        <span className="ml-auto text-xs">{tipo === "evento" ? "lo ve en su agenda" : tipo === "habito" ? "ven la racha del otro" : "lo puede palomear"}</span>
      </button>
    );
  return (
    <div className="mb-4 rounded-xl border border-line p-3">
      <p className="text-sm font-medium">{tipo === "habito" ? "🔥 Hazlo con alguien" : "👥 Compartir"}</p>
      <p className="mb-2 text-xs text-muted">
        {tipo === "evento" ? "Le aparece en su Mi agenda (sólo para ver). Si cambias algo, lo ve cambiado." : tipo === "habito" ? "Le llega la invitación; si acepta, tiene el suyo. Cada quien palomea el propio y ven la racha y el “hoy” del otro." : "Le aparece en sus pendientes y lo puede palomear; tú lo ves palomeado."} Sólo ve esto, nada más de tu agenda.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          className="campo flex-1 py-1.5 text-sm"
          placeholder="correo@ejemplo.com"
          value={correo}
          maxLength={200}
          onChange={(e) => setCorreo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enviar(); } }}
          aria-label="Correo de con quién compartes"
        />
        <button type="button" className="btn btn-primario rounded-full px-4 text-sm" disabled={enviando || !correo.trim()} onClick={enviar}>{enviando ? "…" : "Compartir"}</button>
      </div>
      {lista && lista.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {lista.map((x) => (
            <li key={x.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{x.correo}{x.quito && <span className="text-xs text-muted"> · {tipo === "habito" ? "lo dejó" : "lo quitó de su agenda"}</span>}</span>
              <button type="button" onClick={() => quitar(x)} className="text-xs text-danger hover:underline">Quitar</button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.error ? "text-danger" : "text-muted"}`}>{msg.t}</p>}
    </div>
  );
}

/** Notas con los links que se pueden tocar. */
export function TextoConLinks({ texto }: { texto: string }) {
  const partes = texto.split(/(\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 ? (
          <a key={i} href={p.startsWith("www.") ? `https://${p}` : p} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">{p}</a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/** Botones "Unirse a Zoom" / "Abrir link" / "Cómo llegar" de un evento. */
export function BotonesLinks({ lugar, notas }: { lugar: string | null | undefined; notas: string | null | undefined }) {
  const links = linksDe(lugar, notas).slice(0, 3);
  const maps = mapsDe(lugar);
  if (!links.length && !maps) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={`btn rounded-full px-3 py-1.5 text-sm ${l.tipo === "web" || l.tipo === "maps" ? "btn-sec" : "btn-primario"}`}>
          {l.tipo === "web" ? "🔗" : l.tipo === "maps" ? "📍" : "🎥"} {l.etiqueta}
        </a>
      ))}
      {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="btn btn-sec rounded-full px-3 py-1.5 text-sm">📍 Cómo llegar</a>}
    </div>
  );
}

/** Lo que te compartieron: para ver (eventos) o palomear (pendientes), y quitarlo de tu agenda. */
export function VerCompartido({ e, p, dia, onMarcar, onQuitar, onClose }: { e?: PEvento; p?: PPendiente; dia?: string; onMarcar?: (hecho: boolean) => void; onQuitar: () => void; onClose: () => void }) {
  const c = (e ?? p)!.compartido!;
  const [quitar, setQuitar] = useState(false);
  useEffect(() => {
    const k = (x: KeyboardEvent) => x.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const notas = e?.notas ?? p?.notas;
  return (
    <div className="hoja-fondo fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(x) => x.stopPropagation()} role="dialog" aria-label="Te lo compartieron">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <p className="versalitas text-accent">👥 Te lo compartió {c.de}</p>
        <h2 className="serif mt-1 text-3xl leading-tight">{e?.titulo ?? p?.titulo}</h2>
        <p className="mt-1 text-sm text-muted">
          {e
            ? e.tipo === "viaje"
              ? `Del ${fechaLarga(e.fecha)} al ${fechaLarga(e.fecha_fin ?? e.fecha)}`
              : `${fechaLarga(dia ?? e.fecha)} · ${textoHora(e)}${e.repetir !== "nunca" ? " · se repite" : ""}`
            : p?.fecha
              ? `Para el ${fechaLarga(p.fecha)}${p.hora ? ` · ${p.hora.slice(0, 5)}–${finBloque(p)}` : ""}`
              : "Sin fecha"}
        </p>
        {e?.lugar && <p className="mt-2 text-sm">📍 {e.lugar}</p>}
        {notas && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-panel p-3 text-sm"><TextoConLinks texto={notas} /></p>}
        {e && <div className="mt-3"><BotonesLinks lugar={e.lugar} notas={e.notas} /></div>}
        {p && onMarcar && (
          <button onClick={() => { onMarcar(!p.hecho); onClose(); }} className={`btn mt-4 w-full rounded-full py-2.5 ${p.hecho ? "btn-sec" : "btn-primario"}`}>{p.hecho ? "Desmarcar" : "✓ Ya está hecho"}</button>
        )}
        <p className="mt-4 text-xs text-muted">{e ? "Sólo lo puede cambiar quien lo creó. Si lo cambia, aquí lo ves cambiado." : `Cuando lo palomeas, ${c.de} lo ve palomeado.`}</p>
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          {quitar ? (
            <button className="btn rounded-full bg-danger px-4 text-sm text-white" onClick={() => { onQuitar(); onClose(); }}>Sí, quitarlo de mi agenda</button>
          ) : (
            <button className="btn btn-sec rounded-full text-sm text-danger" onClick={() => setQuitar(true)}>Quitar de mi agenda</button>
          )}
          <button className="btn btn-sec ml-auto rounded-full" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/** 3.2 · "Ema te invita a hacer “Gym” juntos": aceptar o no. */
export function InvitacionesHabitos({ lista, onAceptar, onNo }: { lista: InvitacionHabito[]; onAceptar: (id: string) => Promise<boolean>; onNo: (id: string) => void }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  if (!lista.length) return null;
  return (
    <ul className="mb-4 flex flex-col gap-2">
      {lista.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-3" style={{ borderColor: i.color }}>
          <span className="text-2xl" aria-hidden>🔥</span>
          <span className="min-w-0 flex-1 text-sm">
            <b>{i.de}</b> te invita a hacer <b>“{i.nombre}”</b> juntos. Cada quien palomea el suyo y ven la racha del otro.
          </span>
          <span className="flex gap-2">
            <button className="btn btn-primario rounded-full px-3 py-1.5 text-sm" disabled={trabajando === i.id} onClick={async () => { setTrabajando(i.id); await onAceptar(i.id); setTrabajando(null); }}>{trabajando === i.id ? "…" : "Aceptar"}</button>
            <button className="btn btn-sec rounded-full px-3 py-1.5 text-sm" onClick={() => onNo(i.id)}>No, gracias</button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 3.2 · En tu copia de un hábito compartido: con quién lo haces y "dejar de hacerlo juntos". */
export function ParejaCopia({ h, parejas, onDejar }: { h: { id: string }; parejas: Pareja[]; onDejar: (compartidoId: string) => void }) {
  const p = parejas.find((x) => x.habito_id === h.id);
  const [seguro, setSeguro] = useState(false);
  if (!p) return null;
  return (
    <div className="mb-4 rounded-xl border border-line p-3 text-sm">
      <p>👥 Lo haces con <b>{p.con}</b> · lleva {p.racha} {p.racha === 1 ? "día" : "días"}.</p>
      {seguro ? (
        <button type="button" className="mt-2 text-xs font-semibold text-danger hover:underline" onClick={() => onDejar(p.compartido_id)}>Sí, dejar de hacerlo juntos (tu hábito y tu racha se quedan)</button>
      ) : (
        <button type="button" className="mt-2 text-xs text-muted hover:text-ink" onClick={() => setSeguro(true)}>Dejar de hacerlo juntos</button>
      )}
    </div>
  );
}
