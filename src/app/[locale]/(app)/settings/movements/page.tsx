"use client";

import { MovementsList } from "@/components/movements/movements-list";
import { MovementsInfoModal } from "@/components/movements/movements-info-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity } from "lucide-react";
import Link from "next/link";

export default function MovementsPage() {
  return (
    <div className="container max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Historial de Movimientos</h1>
              <MovementsInfoModal />
            </div>
            <p className="text-muted-foreground">
              Revisa todas las actividades realizadas en tu cuenta
            </p>
          </div>
        </div>
      </div>

      {/* Lista de movimientos */}
      <MovementsList />
    </div>
  );
}
