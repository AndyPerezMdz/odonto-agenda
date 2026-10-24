import { describe, expect, it } from "vitest";
import { anotarRapido } from "@/lib/anotarRapido";
import { huecosLibres, ocupadoDe, finBloque } from "@/lib/bloques";
import { linksDe, mapsDe, reunionDe } from "@/lib/links";
import { statsHabito } from "@/lib/statsHabito";
import { buscarMi } from "@/lib/buscarMi";
import { expandir, type PEvento, type PHabito, type PPendiente } from "@/lib/personal";

const HOY = "2026-10-22"; // jueves
const ev = (o: Partial<PEvento>): PEvento => ({ id: "e", user_id: "u", tipo: "evento", titulo: "x", fecha: HOY, fecha_fin: null, hora_inicio: null, hora_fin: null, lugar: null, notas: null, categoria_id: null, hecho: false, hecho_at: null, repetir: "nunca", repetir_hasta: null, excepciones: [], ...o });
const pe = (o: Partial<PPendiente>): PPendiente => ({ id: "p", user_id: "u", padre_id: null, titulo: "x", notas: null, lista: "hacer", fecha: null, hecho: false, hecho_at: null, orden: 0, created_at: HOY, ...o });

describe("3.0 · anotar rápido: prioridad, lista y bloques", () => {
  it("#lista y !! hacen un pendiente", () => {
    expect(anotarRapido("comprar focos #casa !!", HOY)).toMatchObject({ clase: "pendiente", titulo: "Comprar focos", etiqueta: "Casa", prioridad: 2 });
    expect(anotarRapido("urgente: llamar al banco mañana", HOY)).toMatchObject({ clase: "pendiente", titulo: "Llamar al banco", prioridad: 2, fecha: "2026-10-23" });
    expect(anotarRapido("estudiar para el examen !", HOY)).toMatchObject({ clase: "pendiente", prioridad: 1 });
  });
  it("con hora sigue siendo evento aunque diga importante al final", () => {
    expect(anotarRapido("junta con el jefe el lunes 10am importante", HOY)).toMatchObject({ clase: "evento", titulo: "Junta con el jefe", hora_inicio: "10:00", prioridad: 1 });
  });
  it("pendiente con hora = bloque", () => {
    expect(anotarRapido("pendiente: estudiar mañana de 4 a 6pm", HOY)).toMatchObject({ clase: "pendiente", fecha: "2026-10-23", hora_inicio: "16:00", hora_fin: "18:00" });
    expect(anotarRapido("pendiente: comprar café", HOY)).toMatchObject({ clase: "pendiente", hora_inicio: null });
  });
});

describe("3.0 · bloques de tiempo", () => {
  const ocs = expandir([ev({ id: "a", hora_inicio: "09:00:00", hora_fin: "11:00:00" }), ev({ id: "b", hora_inicio: "13:00:00" })], HOY, HOY);
  const pends = [pe({ id: "q", fecha: HOY, hora: "11:30:00", duracion: 30 })];
  it("ocupado: eventos (sin fin = 1 h) y bloques", () => {
    expect(ocupadoDe(ocs, pends, HOY)).toEqual([{ ini: 540, fin: 660 }, { ini: 690, fin: 720 }, { ini: 780, fin: 840 }]);
  });
  it("huecos de 1 h desde las 8:10", () => {
    expect(huecosLibres(ocupadoDe(ocs, pends, HOY), 60, 8 * 60 + 10)).toEqual([12 * 60, 14 * 60, 15 * 60, 16 * 60]);
  });
  it("huecos de 30 min caben antes de la junta", () => {
    expect(huecosLibres(ocupadoDe(ocs, pends, HOY), 30, 8 * 60, { max: 3 })).toEqual([8 * 60, 8 * 60 + 30, 11 * 60]);
  });
  it("fin del bloque", () => {
    expect(finBloque({ hora: "16:00:00", duracion: 90 })).toBe("17:30");
    expect(finBloque({ hora: "16:00", duracion: null })).toBe("17:00");
  });
});

