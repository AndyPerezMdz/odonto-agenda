import { describe, expect, it } from "vitest";
import { numerosCuatri, periodoParaPresumir, vale } from "@/lib/cuatriNumeros";

const c = (fecha: string, o: Partial<Parameters<typeof numerosCuatri>[0][number]> = {}) => ({ fecha, hora_inicio: "09:00:00", hora_fin: "11:00:00", paciente: "Ana López", materia_id: "m1", estado: "asistio" as const, confirmacion: null, ...o });

describe("3.2 · tu cuatri en números", () => {
  const mats = new Map([["m1", "Endodoncia"], ["m2", "Periodoncia"]]);
  const n = numerosCuatri(
    [
      c("2026-10-05"), c("2026-10-06", { paciente: "ana lópez " }), c("2026-10-07", { paciente: "Luis", materia_id: "m2", confirmacion: "confirmada" }),
      c("2026-10-12", { paciente: "Rosa", estado: "falto" }), c("2026-10-13", { estado: "cancelo" }), c("2026-10-14", { paciente: "Rosa", estado: null, confirmacion: "confirmada" }),
    ],
    mats
  );
  it("cuenta lo que importa", () => {
    expect(n).toMatchObject({ citas: 5, atendidas: 3, pacientes: 2, horas: 6, faltaron: 1, confirmaron: 40 });
    expect(n.materiaTop).toEqual({ nombre: "Endodoncia", n: 2 });
    expect(n.semanaPesada).toEqual({ lunes: "2026-10-05", n: 3 });
    expect(vale(n)).toBe(true);
  });
  it("cuándo se presume", () => {
    expect(periodoParaPresumir("2026-10-24", "cuatrimestre")).toBeNull(); // a media cuatri
    expect(periodoParaPresumir("2026-12-20", "cuatrimestre")).toMatchObject({ desde: "2026-09-01", hasta: "2026-12-31", cerrado: false });
    expect(periodoParaPresumir("2027-01-10", "cuatrimestre")).toMatchObject({ desde: "2026-09-01", hasta: "2026-12-31", cerrado: true });
    expect(periodoParaPresumir("2026-08-03", "semestre")).toMatchObject({ desde: "2026-01-01", hasta: "2026-07-31", cerrado: true });
  });
});
