import { describe, expect, it } from "vitest";
import { dominioInstitucional, requiereVerificacion, ejemploCorreo } from "@/lib/verificacionEscolar";

describe("3.1 · correo institucional", () => {
  it("UPP: sólo su dominio exacto", () => {
    expect(dominioInstitucional("upp", "Alguien.MO25@UniversidadUPP.edu.mx ")).toBe("universidadupp.edu.mx");
    expect(dominioInstitucional("upp", "alguien@gmail.com")).toBeNull();
    expect(dominioInstitucional("upp", "alguien@falso.universidadupp.edu.mx")).toBeNull();
    expect(dominioInstitucional("upp", "alguien@universidadupp.edu.mx.evil.com")).toBeNull();
    expect(dominioInstitucional("upp", "sin-arroba")).toBeNull();
  });
  it("UADY todavía no pide verificación", () => {
    expect(requiereVerificacion("upp")).toBe(true);
    expect(requiereVerificacion("uady")).toBe(false);
    expect(ejemploCorreo("upp")).toBe("tucorreo@universidadupp.edu.mx");
  });
});
