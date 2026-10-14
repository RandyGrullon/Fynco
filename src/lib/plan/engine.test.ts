import { describe, expect, it } from "vitest";
import { buildPlan, chargeSchedule } from "./engine";
import type { PlanAccount, PlanInput, PlanRule, PlanTx } from "./types";

// Escenario del 13 de octubre de 2026 (moneda principal DOP). Montos y fechas del caso real; nombres genéricos.
const acc = (o: Partial<PlanAccount> & Pick<PlanAccount, "id" | "name" | "type" | "balance">): PlanAccount => ({
  currency: "DOP",
  last4: null,
  is_default: false,
  archived_at: null,
  statement_day: null,
  payment_due_day: null,
  pay_day: null,
  pay_from_account_id: null,
  reserved: false,
  credit_limit: null,
  ...o,
});

const accounts: PlanAccount[] = [
  acc({ id: "a1", name: "Corriente 1001", type: "checking", balance: 18_469_500, is_default: true, last4: "1001" }),
  acc({ id: "a2", name: "Ahorro 1002", type: "savings", balance: 17_100, last4: "1002" }),
  acc({ id: "v5001", name: "Visa 5001", type: "credit", balance: -3_170_475, last4: "5001", statement_day: 13, payment_due_day: 9, pay_day: 4, credit_limit: 6_500_000 }),
  acc({ id: "jb", name: "Visa 3001 RD$", type: "credit", balance: -2_190_281, last4: "3001", statement_day: 1, payment_due_day: 22, pay_day: 19 }),
  acc({ id: "jbu", name: "Visa 3001 US$", type: "credit", currency: "USD", balance: -44_300, last4: "3001", statement_day: 1, payment_due_day: 22, pay_day: 19 }),
  acc({ id: "r1", name: "Préstamo familiar A", type: "other", balance: -10_000_000, reserved: true }),
  acc({ id: "r2", name: "Préstamo familiar B", type: "other", balance: -5_000_000, reserved: true }),
  acc({ id: "d1", name: "Deuda familiar (viaje)", type: "other", balance: -11_060_000 }),
];

const tx = (id: string, account_id: string, amount: number, occurred_on: string, kind: PlanTx["kind"] = "expense"): PlanTx => ({
  id,
  account_id,
  kind,
  amount,
  occurred_on,
  category_id: null,
  recurring_rule_id: null,
  transfer_id: null,
  description: id,
  debt_id: null,
});

// Lo consumido en las Visa 3001 después del corte del 1 de octubre (lo demás es del corte).
const transactions: PlanTx[] = [tx("jb1", "jb", -540_281, "2026-10-05"), tx("jb2", "jb", -500_000, "2026-10-10"), tx("jbu1", "jbu", -3_700, "2026-10-08")];

const once = (id: string, date: string, o: Partial<PlanRule>): PlanRule => ({
  id,
  kind: "income",
  amount: 0,
  account_id: "a1",
  to_account_id: null,
  category_id: null,
  description: id,
  frequency: "monthly",
  start_on: date,
  end_on: date,
  run_count: 0,
  next_run_on: date,
  weekend_policy: "keep",
  active: true,
  ...o,
});

const paydays = ["2026-10-16", "2026-10-29", "2026-11-11", "2026-11-25", "2026-12-04", "2026-12-15", "2026-12-28", "2027-01-19"];
const recurring: PlanRule[] = [
  ...paydays.map((d) => once(`nomina-${d}`, d, { kind: "income", amount: d === "2026-12-04" ? 8_400_000 : 3_390_000, category_id: "salario", description: "Nómina" })),
  ...paydays.map((d) => once(`cuota-${d}`, d, { kind: "transfer", amount: 1_000_000, to_account_id: "d1", description: "Cuota deuda familiar" })),
];

const input: PlanInput = {
  today: "2026-10-13",
  currency: "DOP",
  accounts,
  transactions,
  recurring,
  shares: [],
  settings: { monthly_budget: 3_500_000, cushion: 0, horizon_days: 100, budget_account_id: "v5001", rates: { USD: 62, EUR: 69 }, excluded_category_ids: [] },
  periods: [{ id: "viaje", name: "Viaje", start_on: "2026-11-29", end_on: "2027-01-09", budget: 130_000, currency: "EUR", cash_amount: 30_000, account_id: null }],
  salaryCategoryIds: ["salario"],
  debts: [],
};

const plan = buildPlan(input);

describe("plan: tu dinero", () => {
  it("cuentas líquidas menos lo prestado que no se toca", () => {
    // Corriente 184,695 + ahorro 171 − 150,000 prestados.
    expect(plan.liquid).toBe(18_486_600);
    expect(plan.reserved).toBe(15_000_000);
    expect(plan.myMoney).toBe(3_486_600);
  });
  it("lo prestado no aparece como pago programado", () => {
    expect(plan.events.some((e) => e.accountIds.includes("r1") || e.accountIds.includes("r2"))).toBe(false);
  });
});

