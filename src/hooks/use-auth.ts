// src/hooks/use-auth.ts
import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useParams, usePathname } from "next/navigation";
import { verifyUserExistsInFirestore, verifyUserDataIntegrity } from "@/lib/user-validation";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log('Auth state changed:', authUser ? 'User logged in' : 'User logged out');
      
      if (authUser) {
        console.log('Auth: Validating user exists in Firestore...');
        
        // Verificar que el usuario existe en Firestore
        const userExists = await verifyUserExistsInFirestore(authUser.uid);
        
        if (!userExists) {
          console.error('Auth: User does not exist in Firestore, forcing logout');
          
          // El usuario no existe en Firestore, hacer logout
          try {
            await signOut(auth);
            setUser(null);
            setLoading(false);
            
            // Limpiar storage
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
            }
            
            return;
          } catch (error) {
            console.error('Auth: Error during forced logout:', error);
          }
        }
        
        // Verificar integridad de datos
        const dataIntegrity = await verifyUserDataIntegrity(authUser.uid, authUser.email);
        
        if (!dataIntegrity) {
          console.error('Auth: User data integrity check failed, forcing logout');
          
          try {
            await signOut(auth);
            setUser(null);
            setLoading(false);
            
            // Limpiar storage
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
            }
            
            return;
          } catch (error) {
            console.error('Auth: Error during integrity check logout:', error);
          }
        }
        
        console.log('Auth: User validation passed');
        setUser(authUser);
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      console.log('Logging out user...');
      
      // Limpiar cualquier dato en localStorage relacionado con la sesión
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user-data');
        localStorage.removeItem('session-data');
        sessionStorage.clear();
      }
      
      await signOut(auth);
      console.log('User logged out successfully');
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  };

  const forceLogout = async () => {
    try {
      console.log('Force logout initiated...');
      
      // Limpiar toda la sesión
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Desconectar de Firebase
      await signOut(auth);
      
      // Forzar reload para limpiar el estado de la aplicación
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      
      return true;
    } catch (error) {
      console.error("Force logout error:", error);
      // Incluso si falla, redirigir al login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return false;
    }
  };

  return { user, loading, auth, logout, forceLogout };
}

export function useRequireAuth(redirectUrl = "/login") {
  const { user, loading, forceLogout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    console.log('useRequireAuth - Auth check:', { 
      loading, 
      hasUser: !!user, 
      pathname,
      userUid: user?.uid 
    });

    if (!loading) {
      if (!user) {
        console.warn('No user detected, forcing logout and redirect to login');
        
        // Limpiar cualquier dato residual y forzar logout
        forceLogout();
        
        // Preservar la URL actual para redirección después del login
        const loginUrl = `${redirectUrl}?redirect=${encodeURIComponent(pathname)}`;
        
        // Usar replace para evitar que el usuario pueda volver atrás
        router.replace(loginUrl);
      } else {
        console.log('User authenticated:', user.email);
      }
    }
  }, [user, loading, router, redirectUrl, pathname, forceLogout]);

  // Si no hay usuario y no está cargando, retornar null para evitar renderizar contenido protegido
  if (!loading && !user) {
    return { user: null, loading: false };
  }

  return { user, loading };
}
