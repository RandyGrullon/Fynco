import { describe, expect, it } from "vitest";
import { countMovementLines, emptyResult, mccCategory, mergeModelOutput, parseModelJson, statementDate } from "./extract";

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

describe("statementDate", () => {
  it("pone el año a partir de la fecha de corte", () => {
    expect(statementDate("14/09", "2026-09-14", "2026-10-13")).toBe("2026-09-14");
    expect(statementDate("17/08", "2026-09-14", "2026-10-13")).toBe("2026-08-17");
    expect(statementDate("28/12", "2027-01-15", "2027-01-20")).toBe("2026-12-28");
    expect(statementDate("15SEP", "2026-09-28", "2026-10-13")).toBe("2026-09-15");
    expect(statementDate("02-ago-26", "2026-09-28", "2026-10-13")).toBe("2026-08-02");
    expect(statementDate("2026-09-01", "2026-09-28", "2026-10-13")).toBe("2026-09-01");
    expect(statementDate("31/02", "2026-09-28", "2026-10-13")).toBeNull();
  });
});

describe("mccCategory", () => {
  it("traduce el tipo de comercio", () => {
    expect(mccCategory("5812")).toBe("comida");
    expect(mccCategory("5411")).toBe("supermercado");
    expect(mccCategory("5541")).toBe("transporte");
    expect(mccCategory("7011")).toBe("viajes");
    expect(mccCategory("5912")).toBe("salud");
    expect(mccCategory("5734")).toBe("suscripciones");
    expect(mccCategory("5651")).toBe("compras");
    expect(mccCategory("8398")).toBeNull();
    expect(mccCategory(null)).toBeNull();
  });
});

describe("tarjetas", () => {
  const all = [...cats, { id: "c-super", name: "Supermercado", kind: "expense" as const }];
  it("si la IA dejó los consumos en positivo (como el banco), se invierte", () => {
    const r = emptyResult();
    r.closing_date = "2026-09-14";
    mergeModelOutput(
      r,
      { rows: [["20/08", "SUPERMARKET POLLENCA", 762.29, "otro", null, "5411"], ["21/08", "Pago Via App", -36640.78, "pago_tarjeta", null, null], ["14/09", "CARGO SOBREGIRO", 600, "otro", null, null]] },
      all,
      "2026-10-13",
      "credit",
    );
    expect(r.rows.map((x) => [x.date, x.amount, x.category_name, x.card_payment])).toEqual([
      ["2026-08-20", -76_229, "Supermercado", false],
      ["2026-08-21", 3_664_078, null, true],
      ["2026-09-14", -60_000, null, false],
    ]);
  });

  it("cuenta los renglones con movimientos para avisar si falta alguno", () => {
    const chunk = "****-5263 | 65,000.00 | 0.00 | 14/09/2026\n20/08 | 19/08 #5432 | TASTY ASIA | 1,623.39 | MCC 5812\n20/08 | 19/08 #3112 | TASTY ASIA | 1,623.39 | MCC 5812\n21/08 | 21/08 #8439 | Pago Via App | -36,640.78\n01/09/2026 BALANCE ANTERIOR | 45,230.15\n0 | 0.00 | 2,470.50 | 67,937.23";
    expect(countMovementLines(chunk)).toBe(3);
  });
});
