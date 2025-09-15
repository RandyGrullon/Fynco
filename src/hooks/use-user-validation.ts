"use client";

import { useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import {
  verifyUserExistsInFirestore,
  verifyUserDataIntegrity,
} from "@/lib/user-validation";
import { toast } from "./use-toast";

/**
 * Hook que valida periódicamente que el usuario siga existiendo en Firestore
 * Si el usuario fue eliminado de la colección, fuerza logout
 */
export function useUserValidation() {
  const { user, forceLogout } = useAuth();

  const validateUser = useCallback(async () => {
    if (!user) return;

    try {
      // Verificar que el usuario aún existe en Firestore
      const userExists = await verifyUserExistsInFirestore(user.uid);

      if (!userExists) {
        console.error("UserValidation: User no longer exists in Firestore");

        toast({
          variant: "destructive",
          title: "Cuenta no válida",
          description:
            "Tu cuenta ya no existe en el sistema. Serás desconectado.",
          duration: 5000,
        });

        await forceLogout();
        return;
      }

      // Verificar integridad de datos
      const dataIntegrity = await verifyUserDataIntegrity(user.uid, user.email);

      if (!dataIntegrity) {
        console.error("UserValidation: User data integrity compromised");

        toast({
          variant: "destructive",
          title: "Error de seguridad",
          description:
            "Se detectaron inconsistencias en tu cuenta. Serás desconectado por seguridad.",
          duration: 5000,
        });

        await forceLogout();
        return;
      }
    } catch (error) {
      console.error("UserValidation: Error during validation:", error);

      // En caso de error de red o similar, no desconectamos inmediatamente
      // pero registramos el error para monitoreo
      console.warn(
        "UserValidation: Validation failed due to error, will retry"
      );
    }
  }, [user, forceLogout]);

  useEffect(() => {
    if (!user) return;
    // Validar solo al montar el componente (sin intervalos ni listeners)
    validateUser();
  }, [user, validateUser]);

  return { validateUser };
}
