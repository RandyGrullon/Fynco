"use client";

/**
 * Diálogo de consentimiento de términos y privacidad
 * Se muestra al usuario en su primer inicio de sesión
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Shield, Lock, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface ConsentDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentDialog({
  open,
  onAccept,
  onDecline,
}: ConsentDialogProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedEncryption, setAcceptedEncryption] = useState(false);

  const canProceed = acceptedTerms && acceptedPrivacy && acceptedEncryption;

  const handleAccept = () => {
    if (canProceed) {
      onAccept();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDecline()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Bienvenido a Fynco
          </DialogTitle>
          <DialogDescription>
            Antes de comenzar, necesitamos tu consentimiento sobre cómo
            manejamos tus datos
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-6">
            {/* Información de encriptación */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Encriptación End-to-End
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                    Todos tus datos financieros están protegidos con
                    encriptación AES-GCM de 256 bits. Esto significa que{" "}
                    <strong>nosotros NO PODEMOS ver tus datos</strong> - solo tú
                    tienes acceso a ellos cuando inicias sesión.
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                    Los datos se encriptan en tu dispositivo antes de ser
                    almacenados en nuestros servidores.
                  </p>
                </div>
              </div>
            </div>

            {/* Advertencia importante */}
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    Importante: Responsabilidad del Usuario
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                    Debido a la encriptación end-to-end, si pierdes acceso a tu
                    cuenta,
                    <strong> NO podremos recuperar tus datos</strong>. Es tu
                    responsabilidad mantener tu cuenta segura y accesible.
                  </p>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 list-disc list-inside space-y-1 ml-2">
                    <li>Usa una contraseña fuerte y única</li>
                    <li>Guarda tu información de acceso de forma segura</li>
                    <li>Mantén tu correo electrónico actualizado</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Puntos clave de privacidad */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">
                Puntos Clave de Nuestra Política
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    Tus datos financieros están encriptados y solo tú puedes
                    acceder a ellos
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    NO vendemos ni compartimos tu información personal con
                    terceros
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    Puedes eliminar tu cuenta y todos tus datos en cualquier
                    momento
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    Usamos Firebase (Google) para autenticación y almacenamiento
                    seguro
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>
                    Cumplimos con estándares internacionales de protección de
                    datos
                  </span>
                </li>
              </ul>
            </div>

            {/* Checkboxes de consentimiento */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) =>
                    setAcceptedTerms(checked === true)
                  }
                  className="mt-1"
                />
                <label
                  htmlFor="terms"
                  className="text-sm leading-relaxed cursor-pointer flex-1"
                >
                  He leído y acepto los{" "}
                  <Link
                    href="/legal/terms"
                    target="_blank"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Términos y Condiciones
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="privacy"
                  checked={acceptedPrivacy}
                  onCheckedChange={(checked) =>
                    setAcceptedPrivacy(checked === true)
                  }
                  className="mt-1"
                />
                <label
                  htmlFor="privacy"
                  className="text-sm leading-relaxed cursor-pointer flex-1"
                >
                  He leído y acepto la{" "}
                  <Link
                    href="/legal/privacy"
                    target="_blank"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Política de Privacidad
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="encryption"
                  checked={acceptedEncryption}
                  onCheckedChange={(checked) =>
                    setAcceptedEncryption(checked === true)
                  }
                  className="mt-1"
                />
                <label
                  htmlFor="encryption"
                  className="text-sm leading-relaxed cursor-pointer flex-1"
                >
                  Entiendo que mis datos están encriptados y que{" "}
                  <strong>Fynco no puede ver ni recuperar mis datos</strong> si
                  pierdo acceso a mi cuenta
                </label>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onDecline}
            className="w-full sm:w-auto"
          >
            Rechazar y Salir
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={!canProceed}
            className="w-full sm:w-auto"
          >
            Aceptar y Continuar
          </Button>
        </DialogFooter>

        {!canProceed && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Debes aceptar todos los términos para continuar usando Fynco
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
