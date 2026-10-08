import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guarda Fynco, cómo los protege y qué puedes hacer con ellos.",
};

export default function PrivacidadPage() {
  return (
    <>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Política de privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: 8 de octubre de 2026</p>
      </header>
      <p>
        Fynco es una app para organizar tus finanzas personales y dividir gastos con otras personas. Aquí te explicamos, sin letra pequeña, qué datos
        guardamos, dónde, quién los puede ver y qué puedes hacer con ellos.
      </p>

      <Section title="1. Qué datos guardamos">
        <ul>
          <li>
            <strong>Tu cuenta:</strong> nombre, correo y, si entras con Google, la foto de perfil que Google comparte. Tu contraseña la gestiona el
            servicio de autenticación y nunca la vemos.
          </li>
          <li>
            <strong>Lo que tú registras:</strong> cuentas, saldos iniciales, movimientos, categorías, recurrentes y metas.
          </li>
          <li>
            <strong>Gastos compartidos:</strong> los grupos que creas o a los que te unes, sus miembros (incluido el correo de quien invites), los
            gastos y los pagos.
          </li>
          <li>
            <strong>Preferencias:</strong> moneda principal, «ocultar montos» y bloqueo con PIN.
          </li>
          <li>
            <strong>Tu PIN</strong>, guardado solo como hash (ver punto 4).
          </li>
        </ul>
        <p>
          Fynco no se conecta a tu banco ni te pide claves bancarias. Los montos y saldos son los que tú escribes.
        </p>
      </Section>

      <Section title="2. Dónde se guardan y cómo se protegen">
        <ul>
          <li>
            Tus datos se guardan en <strong>Supabase</strong>, un servicio de base de datos (Postgres) y autenticación. La web se sirve desde un
            proveedor de alojamiento (Vercel).
          </li>
          <li>
            La base de datos usa <strong>seguridad a nivel de fila</strong>: cada consulta se filtra en el servidor para que solo puedas leer tus propios
            datos y los de los grupos a los que perteneces.
          </li>
          <li>
            Los datos viajan <strong>cifrados</strong> entre tu dispositivo y el servidor (HTTPS) y el proveedor los guarda <strong>cifrados en
            reposo</strong>.
          </li>
          <li>
            Para ser claros: Fynco <strong>no</strong> usa cifrado de extremo a extremo ni un cifrado adicional propio dentro de la app. Eso significa
            que, técnicamente, el proveedor de la base de datos y las personas que administran Fynco con acceso a la infraestructura podrían acceder a
            los datos. Solo lo hacemos cuando es necesario para operar el servicio o resolver un problema que nos pidas.
          </li>
        </ul>
      </Section>

      <Section title="3. Gastos compartidos: qué ven los demás">
        <p>Cuando estás en un grupo o en un gasto directo con alguien, los demás miembros pueden ver:</p>
        <ul>
          <li>Tu nombre, tu correo y tu foto de perfil.</li>
          <li>Los gastos y pagos registrados en ese grupo (incluidos los tuyos) y los saldos de cada persona.</li>
        </ul>
        <p>
          No ven tus cuentas, tus movimientos personales, tus metas ni tus gastos de otros grupos. Si ligas un gasto compartido a una de tus cuentas, ese
          movimiento sigue siendo privado.
        </p>
      </Section>

      <Section title="4. Tu PIN">
        <p>
          El PIN se guarda como un hash <strong>bcrypt</strong>, nunca en texto. Se verifica en el servidor y, tras varios intentos fallidos, se bloquea
          por un tiempo que aumenta con cada bloqueo. El PIN protege la app contra el acceso casual a tu dispositivo; no reemplaza tu contraseña.
        </p>
      </Section>

      <Section title="5. El asistente y las notas de voz">
        <ul>
          <li>
            Cuando usas el asistente, enviamos tu pregunta y <strong>solo los datos necesarios para responderla</strong> (por ejemplo, saldos,
            movimientos o categorías relevantes) a <strong>Google Gemini</strong>, el servicio de inteligencia artificial de Google. Si no usas el
            asistente, no se envía nada.
          </li>
          <li>
            Las <strong>notas de voz</strong> se procesan para transcribirlas y <strong>no se guardan</strong>.
          </li>
          <li>Las respuestas del asistente las genera una IA y pueden tener errores. Revísalas antes de tomar decisiones.</li>
        </ul>
      </Section>

      <Section title="6. Para qué usamos tus datos">
        <ul>
          <li>Solo para darte el servicio: mostrar tus cuentas, calcular saldos, dividir gastos y responder al asistente.</li>
          <li>No vendemos tus datos, no mostramos publicidad y no usamos cookies de publicidad ni de analítica de terceros.</li>
          <li>
            Solo los compartimos con los proveedores necesarios para funcionar (Supabase, el alojamiento de la web y Google para entrar con Google o
            para el asistente) o si una autoridad competente lo exige conforme a la ley.
          </li>
        </ul>
      </Section>

      <Section title="7. Cookies y almacenamiento en tu dispositivo">
        <p>
          Usamos cookies estrictamente necesarias para mantener tu sesión iniciada y el almacenamiento del navegador para recordar, por ejemplo, si
          desbloqueaste la app con tu PIN. Al cerrar sesión se borran.
        </p>
      </Section>

      <Section title="8. Tus derechos">
        <ul>
          <li>
            <strong>Acceder y llevarte tus datos:</strong> en Ajustes → Datos puedes exportar todos tus movimientos en CSV.
          </li>
          <li>
            <strong>Corregirlos:</strong> puedes editar o borrar cualquier dato desde la app.
          </li>
          <li>
            <strong>Eliminar tu cuenta:</strong> en Ajustes → Zona de peligro. Se borran tu perfil, tu PIN y todos tus datos personales (cuentas,
            movimientos, recurrentes y metas). En los grupos compartidos quedarás como invitado con tu nombre, para que los demás conserven su historial y
            sus saldos.
          </li>
        </ul>
        <p>
          Las copias de seguridad del proveedor pueden conservar datos borrados durante un tiempo limitado, hasta que se renuevan.
        </p>
      </Section>

      <Section title="9. Cuánto tiempo los guardamos">
        <p>Mientras tengas una cuenta. Si la eliminas, se borran como se explica arriba.</p>
      </Section>

      <Section title="10. Cambios a esta política">
        <p>Si cambiamos algo importante, te avisaremos en la app antes de que entre en vigor.</p>
      </Section>

      <Section title="11. Contacto">
        <p>
          ¿Dudas o solicitudes sobre tus datos? Escríbenos a{" "}
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
