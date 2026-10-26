import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { ahoraEn, zonaValida, ZONA_BASE } from "@/lib/recordatorios";
import { esFalloCorreo } from "@/lib/avisarFalloCorreo";

describe("3.5 · zona horaria por persona", () => {
  it("valida la zona del cel y cae en Mérida si viene basura", () => {
    expect(zonaValida("America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(zonaValida("Marte/Base")).toBe(ZONA_BASE);
    expect(zonaValida(undefined)).toBe(ZONA_BASE);
    expect(zonaValida(42)).toBe(ZONA_BASE);
  });
  it("calcula hoy y el minuto en cada zona", () => {
    const t = new Date("2026-10-25T03:30:00Z"); // 21:30 del 24 en Mérida; 20:30 del 24 en Los Ángeles (PDT)
    expect(ahoraEn("America/Merida", t)).toEqual({ hoy: "2026-10-24", min: 21 * 60 + 30 });
    expect(ahoraEn("America/Los_Angeles", t)).toEqual({ hoy: "2026-10-24", min: 20 * 60 + 30 });
    expect(ahoraEn("Europe/Madrid", t)).toEqual({ hoy: "2026-10-25", min: 4 * 60 + 30 }); // ese día Madrid ya salió del horario de verano
  });
  it("medianoche es minuto 0, no 1440", () => {
    expect(ahoraEn("UTC", new Date("2026-10-25T00:00:00Z")).min).toBe(0);
  });
});

describe("3.5 · fallas de correo", () => {
  it("reconoce el error de Supabase cuando no puede mandar el correo", () => {
    expect(esFalloCorreo({ message: "Error sending confirmation email", status: 500 })).toBe(true);
    expect(esFalloCorreo({ message: "Error sending recovery email" })).toBe(true);
  });
  it("no confunde el límite de envíos ni otros errores", () => {
    expect(esFalloCorreo({ message: "Error sending confirmation email", status: 429 })).toBe(false);
    expect(esFalloCorreo({ message: "email rate limit exceeded", code: "over_email_send_rate_limit" })).toBe(false);
    expect(esFalloCorreo({ message: "Password should be at least 8 characters" })).toBe(false);
    expect(esFalloCorreo(null)).toBe(false);
  });
});
