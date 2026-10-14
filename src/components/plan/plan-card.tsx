"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Money } from "@/components/money";
import { usePlan } from "@/hooks/use-plan";
import { shortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** En Inicio: cuánto puedes gastar esta quincena y el próximo pago de tarjeta. Lleva a /plan. */
export function PlanCard() {
  const { plan } = usePlan();
  if (!plan || (!plan.canSpend && !plan.nextCard)) return null;
  return (
    <Link
      href="/plan"
      className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 rounded-2xl border border-secondary bg-card p-4 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Puedes gastar</span>
        {plan.canSpend ? (
          <>
            <Money amount={plan.canSpend.amount} currency={plan.currency} className={cn("text-[17px] font-extrabold", plan.canSpend.amount < 0 && "text-negative")} />
            <span className="truncate text-[11px] text-muted-foreground">hasta el {shortDate(plan.canSpend.end)}</span>
          </>
        ) : (
          <span className="text-sm font-semibold">Sin presupuesto</span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 border-l border-secondary pl-3">
        <span className="text-xs text-muted-foreground">Próximo pago</span>
        {plan.nextCard ? (
          <>
            <Money amount={plan.nextCard.amount} currency={plan.nextCard.currency} className="text-[17px] font-extrabold" />
            <span className="truncate text-[11px] text-muted-foreground">
              {shortDate(plan.nextCard.date)} · {plan.nextCard.name}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold">Nada pendiente</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Ver el plan</span>
    </Link>
  );
}
