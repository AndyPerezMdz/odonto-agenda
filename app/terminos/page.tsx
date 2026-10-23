import type { Metadata } from "next";
import Link from "next/link";
import DocLegal from "@/components/DocLegal";
import { LEGAL } from "@/lib/legal";
import { PAGO_EN_LINEA } from "@/lib/plan";

export const metadata: Metadata = { title: "Términos y condiciones — Agenda de clínicas" };

export default function TerminosPage() {
  const L = LEGAL;
  return (
    <DocLegal titulo="Términos y condiciones">
      <p>
        Estos términos aplican al uso de <b>{L.servicio}</b>, que ofrece {L.responsable}. Al crear tu cuenta aceptas estos términos
        y el <Link href="/privacidad">Aviso de privacidad</Link>.
      </p>

      <h2>1. Qué es el servicio</h2>
      <p>
        Una agenda en línea para que dos personas organicen citas de pacientes: nombre, fecha, hora, clínica, materia y notas.
        <b> No es un expediente clínico</b> ni sustituye los registros oficiales que pida tu institución.
      </p>

      <h2>2. Cuentas</h2>
      <ul>
        <li>Cualquier persona puede crear su cuenta en <b>/registro</b>, confirmando su correo con un código. Quien crea una agenda es su <b>dueño/a</b> y puede tener, como máximo, <b>un compañero/a</b>, que entra por invitación (correo o link).</li>
        <li>El dueño/a decide a quién invita y puede quitar a su compañero/a; al hacerlo se borran la cuenta y las citas de esa persona.</li>
        <li>Tu contraseña es personal: no la compartas. Eres responsable de lo que se haga con tu cuenta.</li>
      </ul>

      <h2>3. Uso correcto</h2>
      <ul>
        <li>Captura sólo los datos necesarios para organizarte. <b>No escribas diagnósticos ni datos de salud</b> de tus pacientes.</li>
        <li>Respeta la privacidad de tus pacientes y las reglas de tu institución.</li>
        <li>No uses la agenda para nada ilegal ni intentes acceder a agendas que no son tuyas.</li>
      </ul>

      <h2>4. Suscripción y pagos</h2>
      <ul>
        <li>La agenda tiene dos niveles <b>por agenda</b> (dueño/a y compañero/a): <b>Gratis</b>, sin costo y sin fecha de fin, con lo necesario para la clínica (agenda compartida, citas, asistencia, horario, folios, avance del periodo actual); y <b>Pro</b>, de paga, que agrega funciones como recordatorios, notificaciones, historial completo, PDF, pacientes, confirmación del paciente con link y, en la UADY, ritmo, material y turnos. La lista vigente está en <b>Personalizar → Suscripción</b>.</li>
        <li>Pro se paga por adelantado por el plan que elijas (los disponibles aparecen ahí mismo; los planes más largos cuestan menos por mes). Los precios aparecen en <b>Personalizar → Suscripción</b>.</li>
        {PAGO_EN_LINEA ? (
          <li>Puedes pagar en línea con tarjeta u OXXO a través de <b>Mercado Pago</b>, que procesa el pago (nosotros no vemos ni guardamos los datos de tu tarjeta), o por transferencia con el <b>concepto</b> indicado y presionando <b>“Ya pagué”</b>; la transferencia se confirma manualmente. Te avisamos por correo.</li>
        ) : (
          <li>Se paga por transferencia con el <b>concepto</b> indicado y presionando <b>“Ya pagué”</b>. El pago se confirma manualmente y te avisamos por correo.</li>
        )}
        <li>Pro no se renueva solo. Cuando termina, la agenda <b>pasa a Gratis</b>: no se borra nada y lo que capturaste con Pro vuelve a verse al renovar.</li>
        <li>Los periodos ya pagados no son reembolsables, salvo que se haya cobrado por error.</li>
        <li><b>Prueba de Pro:</b> {L.diasPrueba} días, una por persona, seas dueño/a o compañero/a. Las agendas nuevas empiezan en Gratis y el dueño/a activa la prueba <b>cuando quiera</b> (al activarla se usa la suya y la de su compañero/a). Si entras a una agenda que está en su prueba, usas la tuya. A una agenda con Pro pagado puedes entrar sin gastarla. Si dejas una agenda en su prueba para entrar a una pagada dentro de los primeros 7 días, te la devolvemos (sólo una vez).</li>
        <li><b>Códigos de creador:</b> dan días extra de Pro (normalmente {L.diasCodigo}) a la prueba de una agenda: se guardan al registrarte o antes de activarla y se suman al activarla. Sólo uno por agenda.</li>
        <li>Si ya usaste tu prueba y creas una agenda nueva, ya no tiene prueba: sigue en Gratis hasta que elijas un plan.</li>
        <li>Si el precio cambia, te avisaremos con al menos 30 días de anticipación.</li>
      </ul>

      <h2>5. Disponibilidad</h2>
      <p>
        Hacemos lo posible por que la agenda funcione siempre, pero puede haber interrupciones por mantenimiento o fallas de
        proveedores. Los recordatorios por correo pueden retrasarse o llegar a Spam: <b>no dependas sólo de ellos</b> para tus citas.
      </p>

      <h2>6. Responsabilidad</h2>
      <p>
        El servicio se ofrece “tal cual”. En la medida que lo permita la ley, nuestra responsabilidad total se limita a lo que hayas
        pagado en los últimos 3 meses. No somos responsables por citas perdidas, datos capturados incorrectamente ni por el uso
        que cada persona haga de su cuenta.
      </p>

      <h2>7. Cancelación</h2>
      <p>
        Puedes cancelar cuando quieras escribiendo a <a href={`mailto:${L.correo}`}>{L.correo}</a>. Si lo pides, antes te enviamos
        una copia de tus citas. Después borramos la agenda y sus datos en un máximo de {L.diasBorrado} días. También podemos
        suspender una cuenta que incumpla estos términos.
      </p>

      <h2>8. Cambios</h2>
      <p>Si cambiamos estos términos, publicaremos la nueva versión en esta página. Seguir usando la agenda implica aceptarlos.</p>

      <h2>9. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de México.</p>

      <h2 id="mi-agenda">10. Mi agenda (agenda personal)</h2>
      <p>
        <b>Mi agenda</b> es una agenda personal aparte, para cualquier persona (no sólo de odonto): eventos, viajes, entregas,
        recordatorios y categorías. Aplican estos mismos términos, con lo siguiente:
      </p>
      <ul>
        <li>Cualquier persona puede crearla en <Link href="/mi-agenda/registro">/mi-agenda/registro</Link> (o activarla desde su agenda de clínicas). Empieza en <b>Gratis</b>, y la persona activa sus <b>{L.diasPrueba} días de Pro</b> de prueba cuando quiera, <b>una vez por correo</b>.</li>
        <li>Tiene dos planes: <b>Gratis</b> (eventos, entregas, recordatorios con aviso en el cel, repetir, pendientes y hábitos sin límite) y <b>Pro</b> (además viajes con itinerario, maleta, reservas y gastos, pagos fijos, tus categorías y colores, correo de la mañana, resumen diario en el cel y calendario). Los precios de Pro están en <Link href="/mi-agenda">/mi-agenda</Link> y en “Tu plan”; si cambian, no afectan lo que ya pagaste.</li>
        <li>Pro se paga por adelantado, por transferencia, y se activa cuando confirmamos tu pago. <b>No hay cargos automáticos</b>: al terminar tu tiempo, tu agenda baja a Gratis y no pierdes lo que anotaste. Lo pagado no es reembolsable, salvo error nuestro.</li>
        <li>Si también usas la agenda de clínicas y esa agenda tiene Pro (pagado, en prueba o de cortesía), tu Mi agenda también es Pro mientras dure, sin pagar extra.</li>
        <li>Es de una sola persona: no se comparte ni tiene compañero/a. Si también usas la agenda de clínicas, es la misma cuenta y cambias entre las dos.</li>
        <li>Podemos pausarla o darla de baja si se usa para algo distinto a organizarte, o si lo pides tú. Al darla de baja se borran sus eventos y categorías.</li>
        <li>No es un servicio de alarmas: los avisos por correo, notificación o calendario pueden llegar tarde o no llegar.</li>
      </ul>
    </DocLegal>
  );
}
