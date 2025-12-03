"use client";

/**
 * Componente base reutilizable para diálogos de formulario
 * Elimina duplicación de código en add-expense, add-transaction, add-account, etc.
 */

import { useState, useEffect, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { validateUserAuthentication } from "@/lib/validation-utils";

export interface BaseFormDialogProps<T = any> {
  // Control del diálogo
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Contenido
  title: string;
  description?: string;
  children: ReactNode;

  // Comportamiento del formulario
  onSubmit: (data: T) => Promise<void> | void;
  submitLabel?: string;
  cancelLabel?: string;

  // Validación y reseteo
  validateForm?: () => boolean | string; // true si válido, string con error si inválido
  resetForm?: () => void;

  // Opciones
  requireAuth?: boolean;
  closeOnSubmit?: boolean;
  showCancelButton?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";

  // Callbacks adicionales
  onSuccess?: () => void;
  onError?: (error: string) => void;

  // Estado externo (opcional)
  externalLoading?: boolean;
}

export function BaseFormDialog<T = any>({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  validateForm,
  resetForm,
  requireAuth = true,
  closeOnSubmit = true,
  showCancelButton = true,
  maxWidth = "sm",
  onSuccess,
  onError,
  externalLoading,
}: BaseFormDialogProps<T>) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const isLoading = externalLoading !== undefined ? externalLoading : loading;

  // Resetear formulario cuando se abre/cierra el diálogo
  useEffect(() => {
    if (!open && resetForm) {
      // Esperar un momento para que la animación de cierre termine
      const timer = setTimeout(() => {
        resetForm();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar autenticación si es requerida
    if (requireAuth) {
      const authValidation = validateUserAuthentication(user);
      if (!authValidation.isValid) {
        toast({
          title: "Error de autenticación",
          description: authValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    // Validar formulario si se proporciona validador
    if (validateForm) {
      const validation = validateForm();
      if (validation !== true) {
        const errorMessage =
          typeof validation === "string"
            ? validation
            : "Por favor completa todos los campos requeridos";

        toast({
          title: "Error de validación",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }
    }

    // Ejecutar submit
    if (externalLoading === undefined) {
      setLoading(true);
    }

    try {
      await onSubmit({} as T); // El componente hijo maneja los datos

      // Éxito
      toast({
        title: "Éxito",
        description: "Operación completada correctamente",
      });

      if (onSuccess) {
        onSuccess();
      }

      if (closeOnSubmit) {
        onOpenChange(false);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      if (externalLoading === undefined) {
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-${maxWidth}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {children}

          <DialogFooter className="gap-2 sm:gap-0">
            {showCancelButton && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                {cancelLabel}
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook auxiliar para manejar el estado común de formularios
 */
export function useFormDialog<T>(defaultValues: T) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<T>(defaultValues);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData(defaultValues);
  };

  const updateField = <K extends keyof T>(field: K, value: T[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return {
    open,
    setOpen,
    formData,
    setFormData,
    loading,
    setLoading,
    resetForm,
    updateField,
  };
}
