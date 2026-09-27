"use client";

import { useEffect, useState } from "react";

// Pinta su contenido sólo en el navegador, no en el servidor.
// Por qué: el servidor (Vercel) vive en UTC y tú en Mérida. De 6 p. m. a medianoche el servidor
// ya cree que es "mañana", y React se queja de que el HTML no coincide (error #418).
// Las pantallas que dependen de "hoy" (agenda, avance, banco, personalizar, panel) van aquí adentro.
export default function SoloNavegador({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  if (!listo) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-label="Cargando" />
      </div>
    );
  }
  return <>{children}</>;
}
