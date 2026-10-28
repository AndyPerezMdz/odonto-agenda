// 3.6 · Idea de Itiel: cuando agendas a un paciente nuevo, salen dientes volando. 🦷
// DOM + Web Animations (sin librerías). Se apaga con "Reducir movimiento".

export function lluviaDientes(cuantos = 26) {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const capa = document.createElement("div");
  capa.setAttribute("aria-hidden", "true");
  capa.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden";
  document.body.appendChild(capa);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const g = H * 2.4; // gravedad (px/s²) proporcional a la pantalla
  let mas = 0;
  for (let i = 0; i < cuantos; i++) {
    const d = document.createElement("span");
    d.textContent = i % 7 === 6 ? "✨" : "🦷";
    const tam = 22 + Math.random() * 22;
    d.style.cssText = `position:absolute;left:${W / 2}px;top:${H * 0.72}px;font-size:${tam}px;line-height:1;will-change:transform,opacity;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    capa.appendChild(d);

    // Sale disparado hacia arriba en abanico y cae con gravedad, girando
    const angulo = ((Math.random() - 0.5) * 110 * Math.PI) / 180;
    const v = H * (0.9 + Math.random() * 0.75);
    const vx = Math.sin(angulo) * v * (W < 640 ? 0.55 : 0.8);
    const vy = -Math.cos(angulo) * v;
    const giro = (Math.random() - 0.5) * 900;
    const dur = 1.3 + Math.random() * 0.7;
    mas = Math.max(mas, dur);
    const pasos = 14;
    const cuadros: Keyframe[] = [];
    for (let k = 0; k <= pasos; k++) {
      const t = (k / pasos) * dur;
      const x = vx * t;
      const y = vy * t + 0.5 * g * t * t;
      cuadros.push({
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${(giro * t) / dur}deg) scale(${k === 0 ? 0.3 : 1})`,
        opacity: k > pasos * 0.75 ? 1 - (k - pasos * 0.75) / (pasos * 0.25) : 1,
      });
    }
    d.animate(cuadros, { duration: dur * 1000, delay: Math.random() * 90, easing: "linear", fill: "forwards" });
  }
  setTimeout(() => capa.remove(), mas * 1000 + 200);
}
