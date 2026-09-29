"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/AuthCard";
import { UNIVERSIDADES } from "@/lib/universidades";
import { completarRegistro, guardarPendiente, leerPendiente, type ResultadoRegistro } from "@/lib/registroCliente";

type Enlace = { agenda: string; dueno: string | null; ocupada: boolean };

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <Registro />
    </Suspense>
  );
}

// Registro libre: datos → código de 6 dígitos que llega al correo → agenda lista.
// Con ?unir=TOKEN (link del dueño) la persona entra a esa agenda como compañero/a.
function Registro() {
  const router = useRouter();
  const q = useSearchParams();
  const unir = q.get("unir") ?? "";
  const [paso, setPaso] = useState<"datos" | "codigo" | "listo">(q.get("confirmar") ? "codigo" : "datos");
  const [enlace, setEnlace] = useState<Enlace | null>(null);
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState(q.get("confirmar") ?? "");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [codigoCreador, setCodigoCreador] = useState("");
  const [uni, setUni] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);
  const [resultado, setResultado] = useState<ResultadoRegistro | null>(null);

  // ¿A qué agenda invita el link?
  useEffect(() => {
    if (!unir) return;
    fetch(`/api/registro/enlace?t=${encodeURIComponent(unir)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) setEnlace(d);
        else setErrorEnlace(d.error ?? "Ese link ya no sirve.");
      })
      .catch(() => setErrorEnlace("No se pudo revisar el link."));
  }, [unir]);

  // Si ya tiene sesión (p. ej. abrió el link estando dentro), se une directo o se va a su agenda
  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user?.email_confirmed_at) return;
      if (!unir) return router.replace("/");
      setCargando(true);
      const r = await completarRegistro({ unir });
      setCargando(false);
      terminar(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(espera - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function terminar(r: ResultadoRegistro) {
    if (r.ok && !r.aviso) {
      router.replace("/");
      router.refresh();
      return;
    }
    setResultado(r);
    setPaso("listo");
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) return setError("Escribe tu nombre.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    if (!unir && !uni) return setError("Elige tu universidad.");
    if (!acepto) return setError("Para continuar, acepta el Aviso de privacidad y los Términos.");

    setCargando(true);
    const correo = email.trim().toLowerCase();
    guardarPendiente({ nombre: nombre.trim(), codigo: codigoCreador.trim(), unir, email: correo, universidad: uni || undefined });
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: { data: { nombre: nombre.trim() }, emailRedirectTo: `${window.location.origin}/auth/confirm?next=/` },
    });
    setCargando(false);
    if (error) {
      if (error.code === "weak_password") return setError("Esa contraseña es muy débil. Prueba una más larga.");
      if (error.code === "over_email_send_rate_limit" || error.status === 429) return setError("Se pidieron muchos códigos seguidos. Espera un minuto e inténtalo otra vez.");
      if (error.code === "user_already_exists") return setError("Ese correo ya tiene cuenta. Inicia sesión.");
      return setError("No se pudo crear la cuenta: " + error.message);
    }
    // Supabase no dice si el correo ya existía: en ese caso regresa un usuario sin identidades
    if (data.user && data.user.identities?.length === 0) {
      return setError(unir ? "Ese correo ya tiene cuenta. Inicia sesión y vuelve a abrir el link." : "Ese correo ya tiene cuenta. Inicia sesión.");
    }
    if (data.session) {
      // (si algún día apagas "Confirm email", entra directo)
      setCargando(true);
      terminar(await completarRegistro(leerPendiente()));
      return;
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
    terminar(await completarRegistro(leerPendiente()));
    setCargando(false);
  }

  async function reenviar() {
    setError(null);
    const { error } = await createClient().auth.resend({ type: "signup", email: email.trim().toLowerCase() });
    if (error) return setError(error.status === 429 ? "Espera un minuto antes de pedir otro código." : error.message);
    setEspera(60);
  }

  if (paso === "listo" && resultado) {
    return (
      <AuthCard titulo={resultado.ok ? "¡Tu agenda está lista!" : "Tu cuenta quedó creada"} subtitulo={resultado.ok ? undefined : "Pero no pudimos meterte a esa agenda."}>
        <p className={`mb-5 text-sm ${resultado.ok ? "text-muted" : "text-danger"}`}>{resultado.ok ? resultado.aviso : resultado.error}</p>
        {!resultado.ok && (
          <button
            className="btn btn-primario mb-2 w-full"
            disabled={cargando}
            onClick={async () => {
              setCargando(true);
              const r = await completarRegistro({ nombre: leerPendiente().nombre });
              setCargando(false);
              terminar(r);
            }}
          >
            {cargando ? "Creando…" : "Mejor crear mi propia agenda"}
          </button>
        )}
        <button className={`btn w-full ${resultado.ok ? "btn-primario" : "btn-sec"}`} onClick={() => { router.replace("/"); router.refresh(); }}>
          Entrar
        </button>
      </AuthCard>
    );
  }

  if (paso === "codigo") {
    return (
      <AuthCard titulo="Revisa tu correo" subtitulo={`Te mandamos un código de 6 dígitos a ${email || "tu correo"}. Escríbelo aquí para confirmar que es tuyo.`}>
        <form onSubmit={verificar}>
          {!email && (
            <input type="email" required className="campo mb-3" placeholder="Tu correo" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
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
          <button className="btn btn-primario w-full" disabled={cargando}>{cargando ? "Confirmando…" : "Confirmar"}</button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button className="font-medium text-accent disabled:text-muted" disabled={espera > 0} onClick={reenviar}>
            {espera > 0 ? `Reenviar código (${espera})` : "Reenviar código"}
          </button>
          <button className="text-muted hover:text-ink" onClick={() => { setPaso("datos"); setError(null); }}>Cambiar correo</button>
        </div>
        <p className="mt-4 text-xs text-muted">¿No llega? Revisa Spam o Promociones. Viene de “Agenda de clínicas”.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo={unir ? "Únete a la agenda" : "Crea tu agenda"}
      subtitulo={
        unir
          ? enlace
            ? `${enlace.dueno ?? "Tu compañero/a"} te invitó a compartir “${enlace.agenda}”.`
            : errorEnlace ?? "Revisando el link…"
          : "Un mes gratis para probarla. Luego $200 al mes por pareja de clínica."
      }
    >
      {unir && enlace?.ocupada && <p className="mb-4 rounded-lg bg-panel-2 p-3 text-sm text-danger">Esa agenda ya tiene compañero/a. Si te registras, se te crea tu propia agenda.</p>}
      <form onSubmit={registrar}>
        <label className="mb-1 block text-sm font-medium" htmlFor="nombre">¿Cómo te llamas?</label>
        <input id="nombre" required className="campo mb-4" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Así te verá tu compañero/a" />

        <label className="mb-1 block text-sm font-medium" htmlFor="email">Correo</label>
        <input id="email" type="email" autoComplete="email" required className="campo mb-4" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="mb-1 block text-sm font-medium" htmlFor="pw">Contraseña</label>
        <input id="pw" type="password" autoComplete="new-password" required className="campo mb-4" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />

        <label className="mb-1 block text-sm font-medium" htmlFor="pw2">Repítela</label>
        <input id="pw2" type="password" autoComplete="new-password" required className="campo mb-4" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />

        {!unir && (
          <>
            <p className="mb-1 block text-sm font-medium" id="uni">Universidad</p>
            <div className="mb-1 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="uni">
              {UNIVERSIDADES.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={uni === u.id}
                  onClick={() => { setUni(u.id); setError(null); }}
                  className={`rounded-xl border px-3 py-2.5 text-left ${uni === u.id ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2"}`}
                >
                  <span className={`block font-semibold ${uni === u.id ? "text-accent" : ""}`}>{u.nombre}</span>
                  <span className="text-xs text-muted">{u.periodos === "semestre" ? "Semestres" : "Cuatrimestres"}</span>
                </button>
              ))}
            </div>
            <p className="mb-4 text-xs text-muted">Tu agenda se arma para tu universidad. <b>No se puede cambiar después.</b></p>

            <label className="mb-1 block text-sm font-medium" htmlFor="codigo">
              Código de creador <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input id="codigo" className="campo mb-1 uppercase placeholder:normal-case" value={codigoCreador} onChange={(e) => setCodigoCreador(e.target.value)} placeholder="Si alguien te recomendó, pon su código" />
            <p className="mb-4 text-xs text-muted">Te da tiempo gratis extra.</p>
          </>
        )}

        <label className="mb-5 flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>
            Acepto el <Link href="/privacidad" target="_blank" className="text-accent underline">Aviso de privacidad</Link> y los{" "}
            <Link href="/terminos" target="_blank" className="text-accent underline">Términos y condiciones</Link>.
          </span>
        </label>

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <button className="btn btn-primario w-full" disabled={cargando}>{cargando ? "Creando…" : "Crear cuenta"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        ¿Ya tienes cuenta? <Link href="/login" className="font-medium text-accent hover:underline">Inicia sesión</Link>
      </p>
    </AuthCard>
  );
}
