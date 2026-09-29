// Precios por universidad (los pones en tu panel → Ajustes). Cada agenda nueva toma el mensual de su universidad.
// El plan anual es opcional: si lo activas, el dueño puede pagar 12 meses de un jalón a ese precio.
export type PrecioUni = { mensual: number; anual: number | null };
export type Precios = { upp: PrecioUni; uady: PrecioUni };

export const PRECIOS_DEFAULT: Precios = {
  upp: { mensual: 200, anual: null },
  uady: { mensual: 200, anual: null },
};

/** Limpia lo que venga de la base (o del formulario) para que siempre sea válido. */
export function normalizarPrecios(v: unknown): Precios {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Partial<PrecioUni>>;
  const uno = (u: "upp" | "uady"): PrecioUni => {
    const x = o[u] ?? {};
    const mensual = Number(x.mensual);
    const anual = x.anual == null || x.anual === ("" as unknown) ? null : Number(x.anual);
    return {
      mensual: Number.isFinite(mensual) && mensual >= 0 && mensual <= 100000 ? Math.round(mensual) : PRECIOS_DEFAULT[u].mensual,
      anual: anual != null && Number.isFinite(anual) && anual > 0 && anual <= 1000000 ? Math.round(anual) : null,
    };
  };
  return { upp: uno("upp"), uady: uno("uady") };
}
