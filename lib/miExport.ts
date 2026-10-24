// 3.0 · Tus datos de Mi agenda en tablas legibles: para el Excel y para la versión "para leer" (imprimible / PDF).

import type { Hoja } from "@/lib/xlsx";
import { mejorRacha, rachaActual, REPETIR, type PHabito } from "@/lib/personal";

type Fila = Record<string, unknown>;
export type DatosExportados = {
  exportado: string;
  cuenta: Fila & { correo: string | null };
  eventos: Fila[]; categorias: Fila[]; pendientes: Fila[]; habitos: Fila[]; habito_marcas: Fila[];
  viajes_itinerario_maleta_reservas_gastos: Fila[]; pagos_fijos: Fila[]; pagos_fijos_hechos: Fila[]; pagos_de_tu_plan: Fila[];
  compartiste_con?: Fila[];
};

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const TIPO: Record<string, string> = { evento: "Evento", viaje: "Viaje", entrega: "Entrega", recordatorio: "Recordatorio" };
const COSA: Record<string, string> = { itinerario: "Itinerario", maleta: "Maleta", reserva: "Reserva", gasto: "Gasto" };
const str = (x: unknown) => (x == null || x === "" ? "" : String(x));
const hora = (x: unknown) => str(x).slice(0, 5);
const fecha = (x: unknown) => str(x).slice(0, 10);
const si = (x: unknown) => (x ? "Sí" : "");
const num = (x: unknown) => (x == null || x === "" || Number.isNaN(Number(x)) ? null : Number(x));

