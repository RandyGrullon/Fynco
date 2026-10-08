"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Mic, Split } from "lucide-react";
import { Panel, PanelContent } from "@/components/ui/panel";
import { useSheets } from "./sheets";

export function QuickAddPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const sheets = useSheets();
  const options = [
    { label: "Gasto", hint: "Sale de una cuenta", icon: ArrowUpRight, onClick: () => sheets.open({ type: "transaction", kind: "expense" }) },
    { label: "Ingreso", hint: "Entra a una cuenta", icon: ArrowDownLeft, onClick: () => sheets.open({ type: "transaction", kind: "income" }) },
    { label: "Transferir", hint: "Entre tus cuentas", icon: ArrowLeftRight, onClick: () => sheets.open({ type: "transfer" }) },
    { label: "Dividir", hint: "Gasto con otras personas", icon: Split, onClick: () => sheets.open({ type: "expense" }), accent: true },
  ];

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Añadir" description="¿Qué quieres registrar?">
        <div className="grid grid-cols-2 gap-2.5 pb-3 pt-1">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={o.onClick}
              className="flex flex-col items-start gap-3 rounded-xl border border-secondary bg-card p-4 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={o.accent ? "flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground" : "flex h-11 w-11 items-center justify-center rounded-lg bg-secondary"}>
                <o.icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span>
                <span className="block text-[15px] font-bold">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
          <Link
            href="/asistente?voz=1"
            onClick={() => onOpenChange(false)}
            className="col-span-2 flex items-center gap-3 rounded-xl border border-secondary bg-card p-4 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
              <Mic className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[15px] font-bold">Dictar</span>
              <span className="block text-xs text-muted-foreground">“Gasté 850 en almuerzo con la tarjeta”</span>
            </span>
          </Link>
        </div>
      </PanelContent>
    </Panel>
  );
}
