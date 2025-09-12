"use client";

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useUserValidation } from '@/hooks/use-user-validation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

/**
 * Componente que intercepta cambios en el estado de autenticación
 * y maneja errores o pérdidas de sesión automáticamente
 */
export function AuthMonitor() {
  const { forceLogout } = useAuth();
  
  // Activar validación periódica del usuario
  useUserValidation();

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;
    let warningShown = false;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      warningShown = false;
      
      // 30 minutos de inactividad
      inactivityTimer = setTimeout(() => {
        if (!warningShown) {
          warningShown = true;
          toast({
            variant: "destructive",
            title: "Sesión por expirar",
            description: "Tu sesión expirará en 5 minutos por inactividad.",
            duration: 10000,
          });

          // 5 minutos adicionales antes de logout
          setTimeout(() => {
            toast({
              variant: "destructive",
              title: "Sesión expirada",
              description: "Has sido desconectado por inactividad.",
            });
            forceLogout();
          }, 5 * 60 * 1000); // 5 minutos
        }
      }, 30 * 60 * 1000); // 30 minutos
    };

    // Eventos que resetean el timer de inactividad
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const addEventListeners = () => {
      events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
      });
    };

    const removeEventListeners = () => {
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
    };

    // Monitor cambios en el estado de auth
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('AuthMonitor - User authenticated, starting inactivity monitoring');
        addEventListeners();
        resetInactivityTimer();
      } else {
        console.log('AuthMonitor - User not authenticated, stopping monitoring');
        removeEventListeners();
        clearTimeout(inactivityTimer);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
      removeEventListeners();
      clearTimeout(inactivityTimer);
    };
  }, [forceLogout]);

  // Este componente no renderiza nada
  return null;
}
