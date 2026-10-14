// Deudas y préstamos entre personas: interés simple y cuotas. Puro (lo usan la app y las pruebas).
// La base de datos usa la misma fórmula en public.debt_terms (supabase/migrations/20261016000001_debts.sql).
import { addMonths, format } from "date-fns";
import { parseDate } from "@/lib/dates";

export type DebtDirection = "borrowed" | "lent";
export type DebtFrequency = "once" | "weekly" | "biweekly" | "monthly";
export type InterestPeriod = "none" | "total" | "monthly" | "annual";

export interface DebtTermsInput {
  /** Centavos. */
  principal: number;
  started_on: string;
  /** Porcentaje, p. ej. 10 = 10 %. */
  interest_rate: number;
  interest_period: InterestPeriod;
  installments: number;
  frequency: DebtFrequency;
  /** Primera cuota, o la fecha límite si es un solo pago. */
  first_due_on: string;
}

export interface Installment {
  n: number;
  due_on: string;
  /** Centavos. */
  amount: number;
}

export interface DebtTerms {
  interest: number;
  total: number;
  last_due_on: string;
  /** Meses que dura el préstamo (para el interés). */
  months: number;
  installments: Installment[];
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const DAYS: Partial<Record<DebtFrequency, number>> = { weekly: 7, biweekly: 14 };

/** Fecha de cada cuota. Las mensuales caen el mismo día de cada mes (o el último, si el mes es más corto). */
export function dueDates(t: Pick<DebtTermsInput, "first_due_on" | "frequency" | "installments">): string[] {
  const first = parseDate(t.first_due_on);
  const n = t.frequency === "once" ? 1 : Math.max(1, Math.floor(t.installments));
  return Array.from({ length: n }, (_, i) => {
    if (t.frequency === "monthly") return iso(addMonths(first, i));
    const d = new Date(first);
    d.setDate(d.getDate() + (DAYS[t.frequency] ?? 0) * i);
    return iso(d);
  });
}

/** Meses entre dos fechas: los de calendario más los días sueltos sobre 30 (del 15 oct al 15 feb = 4). */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30);
}

export function debtTerms(t: DebtTermsInput): DebtTerms {
  const dates = dueDates(t);
  const last = dates[dates.length - 1];
  const months = monthsBetween(t.started_on, last);
  const rate = Math.max(0, t.interest_rate) / 100;
  const raw =
    t.interest_period === "total" ? t.principal * rate : t.interest_period === "monthly" ? t.principal * rate * months : t.interest_period === "annual" ? (t.principal * rate * months) / 12 : 0;
  const interest = Math.round(raw);
  const total = t.principal + interest;
  const n = dates.length;
  const base = Math.round(total / n);
  const installments = dates.map((due_on, i) => ({ n: i + 1, due_on, amount: i === n - 1 ? total - base * (n - 1) : base }));
  return { interest, total, last_due_on: last, months, installments };
}

export interface InstallmentStatus extends Installment {
  /** Lo que falta de esta cuota. */
  pending: number;
  state: "paid" | "partial" | "overdue" | "pending";
}

export interface DebtStatus {
  paid: number;
  remaining: number;
  schedule: InstallmentStatus[];
  /** Primera cuota con saldo. */
  next: InstallmentStatus | null;
  overdue: number;
  done: boolean;
}

/** Los pagos cubren las cuotas en orden. */
export function debtStatus(terms: DebtTerms, paid: number, today: string): DebtStatus {
  let left = paid;
  const schedule = terms.installments.map((c): InstallmentStatus => {
    const covered = Math.min(c.amount, Math.max(0, left));
    left -= covered;
    const pending = c.amount - covered;
    const state = pending === 0 ? "paid" : c.due_on < today ? "overdue" : covered > 0 ? "partial" : "pending";
    return { ...c, pending, state };
  });
  const remaining = Math.max(0, terms.total - paid);
  return {
    paid,
    remaining,
    schedule,
    next: schedule.find((c) => c.pending > 0) ?? null,
    overdue: schedule.filter((c) => c.state === "overdue").reduce((n, c) => n + c.pending, 0),
    done: remaining === 0,
  };
}

/** Primera cuota sugerida: un período después del préstamo. */
export function defaultFirstDue(started_on: string, frequency: DebtFrequency): string {
  const d = parseDate(started_on);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else return iso(addMonths(d, 1));
  return iso(d);
}

export const FREQUENCY_LABEL: Record<DebtFrequency, string> = { once: "Un solo pago", weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual" };
export const INTEREST_LABEL: Record<InterestPeriod, string> = { none: "Sin interés", total: "total", monthly: "mensual", annual: "anual" };

export function interestLabel(rate: number, period: InterestPeriod): string {
  return period === "none" || !rate ? "Sin interés" : `${rate.toLocaleString("es-DO", { maximumFractionDigits: 3 })}% ${INTEREST_LABEL[period]}`;
}
