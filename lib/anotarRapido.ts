// 2.6 · Anotar rápido: "cena con Ana el viernes 9pm en La Chaya" → evento con fecha, hora y lugar.
// Sin IA y sin internet: reglas en español de México. Siempre se revisa antes de guardar.

import { sumarDias } from "@/lib/pagos";
import type { Repetir, TipoEvento } from "@/lib/personal";

export type Borrador = {
  clase: "evento" | "pendiente"; // pendiente → va a Pendientes
  tipo: TipoEvento;
  titulo: string;
  fecha: string | null; // null: no dijo cuándo (se usa hoy al revisar)
  fecha_fin: string | null;
  hora_inicio: string | null; // "HH:MM"
  hora_fin: string | null;
  lugar: string | null;
  repetir: Repetir;
};

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6,
  jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};
const RE_MES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic)\\.?";
const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const RE_DIA = "(lunes|martes|miercoles|jueves|viernes|sabado|domingo)";
const NUM: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, diez: 10, quince: 15 };
const RE_SUF = "(am|pm|a\\.\\s?m\\.?|p\\.\\s?m\\.?|hrs?|h)";
const RE_PERIODO = "(?:\\s*(?:de|en|por)\\s+la\\s+(manana|tarde|noche)|\\s*del\\s+mediodia)";

/** Quita acentos letra por letra (así las posiciones coinciden con el texto original). */
const normalizar = (s: string) =>
  [...s].map((c) => (c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() || " ")[0]).join("");

const diaSemana = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const valida = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
/** El próximo día de la semana (hoy no cuenta: "el viernes" en viernes es el de la otra semana). */
const proximo = (hoy: string, dow: number, incluirHoy = false) => {
  const n = (dow - diaSemana(hoy) + 7) % 7;
  return sumarDias(hoy, n === 0 && !incluirHoy ? 7 : n);
};
/** "12 de nov" sin año: este año, o el que sigue si ya pasó. */
const conAnio = (hoy: string, m: number, d: number, y?: number) => {
  const a = y ?? Number(hoy.slice(0, 4));
  if (!valida(a, m, d)) return null;
  const f = iso(a, m, d);
  if (y == null && f < hoy) return valida(a + 1, m, d) ? iso(a + 1, m, d) : null;
  return f;
};

