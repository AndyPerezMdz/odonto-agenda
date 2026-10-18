// Planes por tiempo, por universidad (los editas en tu panel → Ajustes).
// El de "periodo" va amarrado al calendario: cuatrimestre (4 meses) en la UPP, semestre (6) en la UADY.
export type Universidad = "upp" | "uady";
export type PlanId = "mes" | "tri" | "periodo" | "anual";
export type Plan = { id: PlanId; nombre: string; meses: number; precio: number; activo: boolean };
export type Planes = Record<Universidad, Plan[]>;

const IDS: PlanId[] = ["mes", "tri", "periodo", "anual"];

function base(u: Universidad): Plan[] {
  const periodo = u === "uady" ? 6 : 4;
  return [
    { id: "mes", nombre: "Mensual", meses: 1, precio: 200, activo: true },
    { id: "tri", nombre: "Trimestral", meses: 3, precio: 540, activo: true },
    { id: "periodo", nombre: u === "uady" ? "Semestral" : "Cuatrimestral", meses: periodo, precio: Math.round(200 * periodo * 0.8), activo: true },
    { id: "anual", nombre: "Anual", meses: 12, precio: 1680, activo: true },
  ];
}

export const PLANES_DEFAULT: Planes = { upp: base("upp"), uady: base("uady") };

/** Limpia lo guardado (o lo del formulario): sólo cambia precio y activo; nombres y meses son fijos. */
export function normalizarPlanes(v: unknown): Planes {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const uno = (u: Universidad): Plan[] => {
    const guardados = Array.isArray(o[u]) ? (o[u] as Partial<Plan>[]) : [];
    return base(u).map((p) => {
      const g = guardados.find((x) => x?.id === p.id);
      const precio = Number(g?.precio);
      return {
        ...p,
        precio: Number.isFinite(precio) && precio > 0 && precio <= 1000000 ? Math.round(precio) : p.precio,
        activo: p.id === "mes" ? true : g?.activo === undefined ? p.activo : !!g.activo, // el mensual siempre existe
      };
    });
  };
  return { upp: uno("upp"), uady: uno("uady") };
}

export const planDe = (planes: Planes, u: string | null | undefined, id: string | null | undefined) =>
  planes[u === "uady" ? "uady" : "upp"].find((p) => p.id === id && p.activo) ?? null;

export const mensualDe = (planes: Planes, u: string | null | undefined) => planes[u === "uady" ? "uady" : "upp"][0].precio;

/** Cuánto se ahorra contra pagar mes por mes. */
export const ahorroDe = (p: Plan, mensual: number) => Math.max(0, mensual * p.meses - p.precio);

export const esPlanId = (x: unknown): x is PlanId => IDS.includes(x as PlanId);
