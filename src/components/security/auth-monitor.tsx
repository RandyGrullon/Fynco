"use client";

import { useEffect } from "react";
import { useUserValidation } from "@/hooks/use-user-validation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Componente que intercepta cambios en el estado de autenticación
 * y maneja errores o pérdidas de sesión automáticamente
 */
export function AuthMonitor() {
  // Activar validación periódica del usuario
  useUserValidation();

  useEffect(() => {
    // Monitor cambios en el estado de auth
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Usuario no autenticado - no hay nada que hacer aquí
        // La lógica de logout se maneja en otros lugares
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, []);

  // Este componente no renderiza nada
  return null;
}
