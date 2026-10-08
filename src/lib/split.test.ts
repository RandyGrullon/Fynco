import { describe, expect, it } from "vitest";
import { debtsFor, myExpenseImpact, pairwiseDebts, simplifyDebts, splitByWeights, splitEqual, splitPercent } from "./split";

const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);

describe("splitEqual", () => {
  it("cuadra exacto y reparte los centavos sobrantes a los primeros", () => {
    const r = splitEqual(1000, ["a", "b", "c"]);
    expect(r.map((x) => x.amount)).toEqual([334, 333, 333]);
    expect(sum(r)).toBe(1000);
  });

  it("caso de la cena: 7,150 entre 4", () => {
    const r = splitEqual(715000, ["yo", "ana", "luis", "carla"]);
    expect(r.every((x) => x.amount === 178750)).toBe(true);
  });
});

describe("splitByWeights", () => {
  it("respeta partes 2:1:1 y no pierde centavos", () => {
    const r = splitByWeights(1001, [
      { member_id: "a", weight: 2 },
      { member_id: "b", weight: 1 },
      { member_id: "c", weight: 1 },
    ]);
    expect(sum(r)).toBe(1001);
    expect(r[0].amount).toBeGreaterThanOrEqual(500);
  });

  it("peso 0 recibe 0", () => {
    const r = splitByWeights(900, [
      { member_id: "a", weight: 1 },
      { member_id: "b", weight: 0 },
    ]);
    expect(r).toEqual([
      { member_id: "a", amount: 900, weight: 1 },
      { member_id: "b", amount: 0, weight: 0 },
    ]);
  });
});

describe("splitPercent", () => {
  it("rechaza porcentajes que no suman 100", () => {
    const r = splitPercent(1000, [
      { member_id: "a", weight: 50 },
      { member_id: "b", weight: 40 },
    ]);
    expect(r.ok).toBe(false);
  });

  it("33.33/33.33/33.34 cuadra", () => {
    const r = splitPercent(10000, [
      { member_id: "a", weight: 33.33 },
      { member_id: "b", weight: 33.33 },
      { member_id: "c", weight: 33.34 },
    ]);
    expect(r.ok && sum(r.portions)).toBe(10000);
  });
});

describe("simplifyDebts", () => {
  it("viaje a Samaná: Ana y Luis le pagan a Randy, Carla a mano", () => {
    const debts = simplifyDebts([
      { member_id: "randy", net: 425000 },
      { member_id: "ana", net: -215000 },
      { member_id: "luis", net: -210000 },
      { member_id: "carla", net: 0 },
    ]);
    expect(debts).toEqual([
      { from: "ana", to: "randy", amount: 215000 },
      { from: "luis", to: "randy", amount: 210000 },
    ]);
  });

  it("como máximo n−1 pagos y todo cuadra", () => {
    const nets = [
      { member_id: "a", net: 5000 },
      { member_id: "b", net: 3000 },
      { member_id: "c", net: -4000 },
      { member_id: "d", net: -2500 },
      { member_id: "e", net: -1500 },
    ];
    const debts = simplifyDebts(nets);
    expect(debts.length).toBeLessThanOrEqual(nets.length - 1);
    const after = Object.fromEntries(nets.map((n) => [n.member_id, n.net]));
    for (const d of debts) {
      after[d.from] += d.amount;
      after[d.to] -= d.amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
});

describe("pairwiseDebts", () => {
  const expenses = [
    { amount: 840000, payers: [{ member_id: "randy", amount: 840000 }], shares: ["randy", "ana", "luis", "carla"].map((m) => ({ member_id: m, amount: 210000 })) },
    { amount: 715000, payers: [{ member_id: "carla", amount: 715000 }], shares: ["randy", "ana", "luis", "carla"].map((m) => ({ member_id: m, amount: 178750 })) },
  ];

  it("netea por pareja", () => {
    const debts = pairwiseDebts(expenses, []);
    const randyCarla = debts.find((d) => (d.from === "carla" && d.to === "randy") || (d.from === "randy" && d.to === "carla"));
    // Carla le debe 2,100 a Randy y Randy le debe 1,787.50 a Carla → Carla le debe 312.50
    expect(randyCarla).toEqual({ from: "carla", to: "randy", amount: 31250 });
  });

  it("los pagos registrados reducen la deuda", () => {
    const debts = pairwiseDebts(expenses, [{ from_member: "ana", to_member: "randy", amount: 210000 }]);
    const anaRandy = debts.find((d) => d.from === "ana" && d.to === "randy");
    expect(anaRandy).toBeUndefined();
  });

  it("varios pagadores reparten la deuda proporcionalmente", () => {
    const debts = pairwiseDebts(
      [{ amount: 300, payers: [{ member_id: "a", amount: 200 }, { member_id: "b", amount: 100 }], shares: [{ member_id: "c", amount: 300 }] }],
      [],
    );
    expect(debts).toEqual([
      { from: "c", to: "a", amount: 200 },
      { from: "c", to: "b", amount: 100 },
    ]);
  });
});

describe("debtsFor y myExpenseImpact", () => {
  it("signo desde mi punto de vista", () => {
    expect(debtsFor("randy", [{ from: "ana", to: "randy", amount: 10 }, { from: "randy", to: "marco", amount: 4 }])).toEqual([
      { other: "ana", amount: 10 },
      { other: "marco", amount: -4 },
    ]);
  });

  it("prestaste lo pagado menos tu parte", () => {
    expect(
      myExpenseImpact({ payers: [{ member_id: "yo", amount: 840000 }], shares: [{ member_id: "yo", amount: 210000 }] }, "yo"),
    ).toEqual({ paid: 840000, share: 210000, net: 630000 });
  });
});
