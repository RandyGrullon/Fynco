"use client";

import { CalendarClock } from "lucide-react";
import { cardDates, daysUntil, inDays } from "@/lib/card-dates";
import { shortDate, todayISO } from "@/lib/dates";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Próximo corte y fecha límite de pago de una tarjeta. */
export function CardDatesInfo({ account, onSetup }: { account: Account; onSetup?: () => void }) {
  const today = todayISO();
  const { nextStatement, nextDue } = cardDates(account.statement_day, account.payment_due_day, today);

  if (!nextStatement && !nextDue) {
    if (!onSetup) return null;
    return (
      <button
        type="button"
        onClick={onSetup}
        className="flex items-center gap-3 rounded-2xl border border-dashed border-secondary p-4 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
          <CalendarClock className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">Agrega la fecha de corte y de pago</span>
          <span className="block text-xs text-muted-foreground">Te avisamos en Inicio cuando se acerque el pago.</span>
        </span>
      </button>
    );
  }

  const dueIn = nextDue ? daysUntil(nextDue, today) : null;
  const urgent = dueIn !== null && dueIn <= 3;
  return (
    <section aria-label="Fechas de la tarjeta" className="grid grid-cols-2 gap-2.5">
      <div className="flex flex-col gap-0.5 rounded-2xl border border-secondary bg-card p-3.5">
        <span className="text-xs text-muted-foreground">Próximo corte</span>
        <span className="text-[17px] font-extrabold">{nextStatement ? shortDate(nextStatement) : "Sin definir"}</span>
        {nextStatement && <span className="text-xs text-muted-foreground">{inDays(daysUntil(nextStatement, today))}</span>}
      </div>
      <div className={cn("flex flex-col gap-0.5 rounded-2xl border p-3.5", urgent ? "border-negative/40 bg-negative/10" : "border-secondary bg-card")}>
        <span className="text-xs text-muted-foreground">Pagar antes del</span>
        <span className={cn("text-[17px] font-extrabold", urgent && "text-negative")}>{nextDue ? shortDate(nextDue) : "Sin definir"}</span>
        {dueIn !== null && <span className={cn("text-xs", urgent ? "font-semibold text-negative" : "text-muted-foreground")}>{inDays(dueIn)}</span>}
      </div>
    </section>
  );
}
