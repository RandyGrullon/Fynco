// Fechas de los recurrentes, igual que recurring_date() y adjust_weekend() en la base de datos.
import { addDays, addMonths, addYears, format } from "date-fns";
import { parseDate } from "@/lib/dates";
import type { Recurrence, WeekendPolicy } from "@/lib/types";
import type { PlanRule } from "./types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function recurringDate(start: string, freq: Recurrence, n: number): string {
  const d = parseDate(start);
  switch (freq) {
    case "daily":
      return iso(addDays(d, n));
    case "weekly":
      return iso(addDays(d, 7 * n));
    case "biweekly":
      return iso(addDays(d, 14 * n));
    case "monthly":
      return iso(addMonths(d, n));
    case "quarterly":
      return iso(addMonths(d, 3 * n));
    case "yearly":
      return iso(addYears(d, n));
  }
}

export function adjustWeekendISO(date: string, policy: WeekendPolicy): string {
  if (policy === "keep") return date;
  const d = parseDate(date);
  const dow = d.getDay();
  if (dow !== 0 && dow !== 6) return date;
  const shift = policy === "before" ? (dow === 6 ? -1 : -2) : dow === 6 ? 2 : 1;
  return iso(addDays(d, shift));
}

/** Próximas veces que se registra un recurrente activo, con su fecha real, entre `from` y `to`. */
export function occurrences(rule: PlanRule, from: string, to: string): string[] {
  if (!rule.active) return [];
  const out: string[] = [];
  let n = rule.run_count;
  let d = rule.next_run_on;
  for (let guard = 0; guard < 800 && d <= to && (!rule.end_on || d <= rule.end_on); guard++) {
    const real = adjustWeekendISO(d, rule.weekend_policy);
    if (real >= from && real <= to) out.push(real);
    n++;
    d = recurringDate(rule.start_on, rule.frequency, n);
  }
  return out;
}

export function addDaysISO(date: string, n: number): string {
  return iso(addDays(parseDate(date), n));
}

/** Días entre dos fechas, ambas incluidas. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000) + 1;
}
