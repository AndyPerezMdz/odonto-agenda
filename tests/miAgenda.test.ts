import { describe, expect, it } from "vitest";
import { mejorRacha, rachaActual, tocaHabito, ocurrencias, type PEvento, type PHabito } from "@/lib/personal";
import { pagosPorAtender, totalMes, vencimientos, type PPagoFijo } from "@/lib/viajesPagos";
import { novedadesSinVer, NOVEDADES_MI } from "@/lib/novedadesMi";

const HOY = "2026-10-22"; // jueves

describe("hábitos y rachas", () => {
  const h: PHabito = { id: "h", user_id: "u", nombre: "Gym", color: "#000", dias: [1, 2, 3, 4, 5], orden: 0, archivado: false, created_at: "2026-09-01T00:00:00Z" };
  it("sólo toca entre semana", () => {
    expect(tocaHabito(h, "2026-10-24")).toBe(false); // sábado
    expect(tocaHabito(h, "2026-10-26")).toBe(true); // lunes
  });
  it("hoy sin palomear no rompe la racha; el fin de semana no cuenta", () => {
    const marcas = new Set(["2026-10-21", "2026-10-20", "2026-10-19", "2026-10-16"]); // mié, mar, lun y el viernes anterior
    expect(rachaActual(h, marcas, HOY)).toBe(4);
    expect(mejorRacha(h, marcas, HOY)).toBe(4);
  });
  it("un día que tocaba sin palomear sí la rompe", () => {
    expect(rachaActual(h, new Set(["2026-10-21", "2026-10-19"]), HOY)).toBe(1);
  });
});

describe("cada año", () => {
  it("un cumpleaños sale cada año, aunque se haya anotado hace mucho", () => {
    const e = { id: "e", user_id: "u", tipo: "evento", titulo: "Cumple", fecha: "2000-10-26", fecha_fin: null, hora_inicio: null, hora_fin: null, lugar: null, notas: null, categoria_id: null, hecho: false, hecho_at: null, repetir: "anual", repetir_hasta: null, excepciones: [] } as PEvento;
    expect(ocurrencias(e, "2026-10-01", "2026-10-31").map((o) => o.dia)).toEqual(["2026-10-26"]);
  });
});

describe("pagos fijos", () => {
  const p = (o: Partial<PPagoFijo>): PPagoFijo => ({ id: "p", user_id: "u", nombre: "Renta", monto: 100, frecuencia: "mensual", dia: 31, mes: null, avisar_dias: 3, desde: "2026-01-15", activo: true, notas: null, created_at: "", ...o });
  it("el 31 en meses cortos es el último día", () => {
    expect(vencimientos(p({}), "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("anual, con bisiestos", () => {
    expect(vencimientos(p({ frecuencia: "anual", dia: 29, mes: 2, desde: "2026-01-01" }), "2026-01-01", "2028-12-31")).toEqual(["2026-02-28", "2027-02-28", "2028-02-29"]);
  });
  it("sale en Hoy dentro de sus días de aviso y deja de salir al pagarlo", () => {
    const renta = p({ dia: 24, desde: "2026-10-01" });
    expect(pagosPorAtender([renta], [], HOY).map((v) => v.fecha)).toEqual(["2026-10-24"]);
    expect(pagosPorAtender([renta], [{ pago_id: "p", periodo: "2026-10-24", monto: 100, pagado_at: "" }], HOY)).toEqual([]);
  });
  it("total del mes", () => {
    const t = totalMes([p({ dia: 5, desde: "2026-01-01" })], [{ pago_id: "p", periodo: "2026-10-05", monto: 100, pagado_at: "" }], 2026, 9);
    expect(t).toMatchObject({ total: 100, pagado: 100, falta: 0 });
  });
});

describe("novedades", () => {
  it("a quien nunca vio nada le sale sólo la última; a quien vio la 2.5, lo de después", () => {
    expect(novedadesSinVer(undefined)).toHaveLength(1);
    expect(novedadesSinVer("2.5").map((v) => v.version)).toEqual(NOVEDADES_MI.filter((v) => !["2.4", "2.5"].includes(v.version)).map((v) => v.version));
    expect(novedadesSinVer("2.9").map((v) => v.version)).toEqual(["3.0"]);
  });
});
