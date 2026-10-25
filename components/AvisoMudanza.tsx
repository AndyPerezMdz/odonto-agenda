"use client";

import { useEffect, useRef, useState } from "react";

// 3.3 · ¡Estrenamos casa! La primera vez que alguien entra en laagendita.app: pantalla con confeti.
// Una sola vez por navegador, hasta fin de año, y sólo en la dirección nueva.

const HASTA = "2026-12-31";
const LLAVE = "fiesta-laagendita"; // (llave nueva: la del aviso anterior ya la tenían quienes lo cerraron)
const COLORES = ["#f0a37f", "#2f5d50", "#b4472e", "#e8c36a", "#7fb7a6", "#fbf8f2"];

export default function AvisoMudanza() {
  const [ver, setVer] = useState(false);
  const [host, setHost] = useState("");
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sitio = process.env.NEXT_PUBLIC_SITE_URL;
    let canon = "";
    try { canon = sitio ? new URL(sitio).host : ""; } catch {}
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Merida" });
    let visto = false;
    try { visto = localStorage.getItem(LLAVE) === "1"; } catch {}
    if (canon && location.host === canon && !canon.endsWith(".vercel.app") && hoy <= HASTA && !visto) {
      setHost(location.host);
      setVer(true);
    }
  }, []);

  // Confeti (sin librerías). Si la persona pidió menos movimiento, no hay confeti.
  useEffect(() => {
    if (!ver || !lienzo.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = lienzo.current;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ajustar = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    ajustar();
    window.addEventListener("resize", ajustar);
    type P = { x: number; y: number; vx: number; vy: number; r: number; giro: number; vg: number; w: number; h: number; color: string; forma: number };
    const nuevas = (n: number, desde: "arriba" | "lados"): P[] =>
      Array.from({ length: n }, () => {
        const izq = Math.random() < 0.5;
        return {
          x: desde === "arriba" ? Math.random() * c.width : izq ? 0 : c.width,
          y: desde === "arriba" ? -20 * dpr - Math.random() * c.height * 0.3 : c.height * (0.55 + Math.random() * 0.2),
          vx: desde === "arriba" ? (Math.random() - 0.5) * 2 * dpr : (izq ? 1 : -1) * (6 + Math.random() * 8) * dpr,
          vy: desde === "arriba" ? (2 + Math.random() * 3) * dpr : -(10 + Math.random() * 9) * dpr,
          r: Math.random() * Math.PI,
          giro: 0,
          vg: (Math.random() - 0.5) * 0.3,
          w: (6 + Math.random() * 6) * dpr,
          h: (9 + Math.random() * 8) * dpr,
          color: COLORES[Math.floor(Math.random() * COLORES.length)],
          forma: Math.random(),
        };
      });
    let ps = [...nuevas(90, "lados"), ...nuevas(70, "arriba")];
    let raf = 0;
    let segunda = false;
    const inicio = performance.now();
    const paso = (t: number) => {
      g.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        p.vy += 0.18 * dpr;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vg;
        p.giro += 0.12;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.scale(1, Math.cos(p.giro)); // efecto de que da vueltas
        g.fillStyle = p.color;
        if (p.forma < 0.25) {
          g.beginPath();
          g.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          g.fill();
        } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      ps = ps.filter((p) => p.y < c.height + 40 * dpr);
      // Una segunda lluvia al segundo y medio
      if (!segunda && t - inicio > 1500) {
        segunda = true;
        ps.push(...nuevas(60, "arriba"));
      }
      if (ps.length) raf = requestAnimationFrame(paso);
      else g.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", ajustar);
    };
  }, [ver]);

  if (!ver) return null;
  const listo = () => {
    try { localStorage.setItem(LLAVE, "1"); } catch {}
    setVer(false);
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Nos mudamos">
      <canvas ref={lienzo} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden />
      <div className="relative w-full max-w-sm animate-[aparecer_.45s_ease-out] rounded-3xl border border-line bg-panel p-6 text-center shadow-2xl">
        <p className="text-5xl" aria-hidden>🎉🏡</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">¡Estrenamos casa!</p>
        <h2 className="mt-1 text-2xl font-bold leading-tight">Ahora somos<br /><span className="text-accent">{host}</span></h2>
        <p className="mt-3 text-sm text-muted">Tu agenda es la misma, con todo lo tuyo. Sólo cambió la dirección, y está más fácil de recordar.</p>
        <ul className="mt-4 flex flex-col gap-2 rounded-2xl bg-panel-2 p-3 text-left text-sm">
          <li>⭐ <b>Guárdala en favoritos:</b> {host}</li>
          <li>📲 <b>¿Tenías la app en tu pantalla de inicio?</b> Bórrala e instálala otra vez desde aquí.</li>
          <li>🔔 <b>Tus avisos del cel siguen llegando:</b> no tienes que hacer nada.</li>
        </ul>
        <button onClick={listo} className="btn btn-primario mt-5 w-full rounded-full py-2.5 text-base">¡Va, a seguirle! 🎊</button>
      </div>
      <style>{`@keyframes aparecer{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
