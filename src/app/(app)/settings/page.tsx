"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { updateProfile } from "firebase/auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDoc, collection } from "firebase/firestore";
import { useCurrency } from "@/contexts/currency-context";
import { availableCurrencies } from "@/lib/currency";
import { useTheme } from "@/contexts/theme-context";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Shield,
  Sun,
  FileText,
} from "lucide-react";
import { useSecurity } from "@/contexts/security-context";
import { DangerZoneSection } from "@/components/settings/DangerZoneSection";

const GmailIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mr-2 h-5 w-5"
  >
    <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z"></path>
    <path d="M22 6l-10 7L2 6"></path>
  </svg>
);

const ThemeSection = () => {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    {
      value: "light" as const,
      label: "Light",
      description: "Light theme for bright environments",
      icon: Sun,
    },
    {
      value: "dark" as const,
      label: "Dark",
      description: "Dark theme for low light environments",
      icon: Moon,
    },
    {
      value: "system" as const,
      label: "System",
      description: "Follows your system's theme preference",
      icon: Monitor,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose your preferred theme. The system option will automatically
          switch between light and dark modes based on your device settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {themeOptions.map(({ value, label, description, icon: Icon }) => (
            <div
              key={value}
              className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                theme === value ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => setTheme(value)}
            >
              <div className="flex-shrink-0">
                <Icon
                  className={`h-5 w-5 ${
                    theme === value ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1">
                <div
                  className={`font-medium ${
                    theme === value ? "text-primary" : ""
                  }`}
                >
                  {label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {description}
                </div>
              </div>
              <div className="flex-shrink-0">
                {theme === value && (
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const OutlookIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="mr-2 h-5 w-5"
  >
    <path d="M15.5 2.25a.755.755 0 0 1 .75.75v18a.755.755 0 0 1-.75.75H2.75a.755.755 0 0 1-.75-.75V3a.755.755 0 0 1 .75-.75h12.75zM14 8.625H4.25V6.375H14v2.25zm0 4.125H4.25v-2.25H14v2.25zM14 17.25H4.25V15H14v2.25z"></path>
    <path d="M16.25 21.75V3a.75.75 0 0 1 .64-.741l4.22-.01a.75.75 0 0 1 .74.64l.01 18.22a.75.75 0 0 1-.64.74l-4.22.01a.75.75 0 0 1-.73-.659z"></path>
  </svg>
);

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currency, setCurrency, isLoading: currencyLoading } = useCurrency();
  const [name, setName] = useState(user?.displayName || "");
  const [loading, setLoading] = useState(false);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [currencyUpdateLoading, setCurrencyUpdateLoading] = useState(false);

  const {
    settings: securitySettings,
    enableAppLock,
    disableAppLock,
    updatePin: updateSecurityPin,
    clearPin,
    registerBiometricCredential,
    isBiometricAvailable,
    refreshingCredential,
    localSnapshot,
  } = useSecurity();

  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [removePinDialogOpen, setRemovePinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirmValue, setPinConfirmValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const biometricConfigured =
    securitySettings.biometricEnabled && !!localSnapshot?.credentialId;

  // Campos para la configuración del salario
  const [salaryAmount, setSalaryAmount] = useState("");
  const [depositDay, setDepositDay] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">(
    "monthly"
  );

  // Cargar configuración de salario existente y datos de perfil
  useEffect(() => {
    const loadUserData = async (): Promise<void> => {
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();

          // Actualizar nombre desde Firestore si existe
          if (userData.displayName) {
            setName(userData.displayName);
          }

          // Cargar configuración de salario
          if (userData.salarySettings) {
            const settings = userData.salarySettings;
            setSalaryAmount(settings.amount || "");
            setDepositDay(settings.depositDay || "");
            setFrequency(settings.frequency || "monthly");
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [user]);

  // Verificar si toca depositar el salario automáticamente
  useEffect(() => {
    const checkSalaryDeposit = async (): Promise<void> => {
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().salarySettings) {
          const settings = userDoc.data().salarySettings;
          const lastDeposit = settings.lastDeposit
            ? new Date(settings.lastDeposit)
            : null;
          const now = new Date();
          const currentDay = now.getDate();

          // Si es el día de depósito y no se ha depositado hoy (o este período)
          if (
            settings.depositDay &&
            currentDay.toString() === settings.depositDay &&
            (!lastDeposit ||
              (shouldAddNewDeposit(lastDeposit, settings.frequency, now) &&
                lastDeposit.toDateString() !== now.toDateString()))
          ) {
            // Agregar la transacción de salario
            await addSalaryTransaction(parseFloat(settings.amount));

            // Actualizar la fecha de último depósito
            await setDoc(
              userDocRef,
              {
                salarySettings: {
                  ...settings,
                  lastDeposit: now.toISOString(),
                },
              },
              { merge: true }
            );

            toast({
              title: "Salario Depositado",
              description: `Se ha agregado automáticamente tu salario de $${settings.amount}.`,
              className: "bg-accent text-accent-foreground",
            });
          }
        }
      } catch (error) {
        console.error("Error checking salary deposit:", error);
      }
    };

    checkSalaryDeposit();
  }, [user, toast]);

  // Determina si debe añadir un nuevo depósito basado en la frecuencia
  const shouldAddNewDeposit = (
    lastDeposit: Date,
    frequency: "weekly" | "biweekly" | "monthly",
    now: Date
  ): boolean => {
    if (frequency === "weekly") {
      // Si ha pasado al menos una semana
      return now.getTime() - lastDeposit.getTime() >= 7 * 24 * 60 * 60 * 1000;
    } else if (frequency === "biweekly") {
      // Si han pasado al menos dos semanas
      return now.getTime() - lastDeposit.getTime() >= 14 * 24 * 60 * 60 * 1000;
    } else if (frequency === "monthly") {
      // Verificación más precisa para depósitos mensuales
      const lastMonth = lastDeposit.getMonth();
      const lastYear = lastDeposit.getFullYear();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Asegurarse que ha pasado al menos un mes
      return (
        currentYear > lastYear ||
        (currentYear === lastYear && currentMonth > lastMonth)
      );
    }
    return true;
  };

  // Añadir transacción de salario
  const addSalaryTransaction = async (amount: number): Promise<void> => {
    if (!user) return;

    try {
      // Usar addTransaction en lugar de addDoc directamente para registrar movimientos
      const { addTransaction } = await import("@/lib/transactions");

      // Necesitamos una cuenta para la transacción - usar la primera cuenta disponible
      const { getAccounts } = await import("@/lib/accounts");
      const accounts = await getAccounts(user.uid);

      if (accounts.length === 0) {
        console.error("No accounts available for salary transaction");
        return;
      }

      await addTransaction(
        {
          amount: amount,
          source: "Salario",
          date: new Date(),
          category: "Salary",
          type: "income",
          method: "Direct Deposit",
          accountId: accounts[0].id || "", // usar la primera cuenta
        },
        user.uid
      );
    } catch (error) {
      console.error("Error adding salary transaction:", error);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await updateProfile(user, { displayName: name });
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { displayName: name }, { merge: true });

      toast({
        title: "Profile Updated",
        description: "Your name has been updated successfully.",
        className: "bg-accent text-accent-foreground",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update profile: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración de salario
  const handleSalarySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSalaryLoading(true);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(
        userDocRef,
        {
          salarySettings: {
            amount: salaryAmount,
            depositDay: depositDay,
            frequency: frequency,
          },
        },
        { merge: true }
      );

      toast({
        title: "Configuración de Salario Guardada",
        description: "Se ha configurado correctamente tu salario automático.",
        className: "bg-accent text-accent-foreground",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al guardar la configuración: ${error.message}`,
      });
    } finally {
      setSalaryLoading(false);
    }
  };

  // Actualizar la moneda
  const handleCurrencyUpdate = async (currencyCode: string) => {
    if (!user) return;
    setCurrencyUpdateLoading(true);

    try {
      const selectedCurrency = availableCurrencies.find(
        (c) => c.code === currencyCode
      );
      if (!selectedCurrency) {
        throw new Error("Moneda no válida");
      }

      await setCurrency(selectedCurrency);

      toast({
        title: "Moneda Actualizada",
        description: `Se ha configurado ${selectedCurrency.name} (${selectedCurrency.symbol}) como tu moneda predeterminada.`,
        className: "bg-accent text-accent-foreground",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al actualizar la moneda: ${error.message}`,
      });
    } finally {
      setCurrencyUpdateLoading(false);
    }
  };

  const handleAppLockToggle = async (enabled: boolean) => {
    if (!user) return;

    if (enabled && !securitySettings.pinEnabled && !biometricConfigured) {
      toast({
        variant: "destructive",
        title: "Configura un método de seguridad",
        description:
          "Activa FaceID/huella o crea un PIN antes de habilitar el bloqueo.",
      });
      resetPinDialog();
      setPinDialogOpen(true);
      return;
    }

    setSecurityLoading(true);
    try {
      if (enabled) {
        await enableAppLock({ requirePin: securitySettings.pinEnabled });
        toast({
          title: "Bloqueo activado",
          description:
            "Tu cuenta ahora solicitará un método de seguridad al ingresar.",
          className: "bg-accent text-accent-foreground",
        });
      } else {
        await disableAppLock();
        toast({
          title: "Bloqueo desactivado",
          description: "Ya no se solicitará PIN ni biometría al entrar.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error?.message || "No se pudo actualizar el bloqueo de la app.",
      });
    } finally {
      setSecurityLoading(false);
    }
  };

  const resetPinDialog = () => {
    setPinValue("");
    setPinConfirmValue("");
    setPinError(null);
  };

  const handlePinSave = async () => {
    if (!pinValue || !pinConfirmValue) {
      setPinError("Completa ambos campos para guardar el PIN.");
      return;
    }

    if (pinValue !== pinConfirmValue) {
      setPinError("Los PIN no coinciden.");
      return;
    }

    if (!/^[0-9]{4,12}$/.test(pinValue)) {
      setPinError("El PIN debe tener entre 4 y 12 dígitos numéricos.");
      return;
    }

    setSecurityLoading(true);
    try {
      await updateSecurityPin(pinValue);
      setPinDialogOpen(false);
      resetPinDialog();
    } catch (error: any) {
      setPinError(
        error?.message || "No se pudo actualizar el PIN. Intenta nuevamente."
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const handlePinRemove = async () => {
    setSecurityLoading(true);
    try {
      await clearPin();
      toast({
        title: "PIN eliminado",
        description: "Ya no se solicitará el PIN como método de seguridad.",
      });
      setRemovePinDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error?.message ||
          "No se pudo eliminar el PIN. Intenta de nuevo más tarde.",
      });
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleRegisterBiometric = async () => {
    setSecurityLoading(true);
    try {
      const success = await registerBiometricCredential();
      if (!success) {
        toast({
          variant: "destructive",
          title: "No se pudo configurar",
          description:
            "Revisa los permisos de FaceID/huella y vuelve a intentarlo.",
        });
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          Settings
        </h2>
        <p className="text-muted-foreground">
          Manage your account settings and integrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your personal information. This will be displayed across the
            app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Update Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seguridad y acceso</CardTitle>
          <CardDescription>
            Protege tu información con PIN, FaceID o huella dactilar antes de
            entrar a la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Bloqueo de aplicación</p>
                <p className="text-sm text-muted-foreground">
                  Solicita un método de seguridad adicional cada vez que abras
                  Fynco en este dispositivo.
                </p>
              </div>
            </div>
            <Switch
              checked={securitySettings.appLockEnabled}
              onCheckedChange={(checked) => handleAppLockToggle(checked)}
              disabled={securityLoading || refreshingCredential}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <KeyRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">PIN de 4-12 dígitos</p>
                  <p className="text-sm text-muted-foreground">
                    {securitySettings.pinEnabled
                      ? "Actualmente tienes un PIN activo."
                      : "Configura un PIN numérico como método alterno."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    resetPinDialog();
                    setPinDialogOpen(true);
                  }}
                  disabled={securityLoading}
                >
                  {securitySettings.pinEnabled
                    ? "Actualizar PIN"
                    : "Configurar PIN"}
                </Button>
                {securitySettings.pinEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRemovePinDialogOpen(true)}
                    disabled={securityLoading}
                  >
                    Quitar PIN
                  </Button>
                )}
              </div>
              {securitySettings.pinEnabled ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  PIN activo
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Sin PIN configurado
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Fingerprint className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">FaceID / Huella</p>
                  <p className="text-sm text-muted-foreground">
                    Usa los sensores biométricos del dispositivo para
                    desbloquear al instante.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleRegisterBiometric}
                  disabled={
                    securityLoading ||
                    refreshingCredential ||
                    !isBiometricAvailable
                  }
                >
                  {biometricConfigured
                    ? "Actualizar biometría"
                    : "Activar biometría"}
                </Button>
                {!isBiometricAvailable && (
                  <span className="text-sm text-muted-foreground">
                    No disponible en este dispositivo.
                  </span>
                )}
              </div>
              {biometricConfigured ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Configurada para este
                  dispositivo
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Registra tu biometría en este dispositivo para activarla.
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            El PIN se cifra antes de guardarse en la nube. La autenticación
            biométrica se almacena localmente y deberás configurarla en cada
            dispositivo.
          </p>
        </CardContent>
      </Card>

      {/* Nueva sección para la configuración de moneda */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Moneda</CardTitle>
          <CardDescription>
            Selecciona la moneda predeterminada para todas las transacciones en
            la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select
                value={currency.code}
                onValueChange={handleCurrencyUpdate}
                disabled={currencyUpdateLoading || currencyLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona moneda" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.symbol} - {curr.name} ({curr.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold">{currency.symbol}</span>
                <span className="text-muted-foreground">
                  Todos los valores se mostrarán en {currency.name} (
                  {currency.code})
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nueva sección para la configuración de tema */}
      <ThemeSection />

      <Dialog
        open={pinDialogOpen}
        onOpenChange={(open) => {
          setPinDialogOpen(open);
          if (!open) {
            resetPinDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {securitySettings.pinEnabled ? "Actualizar PIN" : "Crear PIN"}
            </DialogTitle>
            <DialogDescription>
              Define un PIN numérico de 4 a 12 dígitos. Se solicitará cuando
              abras Fynco si el bloqueo está activo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pin">Nuevo PIN</Label>
              <Input
                id="pin"
                inputMode="numeric"
                value={pinValue}
                disabled={securityLoading}
                placeholder="••••"
                onChange={(event) => {
                  const value = event.target.value.replace(/[^0-9]/g, "");
                  setPinValue(value.slice(0, 12));
                  setPinError(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin-confirm">Confirmar PIN</Label>
              <Input
                id="pin-confirm"
                inputMode="numeric"
                value={pinConfirmValue}
                disabled={securityLoading}
                placeholder="••••"
                onChange={(event) => {
                  const value = event.target.value.replace(/[^0-9]/g, "");
                  setPinConfirmValue(value.slice(0, 12));
                  setPinError(null);
                }}
              />
            </div>
            {pinError && <p className="text-sm text-destructive">{pinError}</p>}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={securityLoading}
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handlePinSave} disabled={securityLoading}>
              {securityLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando
                </span>
              ) : (
                "Guardar PIN"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removePinDialogOpen} onOpenChange={setRemovePinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar PIN</DialogTitle>
            <DialogDescription>
              Si quitas el PIN, solo la biometría (si está configurada) podrá
              proteger tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={securityLoading}
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handlePinRemove}
              disabled={securityLoading}
            >
              {securityLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Eliminando
                </span>
              ) : (
                "Quitar PIN"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva sección para la configuración de salario automático */}

      <Card>
        <CardHeader>
          <CardTitle>Email Sync</CardTitle>
          <CardDescription>
            Connect your email accounts to automatically import expenses from
            receipts (Feature coming soon).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center">
              <GmailIcon />
              <span className="font-medium">Gmail</span>
            </div>
            <Button disabled>Connect</Button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center">
              <OutlookIcon />
              <span className="font-medium">Outlook</span>
            </div>
            <Button disabled>Connect</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sección Legal */}
      <Card>
        <CardHeader>
          <CardTitle>Legal & Privacy</CardTitle>
          <CardDescription>Read our terms and privacy policy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <Button variant="outline" asChild className="justify-start">
              <a href="/legal/terms" target="_blank" rel="noopener noreferrer">
                <FileText className="mr-2 h-4 w-4" />
                Terms & Conditions
              </a>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Shield className="mr-2 h-4 w-4" />
                Privacy Policy
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zona de Peligro - Eliminación de cuenta */}
      <DangerZoneSection />
    </div>
  );
}
