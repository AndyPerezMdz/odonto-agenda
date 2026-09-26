// Temas de color y formas del marcador de "hoy". Cada usuario elige los suyos en Personalizar.
// Los colores viven en app/globals.css bajo :root[data-tema="..."].

export const TEMAS = [
  { id: "verde", nombre: "Salvia", muestra: ["#2f5d50", "#e3ece8", "#f6f5f2"] },
  { id: "rosa", nombre: "Rosita", muestra: ["#d24a83", "#fbe3ec", "#fbf4f6"] },
  { id: "lavanda", nombre: "Lavanda", muestra: ["#7b5cc7", "#ece6fa", "#f6f4fb"] },
  { id: "cielo", nombre: "Cielo", muestra: ["#2c7fb8", "#e0eef8", "#f3f7fa"] },
  { id: "durazno", nombre: "Durazno", muestra: ["#c8623a", "#fbe8dd", "#fbf6f2"] },
] as const;

export type TemaId = (typeof TEMAS)[number]["id"];

export const MARCADORES = [
  { id: "circulo", nombre: "Círculo" },
  { id: "muela", nombre: "Muela" },
  { id: "corazon", nombre: "Corazón" },
  { id: "flor", nombre: "Flor" },
  { id: "cuadro", nombre: "Cuadro" },
] as const;

export type MarcadorId = (typeof MARCADORES)[number]["id"];

const CLAVE = "agenda-tema";

/** Aplica el tema en la página y lo recuerda en este navegador (para que no parpadee al cargar). */
export function aplicarTema(tema: string) {
  if (typeof document === "undefined") return;
  if (tema && tema !== "verde") document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
  try {
    localStorage.setItem(CLAVE, tema || "verde");
  } catch {
    /* modo privado: no pasa nada */
  }
}

/** Script que corre ANTES de pintar la página, para aplicar el último tema usado. */
export const SCRIPT_TEMA_INICIAL = `try{var t=localStorage.getItem("${CLAVE}");if(t&&t!=="verde")document.documentElement.dataset.tema=t}catch(e){}`;
