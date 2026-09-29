// Ayudas del registro que corren en el navegador.

export type ResultadoRegistro =
  | { ok: true; agenda: "creada" | "unido" | "invitacion" | "ya"; aviso?: string }
  | { ok: false; error: string; motivo?: string | null };

type Pendiente = { nombre?: string; codigo?: string; unir?: string; email?: string; plantilla?: string };
const CLAVE = "registro-pendiente";

/** Se guarda lo que escribió al registrarse, por si confirma el correo en otra pestaña o más tarde. */
export function guardarPendiente(p: Pendiente) {
  try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch {}
}

export function leerPendiente(): Pendiente {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? "{}"); } catch { return {}; }
}

export function borrarPendiente() {
  try { localStorage.removeItem(CLAVE); } catch {}
}

export async function completarRegistro(p: Pendiente): Promise<ResultadoRegistro> {
  const res = await fetch("/api/registro/completar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: p.nombre, codigo: p.codigo, unir: p.unir, plantilla: p.plantilla }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: d.error ?? "No se pudo terminar el registro.", motivo: d.motivo ?? null };
  borrarPendiente();
  return d as ResultadoRegistro;
}
