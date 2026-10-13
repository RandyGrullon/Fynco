import { describe, expect, it } from "vitest";
import { cardDates, daysUntil } from "./card-dates";

describe("cardDates", () => {
  it("corte el 15 y pago el 5: antes del pago pendiente", () => {
    expect(cardDates(15, 5, "2026-10-03")).toEqual({ nextStatement: "2026-10-15", nextDue: "2026-10-05" });
  });

  it("corte el 15 y pago el 5: ya pagado el del mes, toca el del próximo corte", () => {
    expect(cardDates(15, 5, "2026-10-13")).toEqual({ nextStatement: "2026-10-15", nextDue: "2026-11-05" });
  });

  it("el día del corte cuenta como hoy", () => {
    expect(cardDates(15, 5, "2026-10-15")).toEqual({ nextStatement: "2026-10-15", nextDue: "2026-11-05" });
    expect(cardDates(15, 5, "2026-10-16")).toEqual({ nextStatement: "2026-11-15", nextDue: "2026-11-05" });
  });

  it("pago en el mismo mes del corte (corte 5, pago 28)", () => {
    expect(cardDates(5, 28, "2026-10-10")).toEqual({ nextStatement: "2026-11-05", nextDue: "2026-10-28" });
    expect(cardDates(5, 28, "2026-10-29")).toEqual({ nextStatement: "2026-11-05", nextDue: "2026-11-28" });
  });

  it("días que no existen en el mes usan el último día", () => {
    expect(cardDates(31, 20, "2027-02-10")).toEqual({ nextStatement: "2027-02-28", nextDue: "2027-02-20" });
    expect(cardDates(30, 31, "2026-02-01").nextStatement).toBe("2026-02-28");
  });

  it("cambio de año", () => {
    expect(cardDates(20, 10, "2026-12-25")).toEqual({ nextStatement: "2027-01-20", nextDue: "2027-01-10" });
  });

  it("sin días configurados", () => {
    expect(cardDates(null, null, "2026-10-13")).toEqual({ nextStatement: null, nextDue: null });
    expect(cardDates(null, 5, "2026-10-13")).toEqual({ nextStatement: null, nextDue: "2026-11-05" });
  });
});

describe("daysUntil", () => {
  it("cuenta días calendario", () => {
    expect(daysUntil("2026-10-13", "2026-10-13")).toBe(0);
    expect(daysUntil("2026-11-05", "2026-10-13")).toBe(23);
  });
});
