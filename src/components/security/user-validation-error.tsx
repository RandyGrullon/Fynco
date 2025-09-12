"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserValidationErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Componente que se muestra cuando hay un error de validación de usuario
 */
export function UserValidationError({ 
  title = "Error de autenticación",
  message = "Tu sesión no es válida o ha expirado.",
  onRetry
}: UserValidationErrorProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Auto-redirigir al login después del countdown
      router.push('/login');
    }
  }, [countdown, router]);

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {message}
            </p>
            
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                Serás redirigido al login en <span className="font-bold text-primary">{countdown}</span> segundos
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button onClick={handleGoToLogin} className="w-full">
              Ir al Login Ahora
            </Button>
            
            {onRetry && (
              <Button onClick={onRetry} variant="outline" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            )}
          </div>

          <div className="pt-4 border-t text-xs text-muted-foreground">
            <p>
              Si este problema persiste, contacta al soporte técnico.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
