"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Activity } from "lucide-react";

interface ActivityInfoModalProps {
  trigger?: React.ReactNode;
}

export function ActivityInfoModal({ trigger }: ActivityInfoModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Actividad Financiera - Registro Completo
          </DialogTitle>
          <DialogDescription>
            Este módulo registra automáticamente todas las acciones que realizas en la aplicación para mantener un historial completo de tu actividad financiera.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-4">
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="text-xl">👤</span>
                Gestión de Cuentas
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Creación de nuevas cuentas</li>
                <li>• Modificación de cuentas existentes</li>
                <li>• Eliminación de cuentas</li>
              </ul>
            </div>

            <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="text-xl">💰</span>
                Transacciones
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Registro de ingresos y gastos</li>
                <li>• Transferencias entre cuentas</li>
                <li>• Modificación de transacciones</li>
              </ul>
            </div>

            <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="text-xl">🎯</span>
                Metas y Objetivos
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Creación y edición de metas</li>
                <li>• Adición de fondos a metas</li>
                <li>• Seguimiento de progreso</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="text-xl">🔁</span>
                Transacciones Recurrentes
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Configuración de pagos automáticos</li>
                <li>• Modificación de recurrencias</li>
                <li>• Gestión de suscripciones</li>
              </ul>
            </div>

            <div className="space-y-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="text-xl">🔄</span>
                Transferencias
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Movimiento de dinero entre cuentas</li>
                <li>• Registro de origen y destino</li>
                <li>• Historial completo de transferencias</li>
              </ul>
            </div>

            <div className="space-y-3 p-4 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="text-xl">📊</span>
                Información Detallada
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Fecha y hora exacta</li>
                <li>• Montos y monedas</li>
                <li>• Cuentas involucradas</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">🔍</span>
            Funciones de Búsqueda y Filtrado
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium mb-1">Filtros disponibles:</p>
              <ul className="space-y-1">
                <li>• Por tipo de actividad</li>
                <li>• Por rango de fechas</li>
                <li>• Por término de búsqueda</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Información mostrada:</p>
              <ul className="space-y-1">
                <li>• Descripción detallada</li>
                <li>• Timestamp preciso</li>
                <li>• Metadatos relevantes</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Nota:</strong> Todas las actividades se registran automáticamente. 
            No necesitas hacer nada adicional - simplemente usa la aplicación normalmente 
            y podrás revisar tu historial completo aquí.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
