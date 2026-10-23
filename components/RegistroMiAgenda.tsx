"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/AuthCard";
import { DIAS_PRUEBA_MI } from "@/lib/planMi";

// 2.3 · Registro abierto de Mi agenda (también sale en /registro al elegir "Personal", 2.8): datos → código de 6 dígitos → su agenda con días de Pro de prueba.
// (Si el correo ya tiene cuenta, p. ej. de la agenda de clínicas, entra y la activa desde ahí.)
export default function RegistroMiAgenda({ onVolver }: { onVolver?: () => void } = {}) {
  const router = useRouter();
  const [paso, setPaso] = useState<"datos" | "codigo">("datos");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [yaExiste, setYaExiste] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(espera - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function activar() {
    const r = await fetch("/api/personal/activar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim() }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setCargando(false);
      return setError(d.error ?? "No se pudo crear tu agenda. Intenta entrar.");
    }
    router.replace("/personal");
    router.refresh();
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setYaExiste(false);
    if (!nombre.trim()) return setError("Escribe tu nombre.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    if (!acepto) return setError("Para continuar, acepta el Aviso de privacidad y los Términos.");
    setCargando(true);
    const correo = email.trim().toLowerCase();
    const { data, error } = await createClient().auth.signUp({
      email: correo,
      password,
      options: { data: { nombre: nombre.trim(), personal: true }, emailRedirectTo: `${window.location.origin}/auth/confirm?next=/personal` },
    });
    setCargando(false);
    if (error) {
      if (error.code === "weak_password") return setError("Esa contraseña es muy débil. Prueba una más larga.");
      if (error.code === "over_email_send_rate_limit" || error.status === 429) return setError("Se pidieron muchos códigos seguidos. Espera un minuto e inténtalo otra vez.");
      if (error.code === "user_already_exists") return setYaExiste(true);
      return setError("No se pudo crear la cuenta: " + error.message);
    }
    // Supabase no dice si el correo ya existía: en ese caso regresa un usuario sin identidades
    if (data.user && data.user.identities?.length === 0) return setYaExiste(true);
    if (data.session) {
      setCargando(true);
      return activar();
    }
    setEspera(60);
    setPaso("codigo");
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = otp.replace(/\D/g, "");
    if (token.length < 6) return setError("El código tiene 6 dígitos.");
    setCargando(true);
    const supabase = createClient();
    const correo = email.trim().toLowerCase();
    let r = await supabase.auth.verifyOtp({ email: correo, token, type: "signup" });
    if (r.error) r = await supabase.auth.verifyOtp({ email: correo, token, type: "email" });
    if (r.error) {
      setCargando(false);
      return setError(/expired|invalid/i.test(r.error.message) ? "Ese código no es correcto o ya caducó. Revisa o pide otro." : r.error.message);
    }
    await activar();
  }

  async function reenviar() {
    setError(null);
    const { error } = await createClient().auth.resend({ type: "signup", email: email.trim().toLowerCase() });
    if (error) return setError(error.status === 429 ? "Espera un minuto antes de pedir otro código." : error.message);
    setEspera(60);
  }

  if (paso === "codigo") {
    return (
      <AuthCard logo="/mi-agenda-icon.svg" serif titulo="Revisa tu correo" subtitulo={`Te mandamos un código de 6 dígitos a ${email}. Escríbelo aquí para confirmar que es tuyo.`}>
        <form onSubmit={verificar}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={8}
            className="campo mb-4 text-center text-2xl font-semibold tracking-[0.4em]"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
          {error && <p className="mb-4 text-sm text-danger">{error}</p>}
          <button className="btn btn-primario w-full" disabled={cargando}>{cargando ? "Creando tu agenda…" : "Confirmar"}</button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button className="font-medium text-accent disabled:text-muted" disabled={espera > 0} onClick={reenviar}>
            {espera > 0 ? `Reenviar código (${espera})` : "Reenviar código"}
          </button>
          <button className="text-muted hover:text-ink" onClick={() => { setPaso("datos"); setError(null); }}>Cambiar correo</button>
        </div>
        <p className="mt-4 text-xs text-muted">¿No llega? Revisa Spam o Promociones.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard logo="/mi-agenda-icon.svg" serif titulo="Crea tu agenda" subtitulo={`Gratis para siempre. Cuando quieras, pruebas Pro ${DIAS_PRUEBA_MI} días sin pagar. Sin tarjeta.`}>
      <form onSubmit={registrar}>
        <label className="mb-1 block text-sm font-medium" htmlFor="nombre">¿Cómo te llamas?</label>
        <input id="nombre" required className="campo mb-4" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />

        <label className="mb-1 block text-sm font-medium" htmlFor="email">Correo</label>
        <input id="email" type="email" autoComplete="email" required className="campo mb-4" value={email} onChange={(e) => { setEmail(e.target.value); setYaExiste(false); }} />

        <label className="mb-1 block text-sm font-medium" htmlFor="pw">Contraseña</label>
        <input id="pw" type="password" autoComplete="new-password" required className="campo mb-4" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />

        <label className="mb-1 block text-sm font-medium" htmlFor="pw2">Repítela</label>
        <input id="pw2" type="password" autoComplete="new-password" required className="campo mb-4" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />

        <label className="mb-5 flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>
            Acepto el <Link href="/privacidad#mi-agenda" target="_blank" className="text-accent underline">Aviso de privacidad</Link> y los{" "}
            <Link href="/terminos#mi-agenda" target="_blank" className="text-accent underline">Términos y condiciones</Link>.
          </span>
        </label>

        {yaExiste && (
          <p className="mb-4 rounded-xl bg-panel-2 p-3 text-sm">
            Ese correo ya tiene cuenta (quizá de la agenda de clínicas). <Link href="/login?a=mi" className="font-semibold text-accent underline">Entra con él</Link> y ahí mismo activas tu Mi agenda.
          </p>
        )}
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button className="btn btn-primario w-full" disabled={cargando}>{cargando ? "Creando…" : "Crear mi agenda"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        ¿Ya tienes cuenta? <Link href="/login?a=mi" className="font-medium text-accent hover:underline">Entra</Link>
      </p>
      {onVolver && (
        <p className="mt-2 text-center text-sm">
          <button type="button" onClick={onVolver} className="text-muted hover:text-ink">← Era para la escuela</button>
        </p>
      )}
    </AuthCard>
  );
}