function hora(hStr: string, mStr: string | undefined, suf: string | undefined, periodo: string | undefined): string | null {
  let h = Number(hStr);
  const m = mStr ? Number(mStr) : 0;
  if (Number.isNaN(h) || h > 23 || m > 59) return null;
  const s = (suf ?? "").replace(/[\s.]/g, "");
  const pm = s === "pm" || periodo === "tarde" || periodo === "noche";
  const am = s === "am" || periodo === "manana";
  if (pm && h < 12) h += 12;
  else if (am && h === 12) h = 0;
  else if (!pm && !am && !s.startsWith("h") && h >= 1 && h <= 7) h += 12; // "a las 4" casi siempre es de la tarde
  if (periodo === "noche" && h === 24) h = 0;
  return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
const masUnaHora = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h >= 23 ? null : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export function anotarRapido(texto: string, hoy: string): Borrador {
  const o = texto.replace(/\s+/g, " ").trim();
  const n = normalizar(o);
  const usado = new Array<boolean>(o.length).fill(false);
  const libre = (i: number, j: number) => usado.slice(i, j).every((u) => !u);
  const marcar = (i: number, j: number) => { for (let k = i; k < j; k++) usado[k] = true; };
  /** Busca un patrón en lo que queda libre; si `f` regresa algo distinto de false, marca el pedazo. */
  function buscar(re: RegExp, f: (m: RegExpExecArray) => boolean | void) {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(n))) {
      if (!m[0].length) { g.lastIndex++; continue; }
      if (libre(m.index, m.index + m[0].length) && f(m) !== false) { marcar(m.index, m.index + m[0].length); return true; }
    }
    return false;
  }

  const b: Borrador = { clase: "evento", tipo: "evento", titulo: "", fecha: null, fecha_fin: null, hora_inicio: null, hora_fin: null, lugar: null, repetir: "nunca" };
  let quitarPrefijo = false;

  // 1. ¿Qué es? (por cómo empieza)
  buscar(/^(?:pendiente|por hacer|tarea|to ?do)\s*:?\s+/, () => { b.clase = "pendiente"; });
  buscar(/^(?:recuerdame|recordarme|recordar|acuerdame|recordatorio\s*:?)\s+(?:que\s+)?/, () => { b.tipo = "recordatorio"; });
  buscar(/^(?:entregar|entrega(?:\s+de(?:l)?)?\s*:?)\s+/, () => { b.tipo = "entrega"; });
  if (/^(?:viaje|viajo|me voy|vuelo)\s+(?:a|al|para)\s+/.test(n)) {
    b.tipo = "viaje";
    quitarPrefijo = true;
  }

  // 2. ¿Se repite?
  buscar(new RegExp(`\\b(?:todos\\s+los|cada)\\s+${RE_DIA}s?\\b`), (m) => { b.repetir = "semanal"; b.fecha = proximo(hoy, DIAS[m[1]], true); });
  buscar(/\b(?:todos\s+los\s+dias|cada\s+dia|diario|diariamente)\b/, () => { b.repetir = "diario"; });
  buscar(/\b(?:cada\s+(?:15|quince)\s+dias|quincenal(?:mente)?)\b/, () => { b.repetir = "quincenal"; });
  buscar(/\b(?:cada\s+semana|todas\s+las\s+semanas|semanal(?:mente)?)\b/, () => { b.repetir = "semanal"; });
  buscar(/\b(?:cada\s+mes|todos\s+los\s+meses|mensual(?:mente)?)\b/, () => { b.repetir = "mensual"; });
  buscar(/\b(?:cada\s+ano|todos\s+los\s+anos|anual(?:mente)?)\b/, () => { b.repetir = "anual"; });

  // 3. Hora: rangos ("de 4 a 6pm", "10:00-12:00") y luego una sola
  buscar(new RegExp(`\\b(de\\s+(?:las?\\s+)?|entre\\s+(?:las?\\s+)?|desde\\s+(?:las?\\s+)?)?(\\d{1,2})(?::(\\d{2}))?\\s*${RE_SUF}?\\s*(?:a|-|–|hasta|y)\\s*(?:las?\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*${RE_SUF}?${RE_PERIODO}?(?![\\d/])`), (m) => {
    const [, pre, h1, m1, s1, h2, m2, s2, per] = m;
    if (!pre && !m1 && !s1 && !s2 && !per) return false; // "3 a 5" suelto puede ser cualquier cosa
    if (/\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|sep|oct|nov|dic)/.test(n.slice(m.index + m[0].length, m.index + m[0].length + 14))) return false; // "del 3 al 7 de nov"
    const fin = hora(h2, m2, s2, per);
    let ini = hora(h1, m1, s1 ?? (s2 && !s2.startsWith("h") ? s2 : undefined), s1 ? undefined : per);
    if (!ini || !fin) return false;
    if (ini >= fin && !s1 && Number(h1) < 12) ini = hora(String(Number(h1) + 12), m1, "h", undefined); // "de 11 a 1" → 11-13 ya sale; "de 4 a 6pm" → 16-18
    if (!ini || ini >= fin) return false;
    b.hora_inicio = ini;
    b.hora_fin = fin;
  });
  if (!b.hora_inicio) {
    buscar(new RegExp(`\\b(a\\s+las?\\s+|a\\s+la\\s+|las\\s+|tipo\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*${RE_SUF}?${RE_PERIODO}?(?![\\d/])(?!\\s+de\\s+${RE_MES})`), (m) => {
      const [, pre, h, mm, suf, per] = m;
      if (!pre && !mm && !suf && !per && !/mediodia/.test(m[0])) return false;
      const r = hora(h, mm, suf, per);
      if (!r) return false;
      b.hora_inicio = r;
    });
  }
  if (!b.hora_inicio) buscar(/\b(?:al\s+|a\s+)?mediodia\b/, () => { b.hora_inicio = "12:00"; });
  // "en la noche" sin hora: sólo se quita del título
  buscar(/\b(?:en|por|de)\s+la\s+(?:manana|tarde|noche)\b/, () => {});

  // 4. Fecha: rangos de viaje, relativas, días de la semana, fechas exactas
  if (!b.fecha) {
    buscar(new RegExp(`\\b(?:del|de)\\s+(\\d{1,2})(?:\\s+de\\s+${RE_MES})?\\s+(?:al|a|hasta\\s+el)\\s+(\\d{1,2})\\s+de\\s+${RE_MES}(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`), (m) => {
      const [, d1, mes1, d2, mes2, y] = m;
      const m2n = MESES[mes2];
      const m1n = mes1 ? MESES[mes1] : m2n;
      const fin = conAnio(hoy, m2n, Number(d2), y ? Number(y) : undefined);
      if (!fin) return false;
      let ini = iso(Number(fin.slice(0, 4)) - (m1n > m2n ? 1 : 0), m1n, Number(d1));
      if (!valida(Number(ini.slice(0, 4)), m1n, Number(d1)) || ini > fin) return false;
      b.fecha = ini;
      b.fecha_fin = fin;
    });
  }
  if (!b.fecha) buscar(/\bpasado\s+manana\b/, () => { b.fecha = sumarDias(hoy, 2); });
  if (!b.fecha) buscar(/(?<!la\s)\bmanana\b/, () => { b.fecha = sumarDias(hoy, 1); });
  if (!b.fecha) buscar(/\b(?:hoy|esta\s+noche|hoy\s+en\s+la\s+noche)\b/, () => { b.fecha = hoy; });
  if (!b.fecha)
    buscar(/\ben\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|diez|quince)\s+(dias?|semanas?|mes(?:es)?)\b/, (m) => {
      const k = Number(m[1]) || NUM[m[1]];
      if (!k) return false;
      if (m[2].startsWith("mes")) {
        const [y, mo, d] = hoy.split("-").map(Number);
        const t = new Date(Date.UTC(y, mo - 1 + k, 1));
        b.fecha = iso(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()));
      } else b.fecha = sumarDias(hoy, k * (m[2].startsWith("semana") ? 7 : 1));
    });
  if (!b.fecha) buscar(/\b(?:la\s+)?(?:proxima\s+semana|semana\s+que\s+viene|siguiente\s+semana)\b/, () => { b.fecha = proximo(hoy, 1); });
  if (!b.fecha) buscar(/\b(?:este\s+|el\s+)?fin(?:de)?\s*(?:de\s+)?semana\b/, () => { b.fecha = proximo(hoy, 6, true); });
  if (!b.fecha)
    buscar(new RegExp(`\\b(?:el\\s+|este\\s+|el\\s+proximo\\s+|proximo\\s+|el\\s+siguiente\\s+|para\\s+el\\s+)?${RE_DIA}(\\s+que\\s+viene|\\s+proximo|\\s+de\\s+la\\s+otra\\s+semana)?\\b`), (m) => {
      b.fecha = proximo(hoy, DIAS[m[1]], !m[2] && !/proximo|siguiente/.test(m[0]) ? true : false);
      // "el viernes" dicho en viernes: hoy mismo sólo si dijo "este"; si no, el de la otra semana
      if (b.fecha === hoy && !/\beste\b/.test(m[0])) b.fecha = sumarDias(hoy, 7);
    });
  if (!b.fecha)
    buscar(new RegExp(`\\b(?:el\\s+|para\\s+el\\s+)?(\\d{1,2})\\s+de\\s+${RE_MES}(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`), (m) => {
      const f = conAnio(hoy, MESES[m[2]], Number(m[1]), m[3] ? Number(m[3]) : undefined);
      if (!f) return false;
      b.fecha = f;
    });
  if (!b.fecha)
    buscar(/\b(?:el\s+|para\s+el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
      const f = conAnio(hoy, Number(m[2]), Number(m[1]), y);
      if (!f) return false;
      b.fecha = f;
    });
  if (!b.fecha)
    buscar(/\b(?:el|para\s+el)\s+(?:dia\s+)?(\d{1,2})\b/, (m) => {
      const d = Number(m[1]);
      const [y, mo] = hoy.split("-").map(Number);
      let f = valida(y, mo, d) ? iso(y, mo, d) : null;
      if (!f || f < hoy) {
        const t = new Date(Date.UTC(y, mo, 1));
        f = valida(t.getUTCFullYear(), t.getUTCMonth() + 1, d) ? iso(t.getUTCFullYear(), t.getUTCMonth() + 1, d) : null;
      }
      if (!f) return false;
      b.fecha = f;
    });

  // "el jueves 3" / "mañana 10": el número pegado al día es la hora
  if (!b.hora_inicio && b.fecha)
    buscar(/(?<=\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|hoy)\s)(\d{1,2})(?::(\d{2}))?\b(?!\s*(?:de\b|\/))/, (m) => {
      const r = hora(m[1], m[2], undefined, undefined);
      if (!r) return false;
      b.hora_inicio = r;
      if (b.tipo === "evento") b.hora_fin = null;
    });

  // 5. Lugar: "en …" o "@ …" hasta donde empieza la fecha u hora (o el final)
  const resto = [...n].map((c, i) => (usado[i] ? "|" : c)).join("");
  const reLugar = /(?:^|\s|\|)(?:en|@)\s+(?!la\s+(?:manana|tarde|noche)\b)([^|]+?)\s*(?=\||$)/g;
  let ml: RegExpExecArray | null;
  let lugar: { i: number; j: number; t: string } | null = null;
  while ((ml = reLugar.exec(resto))) {
    const t = ml[1].trim().replace(/[,.;]+$/, "");
    if (t.length >= 3 && !/^\d/.test(t)) {
      const i = ml.index + ml[0].indexOf(ml[1]);
      lugar = { i: ml.index, j: i + ml[1].length, t: o.slice(i, i + ml[1].length).trim().replace(/[,.;]+$/, "") };
    }
  }
  if (lugar && b.tipo !== "viaje") {
    // Que quede título: si "en" era todo, no es lugar
    const sin = [...o].filter((_, k) => !usado[k] && (k < lugar!.i || k >= lugar!.j)).join("").trim();
    if (sin.length >= 2) {
      b.lugar = lugar.t;
      marcar(lugar.i, lugar.j);
    }
  }

  // 6. Título: lo que sobró, sin conectores sueltos
  let t = [...o].map((c, k) => (usado[k] ? " " : c)).join("").replace(/\s+/g, " ").trim();
  if (quitarPrefijo) t = t.replace(/^(?:viaje|viajo|me voy|vuelo)\s+(?:a|al|para)\s+/i, "");
  const CONECTOR = /^(?:el|la|los|las|de|del|a|al|en|para|y|que|con|desde|hasta|este|esta|,|-)$/i;
  let palabras = t.split(" ").filter(Boolean);
  while (palabras.length > 1 && CONECTOR.test(normalizar(palabras[palabras.length - 1]))) palabras.pop();
  while (palabras.length > 1 && /^(?:el|la|a|de|para|que|,|-)$/i.test(normalizar(palabras[0]))) palabras.shift();
  t = palabras.join(" ").replace(/[\s,;:.-]+$/, "").replace(/^[\s,;:.-]+/, "");
  b.titulo = t ? t[0].toUpperCase() + t.slice(1) : "";

  // 7. Ajustes finales
  if (/\b(?:cumple|cumpleanos|aniversario)\b/.test(normalizar(b.titulo)) && b.repetir === "nunca" && b.tipo === "evento") b.repetir = "anual";
  if (b.tipo === "entrega" || b.tipo === "viaje") { b.hora_inicio = null; b.hora_fin = null; }
  if (b.tipo !== "viaje") b.fecha_fin = null;
  if (b.tipo === "evento" && b.hora_inicio && !b.hora_fin) b.hora_fin = masUnaHora(b.hora_inicio);
  if (b.clase === "pendiente") { b.hora_inicio = null; b.hora_fin = null; b.repetir = "nunca"; b.lugar = null; }
  return b;
}
