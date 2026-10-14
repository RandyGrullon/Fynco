"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { debtView } from "@/components/debts/debt-view";
import { fetchAllTransactions } from "@/lib/data/transactions";
import { fetchMySharedShares } from "@/lib/data/plan";
import { todayISO } from "@/lib/dates";
import { buildPlan } from "@/lib/plan/engine";
import { addDaysISO } from "@/lib/plan/recurring";
import type { PlanDebtIn, PlanResult } from "@/lib/plan/types";
import { keys, useAccounts, useCategories, useDebts, usePlanPeriods, usePlanSettings, useProfile, useRecurring } from "./queries";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Todo lo que necesita el plan, ya calculado. */
export function usePlan(): {
  plan: PlanResult | null;
  isLoading: boolean;
  /** La base todavía no tiene las tablas del plan (falta la migración). */
  missingSetup: boolean;
  error: boolean;
  refetch: () => void;
} {
  const today = todayISO();
  const from = addDaysISO(today, -70);
  const profile = useProfile();
  const accounts = useAccounts();
  const recurring = useRecurring();
  const categories = useCategories();
  const debts = useDebts();
  const settings = usePlanSettings();
  const periods = usePlanPeriods();
  const txs = useQuery({ queryKey: [...keys.transactionsAll, "plan", from, today], queryFn: () => fetchAllTransactions({ from, to: today }) });
  const shares = useQuery({ queryKey: [...keys.stats, "plan-shares", from, today], queryFn: () => fetchMySharedShares(from, today) });

  const isLoading = [profile, accounts, recurring, categories, settings, periods, txs].some((q) => q.isLoading);
  const settingsError = settings.error as { code?: string; message?: string } | null;
  const missingSetup = Boolean(settingsError && /PGRST205|42P01|plan_settings|schema cache/i.test(`${settingsError.code ?? ""} ${settingsError.message ?? ""}`));
  const error = !missingSetup && [accounts, recurring, settings, periods, txs].some((q) => q.isError);

  const plan = useMemo(() => {
    if (isLoading || error || missingSetup || !accounts.data) return null;
    const s = settings.data;
    const planDebts: PlanDebtIn[] = (debts.data ?? []).map((d) => {
      const v = debtView(d, today);
      return {
        id: d.id,
        person: d.person,
        direction: d.direction,
        currency: d.currency,
        account_id: d.account_id,
        remaining: v.status.remaining,
        installments: v.status.schedule.map((c) => ({ n: c.n, due_on: c.due_on, pending: c.pending })),
      };
    });
    return buildPlan({
      today,
      currency: profile.data?.default_currency ?? "DOP",
      accounts: accounts.data,
      transactions: txs.data ?? [],
      recurring: recurring.data ?? [],
      shares: shares.data ?? [],
      settings: {
        monthly_budget: s?.monthly_budget ?? null,
        cushion: s?.cushion ?? 0,
        horizon_days: s?.horizon_days ?? 100,
        budget_account_id: s?.budget_account_id ?? null,
        rates: s?.rates ?? {},
        excluded_category_ids: s?.excluded_category_ids ?? [],
      },
      periods: periods.data ?? [],
      salaryCategoryIds: (categories.data ?? []).filter((c) => c.kind === "income" && norm(c.name) === "salario").map((c) => c.id),
      debts: planDebts,
    });
  }, [isLoading, error, missingSetup, accounts.data, settings.data, debts.data, txs.data, recurring.data, shares.data, periods.data, categories.data, profile.data, today]);

  return {
    plan,
    isLoading,
    missingSetup,
    error,
    refetch: () => {
      void settings.refetch();
      void periods.refetch();
      void txs.refetch();
      void accounts.refetch();
    },
  };
}
