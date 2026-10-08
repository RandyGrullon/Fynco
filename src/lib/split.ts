// Lógica tipo Splitwise: repartir montos y calcular quién le debe a quién. Todo en centavos.
import type { Debt, MemberBalance, Portion, Settlement, SharedExpense } from "./types";

/** Reparte `total` según pesos con el método del mayor residuo: la suma siempre cuadra exacto. */
export function splitByWeights(total: number, weights: { member_id: string; weight: number }[]): Portion[] {
  const valid = weights.filter((w) => w.weight > 0);
  const sum = valid.reduce((a, w) => a + w.weight, 0);
  if (total <= 0 || sum <= 0) return weights.map((w) => ({ member_id: w.member_id, amount: 0, weight: w.weight }));

  const raw = valid.map((w, i) => {
    const exact = (total * w.weight) / sum;
    return { i, member_id: w.member_id, weight: w.weight, floor: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let remaining = total - raw.reduce((a, r) => a + r.floor, 0);
  // Desempate estable: mayor residuo primero, luego el orden en que vinieron.
  const order = [...raw].sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const r of order) {
    if (remaining <= 0) break;
    r.floor += 1;
    remaining -= 1;
  }
  const byId = new Map(raw.map((r) => [r.member_id, r]));
  return weights.map((w) => ({ member_id: w.member_id, amount: byId.get(w.member_id)?.floor ?? 0, weight: w.weight }));
}

export function splitEqual(total: number, memberIds: string[]): Portion[] {
  return splitByWeights(
    total,
    memberIds.map((id) => ({ member_id: id, weight: 1 })),
  ).map(({ member_id, amount }) => ({ member_id, amount }));
}

/** Porcentajes deben sumar 100. */
export function splitPercent(total: number, percents: { member_id: string; weight: number }[]) {
  const sum = percents.reduce((a, p) => a + p.weight, 0);
  if (Math.abs(sum - 100) > 0.001) return { ok: false as const, error: `Los porcentajes suman ${round2(sum)}%, deben sumar 100%` };
  return { ok: true as const, portions: splitByWeights(total, percents) };
}

export function validateExact(total: number, portions: Portion[]) {
  const sum = portions.reduce((a, p) => a + p.amount, 0);
  return { ok: sum === total, diff: total - sum };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Deudas simplificadas: el que más debe le paga al que más le deben, hasta cuadrar.
 * Produce como máximo n−1 pagos.
 */
export function simplifyDebts(balances: Pick<MemberBalance, "member_id" | "net">[]): Debt[] {
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.member_id, amt: -b.net }));
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.member_id, amt: b.net }));
  debtors.sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  creditors.sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));

  const out: Debt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return out;
}

/**
 * Deudas sin simplificar: cada participante le debe a cada pagador su proporción,
 * neteado por pareja y descontando los pagos registrados.
 */
export function pairwiseDebts(expenses: Pick<SharedExpense, "amount" | "payers" | "shares">[], settlements: Pick<Settlement, "from_member" | "to_member" | "amount">[]): Debt[] {
  const ledger = new Map<string, number>(); // "a|b" con a<b → positivo: a le debe a b
  const add = (debtor: string, creditor: string, amount: number) => {
    if (debtor === creditor || amount === 0) return;
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const key = `${a}|${b}`;
    ledger.set(key, (ledger.get(key) ?? 0) + (debtor === a ? amount : -amount));
  };

  for (const e of expenses) {
    for (const share of e.shares) {
      if (share.amount <= 0) continue;
      // Proporción de la parte que cubrió cada pagador, repartida sin perder centavos.
      const parts = splitByWeights(
        share.amount,
        e.payers.map((p) => ({ member_id: p.member_id, weight: p.amount })),
      );
      for (const p of parts) add(share.member_id, p.member_id, p.amount);
    }
  }
  for (const s of settlements) add(s.to_member, s.from_member, s.amount); // pagar reduce la deuda

  const out: Debt[] = [];
  for (const [key, v] of ledger) {
    if (v === 0) continue;
    const [a, b] = key.split("|");
    out.push(v > 0 ? { from: a, to: b, amount: v } : { from: b, to: a, amount: -v });
  }
  return out.sort((x, y) => y.amount - x.amount);
}

/** Deudas que involucran a `memberId`, como lista con signo: + te deben, − debes. */
export function debtsFor(memberId: string, debts: Debt[]) {
  return debts
    .filter((d) => d.from === memberId || d.to === memberId)
    .map((d) => (d.to === memberId ? { other: d.from, amount: d.amount } : { other: d.to, amount: -d.amount }));
}

/** Parte de un gasto que te toca y lo que pagaste: lo que "prestaste" (+) o "debes" (−). */
export function myExpenseImpact(expense: Pick<SharedExpense, "payers" | "shares">, memberId: string) {
  const paid = expense.payers.find((p) => p.member_id === memberId)?.amount ?? 0;
  const share = expense.shares.find((s) => s.member_id === memberId)?.amount ?? 0;
  return { paid, share, net: paid - share };
}
