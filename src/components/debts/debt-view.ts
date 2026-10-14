import { debtStatus, debtTerms, type DebtStatus, type DebtTerms } from "@/lib/debts";
import type { PersonDebt } from "@/lib/types";

export interface DebtView {
  debt: PersonDebt;
  terms: DebtTerms;
  status: DebtStatus;
}

/** Cuotas, interés y cuánto falta de una deuda, a la fecha de hoy. */
export function debtView(debt: PersonDebt, today: string): DebtView {
  const terms = debtTerms(debt);
  const paid = debt.payments.reduce((n, p) => n + p.amount, 0);
  return { debt, terms, status: debtStatus(terms, paid, today) };
}
