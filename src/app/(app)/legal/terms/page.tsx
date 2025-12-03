"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a Configuración
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Términos y Condiciones</CardTitle>
          <CardDescription>
            Última actualización: 3 de diciembre de 2025
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  1. Aceptación de los Términos
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Al acceder y utilizar Fynco, usted acepta estar sujeto a estos
                  Términos y Condiciones, todas las leyes y regulaciones
                  aplicables, y acepta que es responsable del cumplimiento de
                  las leyes locales aplicables. Si no está de acuerdo con alguno
                  de estos términos, está prohibido usar o acceder a este sitio.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  2. Descripción del Servicio
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Fynco es una aplicación de gestión financiera personal que le
                  permite:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Registrar y categorizar transacciones financieras</li>
                  <li>Gestionar múltiples cuentas bancarias y financieras</li>
                  <li>Establecer y seguir metas de ahorro</li>
                  <li>Crear y gestionar transacciones recurrentes</li>
                  <li>Visualizar estadísticas y análisis financieros</li>
                  <li>Proteger sus datos con encriptación end-to-end</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  3. Seguridad y Privacidad de Datos
                </h2>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      3.1 Encriptación de Datos
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Todos sus datos financieros sensibles (montos,
                      descripciones, nombres de cuentas) son encriptados usando
                      AES-GCM de 256 bits antes de ser almacenados en nuestra
                      base de datos. La clave de encriptación se deriva de su ID
                      de usuario único y nunca es transmitida o almacenada por
                      nosotros.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      3.2 Imposibilidad de Acceso por Nuestra Parte
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong>IMPORTANTE:</strong> Debido a la arquitectura de
                      encriptación end-to-end, nosotros como empresa NO PODEMOS
                      ver, acceder ni recuperar sus datos financieros. Los datos
                      están encriptados de tal manera que solo usted, con su
                      cuenta autenticada, puede desencriptarlos. Esto garantiza
                      su privacidad máxima.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      3.3 Responsabilidad del Usuario
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Usted es responsable de mantener la seguridad de su
                      cuenta. Si pierde acceso a su cuenta de Firebase
                      Authentication, no podremos recuperar sus datos
                      encriptados. Le recomendamos mantener su información de
                      acceso segura y actualizada.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  4. Registro y Cuenta de Usuario
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">
                    Para utilizar Fynco, debe crear una cuenta proporcionando
                    información precisa y completa. Usted es responsable de:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Mantener la confidencialidad de su contraseña</li>
                    <li>Todas las actividades que ocurran bajo su cuenta</li>
                    <li>
                      Notificarnos inmediatamente de cualquier uso no autorizado
                    </li>
                    <li>
                      Asegurarse de que su información de contacto esté
                      actualizada
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  5. Uso Aceptable
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">Usted se compromete a NO:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Usar el servicio para actividades ilegales o no
                      autorizadas
                    </li>
                    <li>
                      Intentar obtener acceso no autorizado a sistemas o datos
                    </li>
                    <li>Interferir con el funcionamiento del servicio</li>
                    <li>Transmitir virus, malware o código malicioso</li>
                    <li>Compartir su cuenta con terceros</li>
                    <li>
                      Usar el servicio para fines comerciales sin autorización
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  6. Propiedad Intelectual
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  El servicio y su contenido original, características y
                  funcionalidad son propiedad de Fynco y están protegidos por
                  derechos de autor internacionales, marcas registradas,
                  patentes, secretos comerciales y otras leyes de propiedad
                  intelectual. Sus datos financieros permanecen siendo de su
                  propiedad exclusiva.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  7. Limitación de Responsabilidad
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">
                    Fynco se proporciona "tal cual" y "según disponibilidad". No
                    garantizamos que:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      El servicio será ininterrumpido, oportuno o libre de
                      errores
                    </li>
                    <li>
                      Los resultados obtenidos del uso del servicio serán
                      precisos o confiables
                    </li>
                    <li>Los defectos en el software serán corregidos</li>
                  </ul>
                  <p className="leading-relaxed mt-3">
                    En ningún caso Fynco será responsable por daños indirectos,
                    incidentales, especiales, consecuentes o punitivos,
                    incluyendo pérdida de beneficios, datos, uso, o pérdidas
                    intangibles.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  8. Eliminación de Cuenta y Datos
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">
                    Puede eliminar su cuenta en cualquier momento desde la
                    configuración de su perfil. Al eliminar su cuenta:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Se eliminarán permanentemente todos sus datos financieros
                    </li>
                    <li>Se eliminará su cuenta de autenticación</li>
                    <li>Esta acción es irreversible y no puede deshacerse</li>
                    <li>
                      No podremos recuperar sus datos después de la eliminación
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  9. Modificaciones al Servicio
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Nos reservamos el derecho de modificar o discontinuar,
                  temporal o permanentemente, el servicio (o cualquier parte del
                  mismo) con o sin previo aviso. No seremos responsables ante
                  usted o terceros por cualquier modificación, suspensión o
                  discontinuación del servicio.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  10. Cambios en los Términos
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Nos reservamos el derecho de actualizar estos términos en
                  cualquier momento. Le notificaremos sobre cambios materiales
                  publicando los nuevos términos en esta página y actualizando
                  la fecha de "última actualización". Su uso continuado del
                  servicio después de dichos cambios constituye su aceptación de
                  los nuevos términos.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  11. Ley Aplicable
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estos términos se regirán e interpretarán de acuerdo con las
                  leyes aplicables, sin consideración a sus disposiciones sobre
                  conflicto de leyes. Cualquier disputa relacionada con estos
                  términos será resuelta en los tribunales competentes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">12. Contacto</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Si tiene preguntas sobre estos Términos y Condiciones, puede
                  contactarnos en:
                  <br />
                  <strong>Email:</strong> support@fynco.app
                  <br />
                  <strong>Web:</strong> www.fynco.app
                </p>
              </section>

              <section className="border-t pt-4 mt-6">
                <p className="text-sm text-muted-foreground italic">
                  Al usar Fynco, usted reconoce que ha leído, entendido y acepta
                  estar sujeto a estos Términos y Condiciones, así como a
                  nuestra Política de Privacidad.
                </p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
