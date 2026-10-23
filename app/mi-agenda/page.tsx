import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { planesMiConfig } from "@/lib/planMiServer";
import { BENEFICIOS_MI_PRO, DIAS_PRUEBA_MI, GRATIS_MI, type PlanMi } from "@/lib/planMi";
import { pesos } from "@/lib/pagos";

export const dynamic = "force-dynamic"; // los precios los cambias en tu panel

export const metadata: Metadata = {
  title: { absolute: "Mi agenda · tu agenda personal" },
  description: "Eventos, pendientes, hábitos con racha y recordatorios en una agenda con cara de papel que sólo tú ves. Gratis para siempre.",
};

// 2.3 · Página pública de Mi agenda: qué es, la demo, Gratis / Pro y "Crea tu agenda" (sin nada de odonto).

const Ico = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const COSAS = [
  { t: "Tu día, de un vistazo", x: "Una línea del tiempo con lo de hoy y una rayita que te dice qué hora es. Lo que ya pasó se va apagando.", d: "M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
  { t: "Viajes con pase de abordar", x: "Cada viaje cuenta los días que faltan. Y cuando ya vas: “día 2 de 4”.", d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" },
  { t: "Entregas en un post-it", x: "Lo que tienes que entregar esta semana, con palomita. Las atrasadas te gritan en rojo.", d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { t: "Hábitos con racha", x: "Agua, gym, leer… Los palomeas cada día y ves crecer tu racha. Gratis y sin límite.", d: "M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3.5 3C13 8 12 5 9 2c0 4-4 7-4 13 0 4 3 7 7 7z" },
  { t: "Pendientes", x: "Por hacer y “algún día”, con subtareas. Ponles fecha y te salen en Hoy.", d: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { t: "Se repite sola", x: "El gym diario, la clase de cada semana, el pago de cada mes, los cumpleaños cada año. Lo anotas una vez.", d: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" },
  { t: "Tus colores", x: "Categorías como Trabajo, Escuela, Viajes o Personal, con el color que quieras.", d: "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22zM7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01" },
  { t: "Te avisa", x: "Notificación en tu cel a la hora de cada recordatorio. Con Pro, además, un correo cada mañana y tu agenda en el calendario del teléfono.", d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" },
];

export default async function MiAgendaPublica() {
  const planes = (await planesMiConfig(createAdminClient()).catch(() => null))?.filter((p) => p.activo) ?? null;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mi-agenda-icon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
        <span className="serif mr-auto text-2xl">Mi agenda</span>
        <Link href="/login?a=mi" className="btn btn-sec rounded-full py-1.5 text-sm">Entrar</Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        {/* ---------- Portada ---------- */}
        <section className="grid items-center gap-10 py-8 md:grid-cols-[1.1fr_1fr] md:py-14">
          <div>
            <p className="versalitas text-accent">Tu agenda personal</p>
            <h1 className="serif mt-3 text-5xl leading-[1.02] sm:text-6xl">
              Tu vida en orden.
              <br />
              <span className="italic text-accent">Con cara de papel.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted">
              Eventos, pendientes, hábitos con racha y recordatorios en una agenda bonita que <b className="text-ink">sólo tú ves</b>. En tu cel y en tu compu, siempre al día.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/mi-agenda/registro" className="btn btn-primario rounded-full px-6 py-3 text-base">Créala gratis</Link>
              <Link href="/mi-agenda/demo" className="btn btn-sec rounded-full px-6 py-3 text-base">Ver la demo</Link>
            </div>
          </div>
          <Muestra />
        </section>

        {/* ---------- Qué trae ---------- */}
        <section className="border-t border-line py-12">
          <h2 className="serif text-4xl">Lo que trae</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COSAS.map((c) => (
              <li key={c.t} className="rounded-2xl border border-line bg-panel p-5">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent"><Ico d={c.d} /></span>
                <p className="serif mt-3 text-2xl leading-tight">{c.t}</p>
                <p className="mt-1.5 text-sm text-muted">{c.x}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Privacidad ---------- */}
        <section className="grid gap-6 border-t border-line py-12 md:grid-cols-2">
          <div>
            <h2 className="serif text-4xl">Sólo tú la ves</h2>
            <p className="mt-3 text-muted">
              Tu agenda no se comparte con nadie. Ni siquiera el panel de quien administra la app muestra lo que anotas: sólo cuántas cosas tienes. Guardamos tus datos para mostrártelos a ti, y nada más. Puedes pedir que la borremos cuando quieras.
            </p>
          </div>
          <div>
            <h2 className="serif text-4xl">¿Cómo la consigo?</h2>
            <ol className="mt-3 flex flex-col gap-2 text-muted">
              <li><b className="text-ink">1.</b> Crea tu cuenta con tu correo y una contraseña.</li>
              <li><b className="text-ink">2.</b> Confírmala con el código de 6 dígitos que te llega.</li>
              <li><b className="text-ink">3.</b> Listo: tu agenda es <b className="text-ink">gratis para siempre</b>. Y cuando quieras, pruebas Pro {DIAS_PRUEBA_MI} días sin pagar.</li>
            </ol>
          </div>
        </section>

        {/* ---------- Gratis / Pro ---------- */}
        <section id="planes" className="scroll-mt-6 border-t border-line py-12">
          <h2 className="serif text-center text-5xl">Gratis o Pro</h2>
          <p className="mx-auto mb-8 mt-2 max-w-md text-center text-muted">Gratis para siempre. Cuando quieras, pruebas Pro {DIAS_PRUEBA_MI} días sin pagar; si no eliges plan, vuelves a Gratis y no pierdes nada de lo que anotaste.</p>
          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-6">
              <p className="versalitas text-muted">Gratis</p>
              <p className="serif mt-1 text-5xl">$0</p>
              <p className="text-sm text-muted">para siempre</p>
              <ul className="mt-5 flex flex-col gap-2 text-sm">{GRATIS_MI.map((b) => <li key={b} className="flex gap-2"><span className="text-muted">✓</span>{b}</li>)}</ul>
            </div>
            <div className="rounded-2xl border-2 border-accent bg-panel p-6 shadow-[0_20px_40px_-28px_rgba(120,50,30,0.6)]">
              <p className="versalitas text-accent">Pro</p>
              <p className="serif mt-1 text-5xl">{planes ? pesos(planes[0].precio) : "—"}<span className="text-lg text-muted"> /mes</span></p>
              <p className="text-sm text-muted">{planes && planes.length > 1 ? `o ${planes.slice(1).map((p: PlanMi) => `${pesos(p.precio)} ${p.meses === 12 ? "al año" : `cada ${p.meses} meses`}`).join(" · ")}` : "\u00a0"}</p>
              <ul className="mt-5 flex flex-col gap-2 text-sm">
                <li className="flex gap-2 text-muted"><span>✓</span>Todo lo de Gratis, y además:</li>
                {BENEFICIOS_MI_PRO.map((b) => <li key={b} className="flex gap-2"><span className="text-accent">✓</span>{b}</li>)}
              </ul>
              <Link href="/mi-agenda/registro" className="btn btn-primario mt-6 w-full rounded-full py-3">Empieza gratis y pruébalo {DIAS_PRUEBA_MI} días</Link>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-lg text-center text-xs text-muted">Se paga por transferencia, sin tarjeta y sin cargos automáticos: nunca se te cobra nada que no pagues tú. ¿Eres de odonto y tu agenda de clínicas es Pro? Tu Mi agenda también, sin pagar extra.</p>
        </section>

        {/* ---------- Crea la tuya ---------- */}
        <section className="border-t border-line py-14 text-center">
          <h2 className="serif text-5xl">¿Le entras?</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">Tarda un minuto. Sin tarjeta.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/mi-agenda/registro" className="btn btn-primario rounded-full px-6 py-3 text-base">Crear mi agenda</Link>
            <Link href="/login?a=mi" className="btn btn-sec rounded-full px-6 py-3 text-base">Ya tengo cuenta</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        <p className="serif text-base italic">Mi agenda · sólo tú la ves</p>
        <p className="mt-2">
          <Link href="/privacidad#mi-agenda" className="hover:text-ink">Aviso de privacidad</Link> · <Link href="/terminos#mi-agenda" className="hover:text-ink">Términos</Link> ·{" "}
          <Link href="/login?a=mi" className="hover:text-ink">Entrar</Link>
        </p>
      </footer>
    </div>
  );
}

/** Una página de Mi agenda dibujada (no son datos reales). */
function Muestra() {
  const fila = (color: string, hora: string, t: string, gris = false) => (
    <div className={`grid grid-cols-[3rem_1rem_1fr] items-center ${gris ? "opacity-50" : ""}`}>
      <span className="serif text-base tabular-nums">{hora}</span>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="truncate rounded-lg border border-line bg-panel px-2.5 py-1.5 text-sm">{t}</span>
    </div>
  );
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <div className="rotate-[1.5deg] rounded-[2rem] border border-line bg-bg p-5 shadow-[0_30px_60px_-30px_rgba(60,40,20,0.55)]">
        <p className="versalitas text-muted">Hola, Ema</p>
        <p className="serif mt-1 text-5xl leading-none">Viernes</p>
        <p className="serif mt-1 text-lg italic text-accent">24 de octubre</p>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {fila("#9333ea", "07:00", "Gym", true)}
          <div className="grid grid-cols-[3rem_1rem_1fr] items-center">
            <span className="versalitas text-accent">09:20</span>
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="h-px bg-accent/70" />
          </div>
          {fila("#2563eb", "10:00", "Junta de equipo")}
          {fila("#059669", "18:00", "Clase de inglés")}
        </div>
        <div className="nota mt-4 -rotate-1 rounded-sm px-3.5 py-2.5 text-sm">
          <p className="serif text-lg">Por entregar</p>
          <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-current opacity-60" />Reporte mensual <span className="ml-auto text-xs font-bold">mañana</span></p>
        </div>
        <div className="mt-4 flex overflow-hidden rounded-xl border border-line bg-panel">
          <span className="w-1.5 bg-[#ea580c]" />
          <span className="flex-1 px-3 py-2">
            <span className="versalitas block text-muted">Pase de abordar</span>
            <span className="serif text-2xl uppercase leading-none">Cancún</span>
          </span>
          <span className="boleto-corte grid w-20 place-items-center text-center">
            <span><span className="serif block text-3xl leading-none text-accent">9</span><span className="text-xs text-muted">días</span></span>
          </span>
        </div>
      </div>
    </div>
  );
}
