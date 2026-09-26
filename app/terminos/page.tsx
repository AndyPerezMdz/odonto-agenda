import type { Metadata } from "next";
import Link from "next/link";
import DocLegal from "@/components/DocLegal";
import { LEGAL } from "@/lib/legal";

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
        <li>Sólo se entra por invitación. Cada agenda tiene un <b>dueño/a</b> y, como máximo, <b>un compañero/a</b>.</li>
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
        <li>El precio es mensual <b>por agenda</b> (dueño/a y compañero/a). El monto y los datos para transferir aparecen en <b>Personalizar → Suscripción</b>.</li>
        <li>Paga por transferencia con el <b>concepto</b> indicado y presiona <b>“Ya pagué”</b>. El pago se confirma manualmente y te avisamos por correo.</li>
        <li>Si la suscripción vence, tienes <b>{L.diasGracia} días de gracia</b>. Después, la agenda queda en <b>sólo lectura</b> (puedes ver tus citas, pero no agendar ni editar) hasta que se registre el pago.</li>
        <li>Los meses ya pagados no son reembolsables, salvo que se haya cobrado por error.</li>
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
    </DocLegal>
  );
}
