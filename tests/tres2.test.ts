import { describe, expect, it } from "vitest";
import { comodinesDisponibles, rachaActual, rachaSalvable, type PHabito, type PMarca } from "@/lib/personal";
import { statsHabito } from "@/lib/statsHabito";
import { candidatosHueco } from "@/lib/whatsapp";

const HOY = "2026-10-24"; // sábado
const h: PHabito = { id: "h", user_id: "u", nombre: "Agua", color: "#000", dias: [0, 1, 2, 3, 4, 5, 6], orden: 0, archivado: false, created_at: "2026-10-01T00:00:00Z" };

describe("3.2 · comodín de racha", () => {
  const marcas = new Set(["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]); // falta el 23 (ayer)
  it("ayer se te pasó: con comodín salvas 6 días", () => {
    expect(rachaActual(h, marcas, HOY)).toBe(0);
    expect(rachaSalvable(h, marcas, HOY)).toBe(6);
    expect(rachaActual(h, new Set([...marcas, "2026-10-23"]), HOY)).toBe(6);
  });
  it("si ayer sí lo hiciste, no hay nada que salvar", () => {
    expect(rachaSalvable(h, new Set([...marcas, "2026-10-23"]), HOY)).toBe(0);
  });
  it("Gratis 1 al mes, Pro 1 por semana", () => {
    const usada: PMarca[] = [{ habito_id: "h", fecha: "2026-10-15", comodin: true, comodin_at: "2026-10-16T15:00:00Z" }];
    expect(comodinesDisponibles(usada, HOY, false)).toEqual({ quedan: 0, periodo: "este mes" });
    expect(comodinesDisponibles(usada, HOY, true)).toEqual({ quedan: 1, periodo: "esta semana" }); // fue la semana pasada
  });
  it("en las estadísticas el día del comodín no cuenta ni a favor ni en contra", () => {
    const con = new Set([...marcas, "2026-10-23"]);
    const s = statsHabito(h, con, HOY, 26, new Set(["2026-10-23"]));
    expect(s.racha).toBe(6);
    expect(s.total).toBe(5);
    expect(s.semanas[25].find((c) => c.fecha === "2026-10-23")).toMatchObject({ comodin: true, si: false });
  });
});

describe("3.2 · rellenar huecos", () => {
  const p = (id: string, o: Partial<{ owner_id: string; estado: string; materia_id: string | null; telefono: string | null; created_at: string }>) => ({ id, owner_id: "yo", estado: "pendiente", materia_id: null, telefono: "9991234567", created_at: "2026-10-01", ...o });
  it("tus pendientes; primero los de la materia y con teléfono", () => {
    const lista = candidatosHueco(
      [p("a", {}), p("b", { materia_id: "endo" }), p("c", { owner_id: "otro", materia_id: "endo" }), p("d", { estado: "agendado", materia_id: "endo" }), p("e", { materia_id: "endo", telefono: null }), p("f", { estado: "contactado" })],
      "yo",
      "endo"
    );
    expect(lista.map((x) => x.id)).toEqual(["b", "e", "a", "f"]);
  });
});
