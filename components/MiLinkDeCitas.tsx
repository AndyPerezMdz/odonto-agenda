"use client";

import { useCallback, useEffect, useState } from "react";
import { Copiable } from "@/components/TarjetaSuscripcion";
import { pesos } from "@/lib/pagos";
import { fechaLarga } from "@/lib/fechas";

type Datos = {
  activo: boolean;
  premiumHasta: string | null;
  slug: string | null;
  slugSugerido: string;
  linkActivo: boolean;
  sitio: string;
  precio: number;
  concepto: string;
  banco: { banco?: string; clabe?: string; titular?: string };
  ultimoAviso: { estado: "pendiente" | "confirmado" | "descartado"; created_at: string } | null;
  tieneHorario: boolean;
};

// Premium "Tu link de citas": el paciente reserva solo en tus huecos libres.
export default function MiLinkDeCitas() {
  const [d, setD] = useState<Datos | null>(null);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/premium", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setD(j);
      setSlug(j.slug ?? j.slugSugerido);
    } else setError(j.error ?? "No se pudo cargar.");
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(cambios: { slug?: string; linkActivo?: boolean }, ok: string) {
    setTrabajando(true);
    setError(null);
    const res = await fetch("/api/premium", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
    const j = await res.json().catch(() => ({}));
    setTrabajando(false);
    if (!res.ok) return setError(j.error ?? "No se pudo guardar.");
    setAviso(ok);
    cargar();
  }

  async function yaPague(e: React.FormEvent) {
    e.preventDefault();
    setTrabajando(true);
    setError(null);
    const res = await fetch("/api/premium", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referencia }) });
    const j = await res.json().catch(() => ({}));
    setTrabajando(false);
    if (!res.ok) return setError(j.error ?? "No se pudo avisar.");
    setAviso("¡Listo! En cuanto se confirme tu pago, se activa tu link.");
    cargar();
  }

  if (!d) return <section className="rounded-2xl border border-line bg-panel p-5 text-sm text-muted">{error ?? "Cargando…"}</section>;

  const url = d.slug ? `${d.sitio}/c/${d.slug}` : "";
  const pendiente = d.ultimoAviso?.estado === "pendiente";
  const clabe = (d.banco.clabe ?? "").replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{11})(\d?)/, "$1 $2 $3 $4").trim();
  const msg = `¿Necesitas dentista? Soy estudiante de Odontología y atiendo en la clínica de la universidad. Agenda tu cita aquí: ${url}`;

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            Tu link de citas
            <span className="rounded-full bg-[#fdf6e3] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a6a14] dark:bg-[#2a2415] dark:text-[#ecd9a4]">Premium</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Compártelo en tu Instagram o WhatsApp. Tus pacientes ven sólo tus horarios libres, eligen uno y la cita cae sola en tu agenda.
          </p>
        </div>
        {d.activo && <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">Activo hasta el {fechaLarga(d.premiumHasta!)}</span>}
      </div>

      {!d.tieneHorario && (
        <p className="mb-4 rounded-xl bg-[#fdf6e3] p-3 text-sm text-[#5c4712] dark:bg-[#2a2415] dark:text-[#ecd9a4]">
          Primero guarda tu <b>horario de clínica</b> (pestaña Yo): tus pacientes sólo pueden reservar dentro de esos bloques.
        </p>
      )}

      {/* Elegir el link: se puede aunque todavía no pague, para que lo vea */}
      <label className="mb-1 block text-sm font-medium">Tu link</label>
      <div className="mb-1 flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-panel-2 pl-3 text-sm text-muted">
          <span className="shrink-0">{d.sitio.replace(/^https?:\/\//, "")}/c/</span>
          <input className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 font-medium text-ink outline-none" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={30} />
        </div>
        {slug !== (d.slug ?? "") && (
          <button className="btn btn-sec shrink-0" disabled={trabajando} onClick={() => guardar({ slug }, "Link guardado.")}>Guardar</button>
        )}
      </div>
      <p className="mb-4 text-xs text-muted">Letras sin acentos, números y guiones. Ej. mariana-lopez.</p>

      {d.activo ? (
        <>
          <label className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-3">
            <span className="text-sm">
              <b className="block">Recibir citas por mi link</b>
              <span className="text-muted">{d.linkActivo ? "Tus pacientes pueden reservar." : "Apagado: el link dice que no está disponible."}</span>
            </span>
            <input type="checkbox" className="h-5 w-5" checked={d.linkActivo} disabled={trabajando || !d.slug} onChange={(e) => guardar({ linkActivo: e.target.checked }, e.target.checked ? "¡Tu link está recibiendo citas!" : "Link apagado.")} />
          </label>
          {d.slug && (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-sec text-sm"
                onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); })}
              >
                {copiado ? "¡Copiado!" : "Copiar link"}
              </button>
              <a className="btn text-sm text-white" style={{ background: "#25D366" }} href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
              <a className="btn btn-sec text-sm" href={url} target="_blank" rel="noopener noreferrer">Ver cómo lo ven</a>
            </div>
          )}
          <p className="mt-4 text-xs text-muted">Para renovar, paga otro mes igual que la primera vez: transfiere {pesos(d.precio)} con el concepto {d.concepto} y avísanos.</p>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-line px-3">
            <p className="pt-3 text-sm font-semibold">Actívalo por {pesos(d.precio)} al mes</p>
            <Copiable etiqueta="Monto" valor={pesos(d.precio)} />
            <Copiable etiqueta="CLABE" valor={clabe} grande />
            <Copiable etiqueta="Banco" valor={d.banco.banco ?? ""} />
            <Copiable etiqueta="Beneficiario" valor={d.banco.titular ?? ""} />
            <Copiable etiqueta="Concepto (¡importante!)" valor={d.concepto} />
          </div>
          <div className="flex min-w-0 flex-col">
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Es <b className="text-ink">por persona</b>: tu compañero/a necesita el suyo.</li>
              <li>Sólo se ven horas libres; nadie ve a tus pacientes.</li>
              <li>Te llega un correo con cada cita nueva.</li>
            </ul>
            {d.ultimoAviso?.estado === "descartado" && (
              <p className="mb-3 rounded-xl bg-[#fbecea] px-3 py-3 text-sm text-[#7a1f1a] dark:bg-[#3a1d1b] dark:text-[#f1b5b0]">No pudimos confirmar tu último pago. Revisa CLABE y concepto, y vuelve a avisar.</p>
            )}
            {pendiente ? (
              <p className="rounded-xl bg-accent-soft px-3 py-3 text-sm text-accent">Avisaste de un pago el {fechaLarga(d.ultimoAviso!.created_at.slice(0, 10))}. En cuanto se confirme, se activa.</p>
            ) : (
              <form onSubmit={yaPague} className="mt-auto">
                <label className="mb-1 block text-sm font-medium">Clave de rastreo <span className="font-normal text-muted">(opcional)</span></label>
                <input className="campo mb-3" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="La que te da tu banco al transferir" />
                <button className="btn btn-primario w-full" disabled={trabajando || !clabe}>{trabajando ? "Avisando…" : "Ya pagué"}</button>
              </form>
            )}
          </div>
        </div>
      )}
      {aviso && <p className="mt-3 text-sm text-accent">{aviso}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
