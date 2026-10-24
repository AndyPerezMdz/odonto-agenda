"use client";

import { useEffect, useState } from "react";
import { universidad, type Universidad } from "@/lib/universidades";
import { DOMINIOS, dominioInstitucional, ejemploCorreo } from "@/lib/verificacionEscolar";

// 3.1 · "Confirma que eres estudiante": código a tu correo institucional, o (plan B) pedírselo al staff.

type Paso = "cargando" | "correo" | "codigo" | "staff" | "esperando";

export default function VerificarEscolar({ uni, onListo, correoInicial = "" }: { uni: Universidad; onListo: () => void; correoInicial?: string | null }) {
  const u = universidad(uni);
  const [paso, setPaso] = useState<Paso>("cargando");
  const [rechazado, setRechazado] = useState(false);
  const [correo, setCorreo] = useState(correoInicial ?? "");
  const [codigo, setCodigo] = useState("");
  const [nota, setNota] = useState("");
  const [espera, setEspera] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    fetch("/api/registro/verificar")
      .then((r) => r.json())
      .then((d) => {
        if ((d.estado === "verificado" || d.estado === "aprobado") && d.universidad === uni) return onListo();
        if (d.estado === "manual") return setPaso("esperando");
        setRechazado(d.estado === "rechazado");
        setEspera(d.esperar ?? 0);
        setPaso(d.codigoEnviado && d.universidad === uni ? "codigo" : "correo");
      })
      .catch(() => setPaso("correo"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uni]);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(espera - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function llamar(cuerpo: Record<string, string>) {
    setTrabajando(true);
    setError(null);
    const r = await fetch("/api/registro/verificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : { error: "Sin conexión." };
    setTrabajando(false);
    if (d.esperar != null) setEspera(d.esperar);
    if (!r?.ok) {
      setError(d.error ?? "No se pudo.");
      return null;
    }
    return d;
  }
  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!dominioInstitucional(uni, correo)) return setError(`Tiene que terminar en @${DOMINIOS[uni][0]}.`);
    if (await llamar({ accion: "enviar", universidad: uni, correo })) {
      setCodigo("");
      setPaso("codigo");
    }
  }
  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (codigo.replace(/\D/g, "").length < 6) return setError("El código tiene 6 dígitos.");
    if (await llamar({ accion: "confirmar", codigo })) onListo();
  }
  async function staff(e: React.FormEvent) {
    e.preventDefault();
    if (await llamar({ accion: "staff", universidad: uni, nota })) setPaso("esperando");
  }

  if (paso === "cargando") return <div className="grid place-items-center py-8"><span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-label="Cargando" /></div>;

  if (paso === "esperando")
    return (
      <div>
        <p className="mb-3 rounded-xl bg-accent-soft p-3 text-sm text-accent">⏳ Le llegó tu solicitud al staff. Te avisamos por correo cuando la revisen (normalmente el mismo día).</p>
        <p className="mb-4 text-sm text-muted">¿Ya pudiste entrar a tu correo institucional? Mejor confírmalo con el código y entras al instante.</p>
        <button className="btn btn-sec w-full" onClick={() => setPaso("correo")}>Usar mi correo institucional</button>
      </div>
    );

  if (paso === "staff")
    return (
      <form onSubmit={staff}>
        <p className="mb-3 text-sm text-muted">Sin problema: el staff lo revisa a mano. Cuéntanos tu <b>matrícula</b> o semestre y por qué no tienes tu correo de la {u.nombre}.</p>
        <textarea className="campo mb-3 min-h-[90px]" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Matrícula 12345, 3er cuatri. Nunca activé mi correo." autoFocus />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button className="btn btn-primario mb-2 w-full" disabled={trabajando || nota.trim().length < 8}>{trabajando ? "Mandando…" : "Mandar al staff"}</button>
        <button type="button" className="btn btn-sec w-full" onClick={() => { setPaso("correo"); setError(null); }}>Mejor uso mi correo institucional</button>
      </form>
    );

  if (paso === "codigo")
    return (
      <form onSubmit={confirmar}>
        <p className="mb-3 text-sm text-muted">Te mandamos un código de 6 dígitos a <b className="text-ink">{correo || "tu correo institucional"}</b>. Caduca en 15 minutos.</p>
        <input
          inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8}
          className="campo mb-4 text-center text-2xl font-semibold tracking-[0.4em]" placeholder="000000"
          value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} aria-label="Código"
        />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button className="btn btn-primario w-full" disabled={trabajando}>{trabajando ? "Revisando…" : "Confirmar"}</button>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" className="font-medium text-accent disabled:text-muted" disabled={espera > 0 || trabajando || !correo} onClick={() => enviar()}>
            {espera > 0 ? `Reenviar (${espera})` : "Reenviar código"}
          </button>
          <button type="button" className="text-muted hover:text-ink" onClick={() => { setPaso("correo"); setError(null); }}>Cambiar correo</button>
        </div>
        <p className="mt-3 text-xs text-muted">¿No llega? Revisa Spam o “Otros” en el correo de la escuela.</p>
      </form>
    );

  return (
    <form onSubmit={enviar}>
      {rechazado && <p className="mb-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">No pudimos aprobarte a mano. Inténtalo con tu correo institucional.</p>}
      <p className="mb-3 text-sm text-muted">La agenda de clínicas es para estudiantes. Confírmalo con tu correo de alumno de la {u.nombre}: te mandamos un código. <b className="text-ink">Tu cuenta sigue con tu correo de siempre</b>; éste sólo es para comprobar.</p>
      <label className="mb-1 block text-sm font-medium" htmlFor="correo-inst">Correo institucional</label>
      <input id="correo-inst" type="email" autoComplete="off" autoFocus={!correoInicial} className="campo mb-1" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder={ejemploCorreo(uni)} />
      <p className="mb-4 text-xs text-muted">Termina en @{DOMINIOS[uni][0]}</p>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <button className="btn btn-primario w-full" disabled={trabajando || espera > 0}>{trabajando ? "Mandando…" : espera > 0 ? `Espera ${espera} s` : "Mandarme el código"}</button>
      <button type="button" className="mt-3 w-full text-center text-sm text-muted hover:text-ink" onClick={() => { setPaso("staff"); setError(null); }}>No tengo acceso a mi correo institucional</button>
    </form>
  );
}
