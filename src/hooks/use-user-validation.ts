"use client";

import { useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { verifyUserExistsInFirestore, verifyUserDataIntegrity } from '@/lib/user-validation';
import { toast } from './use-toast';

/**
 * Hook que valida periódicamente que el usuario siga existiendo en Firestore
 * Si el usuario fue eliminado de la colección, fuerza logout
 */
export function useUserValidation() {
  const { user, forceLogout } = useAuth();

  const validateUser = useCallback(async () => {
    if (!user) return;

    console.log('UserValidation: Starting periodic validation...');

    try {
      // Verificar que el usuario aún existe en Firestore
      const userExists = await verifyUserExistsInFirestore(user.uid);
      
      if (!userExists) {
        console.error('UserValidation: User no longer exists in Firestore');
        
        toast({
          variant: "destructive",
          title: "Cuenta no válida",
          description: "Tu cuenta ya no existe en el sistema. Serás desconectado.",
          duration: 5000,
        });
        
        await forceLogout();
        return;
      }

      // Verificar integridad de datos
      const dataIntegrity = await verifyUserDataIntegrity(user.uid, user.email);
      
      if (!dataIntegrity) {
        console.error('UserValidation: User data integrity compromised');
        
        toast({
          variant: "destructive",
          title: "Error de seguridad",
          description: "Se detectaron inconsistencias en tu cuenta. Serás desconectado por seguridad.",
          duration: 5000,
        });
        
        await forceLogout();
        return;
      }

      console.log('UserValidation: User validation passed');
    } catch (error) {
      console.error('UserValidation: Error during validation:', error);
      
      // En caso de error de red o similar, no desconectamos inmediatamente
      // pero registramos el error para monitoreo
      console.warn('UserValidation: Validation failed due to error, will retry');
    }
  }, [user, forceLogout]);

  useEffect(() => {
    if (!user) return;

    // Validar inmediatamente al montar el componente
    validateUser();

    // Validar cada 5 minutos
    const validationInterval = setInterval(validateUser, 5 * 60 * 1000);

    // Validar cuando la ventana regresa al foco (usuario regresa a la pestaña)
    const handleFocus = () => {
      console.log('UserValidation: Window focused, validating user...');
      validateUser();
    };

    // Validar cuando la conexión se restaura
    const handleOnline = () => {
      console.log('UserValidation: Connection restored, validating user...');
      validateUser();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(validationInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, validateUser]);

  return { validateUser };
}
