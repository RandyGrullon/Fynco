"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ChevronRight, Plus, Settings2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/money";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { useSheets } from "@/components/shell/sheets";
import { RecurringPanel } from "@/components/recurring/recurring-panel";
import { PlanChart } from "@/components/plan/plan-chart";
import { PlanSettingsPanel } from "@/components/plan/plan-settings-panel";
import { PlanPeriodPanel } from "@/components/plan/period-panel";
import { RichLine } from "@/components/plan/rich";
import { usePlan } from "@/hooks/use-plan";
import { useAccounts, usePlanPeriods, useRecurring } from "@/hooks/queries";
import { monthLabel, parseDate, shortDate } from "@/lib/dates";
import type { PlanEvent, PlanResult } from "@/lib/plan/types";
import type { PlanPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "todo", label: "Todo" },
  { value: "cobros", label: "Cobros" },
  { value: "tarjetas", label: "Tarjetas" },
  { value: "deudas", label: "Deudas" },
  { value: "compras", label: "Compras" },
] as const;
type TypeFilter = (typeof TYPES)[number]["value"];
const TYPE_MATCH: Record<TypeFilter, (e: PlanEvent) => boolean> = {
  todo: () => true,
  cobros: (e) => e.type === "income",
  tarjetas: (e) => e.type === "card",
  deudas: (e) => e.type === "debt",
  compras: (e) => e.type === "purchase" || e.type === "transfer",
};

export default function PlanPage() {
  return (
    <Suspense fallback={<PlanSkeleton />}>
      <PlanScreen />
    </Suspense>
  );
}

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-4 pt-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

