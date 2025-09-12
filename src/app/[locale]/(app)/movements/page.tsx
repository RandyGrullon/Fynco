"use client";

import { MovementsList } from "@/components/movements/movements-list";
import { MovementsInfoModal } from "@/components/movements/movements-info-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Movement, getMovements } from "@/lib/movements";
import { Button } from "@/components/ui/button";
import { RotateCcw, Database } from "lucide-react";
import { migrateAllExistingData } from "@/lib/migration";
import { useToast } from "@/hooks/use-toast";

export default function MovementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const loadMovements = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const { movements: movementsData } = await getMovements(user.uid, 50);
      setMovements(movementsData);
    } catch (error) {
      console.error("Error loading movements:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user?.uid) return;
    
    try {
      setRefreshing(true);
      const { movements: movementsData } = await getMovements(user.uid, 50);
      setMovements(movementsData);
    } catch (error) {
      console.error("Error refreshing movements:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMigration = async () => {
    if (!user?.uid) return;
    
    try {
      setMigrating(true);
      toast({
        title: "Iniciando migración",
        description: "Migrando datos existentes a movimientos...",
      });
      
      await migrateAllExistingData(user.uid);
      
      toast({
        title: "Migración completada",
        description: "Todos los datos existentes han sido migrados a movimientos.",
        className: "bg-green-50 text-green-900 border-green-200",
      });
      
      // Refrescar los movimientos después de la migración
      await handleRefresh();
      
    } catch (error) {
      console.error("Error during migration:", error);
      toast({
        title: "Error en la migración",
        description: "Hubo un error al migrar los datos. Revisa la consola para más detalles.",
        variant: "destructive",
      });
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadMovements();
    }
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:gap-8 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-80 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
              Activity History
            </h1>
            <MovementsInfoModal />
          </div>
          <p className="text-muted-foreground">
            Track all activities and changes in your financial accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || migrating}
            className="gap-2"
          >
            <RotateCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={handleMigration}
            disabled={refreshing || migrating}
            className="gap-2"
          >
            <Database className={`h-4 w-4 ${migrating ? "animate-pulse" : ""}`} />
            {migrating ? "Migrating..." : "Migrate Data"}
          </Button>
        </div>
      </div>

      <MovementsList />
    </div>
  );
}
