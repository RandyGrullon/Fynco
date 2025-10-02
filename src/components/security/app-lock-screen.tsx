"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSecurity } from "@/contexts/security-context";
import { Fingerprint, Lock, ShieldCheck } from "lucide-react";

export function AppLockScreen() {
  const {
    unlockWithPin,
    unlockWithBiometrics,
    settings,
    isBiometricAvailable,
    refreshingCredential,
    localSnapshot,
  } = useSecurity();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pin) {
      setError("Ingresa tu PIN para continuar");
      return;
    }
    setIsUnlocking(true);
    setError(null);
    try {
      const success = await unlockWithPin(pin);
      if (!success) {
        setError("PIN incorrecto. Intenta nuevamente.");
      } else {
        setPin("");
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setIsUnlocking(true);
    setError(null);
    try {
      const success = await unlockWithBiometrics();
      if (!success) {
        setError("No se pudo autenticar con biometría.");
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const showBiometricOption =
    settings.biometricEnabled && isBiometricAvailable;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
      <Card className="relative z-[1310] w-full max-w-sm border-primary/20 shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold">
            Tu sesión está protegida
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {localSnapshot?.lastUnlockMethod === "biometric"
              ? "Usa FaceID o tu huella para volver a entrar."
              : settings.pinEnabled
              ? "Ingresa tu PIN para desbloquear la aplicación."
              : "Utiliza tu método de seguridad configurado para continuar."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {showBiometricOption && (
            <Button
              type="button"
              variant="default"
              className="w-full"
              size="lg"
              onClick={handleBiometricUnlock}
              disabled={isUnlocking || refreshingCredential}
            >
              <Fingerprint className="mr-2 h-5 w-5" />
              {localSnapshot?.lastUnlockMethod === "biometric"
                ? "Usar FaceID / Huella"
                : "Desbloquear con biometría"}
            </Button>
          )}

          {settings.pinEnabled && (
            <form onSubmit={handlePinSubmit} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  PIN de acceso
                </label>
                <Input
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, "");
                    setPin(value.slice(0, 12));
                    if (error) setError(null);
                  }}
                  autoFocus
                  disabled={isUnlocking}
                  placeholder="••••"
                  className="text-center text-lg tracking-[0.4em]"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isUnlocking}
              >
                <ShieldCheck className="mr-2 h-5 w-5" />
                Desbloquear con PIN
              </Button>
            </form>
          )}

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          {!settings.pinEnabled && !showBiometricOption && (
            <p className="text-center text-sm text-muted-foreground">
              No hay métodos de desbloqueo configurados. Configura uno en los
              ajustes de seguridad.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