function PlanScreen() {
  const { plan, isLoading, missingSetup, error, refetch } = usePlan();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const openSettings = () => {
    setSettingsKey((k) => k + 1);
    setSettingsOpen(true);
  };

  const header = (
    <PageHeader
      title="Plan"
      subtitle="Lo que entra, lo que sale y cuánto puedes gastar"
      actions={
        <Button variant="secondary" size="icon" onClick={openSettings} aria-label="Ajustes del plan" title="Ajustes del plan" disabled={missingSetup}>
          <Settings2 />
        </Button>
      }
    />
  );

  if (isLoading) return <PlanSkeleton />;
  if (missingSetup) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        {header}
        <EmptyState icon={CalendarRange} title="Falta preparar la base de datos">
          Corre en Supabase la migración <code>20261017000001_plan.sql</code> y vuelve a abrir esta pantalla.
        </EmptyState>
      </div>
    );
  }
  if (error || !plan) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        {header}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary bg-card p-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">No pudimos armar tu plan.</p>
          <Button variant="secondary" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const needsSetup = !plan.hasBudget || plan.paydaysFrom === "default";

  return (
    <div className="flex flex-col gap-6 pb-4">
      {header}
      <p className="rounded-2xl border border-secondary bg-card p-4 text-[15px] leading-relaxed text-muted-foreground">
        <RichLine parts={plan.summary} />
      </p>

      {needsSetup && (
        <EmptyState
          icon={Settings2}
          title={!plan.hasBudget ? "Ponle un presupuesto al día a día" : "Planifica tus cobros"}
          action={
            plan.hasBudget ? undefined : (
              <Button onClick={openSettings}>
                <Settings2 />
                Configurar el plan
              </Button>
            )
          }
        >
          {!plan.hasBudget
            ? "Con tu gasto mensual del día a día, Fynco calcula cuánto puedes gastar cada quincena y estima tus cortes."
            : "Crea tus cobros de Salario como recurrentes (también los de una sola vez) para que las quincenas vayan de un cobro al siguiente. Mientras tanto se usan los días 1 y 16."}
        </EmptyState>
      )}

      <Figures plan={plan} />
      <Timeline plan={plan} />
      <Cards plan={plan} />
      <Debts plan={plan} />
      <Budget plan={plan} />
      <Periods plan={plan} />

      <section className="flex flex-col gap-2">
        <SectionTitle>Supuestos</SectionTitle>
        <ul className="flex flex-col gap-1.5 rounded-2xl border border-secondary bg-card p-4 text-[13px] leading-relaxed text-muted-foreground">
          {plan.assumptions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">·</span>
              <RichLine parts={a} />
            </li>
          ))}
        </ul>
        <Button variant="secondary" className="h-11" onClick={openSettings}>
          <Settings2 />
          Ajustes del plan
        </Button>
      </section>

      {settingsOpen && <PlanSettingsPanel key={settingsKey} open onOpenChange={setSettingsOpen} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Tile({ label, children, hint, tone }: { label: string; children: React.ReactNode; hint?: React.ReactNode; tone?: "negative" }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-3.5", tone === "negative" ? "border-negative/40" : "border-secondary")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("truncate text-[18px] font-extrabold md:text-[19px]", tone === "negative" && "text-negative")}>{children}</span>
      {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Figures({ plan }: { plan: PlanResult }) {
  const c = plan.currency;
  return (
    <section aria-label="Cifras" className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
      <div className="col-span-2 md:col-span-1">
        <Tile label="Tu dinero" hint={plan.reserved > 0 ? "Sin lo prestado, que no es tuyo" : "Cuentas y efectivo"}>
          <Money amount={plan.myMoney} currency={c} />
        </Tile>
      </div>
      <Tile label="Puedes gastar" tone={plan.canSpend && plan.canSpend.amount < 0 ? "negative" : undefined} hint={plan.canSpend ? `Hasta el ${shortDate(plan.canSpend.end)}` : "Sin presupuesto"}>
        {plan.canSpend ? <Money amount={plan.canSpend.amount} currency={c} cents="never" /> : "—"}
      </Tile>
      <Tile label="Próximo pago de tarjeta" hint={plan.nextCard ? `${shortDate(plan.nextCard.date)} · ${plan.nextCard.name} · desde ${plan.nextCard.from}` : undefined}>
        {plan.nextCard ? (
          <span>
            <Money amount={plan.nextCard.amount} currency={plan.nextCard.currency} cents="never" />
          </span>
        ) : (
          "Nada pendiente"
        )}
      </Tile>
      <Tile label="Deudas" hint="En cuotas">
        <Money amount={plan.debts} currency={c} cents="never" />
      </Tile>
      <Tile label={`Al ${shortDate(plan.horizonEnd)}`} tone={plan.endBalance < plan.cushion ? "negative" : undefined} hint={`Lo más bajo: ${shortDate(plan.low.date)}`}>
        <Money amount={plan.endBalance} currency={c} cents="never" />
      </Tile>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function Timeline({ plan }: { plan: PlanResult }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sheets = useSheets();
  const { data: accounts = [] } = useAccounts();
  const { data: rules = [] } = useRecurring();
  const [ruleId, setRuleId] = useState<string | null>(null);
  const tipo = (TYPES.find((t) => t.value === params.get("tipo"))?.value ?? "todo") as TypeFilter;
  const cuenta = params.get("cuenta") ?? "";
  const mes = params.get("mes") ?? "";
  const pendientes = params.get("pendientes") === "1";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const months = useMemo(() => [...new Set(plan.events.map((e) => e.date.slice(0, 7)))].sort(), [plan.events]);
  const involved = useMemo(() => {
    const ids = new Set(plan.events.flatMap((e) => e.accountIds));
    return accounts.filter((a) => ids.has(a.id));
  }, [plan.events, accounts]);
  const rows = plan.events.filter((e) => e.type !== "estimate" && TYPE_MATCH[tipo](e) && (!cuenta || e.accountIds.includes(cuenta)) && (!mes || e.date.startsWith(mes)) && (!pendientes || !e.past));

  function open(e: PlanEvent) {
    const a = e.action;
    if (!a || e.past) return;
    if (a.kind === "card_payment") sheets.open({ type: "card_payment", cardId: a.cardId, amount: a.amount, fromId: a.fromId });
    else if (a.kind === "transfer") sheets.open({ type: "transfer", preset: { from: a.from, to: a.to, amount: a.amount, description: a.description } });
    else if (a.kind === "recurring") setRuleId(a.ruleId);
    else if (a.kind === "debt") router.push(`/deudas/${a.debtId}`);
  }
  const rule = ruleId ? rules.find((r) => r.id === ruleId) : undefined;

  return (
    <>
      <section className="flex flex-col gap-3">
        <SectionTitle>Tu dinero, día a día</SectionTitle>
        <div className="rounded-2xl border border-secondary bg-card p-3">
          <PlanChart plan={plan} month={mes || null} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
            {plan.periods.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary/20" aria-hidden="true" /> {plan.periods.map((p) => p.name).join(", ")}
              </span>
            )}
            {plan.cushion > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-negative" aria-hidden="true" /> Colchón
              </span>
            )}
            <span>
              Lo más bajo: <Money amount={plan.low.balance} currency={plan.currency} className={cn("font-semibold", plan.belowCushion ? "text-negative" : "text-foreground")} /> el {shortDate(plan.low.date)}
            </span>
          </div>
        </div>
        {plan.belowCushion && (
          <p className="flex items-start gap-2 rounded-xl border border-negative/40 bg-negative/10 p-3 text-sm" role="status">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
            <span>
              El {shortDate(plan.low.date)} bajas a <Money amount={plan.low.balance} currency={plan.currency} className="font-bold" />
              {plan.cushion > 0 ? ", por debajo de tu colchón." : "."}
            </span>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Qué entra y qué sale</SectionTitle>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0" role="radiogroup" aria-label="Tipo">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={tipo === t.value}
              onClick={() => setParam("tipo", t.value === "todo" ? null : t.value)}
              className={cn("min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", tipo === t.value ? "border-primary bg-primary text-primary-foreground" : "border-secondary bg-card text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <select
            aria-label="Cuenta o tarjeta"
            value={cuenta}
            onChange={(e) => setParam("cuenta", e.target.value || null)}
            className="h-11 min-w-0 rounded-xl border border-secondary bg-card px-3 text-sm text-foreground"
          >
            <option value="">Todas las cuentas</option>
            {involved.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select aria-label="Mes" value={mes} onChange={(e) => setParam("mes", e.target.value || null)} className="h-11 min-w-0 rounded-xl border border-secondary bg-card px-3 text-sm text-foreground">
            <option value="">Todos los meses</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(parseDate(`${m}-01`))}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-secondary bg-card px-4">
          <span className="text-sm font-semibold">Solo pendientes</span>
          <Switch checked={pendientes} onCheckedChange={(v) => setParam("pendientes", v ? "1" : null)} />
        </label>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nada con estos filtros.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-secondary bg-card">
            <div className="hidden grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_120px_120px] gap-3 border-b border-secondary px-4 py-2 text-xs font-semibold text-muted-foreground md:grid">
              <span>Fecha</span>
              <span>Qué</span>
              <span>Con</span>
              <span className="text-right">Monto</span>
              <span className="text-right">Queda</span>
            </div>
            <ul className="divide-y divide-secondary">
              {rows.map((e) => {
                const clickable = Boolean(e.action) && !e.past;
                const Row = clickable ? "button" : "div";
                return (
                  <li key={e.id}>
                    <Row
                      {...(clickable ? { type: "button" as const, onClick: () => open(e) } : {})}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-left md:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_120px_120px]",
                        e.past && "opacity-50",
                        clickable && "transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      )}
                    >
                      <span className="hidden text-sm text-muted-foreground md:block">{shortDate(e.date)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {e.label}
                          {e.overdue && <span className="ml-1.5 rounded-full bg-negative/15 px-1.5 text-[10px] font-bold text-negative">Vencido</span>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground md:hidden">
                          {shortDate(e.date)} · {e.with}
                        </span>
                      </span>
                      <span className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
                        {e.with}
                        {e.dueDate && e.dueDate !== e.date ? ` · vence ${shortDate(e.dueDate)}` : ""}
                      </span>
                      <span className="text-right">
                        <Money
                          amount={e.amount}
                          currency={e.currency}
                          sign={e.effect === 0 && !e.past ? "never" : "always"}
                          className={cn("block text-sm font-bold", e.amount > 0 && e.effect !== 0 && "text-positive")}
                        />
                        <span className="block text-[11px] text-muted-foreground md:hidden">{e.balance !== null ? <Money amount={e.balance} currency={plan.currency} /> : "Ya pasó"}</span>
                      </span>
                      <span className="hidden text-right text-sm text-muted-foreground md:block">{e.balance !== null ? <Money amount={e.balance} currency={plan.currency} /> : "—"}</span>
                    </Row>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
      {rule && <RecurringPanel open onOpenChange={(o) => !o && setRuleId(null)} rule={rule} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function Cards({ plan }: { plan: PlanResult }) {
  const sheets = useSheets();
  if (!plan.cards.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Tarjetas</SectionTitle>
      {plan.cards.map((g) => {
        const first = g.cycles[0];
        const main = g.accounts.find((a) => a.currency === g.currency) ?? g.accounts[0];
        const next = plan.events.find((e) => !e.past && e.action?.kind === "card_payment" && e.action.cardId === main.id);
        const nextAmount = next?.action?.kind === "card_payment" ? next.action.amount : undefined;
        return (
          <div key={g.key} className="flex flex-col gap-3 rounded-2xl border border-secondary bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">
                  {g.name}
                  {g.last4 && !g.name.includes(g.last4) ? <span className="font-normal text-muted-foreground"> ···{g.last4}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">Se paga desde {g.fromName}</p>
              </div>
              {first && (
                <Button className="h-10 shrink-0 rounded-full px-4 text-sm" onClick={() => sheets.open({ type: "card_payment", cardId: main.id, amount: nextAmount, fromId: g.fromId })}>
                  Pagar
                </Button>
              )}
            </div>
            {g.accounts
              .filter((a) => a.limit)
              .map((a) => {
                const pct = Math.min(100, Math.round((a.debt / (a.limit ?? 1)) * 100));
                return (
                  <div key={a.id} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Usas el {pct}% del límite</span>
                      <Money amount={a.limit ?? 0} currency={a.currency} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={`Uso del límite de ${a.name}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className={cn("h-full rounded-full", pct >= 90 ? "bg-negative" : "bg-primary")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            {g.missing && <p className="text-xs text-muted-foreground">Agrega el día de corte y de pago en la tarjeta para programar sus pagos.</p>}
            {g.cycles.length > 0 && (
              <ul className="flex flex-col divide-y divide-secondary">
                {g.cycles.map((c) => (
                  <li key={c.payDate} className="grid grid-cols-3 gap-x-3 gap-y-1.5 py-2.5 text-xs">
                    <Cell label="Corte">{shortDate(c.cut)}</Cell>
                    <Cell label="Pagas el">{shortDate(c.payDate)}</Cell>
                    <Cell label="Vence" tone={c.overdue ? "negative" : undefined}>
                      {shortDate(c.dueDate)}
                    </Cell>
                    <Cell label="Ya cargado">
                      <Money amount={c.charged} currency={g.currency} />
                    </Cell>
                    <Cell label="Por venir">
                      <Money amount={c.upcoming} currency={g.currency} />
                    </Cell>
                    <Cell label="Total" strong>
                      <Money amount={c.total} currency={g.currency} />
                    </Cell>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Cell({ label, children, strong, tone }: { label: string; children: React.ReactNode; strong?: boolean; tone?: "negative" }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("truncate font-semibold", strong && "font-extrabold", tone === "negative" && "text-negative")}>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------

function Debts({ plan }: { plan: PlanResult }) {
  const router = useRouter();
  if (!plan.reservedAccounts.length && !plan.installmentDebts.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Deudas y préstamos</SectionTitle>
      {plan.reservedAccounts.length > 0 && (
        <div className="rounded-2xl border border-secondary bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Se devuelve completo (no es tuyo)</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {plan.reservedAccounts.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.name}</span>
                <Money amount={r.amount} currency={r.currency} className="font-bold" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.installmentDebts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {plan.installmentDebts.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => router.push(d.source === "debt" ? `/deudas/${d.id}` : `/cuentas/${d.id}`)}
                className="flex w-full flex-col gap-1.5 rounded-2xl border border-secondary bg-card p-4 text-left transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-bold">{d.name}</span>
                  <Money amount={d.amount} currency={d.currency} className="font-extrabold text-negative" />
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.next.length ? (
                    <>
                      Próximas:{" "}
                      {d.next.map((n, i) => (
                        <span key={n.date + i}>
                          {i > 0 && ", "}
                          {shortDate(n.date)} <Money amount={n.amount} currency={d.currency} />
                        </span>
                      ))}
                    </>
                  ) : (
                    "Sin cuotas planificadas"
                  )}
                </span>
                <span className="flex items-center justify-between text-xs">
                  <span className={d.payoff ? "font-semibold text-primary" : "text-muted-foreground"}>
                    {d.payoff ? (
                      `Queda saldada el ${shortDate(d.payoff)}`
                    ) : (
                      <>
                        Al final del plan faltarían <Money amount={d.leftAtEnd} currency={d.currency} />
                      </>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function Budget({ plan }: { plan: PlanResult }) {
  if (!plan.hasBudget || !plan.budgetRows.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Presupuesto por quincena</SectionTitle>
      <ul className="flex flex-col gap-2">
        {plan.budgetRows.map((r) => {
          const pct = r.budget ? Math.min(100, Math.round((r.spent / r.budget) * 100)) : 0;
          return (
            <li key={r.key} className={cn("rounded-2xl border bg-card p-3.5", r.current ? "border-primary/60" : "border-secondary")} aria-current={r.current ? "true" : undefined}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-bold">
                  {r.label}
                  {r.kind === "period" && <span className="font-normal text-muted-foreground"> · {shortDate(r.start)} – {shortDate(r.end)}</span>}
                  {r.current && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">Ahora</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.days} días</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                <Cell label="Puedes">
                  <Money amount={r.budget} currency={plan.currency} />
                </Cell>
                <Cell label="Gastado">
                  <Money amount={r.spent} currency={plan.currency} />
                </Cell>
                <Cell label="Queda" tone={r.left < 0 ? "negative" : undefined} strong>
                  <Money amount={r.left} currency={plan.currency} />
                </Cell>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Gastado" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn("h-full rounded-full", r.left < 0 ? "bg-negative" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function Periods({ plan }: { plan: PlanResult }) {
  const { data: periods = [] } = usePlanPeriods();
  const [editing, setEditing] = useState<{ key: number; period?: PlanPeriod } | null>(null);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Periodos</SectionTitle>
        <Button variant="secondary" size="sm" className="h-10 px-3.5" onClick={() => setEditing({ key: Date.now() })}>
          <Plus className="!size-4" />
          Agregar
        </Button>
      </div>
      {plan.periods.length === 0 ? (
        <p className="text-sm text-muted-foreground">Un viaje u otro tiempo con su propio presupuesto. Mientras dura, no corre el de casa.</p>
      ) : (
        plan.periods.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setEditing({ key: Date.now(), period: periods.find((x) => x.id === p.id) })}
            className="flex flex-col gap-2.5 rounded-2xl border border-secondary bg-card p-4 text-left transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-bold">{p.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {shortDate(p.start)} – {shortDate(p.end)}
              </span>
            </span>
            <span className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Cell label="Presupuesto">
                <Money amount={p.budget} currency={p.currency} />
              </Cell>
              <Cell label="Gastado">
                <Money amount={p.spent} currency={p.currency} />
              </Cell>
              <Cell label="Queda" tone={p.left < 0 ? "negative" : undefined} strong>
                <Money amount={p.left} currency={p.currency} />
              </Cell>
              <Cell label="Por día">
                <Money amount={p.perDay} currency={p.currency} />
              </Cell>
            </span>
            <span className="text-xs text-muted-foreground">
              Efectivo <Money amount={p.cash} currency={p.currency} className="font-semibold text-foreground" /> · con tarjeta{" "}
              <Money amount={p.card} currency={p.currency} className="font-semibold text-foreground" />
              {p.cardName ? ` (${p.cardName})` : ""}
            </span>
          </button>
        ))
      )}
      {editing && <PlanPeriodPanel key={editing.key} open onOpenChange={(o) => !o && setEditing(null)} period={editing.period} />}
    </section>
  );
}
