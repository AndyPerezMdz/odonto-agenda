import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { registrarPago, notificarPagoConfirmado } from "@/lib/pagosServer";
import type { Plan } from "@/lib/precios";

type Db = ReturnType<typeof createAdminClient>;

// Mercado Pago (Checkout Pro): tarjeta, débito y OXXO. Se activa sólo si pones MP_ACCESS_TOKEN en Vercel.
// El webhook vuelve a consultar el pago con TU token, así que nadie puede "inventar" un pago aprobado.
const API = () => process.env.MP_API_URL || "https://api.mercadopago.com";
export const mpActivo = () => !!process.env.MP_ACCESS_TOKEN;

async function mp<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API()}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json() as Promise<T>;
}

/** Crea el link de pago de un plan. external_reference = agenda|plan|meses (lo leemos al aprobarse). */
export async function crearPreferencia(o: { agendaId: string; agendaNombre: string; plan: Plan; email?: string | null; sitio: string }) {
  const pref = await mp<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [{ id: `pro-${o.plan.id}`, title: `Agenda de clínicas Pro · ${o.plan.nombre}`, description: `${o.plan.meses} mes${o.plan.meses === 1 ? "" : "es"} de Pro para ${o.agendaNombre}`, quantity: 1, unit_price: o.plan.precio, currency_id: "MXN" }],
      external_reference: `${o.agendaId}|${o.plan.id}|${o.plan.meses}`,
      payer: o.email ? { email: o.email } : undefined,
      back_urls: {
        success: `${o.sitio}/personalizar?pago=ok#suscripcion`,
        pending: `${o.sitio}/personalizar?pago=pendiente#suscripcion`,
        failure: `${o.sitio}/personalizar?pago=error#suscripcion`,
      },
      auto_return: "approved",
      notification_url: `${o.sitio}/api/mp/webhook`,
      statement_descriptor: "AGENDA CLINICAS",
    }),
  });
  return pref.init_point;
}

type PagoMP = { id: number; status: string; transaction_amount: number; external_reference: string | null };

/** Revisa un pago de Mercado Pago y, si está aprobado y no lo teníamos, suma los meses (una sola vez). */
export async function procesarPago(db: Db, pagoId: string, sitio: string): Promise<string> {
  const p = await mp<PagoMP>(`/v1/payments/${encodeURIComponent(pagoId)}`);
  if (p.status !== "approved") return `pago ${p.id}: ${p.status}`;
  const [agendaId, , mesesTxt] = (p.external_reference ?? "").split("|");
  const meses = Math.min(Math.max(parseInt(mesesTxt, 10) || 1, 1), 24);
  if (!agendaId) return `pago ${p.id}: sin referencia`;
  const referencia = `MP-${p.id}`;

  const { data: ya } = await db.from("pagos").select("id").eq("referencia", referencia).eq("metodo", "mercadopago").maybeSingle();
  if (ya) return `pago ${p.id}: ya registrado`;
  const r = await registrarPago(db, agendaId, { monto: Number(p.transaction_amount), meses, metodo: "mercadopago", referencia });
  if (r.error) {
    // Si dos avisos llegan al mismo tiempo, el índice único detiene el segundo: no es error real
    if (/duplicate|unique/i.test(r.error)) return `pago ${p.id}: ya registrado`;
    throw new Error(r.error);
  }
  try {
    await notificarPagoConfirmado(db, agendaId, { monto: Number(p.transaction_amount), meses, hasta: r.hasta!, sitio });
  } catch (e) {
    console.error("[mp] correo", e);
  }
  return `pago ${p.id}: +${meses} mes(es), Pro hasta ${r.hasta}`;
}
