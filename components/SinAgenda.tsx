"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import { completarRegistro, leerPendiente, type ResultadoRegistro } from "@/lib/registroCliente";
import { UNIVERSIDADES } from "@/lib/universidades";

// Cuenta con sesión pero sin agenda: recién confirmó su correo (por link) o la quitaron de una agenda.
export default function SinAgenda() {
  const router = useRouter();
  const [estado, setEstado] = useState<"revisando" | "elegir" | "trabajando">("revisando");
  const [r, setR] = useState<ResultadoRegistro | null>(null);

  async function crear(p: Parameters<typeof completarRegistro>[0]) {
    setEstado("trabajando");
    const res = await completarRegistro(p);
    if (res.ok && !res.aviso) {
      router.refresh();
      return;
    }
    setR(res);
    setEstado("elegir");
  }

  // Si se acaba de registrar (dejó datos pendientes), termina solo
  useEffect(() => {
    const p = leerPendiente();
    if (p.unir || (p.nombre && p.universidad)) crear(p);
    else setEstado("elegir");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (estado !== "elegir") {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-label="Preparando tu agenda" />
      </div>
    );
  }

  if (r?.ok) {
    return (
      <AuthCard titulo="¡Tu agenda está lista!">
        <p className="mb-5 text-sm text-muted">{r.aviso}</p>
        <button className="btn btn-primario w-full" onClick={() => router.refresh()}>Entrar</button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo="Todavía no tienes agenda"
      subtitulo={r && !r.ok ? r.error : "Crea la tuya, o pídele a tu compañero/a el link para unirte a la suya."}
    >
      <p className="mb-2 text-sm font-medium">Crear mi agenda de…</p>
      <div className="mb-1 grid grid-cols-2 gap-2">
        {UNIVERSIDADES.map((u) => (
          <button key={u.id} className="btn btn-primario" onClick={() => crear({ ...leerPendiente(), universidad: u.id })}>
            {u.nombre}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted">La universidad no se puede cambiar después.</p>
      <p className="mb-4 text-xs text-muted">Si ya usaste tu mes gratis, tu agenda empieza sin él: para agendar primero se paga el mes.</p>
      <form action="/auth/salir" method="post">
        <button className="btn btn-sec w-full">Cerrar sesión</button>
      </form>
    </AuthCard>
  );
}
