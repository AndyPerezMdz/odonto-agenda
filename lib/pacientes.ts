// 2.3 · Pacientes sin duplicados: comparar nombres sin importar mayúsculas, acentos ni espacios,
// y encontrar nombres "parecidos" (Angela Martínez ↔ Angela Martinez Martinez, Juan Peres ↔ Juan Pérez).

/** Clave para juntar citas del mismo paciente: minúsculas, sin acentos ni signos, espacios simples. */
export function clavePaciente(n: string) {
  return n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distancia(a: string, b: string) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Dos palabras "son la misma": iguales, o con un error de dedo si son largas (Peres/Perez, Martines/Martinez).
const mismaPalabra = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && distancia(a, b) <= 1);

/**
 * ¿Pueden ser la misma persona? (se compara con claves de clavePaciente)
 * - Mismo nombre de pila y todas las palabras del nombre más corto están en el largo (Angela Martinez ⊂ Angela Martinez Martinez).
 * - O casi iguales letra por letra (un par de errores de dedo).
 * `escribiendo`: la última palabra de `a` puede estar a medias (Angela Mart… ya sugiere a Angela Martinez).
 */
export function parecidos(a: string, b: string, escribiendo = false) {
  if (!a || !b || a === b) return false;
  const ta = a.split(" ");
  const tb = b.split(" ");
  if (ta.length < 2 || tb.length < 2) return false; // a partir del segundo nombre/apellido
  if (!mismaPalabra(ta[0], tb[0])) return false;
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const usados = new Set<number>();
  const todas = corto.every((w, i) => {
    const ultima = escribiendo && corto === ta && i === ta.length - 1;
    const j = largo.findIndex((x, k) => !usados.has(k) && (mismaPalabra(w, x) || (ultima && w.length >= 2 && x.startsWith(w))));
    if (j < 0) return false;
    usados.add(j);
    return true;
  });
  if (todas) return true;
  return a.length >= 8 && distancia(a, b) <= 2;
}

/** Clave de un par (para recordar "no son la misma persona"). */
export const clavePar = (a: string, b: string) => [a, b].sort().join("|");
