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

export default function PrivacyPage() {
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
          <CardTitle className="text-3xl">Política de Privacidad</CardTitle>
          <CardDescription>
            Última actualización: 3 de diciembre de 2025
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Introducción</h2>
                <p className="text-muted-foreground leading-relaxed">
                  En Fynco, su privacidad es nuestra máxima prioridad. Esta
                  Política de Privacidad explica cómo recopilamos, usamos,
                  compartimos y protegemos su información personal cuando
                  utiliza nuestra aplicación de gestión financiera.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  2. Información que Recopilamos
                </h2>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      2.1 Información de Cuenta
                    </h3>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>Dirección de correo electrónico</li>
                      <li>Nombre de usuario</li>
                      <li>
                        ID de usuario único generado por Firebase Authentication
                      </li>
                      <li>Fecha de creación de cuenta</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      2.2 Información Financiera (Encriptada)
                    </h3>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>
                        Transacciones financieras (montos, descripciones,
                        categorías)
                      </li>
                      <li>
                        Cuentas bancarias y financieras (nombres, balances,
                        tipos)
                      </li>
                      <li>
                        Metas de ahorro (nombres, montos objetivo, progreso)
                      </li>
                      <li>Transacciones recurrentes</li>
                      <li>Movimientos y actividad financiera</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      2.3 Información de Uso
                    </h3>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                      <li>
                        Preferencias de configuración (tema, moneda, idioma)
                      </li>
                      <li>
                        Configuración de seguridad (PIN habilitado, biometría
                        habilitada)
                      </li>
                      <li>Registros de actividad y auditoría</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  3. Encriptación End-to-End
                </h2>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-3">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    🔒 Su Privacidad está Garantizada
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                    Todos sus datos financieros sensibles están encriptados
                    usando AES-GCM de 256 bits ANTES de ser enviados a nuestros
                    servidores. Nosotros NO PODEMOS ver ni acceder a sus datos
                    financieros porque la clave de encriptación se deriva de su
                    ID de usuario único y nunca sale de su dispositivo.
                  </p>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">
                    <strong>Cómo funciona:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Cada dato sensible se encripta en su dispositivo antes de
                      ser almacenado
                    </li>
                    <li>
                      La clave de encriptación se deriva de su UID + salt único
                      usando PBKDF2
                    </li>
                    <li>
                      Solo su dispositivo autenticado puede desencriptar los
                      datos
                    </li>
                    <li>
                      Nuestros servidores solo almacenan datos encriptados
                      ilegibles
                    </li>
                    <li>
                      Ni siquiera los administradores de Fynco pueden ver sus
                      datos financieros
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  4. Cómo Usamos su Información
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">
                    Usamos la información recopilada para:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Proporcionar y mantener el servicio de Fynco</li>
                    <li>Autenticar su identidad y proteger su cuenta</li>
                    <li>
                      Procesar y almacenar sus transacciones financieras
                      (encriptadas)
                    </li>
                    <li>Mejorar y optimizar nuestra aplicación</li>
                    <li>
                      Comunicarnos con usted sobre actualizaciones del servicio
                    </li>
                    <li>Detectar y prevenir fraude o uso no autorizado</li>
                    <li>Cumplir con obligaciones legales</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  5. Compartición de Información
                </h2>
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-green-900 dark:text-green-100 font-semibold mb-2">
                      ✓ NO Vendemos Sus Datos
                    </p>
                    <p className="text-green-800 dark:text-green-200 text-sm">
                      Nunca vendemos, alquilamos ni compartimos su información
                      personal con terceros para fines de marketing.
                    </p>
                  </div>
                  <div className="text-muted-foreground">
                    <p className="leading-relaxed mb-2">
                      Solo compartimos información en las siguientes
                      circunstancias limitadas:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>
                        <strong>Proveedores de Servicios:</strong> Firebase
                        (Google) para autenticación y almacenamiento de base de
                        datos. Estos proveedores solo tienen acceso a datos
                        encriptados.
                      </li>
                      <li>
                        <strong>Cumplimiento Legal:</strong> Si es requerido por
                        ley, orden judicial o proceso legal gubernamental.
                      </li>
                      <li>
                        <strong>Protección de Derechos:</strong> Para proteger
                        nuestros derechos, privacidad, seguridad o propiedad, y
                        los de nuestros usuarios.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  6. Almacenamiento y Seguridad de Datos
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">
                    <strong>Dónde almacenamos sus datos:</strong> Sus datos se
                    almacenan en servidores de Firebase (Google Cloud) con
                    medidas de seguridad de nivel empresarial.
                  </p>
                  <p className="leading-relaxed mt-2">
                    <strong>Medidas de seguridad implementadas:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Encriptación AES-GCM de 256 bits para todos los datos
                      sensibles
                    </li>
                    <li>Transmisión segura mediante HTTPS/TLS</li>
                    <li>
                      Reglas de seguridad de Firestore que validan la propiedad
                      de datos
                    </li>
                    <li>Autenticación multifactor disponible</li>
                    <li>Protección con PIN y biometría opcional</li>
                    <li>Monitoreo de seguridad y detección de anomalías</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  7. Sus Derechos y Opciones
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">Usted tiene derecho a:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Acceder:</strong> Ver todos sus datos almacenados
                      en cualquier momento desde la aplicación
                    </li>
                    <li>
                      <strong>Rectificar:</strong> Editar o actualizar su
                      información personal y financiera
                    </li>
                    <li>
                      <strong>Eliminar:</strong> Borrar permanentemente su
                      cuenta y todos los datos asociados desde la configuración
                    </li>
                    <li>
                      <strong>Exportar:</strong> Descargar una copia de sus
                      datos financieros
                    </li>
                    <li>
                      <strong>Restringir:</strong> Controlar la visibilidad de
                      montos con la función de ocultar cantidades
                    </li>
                    <li>
                      <strong>Portabilidad:</strong> Exportar sus datos en
                      formato JSON o CSV
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  8. Retención de Datos
                </h2>
                <div className="space-y-2 text-muted-foreground">
                  <p className="leading-relaxed">
                    Retenemos su información personal mientras su cuenta esté
                    activa o según sea necesario para proporcionarle servicios.
                    Puede solicitar la eliminación de su cuenta en cualquier
                    momento, lo que resultará en:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Eliminación inmediata y permanente de todos sus datos
                      financieros
                    </li>
                    <li>Eliminación de su cuenta de autenticación</li>
                    <li>Eliminación de toda información personal asociada</li>
                  </ul>
                  <p className="leading-relaxed mt-2">
                    Algunos datos pueden ser retenidos por períodos limitados
                    para cumplir con obligaciones legales o resolver disputas.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  9. Cookies y Tecnologías Similares
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Fynco utiliza cookies y tecnologías similares para mantener su
                  sesión activa y mejorar su experiencia. Usamos:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 mt-2">
                  <li>
                    <strong>Cookies esenciales:</strong> Para autenticación y
                    funcionalidad básica
                  </li>
                  <li>
                    <strong>LocalStorage:</strong> Para almacenar preferencias
                    de usuario (tema, idioma)
                  </li>
                  <li>
                    <strong>SessionStorage:</strong> Para información temporal
                    de sesión
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  10. Privacidad de Menores
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Fynco no está dirigido a personas menores de 18 años. No
                  recopilamos intencionalmente información personal de menores.
                  Si descubrimos que hemos recopilado información de un menor,
                  la eliminaremos inmediatamente.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  11. Transferencias Internacionales
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Sus datos pueden ser transferidos y almacenados en servidores
                  ubicados fuera de su país de residencia. Firebase (Google
                  Cloud) cumple con marcos de privacidad internacionales
                  incluyendo GDPR para garantizar protección adecuada de datos.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">
                  12. Cambios a Esta Política
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Podemos actualizar esta Política de Privacidad periódicamente.
                  Le notificaremos sobre cambios significativos mediante:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 mt-2">
                  <li>Una notificación en la aplicación</li>
                  <li>Un correo electrónico a su dirección registrada</li>
                  <li>
                    Actualización de la fecha de "última actualización" en esta
                    página
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">13. Contacto</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Si tiene preguntas sobre esta Política de Privacidad o
                  nuestras prácticas de privacidad, puede contactarnos en:
                </p>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mt-3">
                  <p className="text-sm">
                    <strong>Email:</strong> privacy@fynco.app
                    <br />
                    <strong>Soporte:</strong> support@fynco.app
                    <br />
                    <strong>Web:</strong> www.fynco.app
                  </p>
                </div>
              </section>

              <section className="border-t pt-4 mt-6">
                <p className="text-sm text-muted-foreground italic">
                  Al usar Fynco, usted reconoce que ha leído y entendido esta
                  Política de Privacidad y acepta la recopilación, uso y
                  divulgación de su información como se describe aquí.
                </p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
