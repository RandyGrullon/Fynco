import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Las reglas para usar Fynco: qué es, qué no es y tus responsabilidades.",
};

export default function TerminosPage() {
  return (
    <>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Términos de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: 8 de octubre de 2026</p>
      </header>
      <p>
        Estos términos explican las reglas para usar Fynco. Al crear una cuenta o usar la app, los aceptas. Léelos junto con nuestra{" "}
        <Link href="/legal/privacidad" className="font-semibold text-primary underline-offset-4 hover:underline">
          Política de privacidad
        </Link>
        .
      </p>

      <Section title="1. Qué es Fynco">
        <ul>
          <li>Una herramienta para registrar tus cuentas, ingresos y gastos, planificar metas y pagos recurrentes, y dividir gastos con otras personas.</li>
          <li>
            Fynco <strong>no es un banco</strong> ni una entidad financiera: no guarda ni mueve dinero, no procesa pagos y no se conecta a tus cuentas
            bancarias. Los saldos son los que tú registras.
          </li>
          <li>
            Fynco <strong>no da asesoría</strong> financiera, legal, contable ni fiscal. La información que ves, incluida la del asistente, es solo
            orientativa.
          </li>
        </ul>
      </Section>

      <Section title="2. Tu cuenta">
        <ul>
          <li>Debes tener al menos 18 años, o usar Fynco con permiso y supervisión de tu madre, padre o tutor.</li>
          <li>Usa datos reales al registrarte y mantén tu correo al día para poder recuperar el acceso.</li>
          <li>
            Cuida tu contraseña y tu PIN. Eres responsable de lo que se haga con tu cuenta. Si crees que alguien entró sin permiso, cambia tu contraseña y
            escríbenos.
          </li>
        </ul>
      </Section>

      <Section title="3. Uso aceptable">
        <p>Al usar Fynco te comprometes a no:</p>
        <ul>
          <li>Usarlo para actividades ilegales, fraude o lavado de dinero.</li>
          <li>Intentar acceder a datos de otras personas o a partes del sistema que no te corresponden.</li>
          <li>Sobrecargar el servicio o el asistente con usos automatizados o abusivos.</li>
          <li>Registrar en grupos compartidos información de otras personas que no tengas derecho a compartir.</li>
        </ul>
      </Section>

      <Section title="4. Gastos compartidos">
        <ul>
          <li>Lo que registras en un grupo lo ven sus miembros: tu nombre, tu correo, los gastos, los pagos y los saldos.</li>
          <li>
            Los saldos («te deben», «debes») son un cálculo informativo basado en lo que registran los miembros. Fynco no cobra deudas, no garantiza pagos
            y no interviene en desacuerdos entre personas.
          </li>
          <li>Si eliminas tu cuenta, en los grupos quedarás como invitado con tu nombre para que los demás conserven su historial.</li>
        </ul>
      </Section>

      <Section title="5. El asistente">
        <p>
          El asistente usa inteligencia artificial (Google Gemini) y puede equivocarse, entender mal una nota de voz o registrar un monto incorrecto.
          Revisa lo que propone antes de confirmarlo y no tomes decisiones importantes basándote solo en sus respuestas.
        </p>
      </Section>

      <Section title="6. Disponibilidad y tus datos">
        <ul>
          <li>
            Ofrecemos Fynco «tal cual». Trabajamos para que funcione bien y esté disponible, pero puede haber interrupciones, errores o cambios en las
            funciones.
          </li>
          <li>Te recomendamos exportar tus movimientos de vez en cuando (Ajustes → Datos) para tener tu propia copia.</li>
        </ul>
      </Section>

      <Section title="7. Responsabilidad">
        <p>
          En la medida que permita la ley, Fynco no es responsable de pérdidas o decisiones que tomes con base en la información de la app, ni de
          errores en los datos que registres tú u otros miembros de tus grupos.
        </p>
      </Section>

      <Section title="8. Terminación">
        <ul>
          <li>Puedes dejar de usar Fynco y eliminar tu cuenta cuando quieras desde Ajustes → Zona de peligro.</li>
          <li>Podemos suspender o cerrar cuentas que incumplan estos términos o pongan en riesgo el servicio o a otras personas.</li>
        </ul>
      </Section>

      <Section title="9. Cambios">
        <p>
          Podemos actualizar estos términos. Si el cambio es importante, te avisaremos en la app antes de que entre en vigor. Si sigues usando Fynco
          después, se entiende que lo aceptas.
        </p>
      </Section>

      <Section title="10. Ley aplicable">
        <p>Estos términos se rigen por las leyes de la República Dominicana.</p>
      </Section>

      <Section title="11. Contacto">
        <p>
          Escríbenos a{" "}
          <a href="mailto:support@fynco.app" className="font-semibold text-primary underline-offset-4 hover:underline">
            support@fynco.app
          </a>
          .
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}
