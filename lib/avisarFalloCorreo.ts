/** 3.5 · Si Supabase no pudo mandar el correo (código, link), avisa al panel. Devuelve el mensaje amable para la persona. */
export function esFalloCorreo(e: { message?: string; status?: number; code?: string } | null | undefined) {
  return !!e && /sending|smtp/i.test(e.message ?? "") && e.code !== "over_email_send_rate_limit" && e.status !== 429;
}

export function avisarFalloCorreo(donde: "registro" | "registro-mi" | "recuperar" | "reenviar", e: { message?: string }) {
  fetch("/api/alerta-correo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ donde, mensaje: e.message ?? "" }), keepalive: true }).catch(() => {});
  return "No pudimos mandarte el correo. Ya nos llegó el aviso y lo estamos arreglando: inténtalo otra vez en un rato.";
}
