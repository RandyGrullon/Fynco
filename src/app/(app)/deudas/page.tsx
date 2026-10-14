"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, HandCoins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { Segmented } from "@/components/forms/fields";
import { MemberAvatar } from "@/components/visuals";
import { debtView, type DebtView } from "@/components/debts/debt-view";
import { useDebts, useProfile } from "@/hooks/queries";
import { shortDate, todayISO } from "@/lib/dates";
import { interestLabel } from "@/lib/debts";
import { formatMoney, sumByCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

export default function DeudasPage() {
  const { data: debts, isLoading, isError, refetch } = useDebts();
  const { data: profile } = useProfile();
  const sheets = useSheets();
  const [tab, setTab] = useState<"borrowed" | "lent">("borrowed");
  const [showClosed, setShowClosed] = useState(false);
  const currency = profile?.default_currency ?? "DOP";
  const today = todayISO();

  const views = useMemo(() => (debts ?? []).map((d) => debtView(d, today)), [debts, today]);
  const open = views.filter((v) => !v.status.done);
  const totals = (dir: "borrowed" | "lent") =>
    sumByCurrency(
      open.filter((v) => v.debt.direction === dir),
      (v) => v.debt.currency,
      (v) => v.status.remaining,
    );
  const owe = totals("borrowed");
  const owed = totals("lent");
  const list = views.filter((v) => v.debt.direction === tab);
  const active = list
    .filter((v) => !v.status.done)
    .sort((a, b) => (a.status.next?.due_on ?? "9999").localeCompare(b.status.next?.due_on ?? "9999"));
  const closed = list.filter((v) => v.status.done);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader
        title="Deudas"
        subtitle="A quién le debes y quién te debe"
        actions={
          <Button onClick={() => sheets.open({ type: "debt", direction: tab })} className="h-11 rounded-full px-4 text-sm">
            <Plus />
            Nueva
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-2.5" aria-label="Totales">
        <div className="rounded-2xl border border-secondary bg-card p-4">
          <span className="text-xs text-muted-foreground">Debes</span>
          {isLoading ? <Skeleton className="mt-1 h-7 w-24" /> : <Money amount={owe[currency] ?? 0} currency={currency} className="mt-1 block text-[22px] font-extrabold text-negative" />}
        </div>
        <div className="rounded-2xl border border-secondary bg-card p-4">
          <span className="text-xs text-muted-foreground">Te deben</span>
          {isLoading ? <Skeleton className="mt-1 h-7 w-24" /> : <Money amount={owed[currency] ?? 0} currency={currency} className="mt-1 block text-[22px] font-extrabold text-positive" />}
        </div>
      </section>

      <Segmented
        label="Ver"
        value={tab}
        onChange={setTab}
        options={[
          { value: "borrowed", label: "Debo" },
          { value: "lent", label: "Me deben" },
        ]}
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card p-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">No pudimos cargar tus deudas.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={tab === "borrowed" ? "No le debes a nadie" : "Nadie te debe"}
          action={
            <Button onClick={() => sheets.open({ type: "debt", direction: tab })}>
              <Plus />
              {tab === "borrowed" ? "Agregar deuda" : "Agregar préstamo"}
            </Button>
          }
        >
          {tab === "borrowed" ? "Anota lo que te prestaron: Fynco calcula el interés y las cuotas." : "Anota lo que prestaste y lleva la cuenta de lo que te pagan."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((v) => (
            <li key={v.debt.id}>
              <DebtRow view={v} today={today} />
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <section className="flex flex-col gap-2">
          <button type="button" onClick={() => setShowClosed((s) => !s)} className="flex min-h-11 items-center justify-between rounded-lg text-left" aria-expanded={showClosed}>
            <SectionTitle>Saldadas ({closed.length})</SectionTitle>
            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", showClosed && "rotate-180")} />
          </button>
          {showClosed && (
            <ul className="flex flex-col gap-2">
              {closed.map((v) => (
                <li key={v.debt.id}>
                  <DebtRow view={v} today={today} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function DebtRow({ view, today }: { view: DebtView; today: string }) {
  const { debt, terms, status } = view;
  const pct = terms.total ? Math.round((status.paid / terms.total) * 100) : 0;
  const next = status.next;
  const overdue = status.overdue > 0;
  return (
    <Link
      href={`/deudas/${debt.id}`}
      className="flex items-center gap-3 rounded-xl border border-secondary bg-card px-3.5 py-3 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MemberAvatar name={debt.person} seed={debt.person} size={38} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{debt.person}</span>
          <Money amount={status.remaining} currency={debt.currency} className={cn("text-[15px] font-bold", status.done && "text-muted-foreground")} />
        </span>
        <span className={cn("block truncate text-xs", overdue ? "font-semibold text-negative" : "text-muted-foreground")}>
          {status.done
            ? "Saldada"
            : overdue
              ? `Vencido: ${formatMoney(status.overdue, debt.currency)}`
              : next
                ? `${next.due_on === today ? "Hoy" : shortDate(next.due_on)} · cuota ${next.n} de ${terms.installments.length}`
                : ""}
          {!status.done && ` · ${interestLabel(debt.interest_rate, debt.interest_period)}`}
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

