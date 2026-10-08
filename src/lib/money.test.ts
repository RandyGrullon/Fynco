import { describe, expect, it } from "vitest";
import { centsToInput, formatMoney, parseMoney } from "./money";

describe("formatMoney", () => {
  it("oculta .00 y muestra centavos cuando hay", () => {
    expect(formatMoney(18432050)).toBe("RD$ 184,320.50");
    expect(formatMoney(425000)).toBe("RD$ 4,250");
  });

  it("signos", () => {
    expect(formatMoney(-178750)).toBe("−RD$ 1,787.50");
    expect(formatMoney(9500000, "DOP", { sign: "always" })).toBe("+RD$ 95,000");
    expect(formatMoney(-500, "USD", { sign: "never" })).toBe("US$ 5");
  });
});

describe("parseMoney", () => {
  it.each([
    ["1,234.56", 123456],
    ["1234.5", 123450],
    ["1234,56", 123456],
    ["1.234,56", 123456],
    ["RD$ 4,250", 425000],
    ["850", 85000],
    ["0.1", 10],
  ])("%s → %d", (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it("inválidos", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });

  it("ida y vuelta", () => {
    expect(parseMoney(centsToInput(178750))).toBe(178750);
  });
});
