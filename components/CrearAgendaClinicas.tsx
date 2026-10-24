"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import VerificarEscolar from "@/components/VerificarEscolar";
import { completarRegistro, leerPendiente, type ResultadoRegistro } from "@/lib/registroCliente";
import { UNIVERSIDADES, universidad, type Universidad } from "@/lib/universidades";

// 3.1 · Abrir una agenda de clínicas con una cuenta que ya existe (sin agenda, o que sólo tiene Mi agenda):
// elige universidad → confirma que es estudiante (si su universidad lo pide) → agenda lista.

export default function CrearAgendaClinicas({
  titulo = "Abre tu agenda de clínicas", subtitulo, desdeMi = false, error: error0, autoUni,
}: { titulo?: string; subtitulo?: string; desdeMi?: boolean; error?: string | null; autoUni?: Universidad | null }) {
  const router = useRouter();
  const [uni, setUni] = useState<Universidad | null>(null);
  const [paso, setPaso] = useState<"elegir" | "verificar" | "trabajando" | "listo">(autoUni ? "trabajando" : "elegir");
  const [r, setR] = useState<ResultadoRegistro | null>(null);
  const [error, setError] = useState<string | null>(error0 ?? null);

  async function crear(u: Universidad) {
    setUni(u);
    setPaso("trabajando");
    setError(null);
    const res = await completarRegistro({ ...leerPendiente(), unir: undefined, universidad: u });
    if (!res.ok && res.motivo === "verificar") return setPaso("verificar");
    if (!res.ok) {
      setError(res.error);
      return setPaso("elegir");
    }
    // Que "/" abra la de clínicas (y no la última que usó)
    document.cookie = "ultima_agenda=clinicas; path=/; max-age=31536000; samesite=lax";
    if (res.aviso) {
      setR(res);
      return setPaso("listo");
    }
    router.replace("/");
    router.refresh();
  }

  // Recién registrado (ya eligió universidad en el registro): sigue solo
  useEffect(() => {
    if (autoUni) crear(autoUni);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (paso === "trabajando")
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-label="Preparando tu agenda" />
      </div>
    );

  if (paso === "listo" && r?.ok)
    return (
      <AuthCard titulo="¡Tu agenda está lista!">
        <p className="mb-5 text-sm text-muted">{r.aviso}</p>
        <button className="btn btn-primario w-full" onClick={() => { router.replace("/"); router.refresh(); }}>Entrar</button>
      </AuthCard>
    );

  if (paso === "verificar" && uni)
    return (
      <AuthCard titulo="Confirma que eres estudiante" subtitulo={`Agenda de clínicas · ${universidad(uni).nombre}`}>
        <VerificarEscolar uni={uni} onListo={() => crear(uni)} />
        <button className="mt-4 w-full text-center text-xs text-muted hover:text-ink" onClick={() => setPaso("elegir")}>← Elegir otra universidad</button>
      </AuthCard>
    );

  return (
    <AuthCard titulo={titulo} subtitulo={error ?? subtitulo ?? "Citas, pacientes y tu compañero/a, para tus clínicas de odonto."}>
      <p className="mb-2 text-sm font-medium">¿De qué universidad?</p>
      <div className="mb-1 grid grid-cols-2 gap-2">
        {UNIVERSIDADES.map((u) => (
          <button key={u.id} className="btn btn-primario" onClick={() => crear(u.id)}>{u.nombre}</button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted">La universidad no se puede cambiar después.</p>
      <p className="mb-4 text-xs text-muted">Si ya usaste tu prueba de Pro, tu agenda empieza en Gratis (con lo básico).</p>
      {desdeMi ? (
        <a href="/personal" className="btn btn-sec w-full">Volver a Mi agenda</a>
      ) : (
        <form action="/auth/salir" method="post">
          <button className="btn btn-sec w-full">Cerrar sesión</button>
        </form>
      )}
    </AuthCard>
  );
}
