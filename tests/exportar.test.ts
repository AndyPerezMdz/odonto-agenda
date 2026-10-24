import { describe, expect, it } from "vitest";
import { libroXlsx, letra } from "@/lib/xlsx";
import { paginaMiAgenda, tablasMiAgenda, type DatosExportados } from "@/lib/miExport";

const d: DatosExportados = {
  exportado: "2026-10-23T20:00:00Z",
  cuenta: { correo: "ema@correo.com", nombre: "Ema", perfil: "general", created_at: "2026-09-01T00:00:00Z", pagado_hasta: "2026-12-01", prueba_hasta: null },
  eventos: [{ id: "e1", tipo: "evento", titulo: "Cena <con> Ana", fecha: "2026-10-26", hora_inicio: "21:00:00", repetir: "semanal", categoria_id: "c1" }],
  categorias: [{ id: "c1", nombre: "Personal" }],
  pendientes: [{ id: "p1", titulo: "Pagar gas", lista: "hacer", prioridad: 2, etiqueta: "Casa", hecho: false }, { id: "p2", titulo: "Llamar", padre_id: "p1", hecho: true }],
  habitos: [{ id: "h1", nombre: "Gym", dias: [1, 2, 3, 4, 5], created_at: "2026-10-01T00:00:00Z" }],
  habito_marcas: [{ habito_id: "h1", fecha: "2026-10-22" }, { habito_id: "h1", fecha: "2026-10-21" }],
  viajes_itinerario_maleta_reservas_gastos: [], pagos_fijos: [{ id: "f1", nombre: "Renta", monto: "6500", frecuencia: "mensual", dia: 5 }],
  pagos_fijos_hechos: [{ pago_id: "f1", periodo: "2026-10-05", monto: 6500, pagado_at: "2026-10-04T10:00:00Z" }], pagos_de_tu_plan: [],
  compartiste_con: [{ evento_id: "e1", correo: "ana@correo.com", created_at: "2026-10-20T00:00:00Z" }],
};

describe("exportar · Excel y página para leer", () => {
  it("tablas legibles", () => {
    const t = Object.fromEntries(tablasMiAgenda(d, "2026-10-23").map((h) => [h.nombre, h]));
    expect(t.Eventos.filas[0]).toEqual(["Evento", "Cena <con> Ana", "2026-10-26", "", "21:00", "", "", "Personal", "Cada semana", "", "", ""]);
    expect(t.Pendientes.filas.map((f) => [f[0], f[3], f[8]])).toEqual([["Pagar gas", "Urgente", ""], ["Llamar", "", "Pagar gas"]]);
    expect(t["Hábitos"].filas[0].slice(0, 6)).toEqual(["Gym", "lun mar mié jue vie", "", 2, 2, 2]);
    expect(t["Pagos hechos"].filas[0]).toEqual(["Renta", "2026-10-05", 6500, "2026-10-04"]);
    expect(t["Compartiste con"].filas[0]).toEqual(["Cena <con> Ana", "ana@correo.com", "2026-10-20"]);
  });
  it("el .xlsx es un zip con una hoja por tabla", () => {
    const z = libroXlsx(tablasMiAgenda(d));
    expect([z[0], z[1]]).toEqual([0x50, 0x4b]); // "PK"
    const txt = new TextDecoder().decode(z);
    expect(txt).toContain('<sheet name="Eventos"');
    expect(txt).toContain("Cena &lt;con&gt; Ana");
    expect((txt.match(/xl\/worksheets\/sheet\d+\.xml/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect(letra(0) + letra(25) + letra(26)).toBe("AZAA");
  });
  it("la página escapa el HTML", () => {
    const h = paginaMiAgenda(d, "2026-10-23");
    expect(h).toContain("Cena &lt;con&gt; Ana");
    expect(h).not.toContain("<con>");
    expect(h).toContain("$6,500");
  });
});
