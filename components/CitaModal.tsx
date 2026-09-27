"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cita, Clinica, EstadoCita, Materia, Paciente, Perfil, Preferencias } from "@/lib/types";
import { enlaceWhatsApp, mensajeConfirmar, IcoWhatsApp } from "@/lib/whatsapp";
import { fechaLarga, hhmm, sumarMinutos } from "@/lib/fechas";
import { sumarDias } from "@/lib/pagos";
import { ESTADOS } from "@/lib/estados";

type Props = {
  supabase: SupabaseClient;
  userId: string;
  cita: Cita | null;
  fechaInicial: string;
  perfiles: Perfil[];
  clinicas: Clinica[];
  materias: Materia[];
  preferencias: Required<Preferencias>;
  soloLectura?: boolean;
  plantilla?: Cita; // "Otra sesión": nueva cita con los datos de otra
  onOtraSesion?: (c: Cita) => void;
  pacientes?: Paciente[]; // banco de pacientes (para autocompletar nombre y teléfono)
  pacienteOrigen?: string; // si se agenda desde el banco: se marca como "agendado"
  onClose: () => void;
  onGuardado: (fecha: string) => void;
};

export default function CitaModal({
  supabase, userId, cita, fechaInicial, perfiles, clinicas, materias, preferencias, soloLectura = false, plantilla, onOtraSesion, pacientes = [], pacienteOrigen, onClose, onGuardado,
}: Props) {
  const base = cita ?? plantilla ?? null;
  const esNueva = !cita;
  const esMia = (esNueva || cita.owner_id === userId) && !soloLectura;
  const dueno = perfiles.find((p) => p.id === (cita?.owner_id ?? userId));

  const [paciente, setPaciente] = useState(base?.paciente ?? "");
  const [fecha, setFecha] = useState(cita?.fecha ?? fechaInicial);
  const [inicio, setInicio] = useState(base ? hhmm(base.hora_inicio) : preferencias.horaInicio);
  const [fin, setFin] = useState(
    base ? hhmm(base.hora_fin) : sumarMinutos(preferencias.horaInicio, preferencias.duracionMin)
  );
  const [clinicaId, setClinicaId] = useState(base?.clinica_id ?? "");
  const [materiaId, setMateriaId] = useState(base?.materia_id ?? "");
  const [notas, setNotas] = useState(cita?.notas ?? "");
  const [telefono, setTelefono] = useState(base?.telefono ?? "");
  const [cobro, setCobro] = useState(cita?.cobro != null ? String(cita.cobro) : "");
  const [cobrado, setCobrado] = useState(!!cita?.cobrado);
  const materiaSel = materias.find((m) => m.id === materiaId);
  const misPacientes = pacientes.filter((p) => p.owner_id === userId && p.estado !== "descartado");

  // Al escribir un nombre que está en tu banco de pacientes, trae su teléfono y materia
  function cambiarPaciente(v: string) {
    setPaciente(v);
    const p = misPacientes.find((x) => x.nombre.toLowerCase() === v.trim().toLowerCase());
    if (p) {
      if (p.telefono && !telefono) setTelefono(p.telefono);
      if (p.materia_id && !materiaId) setMateriaId(p.materia_id);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [estado, setEstado] = useState<EstadoCita | null>(cita?.estado ?? null);
  const [repetir, setRepetir] = useState(false);
  const [veces, setVeces] = useState(4);
  const [resumen, setResumen] = useState<{ ok: number; choques: string[] } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Al mover la hora de inicio en una cita nueva, arrastra la hora de fin
  function cambiarInicio(v: string) {
    setInicio(v);
    if (!esNueva || !v) return;
    // Sin plantilla: duración de tus preferencias. Con plantilla (otra sesión, banco, hueco): conserva la que traía.
    const min = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
    const dur = plantilla && inicio && fin ? min(fin) - min(inicio) : 0;
    setFin(sumarMinutos(v, dur > 0 ? dur : preferencias.duracionMin));
  }

  // En catálogos, mostrar activos + el que ya tenga la cita (aunque esté inactivo)
  const clinicasOpc = clinicas.filter((c) => c.activo || c.id === base?.clinica_id);
  const materiasOpc = materias.filter((m) => m.activo || m.id === base?.materia_id);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!paciente.trim()) return setError("Falta el nombre del paciente.");
    if (fin <= inicio) return setError("La hora de fin debe ser después de la de inicio.");

    setGuardando(true);
    const datos = {
      paciente: paciente.trim(),
      fecha,
      hora_inicio: inicio,
      hora_fin: fin,
      clinica_id: clinicaId || null,
      materia_id: materiaId || null,
      notas: notas.trim() || null,
      telefono: telefono.trim() || null,
      cobro: cobro.trim() ? Math.max(0, Number(cobro)) : null,
      cobrado: cobro.trim() ? cobrado : false,
    };

    // Nueva y repetida: una por semana. Si alguna choca con otra cita, se salta y se avisa.
    if (esNueva && repetir && veces > 1) {
      let ok = 0;
      const choques: string[] = [];
      for (let i = 0; i < veces; i++) {
        const f = sumarDias(fecha, 7 * i);
        const { error } = await supabase.from("citas").insert({ ...datos, fecha: f });
        if (!error) ok++;
        else if (error.code === "23P01") choques.push(f);
        else {
          setGuardando(false);
          return setError(`Se guardaron ${ok}, pero falló el ${fechaLarga(f)}: ${error.message}`);
        }
      }
      setGuardando(false);
      if (pacienteOrigen && ok > 0) await supabase.from("pacientes").update({ estado: "agendado" }).eq("id", pacienteOrigen);
      if (choques.length === 0) return onGuardado(fecha);
      return setResumen({ ok, choques });
    }

    const { error } = esNueva
      ? await supabase.from("citas").insert(datos)
      : await supabase.from("citas").update({ ...datos, estado }).eq("id", cita.id);

    setGuardando(false);
    if (error) {
      if (error.code === "23P01")
        setError(estado === null && cita?.estado === "cancelo"
          ? "No se puede reactivar: ya tienes otra cita en ese horario."
          : "Ya tienes otra cita que se encima con ese horario.");
      else setError("No se pudo guardar: " + error.message);
      return;
    }
    if (esNueva && pacienteOrigen) await supabase.from("pacientes").update({ estado: "agendado" }).eq("id", pacienteOrigen);
    onGuardado(fecha);
  }

  async function borrar() {
    if (!cita) return;
    setGuardando(true);
    const { error } = await supabase.from("citas").delete().eq("id", cita.id);
    setGuardando(false);
    if (error) return setError("No se pudo borrar: " + error.message);
    onGuardado(cita.fecha);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={guardar}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {esNueva ? (plantilla?.paciente && !pacienteOrigen ? "Siguiente sesión" : "Nueva cita") : esMia ? "Editar cita" : "Detalle de cita"}
          </h2>
          <button type="button" onClick={onClose} className="btn btn-sec px-2.5 py-1" aria-label="Cerrar">✕</button>
        </div>

        {soloLectura && (
          <p className="mb-4 rounded-lg bg-panel-2 px-3 py-2 text-sm text-muted">La agenda está en sólo lectura porque la suscripción venció.</p>
        )}

        {!esMia && !soloLectura && (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-panel-2 px-3 py-2 text-sm text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: dueno?.color }} />
            Cita de {dueno?.nombre}. Sólo esa persona la puede modificar.
          </p>
        )}

        {!esNueva && (
          <div className="mb-4">
            <span className="mb-1 block text-sm font-medium">¿Cómo fue?</span>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-line p-1">
              {ESTADOS.map((e) => (
                <button
                  key={e.nombre}
                  type="button"
                  disabled={!esMia || guardando}
                  onClick={() => setEstado(e.id)}
                  className={`rounded-lg px-1 py-1.5 text-xs font-medium transition sm:text-sm ${
                    estado === e.id ? e.clase.replace("line-through", "") + " ring-1 ring-current" : "text-muted hover:bg-panel-2"
                  }`}
                >
                  {e.nombre}
                </button>
              ))}
            </div>
            {estado === "cancelo" && <p className="mt-1 text-xs text-muted">Una cita cancelada ya no ocupa el horario ni te llega recordatorio.</p>}
          </div>
        )}

        <fieldset disabled={!esMia || guardando} className="grid grid-cols-2 gap-3">
          <Campo label="Paciente">
            <input className="campo" list="banco-pacientes" value={paciente} onChange={(e) => cambiarPaciente(e.target.value)} autoFocus={esNueva} required />
            <datalist id="banco-pacientes">
              {misPacientes.map((p) => <option key={p.id} value={p.nombre} />)}
            </datalist>
          </Campo>
          <Campo label="Teléfono (opcional)">
            <div className="flex gap-1.5">
              <input type="tel" inputMode="tel" className="campo min-w-0" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="999 123 4567" />
              {esMia && !esNueva && enlaceWhatsApp(telefono, "") && (
                <a
                  href={enlaceWhatsApp(telefono, mensajeConfirmar({ paciente, fecha, hora_inicio: inicio }, clinicas.find((c) => c.id === clinicaId)?.numero)) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn shrink-0 bg-[#25D366] px-2.5 text-white"
                  title="Confirmar la cita por WhatsApp"
                  aria-label="Confirmar por WhatsApp"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={IcoWhatsApp} /></svg>
                </a>
              )}
            </div>
          </Campo>

          <Campo label="Fecha" className="col-span-2">
            <input type="date" className="campo" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </Campo>

          <Campo label="Inicio">
            <input type="time" className="campo" value={inicio} onChange={(e) => cambiarInicio(e.target.value)} required />
          </Campo>
          <Campo label="Fin">
            <input type="time" className="campo" value={fin} onChange={(e) => setFin(e.target.value)} required />
          </Campo>

          <Campo label="Clínica">
            <select className="campo" value={clinicaId} onChange={(e) => setClinicaId(e.target.value)}>
              <option value="">—</option>
              {clinicasOpc.map((c) => (
                <option key={c.id} value={c.id}>{c.numero}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Materia">
            <select className="campo" value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
              <option value="">—</option>
              {materiasOpc.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </Campo>

          {materiaSel?.material?.trim() && (
            <div className="col-span-2 rounded-xl bg-panel-2 p-3 text-sm">
              <p className="mb-1 font-medium">Qué llevar a {materiaSel.nombre}</p>
              <ul className="list-disc pl-5 text-muted">
                {materiaSel.material.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          )}

          <Campo label="Cobro al paciente (opcional)">
            <div className="flex items-center gap-1.5">
              <span className="text-muted">$</span>
              <input type="number" min={0} step="1" inputMode="decimal" className="campo" value={cobro} onChange={(e) => setCobro(e.target.value)} placeholder="0" />
            </div>
          </Campo>
          <div className="flex items-end pb-2.5">
            <label className={`flex items-center gap-2 text-sm ${cobro.trim() ? "" : "opacity-40"}`}>
              <input type="checkbox" checked={cobrado} disabled={!cobro.trim()} onChange={(e) => setCobrado(e.target.checked)} />
              Ya me pagó
            </label>
          </div>

          <Campo label="Notas (opcional)" className="col-span-2">
            <textarea
              className="campo min-h-[70px] resize-y"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. traer radiografía, llegar 10 min antes"
            />
            <span className="mt-1 block text-xs text-muted">Sin diagnósticos ni datos clínicos: sólo lo necesario para organizarte.</span>
          </Campo>

          {esNueva && (
            <div className="col-span-2 rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
                Repetir cada semana
              </label>
              {repetir && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">Mismo día y hora, durante</span>
                  <select className="campo w-auto py-1" value={veces} onChange={(e) => setVeces(Number(e.target.value))}>
                    {Array.from({ length: 15 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>{n} semanas</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted">(hasta el {fechaLarga(sumarDias(fecha, 7 * (veces - 1)))})</span>
                </div>
              )}
            </div>
          )}
        </fieldset>

        {(clinicas.length === 0 || materias.length === 0) && esMia && (
          <p className="mt-3 text-xs text-muted">
            ¿No aparece la clínica o materia? Agrégala en <b>Personalizar</b>.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {resumen && (
          <div className="mt-4 rounded-xl bg-panel-2 p-3 text-sm">
            <p className="mb-1 font-medium">Se agendaron {resumen.ok} de {resumen.ok + resumen.choques.length} citas.</p>
            <p className="text-muted">
              Estas fechas ya tenían otra cita a esa hora y se saltaron: {resumen.choques.map(fechaLarga).join(", ")}.
            </p>
            <button type="button" className="btn btn-primario mt-3 w-full" onClick={() => onGuardado(fecha)}>Entendido</button>
          </div>
        )}

        {esMia && !resumen && (
          <div className="mt-5 flex items-center gap-2">
            {!esNueva &&
              (confirmarBorrar ? (
                <>
                  <button type="button" className="btn btn-peligro" onClick={borrar} disabled={guardando}>¿Seguro? Borrar</button>
                  <button type="button" className="btn btn-sec" onClick={() => setConfirmarBorrar(false)}>No</button>
                </>
              ) : (
                <button type="button" className="btn btn-peligro" onClick={() => setConfirmarBorrar(true)}>Borrar</button>
              ))}
            {!esNueva && onOtraSesion && cita && (
              <button type="button" className="btn btn-sec ml-auto" onClick={() => onOtraSesion(cita)} title="Nueva cita con el mismo paciente, clínica, materia y horario">
                + Otra sesión
              </button>
            )}
            <button type="submit" className={`btn btn-primario ${!esNueva && onOtraSesion ? "" : "ml-auto"}`} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function Campo({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