/** Las hojas, en el orden en que se leen. Las vacías también salen (con su encabezado). */
export function tablasMiAgenda(d: DatosExportados, hoy = d.exportado.slice(0, 10)): Hoja[] {
  const cat = new Map(d.categorias.map((c) => [str(c.id), str(c.nombre)]));
  const eventos = new Map(d.eventos.map((e) => [str(e.id), str(e.titulo)]));
  const pend = new Map(d.pendientes.map((p) => [str(p.id), str(p.titulo)]));
  const hab = new Map(d.habitos.map((h) => [str(h.id), str(h.nombre)]));
  const pagos = new Map(d.pagos_fijos.map((p) => [str(p.id), str(p.nombre)]));
  const marcasDe = new Map<string, Set<string>>();
  for (const m of d.habito_marcas) {
    const k = str(m.habito_id);
    if (!marcasDe.has(k)) marcasDe.set(k, new Set());
    marcasDe.get(k)!.add(fecha(m.fecha));
  }
  const porFecha = <T extends Fila>(xs: T[], k = "fecha") => [...xs].sort((a, b) => str(a[k]).localeCompare(str(b[k])));
  const c = d.cuenta;

  return [
    {
      nombre: "Tu cuenta",
      columnas: ["Dato", "Valor"],
      filas: [
        ["Correo", str(c.correo)],
        ["Nombre", str(c.nombre)],
        ["Agenda para", c.perfil === "odonto" ? "Estudiante de odonto" : "General"],
        ["Desde", fecha(c.created_at)],
        ["Pro hasta", c.pagado_hasta === null ? "Cortesía (sin vencimiento)" : fecha(c.pagado_hasta)],
        ["Prueba hasta", fecha(c.prueba_hasta)],
        ["Descargado", d.exportado.replace("T", " ").slice(0, 16) + " (UTC)"],
      ],
    },
    {
      nombre: "Eventos",
      columnas: ["Tipo", "Título", "Fecha", "Hasta", "Empieza", "Termina", "Lugar", "Categoría", "Se repite", "Repetir hasta", "Hecho", "Notas"],
      filas: porFecha(d.eventos).map((e) => [
        TIPO[str(e.tipo)] ?? str(e.tipo), str(e.titulo), fecha(e.fecha), fecha(e.fecha_fin), hora(e.hora_inicio), hora(e.hora_fin), str(e.lugar),
        cat.get(str(e.categoria_id)) ?? "", e.repetir && e.repetir !== "nunca" ? (REPETIR.find((r) => r.id === e.repetir)?.nombre ?? str(e.repetir)) : "",
        fecha(e.repetir_hasta), e.tipo === "entrega" ? si(e.hecho) : "", str(e.notas),
      ]),
    },
    {
      nombre: "Pendientes",
      columnas: ["Título", "Lista", "Etiqueta", "Prioridad", "Para el", "Hora", "Duración (min)", "Hecho", "Subtarea de", "Notas"],
      filas: [...d.pendientes]
        .sort((a, b) => Number(!!a.hecho) - Number(!!b.hecho) || (num(b.prioridad) ?? 0) - (num(a.prioridad) ?? 0) || str(a.fecha || "9999").localeCompare(str(b.fecha || "9999")))
        .map((p) => [
          str(p.titulo), p.lista === "algun_dia" ? "Algún día" : "Por hacer", str(p.etiqueta), p.prioridad === 2 ? "Urgente" : p.prioridad === 1 ? "Importante" : "",
          fecha(p.fecha), hora(p.hora), p.hora ? num(p.duracion) ?? 60 : null, si(p.hecho), pend.get(str(p.padre_id)) ?? "", str(p.notas),
        ]),
    },
    {
      nombre: "Hábitos",
      columnas: ["Hábito", "Días", "Recordar a las", "Racha actual", "Mejor racha", "Palomitas", "Archivado", "Desde"],
      filas: d.habitos.map((h) => {
        const m = marcasDe.get(str(h.id)) ?? new Set<string>();
        const hh = { ...h, dias: (h.dias as number[]) ?? [], created_at: str(h.created_at) } as unknown as PHabito;
        const dias = (h.dias as number[] | undefined) ?? [];
        return [
          str(h.nombre), dias.length === 7 || !dias.length ? "Diario" : [1, 2, 3, 4, 5, 6, 0].filter((x) => dias.includes(x)).map((x) => DIAS[x]).join(" "),
          hora(h.hora), rachaActual(hh, m, hoy), mejorRacha(hh, m, hoy), m.size, si(h.archivado), fecha(h.created_at),
        ];
      }),
    },
    {
      nombre: "Palomitas de hábitos",
      columnas: ["Fecha", "Hábito"],
      filas: porFecha(d.habito_marcas).reverse().map((m) => [fecha(m.fecha), hab.get(str(m.habito_id)) ?? ""]),
    },
    {
      nombre: "Viajes",
      columnas: ["Viaje", "Qué", "Título", "Fecha", "Hora", "Detalle", "Monto", "Hecho"],
      filas: [...d.viajes_itinerario_maleta_reservas_gastos]
        .sort((a, b) => (eventos.get(str(a.viaje_id)) ?? "").localeCompare(eventos.get(str(b.viaje_id)) ?? "") || str(a.tipo).localeCompare(str(b.tipo)) || str(a.fecha).localeCompare(str(b.fecha)))
        .map((x) => [eventos.get(str(x.viaje_id)) ?? "", COSA[str(x.tipo)] ?? str(x.tipo), str(x.titulo), fecha(x.fecha), hora(x.hora), str(x.detalle), num(x.monto), si(x.hecho)]),
    },
    {
      nombre: "Pagos fijos",
      columnas: ["Pago", "Monto", "Cada", "Día", "Mes", "Avisar días antes", "Activo", "Notas"],
      filas: d.pagos_fijos.map((p) => [str(p.nombre), num(p.monto), p.frecuencia === "anual" ? "Año" : "Mes", num(p.dia), num(p.mes), num(p.avisar_dias), si(p.activo !== false), str(p.notas)]),
    },
    {
      nombre: "Pagos hechos",
      columnas: ["Pago", "Tocaba el", "Monto", "Pagado el"],
      filas: porFecha(d.pagos_fijos_hechos, "periodo").reverse().map((h) => [pagos.get(str(h.pago_id)) ?? "", fecha(h.periodo), num(h.monto), fecha(h.pagado_at)]),
    },
    {
      nombre: "Compartiste con",
      columnas: ["Qué", "Correo", "Desde"],
      filas: (d.compartiste_con ?? []).map((x) => [eventos.get(str(x.evento_id)) ?? pend.get(str(x.pendiente_id)) ?? "", str(x.correo), fecha(x.created_at)]),
    },
    {
      nombre: "Pagos de tu plan",
      columnas: ["Fecha", "Monto", "Meses", "Cubre desde", "Cubre hasta"],
      filas: porFecha(d.pagos_de_tu_plan, "created_at").reverse().map((x) => [fecha(x.created_at), num(x.monto), num(x.meses), fecha(x.cubre_desde), fecha(x.cubre_hasta)]),
    },
  ];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** La versión "para leer": una página tipo agenda impresa. Con "Guardar como PDF". */
export function paginaMiAgenda(d: DatosExportados, hoy = d.exportado.slice(0, 10)): string {
  const hojas = tablasMiAgenda(d, hoy);
  const nombre = str(d.cuenta.nombre) || str(d.cuenta.correo);
  const secciones = hojas
    .slice(1)
    .map((h) => {
      const cols = h.columnas.map((c, i) => ({ c, i })).filter(({ i }) => h.filas.some((f) => f[i] != null && f[i] !== ""));
      return `<section><h2>${esc(h.nombre)} <span>${h.filas.length}</span></h2>${
        h.filas.length
          ? `<div class="tabla"><table><thead><tr>${cols.map(({ c }) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${h.filas
              .map((f) => `<tr>${cols.map(({ i }) => {
                const v = f[i] == null ? "" : typeof f[i] === "number" && /monto/i.test(h.columnas[i]) ? `$${Number(f[i]).toLocaleString("es-MX")}` : String(f[i]);
                return `<td${v.length > 22 ? ' class="largo"' : ""}>${esc(v)}</td>`;
              }).join("")}</tr>`)
              .join("")}</tbody></table></div>`
          : `<p class="vacio">Nada por aquí.</p>`
      }</section>`;
    })
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Mi agenda · tus datos</title>
<style>
:root{--bg:#f3ede2;--panel:#fbf8f2;--ink:#2b2520;--muted:#7a6f63;--line:#e0d5c2;--accent:#b4472e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px 48px}
header{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;border-bottom:2px solid var(--line);padding-bottom:14px;margin-bottom:8px}
.marca{font:600 12px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 6px}
h1{font:400 40px/1 Georgia,'Times New Roman',serif;margin:0}
header p{margin:6px 0 0;color:var(--muted)}
button{margin-left:auto;background:var(--accent);color:#fff;border:0;border-radius:999px;padding:10px 18px;font:600 14px system-ui;cursor:pointer}
section{margin-top:26px;break-inside:avoid-page}
h2{font:400 24px/1.1 Georgia,serif;margin:0 0 8px}h2 span{font:600 12px system-ui;color:var(--muted);vertical-align:middle;margin-left:6px}
.tabla{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:13px}
th{text-align:left;background:#efe6d6;font-weight:600;padding:7px 10px;white-space:nowrap}
td{padding:6px 10px;border-top:1px solid var(--line);vertical-align:top;white-space:nowrap}
td.largo{white-space:normal;min-width:220px;overflow-wrap:anywhere}
.vacio{color:var(--muted);font-style:italic;margin:0}
footer{margin-top:36px;color:var(--muted);font-size:12px;text-align:center}
@media (max-width:640px){table{display:block;overflow-x:auto}}
@media print{body{background:#fff}button{display:none}main{padding:0}table{font-size:11px}th{background:#eee}}
</style></head><body><main>
<header><div><p class="marca">Mi agenda</p><h1>Tus datos</h1><p>${esc(nombre)} · descargado el ${esc(hoy)}</p></div>
<button onclick="window.print()">Guardar como PDF</button></header>
${secciones}
<footer>Son tuyos. Para un respaldo completo (y volver a cargarlo algún día), descarga también el respaldo técnico (JSON) en Ajustes → Tu cuenta.</footer>
</main></body></html>`;
}
