"use client";

import { useMemo, useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { iconFor } from "@/components/visuals";
import { FREQUENCY_LABEL, RecurringPanel, adjustWeekend, monthlyEquivalent } from "@/components/recurring/recurring-panel";
import { useAccounts, useCategories, useProfile, useRecurring } from "@/hooks/queries";
import { shortDate, todayISO } from "@/lib/dates";
import type { Account, Category, RecurringRule } from "@/lib/types";
import { cn } from "@/lib/utils";

type Monthly = Record<string, { expense: number; income: number }>;

export default function RecurrentesPage() {
  const { data: rules, isLoading, isError, refetch } = useRecurring();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  // `key` fuerza un formulario limpio cada vez que se abre.
  const [panel, setPanel] = useState<{ key: number; rule?: RecurringRule } | null>(null);

  const currency = profile?.default_currency ?? "DOP";
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const active = useMemo(() => (rules ?? []).filter((r) => r.active), [rules]);
  const paused = useMemo(() => (rules ?? []).filter((r) => !r.active), [rules]);

  const monthly = useMemo(() => {
    const out: Monthly = {};
    for (const r of active) {
      const cur = accById.get(r.account_id)?.currency ?? currency;
      const slot = (out[cur] ??= { expense: 0, income: 0 });
      slot[r.kind] += monthlyEquivalent(r.amount, r.frequency);
    }
    return out;
  }, [active, accById, currency]);
  const main = monthly[currency] ?? { expense: 0, income: 0 };
  const others = Object.entries(monthly).filter(([c]) => c !== currency);

  const openNew = () => setPanel({ key: Date.now() });
  const openRule = (rule: RecurringRule) => setPanel({ key: Date.now(), rule });

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader
        title="Recurrentes"
        subtitle="Gastos e ingresos que se repiten solos"
        actions={
          <Button onClick={openNew} className="h-11 rounded-full px-4 text-sm">
            <Plus />
            Nuevo
          </Button>
        }
      />

      <section aria-label="Equivalente mensual" className="flex flex-col gap-3 rounded-2xl border border-secondary bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Gastos fijos al mes</span>
            {isLoading ? <Skeleton className="h-7 w-28" /> : <Money amount={-main.expense} currency={currency} className="text-[20px] font-extrabold" />}
          </div>
          <div className="flex min-w-0 flex-col gap-1 border-l border-secondary pl-3">
            <span className="text-xs text-muted-foreground">Ingresos fijos al mes</span>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <Money amount={main.income} currency={currency} sign="always" className="text-[20px] font-extrabold text-positive" />
            )}
          </div>
        </div>
        {others.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-secondary pt-3 text-[13px]" aria-label="Otras monedas">
            {others.map(([c, v]) => (
              <li key={c} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">En {c}</span>
                <span className="flex gap-3">
                  {v.expense > 0 && <Money amount={-v.expense} currency={c} className="font-semibold" />}
                  {v.income > 0 && <Money amount={v.income} currency={c} sign="always" className="font-semibold text-positive" />}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Aproximado: cada frecuencia convertida a su equivalente mensual. Solo cuenta los activos.</p>
      </section>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[66px] w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card p-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">No pudimos cargar tus recurrentes.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : !rules?.length ? (
        <EmptyState
          icon={Repeat}
          title="Aún no tienes recurrentes"
          action={
            <Button onClick={openNew}>
              <Plus />
              Crear recurrente
            </Button>
          }
        >
          Salario, alquiler, Netflix, la luz… Fynco los registra solos en su fecha.
        </EmptyState>
      ) : (
        <>
          <RuleSection title="Activos" rules={active} empty="No tienes recurrentes activos." accById={accById} catById={catById} onOpen={openRule} />
          {paused.length > 0 && <RuleSection title="Pausados" rules={paused} accById={accById} catById={catById} onOpen={openRule} />}
        </>
      )}

      {panel && <RecurringPanel key={panel.key} open onOpenChange={(o) => !o && setPanel(null)} rule={panel.rule} />}
    </div>
  );
}

function RuleSection({
  title,
  rules,
  empty,
  accById,
  catById,
  onOpen,
}: {
  title: string;
  rules: RecurringRule[];
  empty?: string;
  accById: Map<string, Account>;
  catById: Map<string, Category>;
  onOpen: (r: RecurringRule) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>
        {title} <span className="font-semibold text-muted-foreground">({rules.length})</span>
      </SectionTitle>
      {rules.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li key={r.id}>
              <RuleRow rule={r} account={accById.get(r.account_id)} category={r.category_id ? catById.get(r.category_id) : undefined} onClick={() => onOpen(r)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RuleRow({ rule, account, category, onClick }: { rule: RecurringRule; account?: Account; category?: Category; onClick: () => void }) {
  const Icon = category ? iconFor(category.icon) : Repeat;
  const ended = Boolean(rule.end_on && rule.next_run_on > rule.end_on);
  const next = adjustWeekend(rule.next_run_on, rule.weekend_policy);
  const when = !rule.active ? (ended ? "Finalizado" : "Pausado") : next === todayISO() ? "Hoy" : shortDate(next);
  const meta = [FREQUENCY_LABEL[rule.frequency], rule.active ? `Próximo: ${when}` : when, account?.name].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[66px] w-full items-center gap-3 rounded-xl border border-secondary bg-card px-3.5 py-3 text-left transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-secondary bg-background"
        style={category ? { color: category.color } : undefined}
        aria-hidden="true"
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[15px] font-semibold", !rule.active && "text-muted-foreground")}>{rule.description}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <Money
        amount={rule.kind === "income" ? rule.amount : -rule.amount}
        currency={account?.currency}
        sign="always"
        className={cn("text-[15px] font-bold", rule.kind === "income" && rule.active && "text-positive", !rule.active && "text-muted-foreground")}
      />
    </button>
  );
}
