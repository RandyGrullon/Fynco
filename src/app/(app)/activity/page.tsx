"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Movement, getMovements } from "@/lib/movements";
import { Button } from "@/components/ui/button";
import { RotateCcw, Database, Activity } from "lucide-react";
import { migrateAllExistingData } from "@/lib/migration";
import { useToast } from "@/hooks/use-toast";
import { ActivityInfoModal } from "@/components/activity/activity-info-modal";
import { ActivityList } from "@/components/activity/activity-list";

export default function ActivityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Movement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const loadActivities = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      const { movements: activitiesData } = await getMovements(user.uid, 50);
      setActivities(activitiesData);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user?.uid) return;
    
    try {
      setRefreshing(true);
      const { movements: activitiesData } = await getMovements(user.uid, 50);
      setActivities(activitiesData);
    } catch (error) {
      console.error("Error refreshing activities:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMigration = async () => {
    if (!user?.uid) return;
    
    try {
      setMigrating(true);
      
      toast({
        title: "Migración iniciada",
        description: "Procesando datos existentes...",
      });

      await migrateAllExistingData(user.uid);
      
      toast({
        title: "Migración completada",
        description: "Todos los datos han sido procesados exitosamente.",
      });

      // Reload activities after migration
      await loadActivities();
    } catch (error) {
      console.error("Migration error:", error);
      toast({
        title: "Error en la migración",
        description: "Hubo un problema al procesar los datos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
          
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Actividad Financiera</h1>
          </div>
          <p className="text-muted-foreground">
            Registro completo de todas tus actividades financieras
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <ActivityInfoModal />
          
          <Button
            variant="outline"
            onClick={handleMigration}
            disabled={migrating}
            className="flex items-center gap-2"
          >
            {migrating ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {migrating ? "Procesando..." : "Migrar Datos"}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-shrink-0"
          >
            <RotateCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <ActivityList
        activities={activities} 
        onRefresh={loadActivities}
      />
    </div>
  );
}
