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
import { Info } from "lucide-react";

interface MovementsInfoModalProps {
  trigger?: React.ReactNode;
}

export function MovementsInfoModal({ trigger }: MovementsInfoModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            ¿Qué incluye el historial de movimientos?
          </DialogTitle>
          <DialogDescription>
            Este módulo registra automáticamente todas las acciones que realizas en la aplicación
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <span className="text-lg">👤</span>
                Gestión de Cuentas
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Creación de nuevas cuentas</li>
                <li>• Modificación de cuentas existentes</li>
                <li>• Eliminación de cuentas</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <span className="text-lg">💰</span>
                Transacciones
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Registro de ingresos y gastos</li>
                <li>• Transferencias entre cuentas</li>
                <li>• Modificación de transacciones</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <span className="text-lg">🎯</span>
                Metas y Objetivos
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Creación y edición de metas</li>
                <li>• Adición de fondos a metas</li>
                <li>• Seguimiento de progreso</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <span className="text-lg">🔁</span>
                Transacciones Recurrentes
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Configuración de pagos automáticos</li>
                <li>• Modificación de recurrencias</li>
                <li>• Gestión de suscripciones</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <span className="text-lg">🔄</span>
                Transferencias
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Movimiento de dinero entre cuentas</li>
                <li>• Registro de origen y destino</li>
                <li>• Historial completo de transferencias</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <span className="text-lg">📊</span>
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

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> Todos los movimientos se registran automáticamente cuando realizas acciones en la aplicación.
            Este historial te permite mantener un seguimiento completo de tu actividad financiera.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