describe("plan: quincenas", () => {
  it("de un cobro al siguiente, con el viaje como su propia fila", () => {
    expect(plan.budgetRows.map((r) => [r.start, r.end, r.kind])).toEqual([
      ["2026-10-13", "2026-10-15", "home"],
      ["2026-10-16", "2026-10-28", "home"],
      ["2026-10-29", "2026-11-10", "home"],
      ["2026-11-11", "2026-11-24", "home"],
      ["2026-11-25", "2026-11-28", "home"],
      ["2026-11-29", "2027-01-09", "period"],
      ["2027-01-10", "2027-01-18", "home"],
    ]);
  });
  it("presupuesto de 13 días redondeado a 50", () => {
    expect(plan.budgetRows[1].budget).toBe(1_495_000);
  });
  it("la quincena actual es la que se puede gastar", () => {
    expect(plan.canSpend?.end).toBe("2026-10-15");
  });
});

describe("plan: tarjetas", () => {
  it("19 oct: las dos Visa 3001 juntas desde la corriente (11,500 + 406 × 62)", () => {
    const e = plan.events.find((x) => x.type === "card" && x.date === "2026-10-19")!;
    expect(e.amount).toBe(-3_667_200);
    expect(e.with).toBe("Corriente 1001 → Visa 3001");
    expect(e.parts?.length).toBe(2);
    expect(e.dueDate).toBe("2026-10-22");
  });
  it("4 nov: la Visa 5001, el corte del 13 de octubre", () => {
    const e = plan.events.find((x) => x.type === "card" && x.date === "2026-11-04")!;
    expect(e.amount).toBe(-3_170_475);
    expect(e.dueDate).toBe("2026-11-09");
    expect(plan.nextCard).toMatchObject({ date: "2026-10-19", amount: 3_667_200, from: "Corriente 1001" });
  });
  it("un consumo cae en el corte que le toca y se paga después", () => {
    expect(chargeSchedule(accounts[2], "2026-10-14")).toEqual({ cut: "2026-11-13", payDate: "2026-12-04" });
    expect(chargeSchedule(accounts[2], "2026-10-13")).toEqual({ cut: "2026-10-13", payDate: "2026-11-04" });
    expect(chargeSchedule(accounts[3], "2026-11-04")).toEqual({ cut: "2026-12-01", payDate: "2026-12-19" });
  });
  it("el presupuesto del día a día cae en la Visa 5001 y se paga en sus cortes", () => {
    const v5001 = plan.cards.find((c) => c.last4 === "5001")!;
    const dic = v5001.cycles.find((c) => c.payDate === "2026-12-04")!;
    expect(dic.cut).toBe("2026-11-13");
    expect(dic.upcoming).toBeGreaterThan(0);
  });
});

describe("plan: cuotas y línea de tiempo", () => {
  it("la cuota sale de la corriente hacia la deuda", () => {
    const e = plan.events.find((x) => x.type === "debt" && x.date === "2026-10-16")!;
    expect(e.with).toBe("Corriente 1001 → Deuda familiar (viaje)");
    expect(e.effect).toBe(-1_000_000);
  });
  it("mismo día: primero lo que entra", () => {
    const day = plan.events.filter((x) => x.date === "2026-10-16" && !x.past);
    expect(day[0].type).toBe("income");
    expect(day[0].balance).toBe(3_486_600 + 3_390_000);
  });
  it("el saldo baja en orden y marca el punto más bajo", () => {
    const after19 = plan.events.find((x) => x.date === "2026-10-19" && x.type === "card")!;
    expect(after19.balance).toBe(3_486_600 + 3_390_000 - 1_000_000 - 3_667_200);
    expect(plan.low.balance).toBeLessThanOrEqual(plan.myMoney);
    expect(plan.series[0]).toEqual({ date: "2026-10-13", balance: 3_486_600 });
  });
  it("la deuda en cuotas muestra cuánto falta al final del plan", () => {
    const d = plan.installmentDebts.find((x) => x.id === "d1")!;
    expect(d.next[0]).toEqual({ date: "2026-10-16", amount: 1_000_000 });
    expect(d.payoff).toBeNull();
    expect(d.leftAtEnd).toBe(11_060_000 - 8 * 1_000_000);
    expect(plan.debts).toBe(11_060_000);
  });
});

describe("plan: periodos y supuestos", () => {
  it("el viaje en su moneda, con la parte en efectivo", () => {
    const v = plan.periods[0];
    expect(v).toMatchObject({ currency: "EUR", budget: 130_000, cash: 30_000, card: 100_000, spent: 0 });
  });
  it("supuestos con las tasas", () => {
    expect(plan.assumptions.some((a) => a.some((x) => typeof x === "string" && x.includes("1 USD = DOP 62")))).toBe(true);
  });
  it("sin cobros planificados, quincenas del 1 y del 16", () => {
    const p = buildPlan({ ...input, recurring: [], periods: [] });
    expect(p.paydaysFrom).toBe("default");
    expect(p.budgetRows[0]).toMatchObject({ start: "2026-10-01", end: "2026-10-15" });
    expect(p.budgetRows[1]).toMatchObject({ start: "2026-10-16", end: "2026-10-31" });
  });
});
