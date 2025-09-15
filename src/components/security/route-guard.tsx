"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rutas y verifica que el usuario solo acceda a sus datos
 * Si no hay usuario loggeado, fuerza logout y redirecciona al login
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const { user, loading, forceLogout } = useAuth();
  const router = useRouter();
  // usePathname can return null (SSR or before hydration). Default to empty string
  // so string operations like .includes/.split are safe.
  const pathname = usePathname() ?? "";
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateUser = async () => {
      // Si no está cargando y no hay usuario, forzar logout
      if (!loading && !user) {
        console.warn(
          "RouteGuard - No authenticated user detected, forcing logout"
        );

        toast({
          variant: "destructive",
          title: "Sesión expirada",
          description:
            "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
        });

        await forceLogout();
        return;
      }

      // Bloquear acceso a rutas de transacciones (fueron removidas)
      if (pathname.includes("/transactions")) {
        console.warn(
          "RouteGuard - Blocked access to removed transactions route"
        );
        toast({
          variant: "destructive",
          title: "Página no disponible",
          description: "Esta funcionalidad ha sido removida.",
        });
        router.replace("/dashboard");
        return;
      }

      // Verificar si la URL contiene parámetros que podrían ser IDs de otros usuarios
      const urlSegments = pathname.split("/");
      const potentialUserIds = urlSegments.filter(
        (segment) =>
          segment.length > 10 && // IDs de Firebase son largos
          segment.match(/^[a-zA-Z0-9]+$/) // Solo alfanuméricos
      );

      // Si encontramos un posible ID de usuario en la URL que no coincide
      let unauthorizedAccess = false;
      potentialUserIds.forEach((potentialUserId) => {
        if (
          user &&
          potentialUserId !== user.uid &&
          potentialUserId.length > 20
        ) {
          console.warn(
            `RouteGuard - Security violation: Attempted access to user ${potentialUserId} by ${user.uid}`
          );
          unauthorizedAccess = true;
        }
      });

      if (unauthorizedAccess) {
        toast({
          variant: "destructive",
          title: "Acceso no autorizado",
          description: "No tienes permisos para acceder a esta información.",
        });
        router.replace("/dashboard");
        return;
      }

      setIsValidating(false);
    };

    validateUser();
  }, [pathname, user, loading, router, forceLogout]);

  // Mostrar loading mientras valida
  if (loading || isValidating) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="h-12 w-12 animate-spin text-primary"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-muted-foreground">Validando acceso...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario después de la validación, no renderizar nada
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
