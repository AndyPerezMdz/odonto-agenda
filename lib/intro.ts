// 3.7 · Va aparte (no en el componente "use client") para que el layout del servidor reciba el texto, no una referencia.
/** Corre en el <head> antes de pintar: si ya se vio la intro de esta agenda (o hay "Reducir movimiento"), ni aparece. */
export const SCRIPT_INTRO = `try{var p=location.pathname,t=p==="/"?"clinicas":(p==="/personal"||p.indexOf("/mi-agenda/demo")===0)?"mi":"";if(!t||sessionStorage.getItem("intro-"+t)||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.intro="no"}catch(e){document.documentElement.dataset.intro="no"}`;
