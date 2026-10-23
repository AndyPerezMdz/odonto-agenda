import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fechaEnZona } from "@/lib/recordatorios";
import { diasEntre } from "@/lib/pagos";
import type { MesResumen } from "@/lib/admin";
import { listarPersonales } from "@/lib/personalServer";
import { listarAvisosMi } from "@/lib/planMiServer";

type Db = ReturnType<typeof createAdminClient>;

// Panel de staff → Mi agenda: números del negocio y de uso. Sólo CONTEOS: nunca lo que la gente anota.

export type RenovacionMi = { user_id: string; nombre: string | null; email: string | null; hasta: string; dias: number; tipo: "pro" | "prueba"; monto: number | null; meses: number | null };
export type UsoFuncion = { id: string; nombre: string; personas: number; total: number };
export type ResumenMiAdmin = {
  personas: {
    total: number;
    activas: number;
    porEstado: { gratis: number; prueba: number; pro: number; cortesia: number; clinicas: number };
    soloMi: number; // sin agenda de clínicas
    odonto: number;
    general: number;
    nuevas7: number;
    nuevas30: number;
    entraron7: number;
    sinContrasena: number;
  };
  meses: MesResumen[]; // últimos 6 (nuevas = personas nuevas)
  cobradoMes: number;
  recurrente: number; // lo que entra al mes de quienes pagan (último pago / meses)
  pagando: number;
  pruebas: { activas: number; terminanSemana: number; convertidas: number; perdidas: number };
  renovaciones: RenovacionMi[]; // Pro o prueba que termina en 30 días
  pendientes: { avisos: number };
  uso: UsoFuncion[];
  marcas7: number; // palomitas de hábitos esta semana (todas las personas)
  invitados: number; // 2.9 · llegaron con el link de un amigo
};

const ZONA = "America/Merida";
const mesDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA }).slice(0, 7);

/** Cuántas personas usan algo y cuántas filas hay (si la tabla no existe todavía: 0). */
async function conteo(p: PromiseLike<{ data: { user_id: string }[] | null; error: unknown }>) {
  const { data, error } = await p;
  if (error || !data) return { personas: 0, total: 0 };
  return { personas: new Set(data.map((x) => x.user_id)).size, total: data.length };
}

