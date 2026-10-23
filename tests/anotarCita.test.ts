import { describe, expect, it } from "vitest";
import { anotarCita } from "@/lib/anotarCita";
import type { Clinica, Materia } from "@/lib/types";

// "Escríbela rápido" de la agenda de clínicas. Hoy = viernes 23 de octubre de 2026.
const HOY = "2026-10-23";
const clinicas: Clinica[] = [
  { id: "c1", numero: "1", descripcion: null, activo: true },
  { id: "c2", numero: "2", descripcion: null, activo: true },
  { id: "cp", numero: "Posgrado", descripcion: null, activo: true },
];
const materias = [
  { id: "endo", nombre: "Endodoncia", color: "", activo: true },
  { id: "perio", nombre: "Periodoncia", color: "", activo: true },
  { id: "op", nombre: "Operatoria dental", color: "", activo: true },
] as Materia[];
const nombres = ["Juan Pérez Canul", "Angela Martínez"];
const c = (t: string) => anotarCita(t, HOY, clinicas, materias, nombres);

describe("anotar cita", () => {
  it("paciente conocido, día, hora y clínica", () => {
    expect(c("Juan Pérez martes 10 clínica 2")).toMatchObject({ paciente: "Juan Pérez Canul", conocido: true, fecha: "2026-10-27", inicio: "10:00", clinicaId: "c2" });
  });
  it("materia abreviada y clínica corta", () => {
    expect(c("angela martinez mañana 9:30 endo c1")).toMatchObject({ paciente: "Angela Martínez", materiaId: "endo", clinicaId: "c1", inicio: "09:30" });
  });
  it("rango de horas y clínica con nombre", () => {
    expect(c("Rosa Uc el viernes de 8 a 11 en la clínica posgrado operatoria")).toMatchObject({ paciente: "Rosa Uc", inicio: "08:00", fin: "11:00", clinicaId: "cp", materiaId: "op", conocido: false });
  });
  it("una clínica que no existe no se pega al nombre", () => {
    expect(c("Pedro Can lunes 9 clínica 7")).toMatchObject({ paciente: "Pedro Can", clinicaId: null, clinicaPedida: "7" });
  });
  it("sin hora de fin: la pone la duración de la materia (no +1 h)", () => {
    expect(c("cita con Pedro Can 15 de nov 4pm perio")).toMatchObject({ paciente: "Pedro Can", inicio: "16:00", fin: null, materiaId: "perio" });
  });
});
