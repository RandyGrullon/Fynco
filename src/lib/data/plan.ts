// Plan: ajustes, periodos y tu parte de lo compartido por día.
import type { PlanPeriod, PlanSettings } from "@/lib/types";
import type { PlanShare } from "@/lib/plan/types";
import { db, myUserId, unwrap } from "./base";

const numOrNull = (v: unknown) => (v == null ? null : Number(v));

export async function fetchPlanSettings(): Promise<PlanSettings | null> {
  const row = unwrap(await db().from("plan_settings").select("*").maybeSingle()) as PlanSettings | null;
  if (!row) return null;
  return {
    ...row,
    monthly_budget: numOrNull(row.monthly_budget),
    cushion: Number(row.cushion ?? 0),
    horizon_days: Number(row.horizon_days ?? 100),
    rates: Object.fromEntries(Object.entries(row.rates ?? {}).map(([k, v]) => [k, Number(v)])),
    excluded_category_ids: row.excluded_category_ids ?? [],
  };
}

export type PlanSettingsInput = Partial<Omit<PlanSettings, "user_id">>;

export async function savePlanSettings(patch: PlanSettingsInput): Promise<void> {
  const user_id = await myUserId();
  unwrap(await db().from("plan_settings").upsert({ ...patch, user_id, updated_at: new Date().toISOString() }));
}

export async function fetchPlanPeriods(): Promise<PlanPeriod[]> {
  const rows = unwrap(await db().from("plan_periods").select("*").order("start_on")) as PlanPeriod[];
  return rows.map((p) => ({ ...p, budget: Number(p.budget), cash_amount: numOrNull(p.cash_amount) }));
}

export type PlanPeriodInput = Omit<PlanPeriod, "id" | "user_id" | "created_at">;

export async function savePlanPeriod(id: string | null, input: PlanPeriodInput): Promise<void> {
  if (id) unwrap(await db().from("plan_periods").update(input).eq("id", id));
  else unwrap(await db().from("plan_periods").insert(input));
}

export async function deletePlanPeriod(id: string): Promise<void> {
  unwrap(await db().from("plan_periods").delete().eq("id", id));
}

/** Tu parte de los gastos compartidos por día. Vacío si la base aún no tiene la función. */
export async function fetchMySharedShares(from: string, to: string): Promise<PlanShare[]> {
  const res = await db().rpc("my_shared_shares", { p_from: from, p_to: to });
  if (res.error) return [];
  return ((res.data ?? []) as PlanShare[]).map((s) => ({ ...s, amount: Number(s.amount) }));
}