describe("3.0 · links", () => {
  it("Zoom, Meet y webs", () => {
    const l = linksDe("Junta https://us02web.zoom.us/j/123?pwd=x.", "ver www.uady.mx/avisos y https://meet.google.com/abc-defg-hij");
    expect(l.map((x) => x.tipo)).toEqual(["zoom", "web", "meet"]);
    expect(l[0].url).toBe("https://us02web.zoom.us/j/123?pwd=x");
    expect(l[1].url).toBe("https://www.uady.mx/avisos");
    expect(reunionDe("nada", "https://teams.microsoft.com/l/meetup")?.etiqueta).toBe("Unirse a Teams");
  });
  it("cómo llegar sólo con lugares de verdad", () => {
    expect(mapsDe("La Chaya Maya")).toContain("query=La%20Chaya%20Maya");
    expect(mapsDe("Casa")).toBeNull();
    expect(mapsDe("https://zoom.us/j/1")).toBeNull();
  });
});

describe("3.0 · estadísticas de hábitos", () => {
  const h: PHabito = { id: "h", user_id: "u", nombre: "Gym", color: "#000", dias: [1, 2, 3, 4, 5], orden: 0, archivado: false, created_at: "2026-10-01T00:00:00Z" };
  // Hizo todos los días hábiles del 1 al 21 menos el 15
  const marcas = new Set<string>();
  for (let d = 1; d <= 21; d++) {
    const f = `2026-10-${String(d).padStart(2, "0")}`;
    const dow = new Date(f + "T12:00:00Z").getUTCDay();
    if (dow >= 1 && dow <= 5 && d !== 15) marcas.add(f);
  }
  const s = statsHabito(h, marcas, HOY);
  it("mes y racha", () => {
    // Días hábiles del 1 al 21 de octubre 2026: 15; hoy (jueves 22) sin palomear no cuenta en contra
    expect(s.mes).toEqual({ hechos: 14, tocaban: 15, pct: 93 });
    expect(s.racha).toBe(4); // 16, 19, 20, 21
    expect(s.mejor).toBe(10);
  });
  it("mapa: 26 columnas de lunes a domingo, la última trae hoy", () => {
    expect(s.semanas).toHaveLength(26);
    expect(s.semanas[25][0].fecha).toBe("2026-10-19");
    expect(s.semanas[25][3]).toMatchObject({ fecha: HOY, si: false, futuro: false });
    expect(s.semanas[25][4].futuro).toBe(true);
    expect(s.porDia[0].pct).toBeNull(); // domingo no toca
    expect(s.porDia[4].pct).toBe(67); // jueves: 1, 8 sí; 15 no
  });
});

describe("3.0 · buscador", () => {
  const datos = {
    hoy: HOY,
    eventos: [
      ev({ id: "1", titulo: "Cena con Ana", fecha: "2026-09-01", lugar: "La Chaya" }),
      ev({ id: "2", titulo: "Clase de inglés", fecha: "2026-09-01", repetir: "semanal" }),
      ev({ id: "3", titulo: "Café con Ána", fecha: "2026-11-02" }),
    ],
    pendientes: [pe({ id: "p1", titulo: "Regalo para Ana", etiqueta: "Compras" })],
    habitos: [],
    cosas: [],
    pagos: [],
  };
  it("sin acentos, lo que viene primero, luego lo pasado, al final sin fecha", () => {
    expect(buscarMi("ana", datos).map((r) => r.id)).toEqual(["3", "1", "p1"]);
  });
  it("todas las palabras; las series muestran la próxima vez", () => {
    expect(buscarMi("cena chaya", datos).map((r) => r.id)).toEqual(["1"]);
    expect(buscarMi("ingles", datos)[0].fecha).toBe("2026-10-27");
    expect(buscarMi("compras", datos)[0].id).toBe("p1");
  });
});
