// Plan: entradas y salidas del motor. Montos en centavos.
import type { Account, PlanPeriod, PlanSettings, RecurringRule, Transaction } from "@/lib/types";

export type PlanAccount = Pick<
  Account,
  | "id"
  | "name"
  | "type"
  | "currency"
  | "balance"
  | "last4"
  | "is_default"
  | "archived_at"
  | "statement_day"
  | "payment_due_day"
  | "pay_day"
  | "pay_from_account_id"
  | "reserved"
  | "credit_limit"
>;

export type PlanTx = Pick<Transaction, "id" | "account_id" | "kind" | "amount" | "occurred_on" | "category_id" | "recurring_rule_id" | "transfer_id" | "description" | "debt_id">;

export type PlanRule = Pick<
  RecurringRule,
  "id" | "kind" | "amount" | "account_id" | "to_account_id" | "category_id" | "description" | "frequency" | "start_on" | "end_on" | "run_count" | "next_run_on" | "weekend_policy" | "active"
>;

/** Tu parte de un gasto compartido. */
export interface PlanShare {
  occurred_on: string;
  currency: string;
  category_id: string | null;
  amount: number;
}

export type PlanSettingsIn = Pick<PlanSettings, "monthly_budget" | "cushion" | "horizon_days" | "budget_account_id" | "rates" | "excluded_category_ids">;
export type PlanPeriodIn = Pick<PlanPeriod, "id" | "name" | "start_on" | "end_on" | "budget" | "currency" | "cash_amount" | "account_id">;

/** Deuda con una persona (módulo Deudas) con sus cuotas pendientes. */
export interface PlanDebtIn {
  id: string;
  person: string;
  direction: "borrowed" | "lent";
  currency: string;
  account_id: string | null;
  remaining: number;
  installments: { n: number; due_on: string; pending: number }[];
}

export interface PlanInput {
  today: string;
  /** Moneda principal. */
  currency: string;
  accounts: PlanAccount[];
  /** Movimientos desde ~2 meses atrás (cortes abiertos y la quincena actual). */
  transactions: PlanTx[];
  recurring: PlanRule[];
  shares: PlanShare[];
  settings: PlanSettingsIn;
  periods: PlanPeriodIn[];
  /** Categorías "Salario": sus ingresos marcan las quincenas. */
  salaryCategoryIds: string[];
  debts: PlanDebtIn[];
}

/** Texto con montos: los montos se pintan con <Money> (respeta "ocultar montos"). */
export type Rich = (string | { amount: number; currency: string })[];

export type PlanEventType = "income" | "card" | "debt" | "purchase" | "transfer" | "estimate";

export type PlanAction =
  | { kind: "card_payment"; cardId: string; amount: number; fromId: string | null }
  | { kind: "transfer"; from: string; to: string; amount: number; description: string }
  | { kind: "recurring"; ruleId: string }
  | { kind: "debt"; debtId: string };

export interface PlanEvent {
  id: string;
  date: string;
  type: PlanEventType;
  /** "Qué". */
  label: string;
  /** "Con": "Entra a X", "Sale de X", "X → Tarjeta"… */
  with: string;
  /** Efecto en "tu dinero" (moneda principal, con signo). 0 si no lo mueve. */
  effect: number;
  /** Lo que se muestra (con signo). */
  amount: number;
  currency: string;
  /** Saldo de "tu dinero" después; null en lo que ya pasó. */
  balance: number | null;
  past: boolean;
  /** Cuentas involucradas (para el filtro). */
  accountIds: string[];
  action?: PlanAction;
  /** Pagos de tarjeta: fecha límite real y si ya está vencido. */
  dueDate?: string;
  overdue?: boolean;
  /** Pagos de tarjeta con doble saldo: lo que va a cada una. */
  parts?: { accountId: string; name: string; amount: number; currency: string }[];
}

export interface CardCycle {
  cut: string;
  payDate: string;
  dueDate: string;
  /** Ya cargado / por venir / total, en la moneda de la cuenta que paga. */
  charged: number;
  upcoming: number;
  total: number;
  closed: boolean;
  overdue: boolean;
}

export interface CardGroup {
  key: string;
  name: string;
  last4: string | null;
  accounts: { id: string; name: string; currency: string; debt: number; limit: number | null }[];
  fromId: string | null;
  fromName: string;
  currency: string;
  cycles: CardCycle[];
  /** Sin día de corte o de pago no se puede programar. */
  missing: boolean;
}

export interface BudgetRow {
  key: string;
  kind: "home" | "period";
  label: string;
  start: string;
  end: string;
  days: number;
  budget: number;
  spent: number;
  left: number;
  current: boolean;
}

export interface PeriodSummary {
  id: string;
  name: string;
  start: string;
  end: string;
  currency: string;
  budget: number;
  spent: number;
  left: number;
  perDay: number;
  cash: number;
  card: number;
  cardName: string | null;
}

export interface OtherDebtRow {
  id: string;
  name: string;
  source: "account" | "debt";
  amount: number;
  currency: string;
  next: { date: string; amount: number }[];
  /** Fecha estimada en que queda saldada dentro del plan; null si no alcanza. */
  payoff: string | null;
  /** Lo que faltaría al final del plan. */
  leftAtEnd: number;
}

export interface PlanResult {
  today: string;
  horizonEnd: string;
  currency: string;
  liquid: number;
  reserved: number;
  myMoney: number;
  canSpend: { amount: number; end: string; label: string } | null;
  nextCard: { amount: number; currency: string; date: string; dueDate: string; name: string; from: string } | null;
  debts: number;
  endBalance: number;
  low: { date: string; balance: number };
  cushion: number;
  belowCushion: boolean;
  events: PlanEvent[];
  series: { date: string; balance: number }[];
  cards: CardGroup[];
  budgetRows: BudgetRow[];
  periods: PeriodSummary[];
  reservedAccounts: { id: string; name: string; amount: number; currency: string }[];
  installmentDebts: OtherDebtRow[];
  summary: Rich;
  assumptions: Rich[];
  paydaysFrom: "rules" | "default";
  hasBudget: boolean;
}
