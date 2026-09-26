"use client";

import { APP_VERSION } from "@/lib/novedades";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/AuthCard";

// Aquí llega el compañero invitado después de abrir el correo: elige su nombre y contraseña.
export default function BienvenidaPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [esDueno, setEsDueno] = useState(false);
  const [acepto, setAcepto] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: perfil } = await supabase.from("perfiles").select("nombre,rol").eq("id", data.user.id).single();
      if (perfil?.nombre) setNombre(perfil.nombre);
      setEsDueno(perfil?.rol === "owner");
    });
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) return setError("Escribe tu nombre.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    if (!acepto) return setError("Para continuar, acepta el Aviso de privacidad y los Términos.");

    setCargando(true);
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setCargando(false);
      if (error.code === "weak_password") return setError("Esa contraseña es muy débil. Prueba una más larga.");
      if (error.status === 401 || error.code === "session_not_found")
        return setError("Tu invitación caducó. Pídele al dueño de la agenda que te la reenvíe.");
      return setError("No se pudo guardar: " + error.message);
    }
    if (u.user) await supabase.from("perfiles").update({ nombre: nombre.trim(), acepto_terminos_at: new Date().toISOString(), version_vista: APP_VERSION }).eq("id", u.user.id);
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthCard
      titulo={esDueno ? "¡Tu agenda está lista!" : "¡Bienvenido/a a la agenda!"}
      subtitulo={
        esDueno
          ? "Crea tu contraseña para entrar. Después podrás invitar a tu compañero/a desde Personalizar."
          : "Te invitaron a compartir la agenda de clínicas. Crea tu contraseña para entrar."
      }
    >
      <form onSubmit={guardar}>
        <label className="mb-1 block text-sm font-medium" htmlFor="nombre">¿Cómo te llamas?</label>
        <input id="nombre" required className="campo mb-4" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Así te verá tu compañero/a" />

        <label className="mb-1 block text-sm font-medium" htmlFor="pw">Contraseña</label>
        <input id="pw" type="password" autoComplete="new-password" required className="campo mb-4" value={password} onChange={(e) => setPassword(e.target.value)} />

        <label className="mb-1 block text-sm font-medium" htmlFor="pw2">Repítela</label>
        <input id="pw2" type="password" autoComplete="new-password" required className="campo mb-5" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />

        <label className="mb-5 flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>
            Acepto el{" "}
            <Link href="/privacidad" target="_blank" className="text-accent underline">Aviso de privacidad</Link> y los{" "}
            <Link href="/terminos" target="_blank" className="text-accent underline">Términos y condiciones</Link>.
          </span>
        </label>

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primario w-full" disabled={cargando}>
          {cargando ? "Guardando…" : "Entrar a la agenda"}
        </button>
      </form>
    </AuthCard>
  );
}
