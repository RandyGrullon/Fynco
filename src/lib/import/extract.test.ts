import { describe, expect, it } from "vitest";
import { emptyResult, mergeModelOutput, parseModelJson } from "./extract";

const cats = [
  { id: "c-food", name: "Comida", kind: "expense" as const },
  { id: "c-fuel", name: "Transporte", kind: "expense" as const },
  { id: "c-sal", name: "Salario", kind: "income" as const },
];

describe("parseModelJson", () => {
  it("acepta JSON con cercas o texto alrededor", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Aquí está: {"a":2} listo')).toEqual({ a: 2 });
    expect(parseModelJson("nada")).toBeNull();
  });
});

describe("mergeModelOutput", () => {
  it("valida filas, montos y categorías", () => {
    const r = emptyResult();
    const added = mergeModelOutput(
      r,
      {
        bank: "BHD",
        last4: "**** 5521",
        currency: "dop",
        period_from: "2026-09-01",
        period_to: "2026-09-30",
        closing_date: "2026-09-28",
        due_date: "2026-10-18",
        closing_balance: "12,500.00",
        minimum_payment: 625,
        credit_limit: null,
        rows: [
          ["2026-09-15", "SUPERMERCADO NACIONAL", -3420, "otro", "Comida"],
          ["2026-09-16", "GASOLINA SHELL", "-1,200.00", "otro", "Transporte"],
          ["2026-09-20", "PAGO RECIBIDO GRACIAS", "10,000.00", "pago_tarjeta", null],
          { date: "2026-09-25", description: "Nómina", amount: 95000, type: "otro", category: "salario" },
          ["2026-13-01", "fecha mala", -10, "otro", null],
          ["2026-09-22", "monto cero", 0, "otro", null],
          ["2031-01-01", "muy en el futuro", -5, "otro", null],
        ],
      },
      cats,
      "2026-10-14",
    );
    expect(added).toBe(4);
    expect(r).toMatchObject({ bank: "BHD", last4: "5521", currency: "DOP", closing_date: "2026-09-28", due_date: "2026-10-18", closing_balance: 1_250_000, minimum_payment: 62_500 });
    expect(r.rows.map((x) => [x.amount, x.category_name, x.card_payment])).toEqual([
      [-342_000, "Comida", false],
      [-120_000, "Transporte", false],
      [1_000_000, null, true],
      [9_500_000, "Salario", false],
    ]);
  });

  it("montos entre paréntesis son negativos y la coma decimal se entiende", () => {
    const r = emptyResult();
    mergeModelOutput(r, { rows: [["2026-09-01", "Cargo", "(1.234,50)", "otro", null]] }, cats, "2026-10-14");
    expect(r.rows[0].amount).toBe(-123_450);
  });

  it("descarta filas de resumen y categoriza por el comercio", () => {
    const r = emptyResult();
    const withSuper = [...cats, { id: "c-super", name: "Supermercado", kind: "expense" as const }];
    mergeModelOutput(
      r,
      {
        rows: [
          ["2026-08-29", "BALANCE ANTERIOR", -22410.3, "otro", null],
          ["2026-09-30", "Total débitos", -31894.65, "otro", null],
          ["2026-09-20", "JUMBO LUPERON", -5612.4, "otro", null],
          ["2026-09-25", "TEXACO AV. 27 DE FEBRERO", -2000, "otro", null],
        ],
      },
      withSuper,
      "2026-10-14",
    );
    expect(r.rows.map((x) => [x.description, x.category_name])).toEqual([
      ["JUMBO LUPERON", "Supermercado"],
      ["TEXACO AV. 27 DE FEBRERO", "Transporte"],
    ]);
  });

  it("el encabezado de la primera parte no se pisa con las siguientes", () => {
    const r = emptyResult();
    mergeModelOutput(r, { bank: "Popular", rows: [] }, cats, "2026-10-14");
    mergeModelOutput(r, { bank: "Otro", rows: [] }, cats, "2026-10-14");
    expect(r.bank).toBe("Popular");
  });
});
