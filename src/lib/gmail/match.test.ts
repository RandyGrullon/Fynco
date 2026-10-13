import { describe, expect, it } from "vitest";
import { cashAccount, convertCents, matchCardAccount, type MatchableAccount } from "./match";
import { htmlToText, senderAddress } from "./google";

const acc = (id: string, currency: string, last4: string | null, type = "credit", extra: Partial<MatchableAccount> = {}): MatchableAccount => ({
  id,
  name: id,
  type,
  currency,
  last4,
  is_default: false,
  archived_at: null,
  ...extra,
});

const ACCOUNTS = [
  acc("popular", "DOP", "1848", "checking", { is_default: true }),
  acc("ikea", "DOP", "5263"),
  acc("jb-dop", "DOP", "3742"),
  acc("jb-usd", "USD", "3742"),
  acc("vieja", "DOP", "9999", "credit", { archived_at: "2026-01-01" }),
];

describe("matchCardAccount", () => {
  it("misma terminación y moneda", () => {
    expect(matchCardAccount(ACCOUNTS, "3742", "DOP")).toEqual({ account: ACCOUNTS[2], convert: false });
    expect(matchCardAccount(ACCOUNTS, "3742", "USD")).toEqual({ account: ACCOUNTS[3], convert: false });
  });
  it("en euros, la tarjeta de doble saldo usa el saldo en dólares", () => {
    expect(matchCardAccount(ACCOUNTS, "3742", "EUR")).toEqual({ account: ACCOUNTS[3], convert: true });
  });
  it("una sola cuenta con esa terminación: convierte a su moneda", () => {
    expect(matchCardAccount(ACCOUNTS, "5263", "USD")).toEqual({ account: ACCOUNTS[1], convert: true });
  });
  it("sin coincidencia o archivada: null", () => {
    expect(matchCardAccount(ACCOUNTS, "0000", "DOP")).toBeNull();
    expect(matchCardAccount(ACCOUNTS, "9999", "DOP")).toBeNull();
  });
  it("cuenta de efectivo", () => {
    expect(cashAccount(ACCOUNTS)).toBeNull();
    expect(cashAccount([...ACCOUNTS, acc("cash", "DOP", null, "cash")])?.id).toBe("cash");
  });
});

describe("convertCents", () => {
  const rates = { USD: 1, EUR: 0.86, DOP: 62 };
  it("convierte con tasas por dólar", () => {
    expect(convertCents(2515, "EUR", "USD", rates)).toBe(2924);
    expect(convertCents(10000, "USD", "DOP", rates)).toBe(620000);
    expect(convertCents(500, "DOP", "DOP", rates)).toBe(500);
  });
  it("moneda sin tasa: null", () => {
    expect(convertCents(100, "XYZ", "USD", rates)).toBeNull();
  });
});

describe("utilidades del correo", () => {
  it("remitente sin nombre", () => {
    expect(senderAddress("Banco Popular <Notificaciones@PopularEnLinea.com>")).toBe("notificaciones@popularenlinea.com");
    expect(senderAddress("alertas@banco.com")).toBe("alertas@banco.com");
  });
  it("HTML a texto", () => {
    expect(htmlToText("<style>x{}</style><p>Monto&nbsp;RD$1,000</p><td>Wolt</td><td>Aprobada</td>").replace(/\s+/g, " ").trim()).toBe("Monto RD$1,000 Wolt Aprobada");
    expect(htmlToText("Caf&#233; &amp; m&#xE1;s")).toBe("Café & más");
  });
});
