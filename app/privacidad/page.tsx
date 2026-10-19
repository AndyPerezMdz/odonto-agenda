import type { Metadata } from "next";
import DocLegal from "@/components/DocLegal";
import { LEGAL } from "@/lib/legal";
import { PAGO_EN_LINEA } from "@/lib/plan";

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
        <li>Tu universidad (la eliges al registrarte) y lo que nos escribas en “¿Qué le falta a tu agenda?”.</li>
        <li>Si eres dueño/a de una agenda: los registros de tus pagos (monto, fecha y clave de rastreo).{PAGO_EN_LINEA ? " Si pagas en línea, el pago lo procesa Mercado Pago: nosotros sólo recibimos el número de operación, el monto y si se aprobó; nunca los datos de tu tarjeta." : " No recibimos ni guardamos datos de tarjetas ni contraseñas bancarias."}</li>
        <li>Si tienes <b>agenda personal</b> (sólo por invitación): lo que captures en ella (eventos, viajes, entregas, recordatorios, categorías y notas). Sólo tú la ves; ni tu compañero/a de clínica ni nadie más.</li>
        <li>Si activas las notificaciones: un identificador técnico de tu navegador para poder mandártelas. Si usas “Tu agenda en tu calendario”: un link privado con un código aleatorio.</li>
      </ul>
      <p><b>De tus pacientes, que tú capturas:</b> nombre, fecha y hora de la cita, clínica, materia y las notas que tú escribas. Si le mandas a tu paciente su link para confirmar, guardamos sólo su respuesta (“sí voy” o “no puedo”) y la hora en que respondió.</p>

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
        <li>Confirmar que tu correo es tuyo (con un código) al registrarte.</li>
        <li>Controlar la prueba de Pro (una por persona) y registrar si llegaste con el código de alguien que te recomendó.</li>
        <li>Darte soporte cuando lo pidas, y leer (y responderte por correo) lo que nos mandes en “¿Qué le falta a tu agenda?”.</li>
        <li>Mandarte avisos generales del servicio (por ejemplo, una actualización o un mantenimiento) dentro de la agenda o por correo.</li>
      </ul>
      <p>No usamos tus datos para publicidad ni para enviarte promociones, y no los vendemos ni rentamos a nadie.</p>

      <h2>5. Datos de tus pacientes</h2>
      <p>
        Tú decides qué datos de tus pacientes capturas y eres responsable de ellos frente a tus pacientes. Nosotros los tratamos
        únicamente <b>por tu cuenta y para darte el servicio</b> (guardarlos, mostrártelos y enviarte recordatorios); no los usamos
        para ningún otro fin. Si guardas el <b>teléfono</b> de un paciente, es sólo para que tú lo contactes por WhatsApp desde tu
        celular: la plataforma no le envía mensajes. Antes de anotarlo, pídele permiso. El link para confirmar que tú le mandas abre una página que sólo muestra su nombre de pila, la fecha, la hora, la clínica y tu nombre de pila; no se indexa en buscadores y deja de servir si cancelas la cita. El <b>No. de historia clínica</b> y el
        <b> folio</b> del tratamiento son sólo números de control para que los tengas a la mano; el expediente clínico se queda
        en tu facultad, no aquí.
      </p>

      <h2>6. Con quién compartimos datos</h2>
      <ul>
        <li><b>Tu compañero/a de agenda</b> ve las citas, nombres y catálogos de la agenda que comparten.</li>
        <li>
          <b>Proveedores que nos ayudan a operar</b> el servicio, sólo para ese fin: alojamiento de base de datos y autenticación
          (Supabase), alojamiento de la página (Vercel), envío de correos (Resend),{PAGO_EN_LINEA ? " cobros en línea (Mercado Pago)," : ""} y, si las activas, el servicio de notificaciones de tu navegador (Google, Apple o Mozilla), que sólo recibe el texto del aviso cifrado. Algunos de sus servidores pueden estar fuera de México.
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
        <li>Lo único que conservamos después es tu <b>correo</b> junto con la fecha en que usaste tu prueba de Pro, para que sea uno por persona. Si quieres que lo borremos, pídelo como se indica abajo.</li>
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
