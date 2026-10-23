import { describe, expect, it } from "vitest";
import { anotarRapido } from "@/lib/anotarRapido";

// "Anotar rápido" de Mi agenda. Hoy = jueves 22 de octubre de 2026.
const HOY = "2026-10-22";
const a = (t: string) => anotarRapido(t, HOY);

describe("anotar rápido · fecha, hora y lugar", () => {
  it("cena con Ana el viernes 9pm", () => {
    expect(a("cena con Ana el viernes 9pm")).toMatchObject({ tipo: "evento", titulo: "Cena con Ana", fecha: "2026-10-23", hora_inicio: "21:00", hora_fin: "22:00" });
  });
  it("lugar y “de la noche”", () => {
    expect(a("Cena con Ana en La Chaya Maya el viernes a las 9 de la noche")).toMatchObject({ titulo: "Cena con Ana", hora_inicio: "21:00", lugar: "La Chaya Maya" });
  });
  it("“a las 4” es de la tarde y el lugar va después de la hora", () => {
    expect(a("dentista el 12 de nov a las 4:30 en Plaza Altabrisa")).toMatchObject({ titulo: "Dentista", fecha: "2026-11-12", hora_inicio: "16:30", lugar: "Plaza Altabrisa" });
  });
  it("mañana, hoy, en N días, fin de semana", () => {
    expect(a("café con Luis mañana a las 10 de la mañana")).toMatchObject({ fecha: "2026-10-23", hora_inicio: "10:00" });
    expect(a("doctor hoy 17:30")).toMatchObject({ fecha: HOY, hora_inicio: "17:30" });
    expect(a("llamar al banco en 3 días")).toMatchObject({ fecha: "2026-10-25" });
    expect(a("partido el fin de semana")).toMatchObject({ fecha: "2026-10-24" });
  });
  it("rangos de hora", () => {
    expect(a("junta de 4 a 6pm en la oficina")).toMatchObject({ hora_inicio: "16:00", hora_fin: "18:00", lugar: "la oficina" });
    expect(a("clase de inglés cada martes de 18:00 a 19:30")).toMatchObject({ hora_inicio: "18:00", hora_fin: "19:30", repetir: "semanal", fecha: "2026-10-27" });
  });
  it("el número pegado al día es la hora", () => {
    expect(a("reunión jueves 3")).toMatchObject({ titulo: "Reunión", fecha: "2026-10-29", hora_inicio: "15:00" });
  });
  it("“en ti” no es un lugar", () => {
    expect(a("Pensar en ti")).toMatchObject({ titulo: "Pensar en ti", lugar: null });
  });
});

describe("anotar rápido · qué es", () => {
  it("entregas, recordatorios, pendientes y viajes", () => {
    expect(a("entregar reporte de prácticas mañana")).toMatchObject({ tipo: "entrega", titulo: "Reporte de prácticas", hora_inicio: null });
    expect(a("recuérdame pagar la luz el lunes 10am")).toMatchObject({ tipo: "recordatorio", titulo: "Pagar la luz", fecha: "2026-10-26", hora_inicio: "10:00" });
    expect(a("pendiente: comprar café")).toMatchObject({ clase: "pendiente", titulo: "Comprar café" });
    expect(a("viaje a Cancún del 31 de oct al 3 de nov")).toMatchObject({ tipo: "viaje", titulo: "Cancún", fecha: "2026-10-31", fecha_fin: "2026-11-03" });
  });
  it("se repite", () => {
    expect(a("gym todos los lunes 7am")).toMatchObject({ repetir: "semanal", fecha: "2026-10-26", hora_inicio: "07:00" });
    expect(a("tomar pastilla diario 8am")).toMatchObject({ repetir: "diario" });
    expect(a("Cumple de mamá 26 de octubre")).toMatchObject({ repetir: "anual", fecha: "2026-10-26" });
  });
  it("pagos fijos (sólo si se repiten)", () => {
    expect(a("pagar la renta el 5 de cada mes $6,500")).toMatchObject({ clase: "pago", titulo: "Renta", monto: 6500, repetir: "mensual", fecha: "2026-11-05" });
    expect(a("Netflix $199 cada mes")).toMatchObject({ clase: "pago", titulo: "Netflix", monto: 199 });
    expect(a("pagar tarjeta 15/11")).toMatchObject({ clase: "evento", titulo: "Pagar tarjeta", monto: null });
  });
});
