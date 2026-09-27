import type { Metadata } from "next";
import DocLegal from "@/components/DocLegal";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso de privacidad — Agenda de clínicas" };

export default function PrivacidadPage() {
  const L = LEGAL;
  return (
    <DocLegal titulo="Aviso de privacidad">
      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        <b>{L.responsable}</b>, con domicilio en {L.domicilio}, es responsable del tratamiento de los datos personales de las
        personas usuarias de <b>{L.servicio}</b> (“la agenda”). Puedes contactarnos en <a href={`mailto:${L.correo}`}>{L.correo}</a>.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <p><b>De ti, como usuario/a:</b></p>
      <ul>
        <li>Nombre y correo electrónico.</li>
        <li>Contraseña (se guarda cifrada; nadie, ni nosotros, puede verla).</li>
        <li>Tus preferencias dentro de la agenda (colores, recordatorios, etc.).</li>
        <li>Si eres dueño/a de una agenda: los registros de tus pagos (monto, fecha y clave de rastreo). No recibimos ni guardamos datos de tarjetas ni contraseñas bancarias.</li>
      </ul>
      <p><b>De tus pacientes, que tú capturas:</b> nombre, fecha y hora de la cita, clínica, materia y las notas que tú escribas.</p>

      <h2>3. Datos sensibles</h2>
      <p>
        <b>No solicitamos datos sensibles.</b> La agenda sirve para organizar citas, no es un expediente clínico. Te pedimos que
        <b> no captures diagnósticos, padecimientos, tratamientos ni otros datos de salud</b> de tus pacientes en las notas; usa
        sólo lo necesario para organizarte (por ejemplo, “traer radiografía”).
      </p>

      <h2>4. Para qué usamos tus datos</h2>
      <ul>
        <li>Crear y administrar tu cuenta, e iniciar sesión de forma segura.</li>
        <li>Mostrar la agenda compartida entre tú y tu compañero/a.</li>
        <li>Enviarte recordatorios de citas y avisos de tu cuenta (invitaciones, cambio de contraseña, pagos y vencimientos).</li>
        <li>Administrar tu suscripción y confirmar tus pagos.</li>
        <li>Controlar el mes gratis (uno por persona) y registrar si llegaste con el código de alguien que te recomendó.</li>
        <li>Darte soporte cuando lo pidas.</li>
      </ul>
      <p>No usamos tus datos para publicidad ni para enviarte promociones, y no los vendemos ni rentamos a nadie.</p>

      <h2>5. Datos de tus pacientes</h2>
      <p>
        Tú decides qué datos de tus pacientes capturas y eres responsable de ellos frente a tus pacientes. Nosotros los tratamos
        únicamente <b>por tu cuenta y para darte el servicio</b> (guardarlos, mostrártelos y enviarte recordatorios); no los usamos
        para ningún otro fin.
      </p>

      <h2>6. Con quién compartimos datos</h2>
      <ul>
        <li><b>Tu compañero/a de agenda</b> ve las citas, nombres y catálogos de la agenda que comparten.</li>
        <li>
          <b>Proveedores que nos ayudan a operar</b> el servicio, sólo para ese fin: alojamiento de base de datos y autenticación
          (Supabase), alojamiento de la página (Vercel) y envío de correos (Resend). Algunos de sus servidores pueden estar fuera de México.
        </li>
        <li><b>Autoridades</b>, sólo cuando una ley o una orden legal lo exija.</li>
      </ul>

      <h2>7. Cómo protegemos los datos</h2>
      <p>
        El acceso es sólo con correo y contraseña y por invitación; cada agenda está aislada de las demás; y las conexiones van
        cifradas.
      </p>

      <h2>8. Cuánto tiempo los conservamos</h2>
      <ul>
        <li>Mientras tu cuenta esté activa.</li>
        <li>Cuando el dueño/a quita a un compañero/a, se borran su cuenta y sus citas.</li>
        <li>Si cancelas el servicio, borramos la agenda y sus datos en un máximo de {L.diasBorrado} días.</li>
        <li>Lo único que conservamos después es tu <b>correo</b> junto con la fecha en que usaste tu mes gratis, para que sea uno por persona. Si quieres que lo borremos, pídelo como se indica abajo.</li>
      </ul>

      <h2>9. Tus derechos (ARCO) y cómo ejercerlos</h2>
      <p>
        Puedes <b>acceder</b> a tus datos, <b>rectificarlos</b>, <b>cancelarlos</b> u <b>oponerte</b> a su uso, así como revocar tu
        consentimiento. Escríbenos a <a href={`mailto:${L.correo}`}>{L.correo}</a> indicando tu nombre, el correo de tu cuenta, qué
        derecho quieres ejercer y sobre qué datos. Te responderemos en un plazo máximo de 20 días hábiles. Tu nombre y color
        también los puedes cambiar tú mismo/a en <b>Personalizar</b>.
      </p>

      <h2>10. Cookies</h2>
      <p>
        Usamos sólo lo indispensable para mantener tu sesión iniciada y recordar el tema de colores en tu navegador. No usamos
        cookies de publicidad ni de rastreo.
      </p>

      <h2>11. Cambios a este aviso</h2>
      <p>Si cambiamos este aviso, publicaremos la nueva versión en esta página con su fecha de actualización.</p>
    </DocLegal>
  );
}
