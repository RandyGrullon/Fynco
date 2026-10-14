import { describe, expect, it } from "vitest";
import { debtStatus, debtTerms, defaultFirstDue, dueDates, monthsBetween } from "./debts";

const base = { principal: 2_000_000, started_on: "2026-10-15", interest_rate: 10, interest_period: "monthly" as const };

describe("debtTerms", () => {
  it("4 cuotas mensuales al 10% mensual = 40% de interés", () => {
    const t = debtTerms({ ...base, installments: 4, frequency: "monthly", first_due_on: "2026-11-15" });
    expect(t.months).toBe(4);
    expect(t.interest).toBe(800_000);
    expect(t.total).toBe(2_800_000);
    expect(t.last_due_on).toBe("2027-02-15");
    expect(t.installments.map((c) => [c.due_on, c.amount])).toEqual([
      ["2026-11-15", 700_000],
      ["2026-12-15", 700_000],
      ["2027-01-15", 700_000],
      ["2027-02-15", 700_000],
    ]);
  });

  it("un solo pago con interés total fijo", () => {
    const t = debtTerms({ ...base, interest_rate: 15, interest_period: "total", installments: 1, frequency: "once", first_due_on: "2026-12-31" });
    expect(t.total).toBe(2_300_000);
    expect(t.installments).toEqual([{ n: 1, due_on: "2026-12-31", amount: 2_300_000 }]);
  });

  it("interés anual según el tiempo y cuotas que no dividen exacto", () => {
    const t = debtTerms({ ...base, principal: 1_000_000, interest_rate: 24, interest_period: "annual", installments: 3, frequency: "monthly", first_due_on: "2026-11-15" });
    expect(t.months).toBe(3);
    expect(t.interest).toBe(60_000);
    expect(t.installments.map((c) => c.amount)).toEqual([353_333, 353_333, 353_334]);
  });

  it("sin interés", () => {
    expect(debtTerms({ ...base, interest_period: "none", installments: 1, frequency: "once", first_due_on: "2027-01-01" }).total).toBe(2_000_000);
  });
});

describe("fechas", () => {
  it("semanales, quincenales y fin de mes", () => {
    expect(dueDates({ first_due_on: "2026-10-22", frequency: "weekly", installments: 3 })).toEqual(["2026-10-22", "2026-10-29", "2026-11-05"]);
    expect(dueDates({ first_due_on: "2026-10-30", frequency: "biweekly", installments: 2 })).toEqual(["2026-10-30", "2026-11-13"]);
    expect(dueDates({ first_due_on: "2027-01-31", frequency: "monthly", installments: 2 })).toEqual(["2027-01-31", "2027-02-28"]);
    expect(defaultFirstDue("2026-10-15", "monthly")).toBe("2026-11-15");
    expect(monthsBetween("2026-10-15", "2026-11-14")).toBeCloseTo(0.967, 3);
  });
});

describe("debtStatus", () => {
  const t = debtTerms({ ...base, installments: 4, frequency: "monthly", first_due_on: "2026-11-15" });
  it("los pagos cubren las cuotas en orden y marca las vencidas", () => {
    const s = debtStatus(t, 1_000_000, "2026-12-20");
    expect(s.remaining).toBe(1_800_000);
    expect(s.schedule.map((c) => [c.state, c.pending])).toEqual([
      ["paid", 0],
      ["overdue", 400_000],
      ["pending", 700_000],
      ["pending", 700_000],
    ]);
    expect(s.next?.n).toBe(2);
    expect(s.overdue).toBe(400_000);
  });
  it("saldada", () => {
    expect(debtStatus(t, 2_800_000, "2027-03-01").done).toBe(true);
  });
});
