"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import CrearAgendaClinicas from "@/components/CrearAgendaClinicas";
import { completarRegistro, leerPendiente, type ResultadoRegistro } from "@/lib/registroCliente";
import { esUniversidad } from "@/lib/universidades";

// Cuenta con sesión pero sin agenda: recién confirmó su correo (por link) o la quitaron de una agenda.
// 3.1 · Crear la suya pasa por CrearAgendaClinicas (que pide el correo institucional si hace falta).
export default function SinAgenda() {
  const router = useRouter();
  const [estado, setEstado] = useState<"revisando" | "crear" | "auto" | "listo">("revisando");
  const [r, setR] = useState<ResultadoRegistro | null>(null);
  const [uni, setUni] = useState<string | undefined>();

  useEffect(() => {
    const p = leerPendiente();
    // Llegó con el link de un compañero/a: se une (no necesita verificar: la agenda ya es de un estudiante)
    if (p.unir) {
      completarRegistro(p).then((res) => {
        if (res.ok && !res.aviso) return router.refresh();
        setR(res);
        setEstado(res.ok ? "listo" : "crear");
      });
      return;
    }
    if (p.nombre && esUniversidad(p.universidad)) {
      setUni(p.universidad);
      setEstado("auto");
    } else setEstado("crear");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (estado === "revisando")
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-label="Preparando tu agenda" />
      </div>
    );

  if (estado === "listo" && r?.ok)
    return (
      <AuthCard titulo="¡Tu agenda está lista!">
        <p className="mb-5 text-sm text-muted">{r.aviso}</p>
        <button className="btn btn-primario w-full" onClick={() => router.refresh()}>Entrar</button>
      </AuthCard>
    );

  return (
    <CrearAgendaClinicas
      titulo="Todavía no tienes agenda"
      subtitulo="Crea la tuya, o pídele a tu compañero/a el link para unirte a la suya."
      error={r && !r.ok ? r.error : null}
      autoUni={estado === "auto" && esUniversidad(uni) ? uni : null}
    />
  );
}
