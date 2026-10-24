// 3.0 · Links dentro de un evento: "Unirse a Zoom", "Abrir link" y "Cómo llegar".

export type LinkEvento = { url: string; tipo: "zoom" | "meet" | "teams" | "maps" | "web"; etiqueta: string };

const RE_URL = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

/** Los links que aparecen en el texto (lugar, notas…), sin repetir. */
export function linksDe(...textos: (string | null | undefined)[]): LinkEvento[] {
  const vistos = new Set<string>();
  const out: LinkEvento[] = [];
  for (const t of textos) {
    for (const m of (t ?? "").matchAll(RE_URL)) {
      const url = m[1].startsWith("www.") ? `https://${m[1]}` : m[1];
      if (vistos.has(url)) continue;
      vistos.add(url);
      let host = "";
      try { host = new URL(url).hostname.toLowerCase(); } catch { continue; }
      const esMapa = host === "maps.app.goo.gl" || /^maps\.google\./.test(host) || (/(^|\.)google\.[a-z.]+$/.test(host) && /\/maps\b/.test(url));
      const tipo: LinkEvento["tipo"] = /(^|\.)zoom\.us$/.test(host) ? "zoom" : host === "meet.google.com" ? "meet" : /(^|\.)teams\.(microsoft|live)\.com$/.test(host) ? "teams" : esMapa ? "maps" : "web";
      const etiqueta = tipo === "zoom" ? "Unirse a Zoom" : tipo === "meet" ? "Unirse a Meet" : tipo === "teams" ? "Unirse a Teams" : tipo === "maps" ? "Abrir mapa" : `Abrir ${host.replace(/^www\./, "")}`;
      out.push({ url, tipo, etiqueta });
    }
  }
  return out;
}

/** El primer link de videollamada (para el botón "Unirse" en Hoy). */
export const reunionDe = (...textos: (string | null | undefined)[]) => linksDe(...textos).find((l) => l.tipo === "zoom" || l.tipo === "meet" || l.tipo === "teams") ?? null;

/** "Cómo llegar" en Google Maps (si el lugar no es un link). */
export const mapsDe = (lugar: string | null | undefined) => {
  const l = (lugar ?? "").trim();
  if (l.length < 3 || /(https?:\/\/|www\.)/i.test(l) || /^(casa|en casa|mi casa|online|en l[ií]nea|virtual|zoom|meet|teams)$/i.test(l)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l)}`;
};
