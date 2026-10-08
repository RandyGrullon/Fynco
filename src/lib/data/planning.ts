// Recurrentes, metas y estadísticas.
import type { Goal, Recurrence, RecurringRule, WeekendPolicy } from "@/lib/types";
import { db, unwrap } from "./base";

// ---------- Recurrentes ----------
export async function fetchRecurring(): Promise<RecurringRule[]> {
  const rows = unwrap(await db().from("recurring_rules").select("*").order("next_run_on")) as RecurringRule[];
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export interface RecurringInput {
  account_id: string;
  kind: "income" | "expense";
  amount: number;
  description: string;
  category_id: string | null;
  frequency: Recurrence;
  start_on: string;
  end_on: string | null;
  weekend_policy: WeekendPolicy;
  active?: boolean;
}

export async function createRecurring(input: RecurringInput) {
  // next_run_on lo fija un trigger a partir de start_on.
  return unwrap(await db().from("recurring_rules").insert({ ...input, next_run_on: input.start_on }).select("*").single());
}

export async function updateRecurring(id: string, patch: Partial<RecurringInput>) {
  return unwrap(await db().from("recurring_rules").update(patch).eq("id", id).select("*").single());
}

export async function deleteRecurring(id: string) {
  unwrap(await db().from("recurring_rules").delete().eq("id", id));
}

/** Idempotente: genera los cobros vencidos hasta hoy (fecha local). */
export async function runMyRecurring(today: string): Promise<number> {
  return unwrap(await db().rpc("run_my_recurring", { p_today: today }));
}

// ---------- Metas ----------
export async function fetchGoals(): Promise<Goal[]> {
  const rows = unwrap(await db().from("goals").select("*").order("created_at")) as Goal[];
  return rows.map((g) => ({ ...g, target_amount: Number(g.target_amount) }));
}

export interface GoalInput {
  name: string;
  target_amount: number;
  currency: string;
  account_id: string | null;
  deadline: string | null;
  is_private: boolean;
  status?: Goal["status"];
}

export async function createGoal(input: GoalInput) {
  return unwrap(await db().from("goals").insert(input).select("*").single());
}

export async function updateGoal(id: string, patch: Partial<GoalInput>) {
  return unwrap(await db().from("goals").update(patch).eq("id", id).select("*").single());
}

export async function deleteGoal(id: string) {
  unwrap(await db().from("goals").delete().eq("id", id));
}

// ---------- Estadísticas ----------
export interface CategorySpend {
  category_id: string | null;
  currency: string;
  total: number;
}

/** Tu gasto real: gastos propios + tu parte de lo compartido (no lo que pagaste por otros). */
export async function spendingByCategory(from: string, to: string): Promise<CategorySpend[]> {
  const rows = unwrap(await db().rpc("spending_by_category", { p_from: from, p_to: to })) as CategorySpend[];
  return rows.map((r) => ({ ...r, total: Number(r.total) }));
}

export interface MonthFlow {
  month: string;
  currency: string;
  income: number;
  expense: number;
}

export async function cashflowByMonth(from: string, to: string): Promise<MonthFlow[]> {
  const rows = unwrap(await db().rpc("cashflow_by_month", { p_from: from, p_to: to })) as MonthFlow[];
  return rows.map((r) => ({ ...r, income: Number(r.income), expense: Number(r.expense) }));
}
