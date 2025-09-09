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
      const transactionsRef = collection(db, "users", user.uid, "transactions");
      await addDoc(transactionsRef, {
        amount: amount,
        source: "Salario",
        date: new Date().toISOString(),
        category: "Salary",
        type: "income",
        method: "Direct Deposit",
      });
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

      {/* Nueva sección para la configuración de salario automático */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Salario Automático</CardTitle>
          <CardDescription>
            Configura tu salario para que se agregue automáticamente a tus
            ingresos en la fecha especificada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSalarySettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="salary">Monto del Salario</Label>
              <Input
                id="salary"
                type="number"
                placeholder="0.00"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                disabled={salaryLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositDay">Día de Depósito (1-31)</Label>
              <Input
                id="depositDay"
                type="number"
                min="1"
                max="31"
                placeholder="15"
                value={depositDay}
                onChange={(e) => setDepositDay(e.target.value)}
                disabled={salaryLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frecuencia</Label>
              <Select
                value={frequency}
                onValueChange={(value: "weekly" | "biweekly" | "monthly") =>
                  setFrequency(value)
                }
                disabled={salaryLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={salaryLoading}>
              {salaryLoading ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}