export async function resumenMiAdmin(db: Db): Promise<ResumenMiAdmin> {
  const hoy = fechaEnZona(0);
  const [lista, { data: pagos }, avisos] = await Promise.all([
    listarPersonales(db),
    db.from("p_pagos").select("user_id,monto,meses,cubre_hasta,created_at").order("created_at", { ascending: false }),
    listarAvisosMi(db).catch(() => []),
  ]);
  const hace = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  // Personas
  const porEstado = { gratis: 0, prueba: 0, pro: 0, cortesia: 0, clinicas: 0 };
  for (const p of lista) porEstado[p.estado.tipo]++;
  const personas = {
    total: lista.length,
    activas: lista.filter((p) => p.activo).length,
    porEstado,
    soloMi: lista.filter((p) => !p.tieneClinica).length,
    odonto: lista.filter((p) => p.perfil === "odonto").length,
    general: lista.filter((p) => p.perfil === "general").length,
    nuevas7: lista.filter((p) => p.created_at >= hace(7)).length,
    nuevas30: lista.filter((p) => p.created_at >= hace(30)).length,
    entraron7: lista.filter((p) => (p.ultimo_acceso ?? p.ultimoLogin ?? "") >= hace(7)).length,
    sinContrasena: lista.filter((p) => !p.password).length,
  };

  // Dinero: últimos 6 meses
  const meses: MesResumen[] = [];
  const [y, m] = hoy.split("-").map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    meses.push({ mes: d.toISOString().slice(0, 7), cobrado: 0, pagos: 0, nuevas: 0 });
  }
  for (const x of pagos ?? []) {
    const mm = meses.find((k) => k.mes === mesDe(x.created_at));
    if (mm) { mm.cobrado += Number(x.monto); mm.pagos++; }
  }
  for (const p of lista) {
    const mm = meses.find((k) => k.mes === mesDe(p.created_at));
    if (mm) mm.nuevas++;
  }
  const ultimoPago = new Map<string, { monto: number; meses: number }>();
  for (const x of pagos ?? []) if (!ultimoPago.has(x.user_id)) ultimoPago.set(x.user_id, { monto: Number(x.monto), meses: Number(x.meses) || 1 });
  const pagan = lista.filter((p) => p.estado.tipo === "pro" && ultimoPago.has(p.user_id));
  const recurrente = Math.round(pagan.reduce((n, p) => n + ultimoPago.get(p.user_id)!.monto / ultimoPago.get(p.user_id)!.meses, 0));

  // Pruebas: las vivas, y de las que ya acabaron cuántas pagaron
  const conPrueba = lista.filter((p) => p.estado.tipo === "prueba");
  const pagaron = new Set((pagos ?? []).map((x) => x.user_id as string));
  const { data: filasPrueba } = await db.from("personales").select("user_id,prueba_hasta").not("prueba_hasta", "is", null);
  const acabadas = (filasPrueba ?? []).filter((f) => (f.prueba_hasta as string) < hoy);
  const pruebas = {
    activas: conPrueba.length,
    terminanSemana: conPrueba.filter((p) => p.estado.tipo === "prueba" && p.estado.dias <= 7).length,
    convertidas: acabadas.filter((f) => pagaron.has(f.user_id)).length,
    perdidas: acabadas.filter((f) => !pagaron.has(f.user_id)).length,
  };

  const renovaciones: RenovacionMi[] = lista
    .filter((p) => (p.estado.tipo === "pro" || p.estado.tipo === "prueba") && Number.isFinite(p.estado.dias) && p.estado.dias <= 30)
    .map((p) => {
      const e = p.estado as { tipo: "pro" | "prueba"; hasta: string; dias: number };
      const u = ultimoPago.get(p.user_id);
      return { user_id: p.user_id, nombre: p.nombre, email: p.email, hasta: e.hasta, dias: diasEntre(hoy, e.hasta), tipo: e.tipo, monto: u?.monto ?? null, meses: u?.meses ?? null };
    })
    .sort((a, b) => a.hasta.localeCompare(b.hasta));

  // Uso: cuántas personas usan cada cosa (sin ver qué anotaron)
  const desde7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [eventos, recordatorios, viajes, pendientes, habitos, marcas, cosas, fijos] = await Promise.all([
    conteo(db.from("p_eventos").select("user_id").in("tipo", ["evento", "entrega"])),
    conteo(db.from("p_eventos").select("user_id").eq("tipo", "recordatorio")),
    conteo(db.from("p_eventos").select("user_id").eq("tipo", "viaje")),
    conteo(db.from("p_pendientes").select("user_id")),
    conteo(db.from("p_habitos").select("user_id").eq("archivado", false)),
    conteo(db.from("p_habito_marcas").select("user_id").gte("fecha", desde7)),
    conteo(db.from("p_viaje_cosas").select("user_id")),
    conteo(db.from("p_pagos_fijos").select("user_id").eq("activo", true)),
  ]);
  const uso: UsoFuncion[] = [
    { id: "eventos", nombre: "Eventos y entregas", ...eventos },
    { id: "recordatorios", nombre: "Recordatorios", ...recordatorios },
    { id: "pendientes", nombre: "Pendientes", ...pendientes },
    { id: "habitos", nombre: "Hábitos", ...habitos },
    { id: "viajes", nombre: "Viajes", ...viajes },
    { id: "cosas", nombre: "Itinerario, maleta y gastos", ...cosas },
    { id: "pagos", nombre: "Pagos fijos", ...fijos },
  ];

  return {
    personas,
    meses,
    cobradoMes: meses[meses.length - 1].cobrado,
    recurrente,
    pagando: pagan.length,
    pruebas,
    renovaciones,
    pendientes: { avisos: avisos.length },
    uso,
    marcas7: marcas.total,
    invitados: await db.from("p_invitaciones").select("id", { count: "exact", head: true }).then((r) => (r.error ? 0 : r.count ?? 0)),
  };
}
