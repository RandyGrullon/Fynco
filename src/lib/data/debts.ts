import type { PersonDebt, PersonDebtPayment } from "@/lib/types";
import { db, unwrap } from "./base";

type Row = Omit<PersonDebt, "payments"> & { debt_payments: PersonDebtPayment[] | null };

export async function fetchDebts(): Promise<PersonDebt[]> {
  const rows = unwrap(await db().from("debts").select("*, debt_payments(*)").order("created_at", { ascending: false })) as Row[];
  return rows.map(({ debt_payments, ...d }) => ({
    ...d,
    principal: Number(d.principal),
    interest_rate: Number(d.interest_rate),
    payments: (debt_payments ?? []).map((p) => ({ ...p, amount: Number(p.amount) })).sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at)),
  }));
}

export interface DebtInput {
  direction: PersonDebt["direction"];
  person: string;
  principal: number;
  currency: string;
  started_on: string;
  interest_rate: number;
  interest_period: PersonDebt["interest_period"];
  installments: number;
  frequency: PersonDebt["frequency"];
  first_due_on: string;
  account_id: string | null;
  note: string | null;
}

/** Crea (id null) o edita una deuda. Si tiene cuenta, el préstamo se refleja en ella. */
export async function saveDebt(id: string | null, i: DebtInput): Promise<string> {
  return unwrap(
    await db().rpc("save_debt", {
      p_debt: id,
      p_direction: i.direction,
      p_person: i.person,
      p_principal: i.principal,
      p_currency: i.currency,
      p_started_on: i.started_on,
      p_interest_rate: i.interest_rate,
      p_interest_period: i.interest_period,
      p_installments: i.installments,
      p_frequency: i.frequency,
      p_first_due_on: i.first_due_on,
      p_account: i.account_id,
      p_note: i.note,
    }),
  );
}

export async function deleteDebt(id: string): Promise<void> {
  unwrap(await db().rpc("delete_debt", { p_debt: id }));
}

export async function recordDebtPayment(input: { debt: string; amount: number; paid_on: string; account_id: string | null; note?: string | null }): Promise<string> {
  return unwrap(
    await db().rpc("record_debt_payment", { p_debt: input.debt, p_amount: input.amount, p_paid_on: input.paid_on, p_account: input.account_id, p_note: input.note ?? null }),
  );
}

export async function deleteDebtPayment(id: string): Promise<void> {
  unwrap(await db().rpc("delete_debt_payment", { p_payment: id }));
}
