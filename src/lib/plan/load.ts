// Carga los datos del plan con un cliente de Supabase cualquiera (lo usa el asistente en el servidor).
// Cada consulta que falle (p. ej. una migración sin correr) deja su parte vacía en vez de romper.
import type { SupabaseClient } from "@supabase/supabase-js";
import { debtStatus, debtTerms, type DebtFrequency, type InterestPeriod } from "@/lib/debts";
import { addDaysISO } from "./recurring";
import type { PlanAccount, PlanDebtIn, PlanInput, PlanPeriodIn, PlanRule, PlanShare, PlanTx } from "./types";

type Res<T> = { data: T | null; error: unknown };
const rows = <T>(r: Res<T[]>): T[] => (r.error ? [] : (r.data ?? []));
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export async function loadPlanInput(supabase: SupabaseClient, userId: string, today: string, currency: string): Promise<PlanInput> {
  const from = addDaysISO(today, -70);
  const [acc, bal, txs, rules, cats, shares, settings, periods, debts] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase.from("account_balances").select("account_id, balance").eq("user_id", userId),
    supabase.from("transactions").select("*").eq("user_id", userId).gte("occurred_on", from).lte("occurred_on", today).limit(5000),
    supabase.from("recurring_rules").select("*").eq("user_id", userId),
    supabase.from("categories").select("id, name, kind"),
    supabase.rpc("my_shared_shares", { p_from: from, p_to: today }),
    supabase.from("plan_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("plan_periods").select("*").eq("user_id", userId),
    supabase.from("debts").select("*, debt_payments(amount)").eq("user_id", userId),
  ]);

  const balances = new Map(rows(bal as Res<{ account_id: string; balance: number }[]>).map((b) => [b.account_id, Number(b.balance)]));
  const accounts: PlanAccount[] = rows(acc as Res<(PlanAccount & { opening_balance: number })[]>).map((a) => ({
    ...a,
    balance: balances.get(a.id) ?? Number(a.opening_balance),
    credit_limit: a.credit_limit == null ? null : Number(a.credit_limit),
  }));
  const s = (settings as Res<Record<string, unknown>>).error ? null : ((settings as Res<Record<string, unknown>>).data ?? null);

  type DebtRow = {
    id: string;
    person: string;
    direction: "borrowed" | "lent";
    currency: string;
    account_id: string | null;
    principal: number;
    started_on: string;
    interest_rate: number;
    interest_period: InterestPeriod;
    installments: number;
    frequency: DebtFrequency;
    first_due_on: string;
    debt_payments: { amount: number }[] | null;
  };
  const planDebts: PlanDebtIn[] = rows(debts as Res<DebtRow[]>).map((d) => {
    const terms = debtTerms({ ...d, principal: Number(d.principal), interest_rate: Number(d.interest_rate) });
    const status = debtStatus(terms, (d.debt_payments ?? []).reduce((n, p) => n + Number(p.amount), 0), today);
    return {
      id: d.id,
      person: d.person,
      direction: d.direction,
      currency: d.currency,
      account_id: d.account_id,
      remaining: status.remaining,
      installments: status.schedule.map((c) => ({ n: c.n, due_on: c.due_on, pending: c.pending })),
    };
  });

  return {
    today,
    currency,
    accounts,
    transactions: rows(txs as Res<PlanTx[]>).map((t) => ({ ...t, amount: Number(t.amount), debt_id: t.debt_id ?? null })),
    recurring: rows(rules as Res<PlanRule[]>).map((r) => ({ ...r, amount: Number(r.amount), to_account_id: r.to_account_id ?? null })),
    shares: rows(shares as Res<PlanShare[]>).map((x) => ({ ...x, amount: Number(x.amount) })),
    settings: {
      monthly_budget: s?.monthly_budget == null ? null : Number(s.monthly_budget),
      cushion: Number(s?.cushion ?? 0),
      horizon_days: Number(s?.horizon_days ?? 100),
      budget_account_id: (s?.budget_account_id as string | null) ?? null,
      rates: Object.fromEntries(Object.entries((s?.rates as Record<string, unknown>) ?? {}).map(([k, v]) => [k, Number(v)])),
      excluded_category_ids: (s?.excluded_category_ids as string[]) ?? [],
    },
    periods: rows(periods as Res<PlanPeriodIn[]>).map((p) => ({ ...p, budget: Number(p.budget), cash_amount: p.cash_amount == null ? null : Number(p.cash_amount) })),
    salaryCategoryIds: rows(cats as Res<{ id: string; name: string; kind: string }[]>)
      .filter((c) => c.kind === "income" && norm(c.name) === "salario")
      .map((c) => c.id),
    debts: planDebts,
  };
}
