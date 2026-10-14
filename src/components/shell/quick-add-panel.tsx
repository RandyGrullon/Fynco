"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, FileUp, HandCoins, Mic, Split } from "lucide-react";
import { useAccounts } from "@/hooks/queries";
import { Panel, PanelContent } from "@/components/ui/panel";
import { useSheets } from "./sheets";

export function QuickAddPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const sheets = useSheets();
  const { data: accounts = [] } = useAccounts();
  const hasCards = accounts.some((a) => a.type === "credit" && !a.archived_at);
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
          {hasCards && (
            <button
              type="button"
              onClick={() => sheets.open({ type: "card_payment" })}
              className="col-span-2 flex items-center gap-3 rounded-xl border border-secondary bg-card p-4 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                <CreditCard className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span>
                <span className="block text-[15px] font-bold">Pagar tarjeta</span>
                <span className="block text-xs text-muted-foreground">Elige la tarjeta y de qué cuenta pagaste</span>
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => sheets.open({ type: "debt" })}
            className="col-span-2 flex items-center gap-3 rounded-xl border border-secondary bg-card p-4 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
              <HandCoins className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[15px] font-bold">Deuda o préstamo</span>
              <span className="block text-xs text-muted-foreground">Te prestaron o prestaste, con o sin interés</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => sheets.open({ type: "import" })}
            className="col-span-2 flex items-center gap-3 rounded-xl border border-secondary bg-card p-4 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
              <FileUp className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[15px] font-bold">Importar estado de cuenta</span>
              <span className="block text-xs text-muted-foreground">PDF, Excel o foto de tu banco</span>
            </span>
          </button>
        </div>
      </PanelContent>
    </Panel>
  );
}
