import { useAuth } from './use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from './use-toast';

/**
 * Hook para verificar que el usuario solo acceda a sus propios datos
 * Redirige al dashboard si intenta acceder a datos de otro usuario
 */
export function useDataOwnership(dataUserId?: string | null) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && dataUserId && user.uid !== dataUserId) {
      // El usuario está intentando acceder a datos que no le pertenecen
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta información.",
      });
      
      // Redirigir al dashboard
      router.push('/dashboard');
    }
  }, [user, dataUserId, router]);

  // Retornar si el usuario tiene acceso a los datos
  return {
    hasAccess: !user || !dataUserId || user.uid === dataUserId,
    isOwnData: user && dataUserId && user.uid === dataUserId,
  };
}

/**
 * Hook para verificar parámetros de URL que contengan IDs de usuario
 */
export function useRouteProtection(userIdFromRoute?: string) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si hay un userId en la ruta y no coincide con el usuario actual
    if (userIdFromRoute && user && user.uid !== userIdFromRoute) {
      toast({
        variant: "destructive",
        title: "Acceso no autorizado",
        description: "Esta página no existe o no tienes acceso a ella.",
      });
      
      // Redirigir al dashboard en lugar de mostrar los datos
      router.replace('/dashboard');
    }
  }, [userIdFromRoute, user, router]);

  return {
    isAuthorized: !userIdFromRoute || !user || user.uid === userIdFromRoute,
  };
}
