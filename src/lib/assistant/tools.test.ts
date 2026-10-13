import { describe, expect, it } from "vitest";
import { cardPaymentTarget } from "./tools";

const acc = (name: string, type: string, extra: { last4?: string; institution?: string } = {}) => ({
  name,
  type,
  last4: extra.last4 ?? null,
  institution: extra.institution ?? null,
  archived_at: null,
});

const accounts = [acc("Popular", "checking"), acc("Visa Scotiabank", "credit", { last4: "7788", institution: "Scotiabank" }), acc("Efectivo", "cash")];

describe("cardPaymentTarget", () => {
  it("reconoce el pago de la tarjeta por nombre, banco o últimos 4", () => {
    expect(cardPaymentTarget(accounts, "Pago Visa Scotiabank")?.name).toBe("Visa Scotiabank");
    expect(cardPaymentTarget(accounts, "pagué la tarjeta del Scotiabank")?.name).toBe("Visa Scotiabank");
    expect(cardPaymentTarget(accounts, "abono a la 7788")?.name).toBe("Visa Scotiabank");
  });

  it("con una sola tarjeta basta decir 'la visa' o 'la tarjeta'", () => {
    expect(cardPaymentTarget(accounts, "Pago Visa")?.name).toBe("Visa Scotiabank");
    expect(cardPaymentTarget(accounts, "pago de la tarjeta")?.name).toBe("Visa Scotiabank");
  });

  it("no confunde gastos normales con pagos de tarjeta", () => {
    expect(cardPaymentTarget(accounts, "Almuerzo")).toBeUndefined();
    expect(cardPaymentTarget(accounts, "Pago de la luz")).toBeUndefined();
    expect(cardPaymentTarget(accounts, "compra con la visa")).toBeUndefined();
  });

  it("con dos tarjetas y sin nombre no adivina", () => {
    const two = [...accounts, acc("Mastercard BHD", "credit", { institution: "BHD" })];
    expect(cardPaymentTarget(two, "pago de la tarjeta")).toBeUndefined();
    expect(cardPaymentTarget(two, "pago tarjeta BHD")?.name).toBe("Mastercard BHD");
  });
});
