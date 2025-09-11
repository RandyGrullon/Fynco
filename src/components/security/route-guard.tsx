"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rutas y verifica que el usuario solo acceda a sus datos
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Bloquear acceso a rutas de transacciones (fueron removidas)
    if (pathname.includes('/transactions')) {
      toast({
        variant: "destructive",
        title: "Página no disponible",
        description: "Esta funcionalidad ha sido removida.",
      });
      router.replace('/dashboard');
      return;
    }

    // Verificar si la URL contiene parámetros que podrían ser IDs de otros usuarios
    const urlSegments = pathname.split('/');
    const potentialUserIds = urlSegments.filter(segment => 
      segment.length > 10 && // IDs de Firebase son largos
      segment.match(/^[a-zA-Z0-9]+$/) // Solo alfanuméricos
    );

    // Si encontramos un posible ID de usuario en la URL que no coincide
    potentialUserIds.forEach(potentialUserId => {
      if (user && potentialUserId !== user.uid && potentialUserId.length > 20) {
        console.warn(`Security: Potential unauthorized access attempt to user ${potentialUserId}`);
        toast({
          variant: "destructive",
          title: "Acceso no autorizado",
          description: "No tienes permisos para acceder a esta información.",
        });
        router.replace('/dashboard');
      }
    });

  }, [pathname, user, router]);

  return <>{children}</>;
}
