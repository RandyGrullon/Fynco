"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel, PanelContent, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AccountSelect, Field } from "@/components/forms/fields";
import { useAccountMutations, useAccounts, useCategories, usePlanMutations, usePlanPeriods, usePlanSettings, useProfile } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { centsToInput, currencySymbol, parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const money = (v: string) => (v.trim() ? parseMoney(v) : null);
const onlyMoney = (v: string) => v.replace(/[^\d.,]/g, "");

/** Presupuesto, colchón, horizonte, tasas, cuenta del día a día, categorías excluidas, tarjetas y préstamos. */
export function PlanSettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: settings } = usePlanSettings();
  const { data: periods = [] } = usePlanPeriods();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  const pm = usePlanMutations();
  const am = useAccountMutations();
  const main = profile?.default_currency ?? "DOP";
  const active = accounts.filter((a) => !a.archived_at);
  const cards = active.filter((a) => a.type === "credit");
  const others = active.filter((a) => a.type === "other");
  const liquid = active.filter((a) => ["checking", "savings", "cash"].includes(a.type));
  const currencies = useMemo(
    () => [...new Set([...active.map((a) => a.currency), ...periods.map((p) => p.currency), ...Object.keys(settings?.rates ?? {})])].filter((c) => c !== main).sort(),
    [active, periods, settings?.rates, main],
  );

  const [budget, setBudget] = useState(settings?.monthly_budget ? centsToInput(settings.monthly_budget) : "");
  const [cushion, setCushion] = useState(settings?.cushion ? centsToInput(settings.cushion) : "");
  const [horizon, setHorizon] = useState(String(settings?.horizon_days ?? 100));
  const [budgetAccount, setBudgetAccount] = useState<string | null>(settings?.budget_account_id ?? null);
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(settings?.rates ?? {}).map(([k, v]) => [k, String(v)])));
  const [excluded, setExcluded] = useState<Set<string>>(new Set(settings?.excluded_category_ids ?? []));
  const [cardDays, setCardDays] = useState<Record<string, string>>(() => Object.fromEntries(cards.map((c) => [c.id, c.pay_day ? String(c.pay_day) : ""])));
  const [cardFrom, setCardFrom] = useState<Record<string, string>>(() => Object.fromEntries(cards.map((c) => [c.id, c.pay_from_account_id ?? ""])));
  const [reserved, setReserved] = useState<Record<string, boolean>>(() => Object.fromEntries(others.map((o) => [o.id, Boolean(o.reserved)])));
  const [error, setError] = useState<string | null>(null);
  const busy = pm.saveSettings.isPending || am.update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const b = money(budget);
    const c = money(cushion);
    const h = Math.round(Number(horizon));
    if (budget.trim() && b === null) return setError("El presupuesto no es un número válido.");
    if (cushion.trim() && c === null) return setError("El colchón no es un número válido.");
    if (!(h >= 14 && h <= 400)) return setError("El horizonte va de 14 a 400 días.");
    const parsedRates: Record<string, number> = {};
    for (const [cur, v] of Object.entries(rates)) {
      if (!v.trim()) continue;
      const n = Number(v.replace(",", "."));
      if (!(n > 0)) return setError(`La tasa de ${cur} no es válida.`);
      parsedRates[cur] = n;
    }
    for (const card of cards) {
      const d = cardDays[card.id]?.trim();
      if (d && !(Number(d) >= 1 && Number(d) <= 31)) return setError(`El día de pago de ${card.name} va del 1 al 31.`);
    }
    setError(null);
    try {
      await pm.saveSettings.mutateAsync({
        monthly_budget: b,
        cushion: c ?? 0,
        horizon_days: h,
        budget_account_id: budgetAccount,
        rates: parsedRates,
        excluded_category_ids: [...excluded],
      });
      for (const card of cards) {
        const payDay = cardDays[card.id]?.trim() ? Number(cardDays[card.id]) : null;
        const payFrom = cardFrom[card.id] || null;
        if (payDay !== (card.pay_day ?? null) || payFrom !== (card.pay_from_account_id ?? null)) {
          await am.update.mutateAsync({ id: card.id, patch: { pay_day: payDay, pay_from_account_id: payFrom } });
        }
      }
      for (const o of others) {
        if (Boolean(reserved[o.id]) !== Boolean(o.reserved)) await am.update.mutateAsync({ id: o.id, patch: { reserved: Boolean(reserved[o.id]) } });
      }
    } catch {
      return; // el aviso global ya mostró el error
    }
    toast({ title: "Plan actualizado" });
    onOpenChange(false);
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange}>
      <PanelContent title="Ajustes del plan" description="Con esto se calculan tus quincenas, tarjetas y estimados.">
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Día a día al mes" htmlFor="plan-budget" hint="Comida, transporte, salidas…">
              <Input id="plan-budget" value={budget} onChange={(e) => setBudget(onlyMoney(e.target.value))} inputMode="decimal" placeholder="35,000" className="tabular" />
            </Field>
            <Field label="Colchón mínimo" htmlFor="plan-cushion" hint="Lo que no quieres tocar.">
              <Input id="plan-cushion" value={cushion} onChange={(e) => setCushion(onlyMoney(e.target.value))} inputMode="decimal" placeholder="0" className="tabular" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Días del plan" htmlFor="plan-horizon">
              <Input id="plan-horizon" value={horizon} onChange={(e) => setHorizon(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className="tabular" />
            </Field>
            <Field label="El día a día se paga con" htmlFor="plan-budget-account">
              <AccountSelect id="plan-budget-account" accounts={[...cards, ...liquid]} value={budgetAccount} onChange={setBudgetAccount} placeholder="La predeterminada" />
            </Field>
          </div>

          {currencies.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold text-muted-foreground">Tasas a {main}</h3>
              <div className="grid grid-cols-2 gap-3">
                {currencies.map((cur) => (
                  <label key={cur} className="flex items-center gap-2 rounded-xl border border-secondary bg-card px-3 py-2 text-sm">
                    <span className="shrink-0 font-semibold">1 {cur} =</span>
                    <span className="text-muted-foreground">{currencySymbol(main)}</span>
                    <input
                      value={rates[cur] ?? ""}
                      onChange={(e) => setRates((r) => ({ ...r, [cur]: e.target.value.replace(/[^\d.,]/g, "") }))}
                      inputMode="decimal"
                      aria-label={`Tasa de ${cur}`}
                      className="tabular min-w-0 flex-1 bg-transparent text-right font-semibold outline-none"
                    />
                  </label>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground">No cuentan para el presupuesto</h3>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((c) => c.kind === "expense")
                .map((c) => {
                  const on = excluded.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setExcluded((s) => {
                          const n = new Set(s);
                          if (on) n.delete(c.id);
                          else n.add(c.id);
                          return n;
                        })
                      }
                      className={cn("min-h-9 rounded-full border px-3 text-xs font-semibold", on ? "border-primary bg-primary-soft text-primary" : "border-secondary bg-card text-muted-foreground")}
                    >
                      {c.name}
                    </button>
                  );
                })}
            </div>
          </section>

          {cards.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold text-muted-foreground">Tarjetas: cuándo y desde dónde las pagas</h3>
              {cards.map((card) => (
                <div key={card.id} className="flex flex-col gap-2 rounded-2xl border border-secondary bg-card p-3">
                  <span className="text-sm font-bold">
                    {card.name}
                    {card.payment_due_day ? <span className="font-normal text-muted-foreground"> · vence el {card.payment_due_day}</span> : null}
                  </span>
                  <div className="grid grid-cols-[90px_1fr] gap-3">
                    <Field label="Pagas el día" htmlFor={`pd-${card.id}`}>
                      <Input
                        id={`pd-${card.id}`}
                        value={cardDays[card.id] ?? ""}
                        onChange={(e) => setCardDays((s) => ({ ...s, [card.id]: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                        inputMode="numeric"
                        placeholder={card.payment_due_day ? String(card.payment_due_day) : "—"}
                        className="tabular"
                      />
                    </Field>
                    <Field label="Desde" htmlFor={`pf-${card.id}`}>
                      <AccountSelect id={`pf-${card.id}`} accounts={liquid} value={cardFrom[card.id] || null} onChange={(v) => setCardFrom((s) => ({ ...s, [card.id]: v }))} placeholder="La predeterminada" />
                    </Field>
                  </div>
                </div>
              ))}
            </section>
          )}

          {others.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold text-muted-foreground">Préstamos (cuentas &quot;Otra&quot;)</h3>
              {others.map((o) => (
                <div key={o.id} className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-secondary bg-card px-4 py-2.5">
                  <label htmlFor={`rs-${o.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block truncate text-sm font-semibold">{o.name}</span>
                    <span className="block text-xs text-muted-foreground">{reserved[o.id] ? "Prestado: se devuelve completo y no es tuyo" : "Deuda que se paga en cuotas"}</span>
                  </label>
                  <Switch id={`rs-${o.id}`} checked={Boolean(reserved[o.id])} onCheckedChange={(v) => setReserved((s) => ({ ...s, [o.id]: v }))} aria-label={`${o.name}: prestado`} />
                </div>
              ))}
            </section>
          )}

          {error && (
            <p className="text-sm font-semibold text-negative" role="alert">
              {error}
            </p>
          )}
          <PanelFooter>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </PanelFooter>
        </form>
      </PanelContent>
    </Panel>
  );
}
