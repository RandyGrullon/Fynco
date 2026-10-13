"use client";

import { CalendarClock } from "lucide-react";
import { Money } from "@/components/money";
import { cardDates, daysUntil, inDays } from "@/lib/card-dates";
import { shortDate, todayISO } from "@/lib/dates";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Próximo corte y fecha límite de pago de una tarjeta. */
export function CardDatesInfo({ account, onSetup }: { account: Account; onSetup?: () => void }) {
  const today = todayISO();
  const { nextStatement, nextDue } = cardDates(account.statement_day, account.payment_due_day, today);

  const limit = account.credit_limit ?? null;
  const used = Math.max(0, -account.balance);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const limitBlock = limit ? (
    <div className="rounded-2xl border border-secondary bg-card p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">Disponible</span>
        <span className="text-xs text-muted-foreground">
          Límite <Money amount={limit} currency={account.currency} className="font-semibold text-foreground" />
        </span>
      </div>
      <Money amount={limit - used} currency={account.currency} className={cn("mt-1 block text-[20px] font-extrabold", limit - used < 0 && "text-negative")} />
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Uso del límite" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", pct >= 90 ? "bg-negative" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <span className="mt-1.5 block text-xs text-muted-foreground">Usas el {pct}% del límite</span>
    </div>
  ) : null;

  if (!nextStatement && !nextDue) {
    if (!onSetup) return limitBlock;
    return (
      <div className="flex flex-col gap-2.5">
        {limitBlock}
        <button
          type="button"
          onClick={onSetup}
          className="flex items-center gap-3 rounded-2xl border border-dashed border-secondary p-4 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
            <CalendarClock className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">{limit ? "Agrega la fecha de corte y de pago" : "Agrega el límite, el corte y la fecha de pago"}</span>
            <span className="block text-xs text-muted-foreground">Te avisamos en Inicio cuando se acerque el pago.</span>
          </span>
        </button>
      </div>
    );
  }

  const dueIn = nextDue ? daysUntil(nextDue, today) : null;
  const urgent = dueIn !== null && dueIn <= 3;
  return (
    <div className="flex flex-col gap-2.5">
      {limitBlock}
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
    </div>
  );
}
