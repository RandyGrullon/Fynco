"use client";

/**
 * Componente para la eliminación completa de cuenta
 * Zona de peligro en configuración
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useSecurity } from "@/contexts/security-context";
import {
  deleteUserAccountCompletely,
  verifyDeletionPhrase,
  getDeletionSummary,
} from "@/lib/account-deletion";
import {
  AlertTriangle,
  Trash2,
  Loader2,
  Shield,
  Database,
  FileText,
} from "lucide-react";

export function DangerZoneSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const securityContext = useSecurity();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [deleteStep, setDeleteStep] = useState<"confirm" | "pin" | "final">(
    "confirm"
  );

  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataSummary, setDataSummary] = useState<{
    accountsCount: number;
    transactionsCount: number;
    goalsCount: number;
    recurringCount: number;
    movementsCount: number;
    totalItems: number;
  } | null>(null);

  // Cargar resumen de datos cuando se abre el diálogo
  useEffect(() => {
    if (showDeleteDialog && user) {
      loadDataSummary();
    }
  }, [showDeleteDialog, user]);

  const loadDataSummary = async () => {
    if (!user) return;

    const summary = await getDeletionSummary(user.uid);
    if (summary) {
      setDataSummary(summary);
    }
  };

  const handleOpenDialog = () => {
    setShowDeleteDialog(true);
    setDeleteStep("confirm");
    setConfirmPhrase("");
    setPinInput("");
  };

  const handleCloseDialog = () => {
    setShowDeleteDialog(false);
    setDeleteStep("confirm");
    setConfirmPhrase("");
    setPinInput("");
  };

  const handleConfirmStep = () => {
    if (!verifyDeletionPhrase(confirmPhrase, "DELETE")) {
      toast({
        title: "Confirmación incorrecta",
        description: "Debes escribir exactamente 'DELETE' para continuar",
        variant: "destructive",
      });
      return;
    }

    // Si tiene PIN habilitado, ir al paso de PIN
    if (securityContext.settings.pinEnabled) {
      setDeleteStep("pin");
    } else {
      // Si no tiene PIN, ir directamente al paso final
      setDeleteStep("final");
    }
  };

  const handlePinStep = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const isPinValid = await securityContext.unlockWithPin(pinInput);

      if (!isPinValid) {
        toast({
          title: "PIN incorrecto",
          description: "El PIN ingresado no es válido",
          variant: "destructive",
        });
        setPinInput("");
        return;
      }

      setDeleteStep("final");
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al verificar el PIN",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalDeletion = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "No hay usuario autenticado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Ejecutar eliminación completa
      const result = await deleteUserAccountCompletely(user);

      if (!result.success) {
        throw new Error(result.error || "Error al eliminar la cuenta");
      }

      // Mostrar toast de éxito
      toast({
        title: "Cuenta eliminada",
        description:
          "Tu cuenta y todos tus datos han sido eliminados permanentemente",
      });

      // Cerrar diálogo
      handleCloseDialog();

      // Redirigir a la página de login después de un momento
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      console.error("Error deleting account:", error);

      let errorMessage = "Error desconocido al eliminar la cuenta";

      if (error.message.includes("requires-recent-login")) {
        errorMessage =
          "Por seguridad, debes volver a iniciar sesión antes de eliminar tu cuenta";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error al eliminar cuenta",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zona de Peligro
          </CardTitle>
          <CardDescription>
            Acciones irreversibles que afectan permanentemente tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Advertencia</AlertTitle>
            <AlertDescription>
              Eliminar tu cuenta es una acción permanente que no puede
              deshacerse. Todos tus datos financieros serán eliminados para
              siempre.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Al eliminar tu cuenta, se eliminarán permanentemente:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 ml-4">
              <li className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Todas tus cuentas bancarias y balances
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Todas tus transacciones y movimientos
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Todas tus metas de ahorro y progreso
              </li>
              <li className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Tu cuenta de usuario y configuración
              </li>
            </ul>
          </div>

          <Button
            variant="destructive"
            onClick={handleOpenDialog}
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar mi cuenta permanentemente
          </Button>
        </CardContent>
      </Card>

      {/* Diálogo de confirmación multi-paso */}
      <Dialog open={showDeleteDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {deleteStep === "confirm" && "Confirmar eliminación de cuenta"}
              {deleteStep === "pin" && "Verificar PIN de seguridad"}
              {deleteStep === "final" && "Confirmación final"}
            </DialogTitle>
            <DialogDescription>
              {deleteStep === "confirm" &&
                "Esta acción no puede deshacerse. Por favor confirma que deseas continuar."}
              {deleteStep === "pin" &&
                "Ingresa tu PIN de seguridad para continuar con la eliminación."}
              {deleteStep === "final" &&
                "Última advertencia: todos tus datos serán eliminados permanentemente."}
            </DialogDescription>
          </DialogHeader>

          {/* Paso 1: Confirmación inicial */}
          {deleteStep === "confirm" && (
            <div className="space-y-4 py-4">
              {dataSummary && (
                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertTitle>Se eliminarán:</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• {dataSummary.accountsCount} cuenta(s)</li>
                      <li>• {dataSummary.transactionsCount} transacción(es)</li>
                      <li>• {dataSummary.goalsCount} meta(s) de ahorro</li>
                      <li>
                        • {dataSummary.recurringCount} transacción(es)
                        recurrente(s)
                      </li>
                      <li>• {dataSummary.movementsCount} movimiento(s)</li>
                      <li className="font-semibold mt-2">
                        Total: {dataSummary.totalItems} elementos
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-phrase">
                  Para confirmar, escribe{" "}
                  <span className="font-mono font-bold text-destructive">
                    DELETE
                  </span>
                </Label>
                <Input
                  id="confirm-phrase"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="Escribe DELETE aquí"
                  autoComplete="off"
                  className="font-mono"
                />
              </div>
            </div>
          )}

          {/* Paso 2: Verificación de PIN */}
          {deleteStep === "pin" && (
            <div className="space-y-4 py-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Verificación de seguridad</AlertTitle>
                <AlertDescription>
                  Tu cuenta está protegida con PIN. Ingresa tu PIN para
                  continuar.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="pin-input">PIN de seguridad</Label>
                <Input
                  id="pin-input"
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Ingresa tu PIN"
                  maxLength={12}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* Paso 3: Confirmación final */}
          {deleteStep === "final" && (
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>¡Última advertencia!</AlertTitle>
                <AlertDescription>
                  Esta es tu última oportunidad para cancelar. Si continúas, tu
                  cuenta y todos tus datos serán eliminados de forma permanente
                  e irreversible.
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-semibold">
                  Se eliminará permanentemente:
                </p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>✗ Todas tus cuentas bancarias</li>
                  <li>✗ Todas tus transacciones</li>
                  <li>✗ Todas tus metas de ahorro</li>
                  <li>✗ Toda tu configuración</li>
                  <li>✗ Tu cuenta de usuario</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
              disabled={loading}
            >
              Cancelar
            </Button>

            {deleteStep === "confirm" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmStep}
                disabled={!confirmPhrase || loading}
              >
                Continuar
              </Button>
            )}

            {deleteStep === "pin" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handlePinStep}
                disabled={!pinInput || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar PIN"
                )}
              </Button>
            )}

            {deleteStep === "final" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleFinalDeletion}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar permanentemente
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
