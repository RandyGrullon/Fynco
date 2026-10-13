import { describe, expect, it } from "vitest";
import { cleanText, guessCategory, parseBankEmail, parseCurrencyAmount, parseDMY, prettyMerchant } from "./parse";

// Textos reales de alertas del Popular (nombre cambiado), tal como los entrega Gmail en text/plain.
const CONSUMO_IKEA = `<https://www.popularenlinea.com/SiteCollectionImages/Mailer/MAYO/Popular
-Logo-Banco.png>

Estimado (a) NOMBRE APELLIDO

Gracias por utilizar su VISA IKEA FAMILY, terminada en 5263.

A continuación le informamos el detalle de su transacción:

Monto \tMoneda \tFecha \tComercio\tEstatus\t
RD$4,704.75 \tPeso dominicano \t12/10/2026 \tSEGUROS
RESERVAS INTERM 3 \tAprobada\t

En caso de requerir mayor información, puede comunicarse con nosotros
llamando al 809­-544­-5555.`;

const CONSUMO_EUR = `Estimado (a) NOMBRE APELLIDO

Gracias por utilizar su MASTERCARD JETBLUE, terminada en 3742.

A continuación le informamos el detalle de su transacción:

Monto \tMoneda \tFecha \tComercio\tEstatus\t
EUR$25.15 \tEuro \t07/10/2026 \tWolt \tAprobada\t

En caso de requerir mayor información, puede comunicarse con nosotros`;

const CONSUMO_USD = `Gracias por utilizar su MASTERCARD JETBLUE, terminada en 3742.

A continuación le informamos el detalle de su transacción:

Monto \tMoneda \tFecha \tComercio\tEstatus\t
US$7.56 \tDólar estadounidense \t01/10/2026 \tGoogle
Workspace_grull \tAprobada\t

En caso de requerir mayor información`;

const CODIGO_CASH = `| Estimado (a) APELLIDO NOMBRE Le informamos que el Código Cash generado desde tu aplicación móvil, ha sido utilizado en uno de nuestros cajeros automáticos. A continuación te damos el detalle de la transacción: |

| |
| Monto | Fecha | Estatus |
|---|---|---|
| RD 4,800.00 | 27/6/2026 | Aprobada |

De no reconocer esta transacción, por favor llame al 809-­544-­6868`;

const NOMINA = `| Estimado(a): APELLIDO NOMBRE No. de identificación XXX-XXXX-0000 Le informamos que ha sido acreditado el pago de su nómina en su cuenta terminada en 1848. Puede consultar los detalles de su depósito de forma inmediata a través de la App Popular |`;

const NOMINA_VIEJA = `| Estimado (a) APELLIDO NOMBRE A continuación, le informamos el detalle del depósito recibido en su cuenta terminada en 1848 . Nos place saludarle e informarle que en fecha 20260717 ha recibido un depósito por concepto de pago de nómina en su cuenta. |`;

const POPULAR = "notificaciones@popularenlinea.com";

describe("cleanText", () => {
  it("quita guiones suaves, tablas y espacios repetidos", () => {
    expect(cleanText("809­-544­-5555")).toBe("809-544-5555");
    expect(cleanText("| a |\n|---|---|\n| b |")).toBe("a b");
  });
});

describe("parseCurrencyAmount", () => {
  it("lee los prefijos de moneda del banco", () => {
    expect(parseCurrencyAmount("RD$4,704.75")).toEqual({ currency: "DOP", amount: 470475 });
    expect(parseCurrencyAmount("US$7.56")).toEqual({ currency: "USD", amount: 756 });
    expect(parseCurrencyAmount("EUR$25.15")).toEqual({ currency: "EUR", amount: 2515 });
    expect(parseCurrencyAmount("RD 4,800.00")).toEqual({ currency: "DOP", amount: 480000 });
    expect(parseCurrencyAmount("€12")).toEqual({ currency: "EUR", amount: 1200 });
  });
  it("rechaza lo que no es un monto", () => {
    expect(parseCurrencyAmount("RD$")).toBeNull();
    expect(parseCurrencyAmount("ABC 12.00")).toBeNull();
    expect(parseCurrencyAmount("RD$0.00")).toBeNull();
  });
});

describe("parseDMY", () => {
  it("convierte día/mes/año", () => {
    expect(parseDMY("12/10/2026")).toBe("2026-10-12");
    expect(parseDMY("7/6/2026")).toBe("2026-06-07");
  });
  it("rechaza fechas imposibles", () => {
    expect(parseDMY("31/02/2026")).toBeNull();
    expect(parseDMY("2026-10-12")).toBeNull();
  });
});

describe("parseBankEmail", () => {
  it("consumo en pesos con comercio partido en dos líneas", () => {
    expect(parseBankEmail({ sender: POPULAR, subject: "Notificación de Consumo", text: CONSUMO_IKEA })).toEqual({
      type: "card_charge",
      cardName: "VISA IKEA FAMILY",
      last4: "5263",
      amount: 470475,
      currency: "DOP",
      occurredOn: "2026-10-12",
      merchant: "SEGUROS RESERVAS INTERM 3",
      status: "Aprobada",
      approved: true,
    });
  });

  it("consumo en euros", () => {
    const r = parseBankEmail({ sender: POPULAR, subject: "Notificación de Consumo", text: CONSUMO_EUR });
    expect(r).toMatchObject({ type: "card_charge", last4: "3742", amount: 2515, currency: "EUR", merchant: "Wolt", occurredOn: "2026-10-07" });
  });

  it("consumo en dólares", () => {
    const r = parseBankEmail({ sender: POPULAR, subject: "Notificación de Consumo", text: CONSUMO_USD });
    expect(r).toMatchObject({ type: "card_charge", currency: "USD", amount: 756, merchant: "Google Workspace_grull" });
  });

  it("consumo declinado no se marca como aprobado", () => {
    const r = parseBankEmail({ sender: POPULAR, subject: "Notificación de Consumo", text: CONSUMO_EUR.replace("Aprobada", "Declinada") });
    expect(r).toMatchObject({ type: "card_charge", approved: false, status: "Declinada" });
  });

  it("retiro con Código Cash", () => {
    const r = parseBankEmail({ sender: POPULAR, subject: "Notificación de retiro Código Cash", text: CODIGO_CASH });
    expect(r).toEqual({ type: "cash_withdrawal", amount: 480000, currency: "DOP", occurredOn: "2026-06-27", approved: true });
  });

  it("nómina sin monto", () => {
    const r = parseBankEmail({ sender: POPULAR, subject: "Notificación Depósito de Nómina", text: NOMINA });
    expect(r).toEqual({ type: "payroll", last4: "1848", amount: null, currency: "DOP", occurredOn: null });
  });

  it("nómina con fecha en el formato viejo", () => {
    const r = parseBankEmail({ sender: POPULAR, subject: "Notificación Depósito de Nómina", text: NOMINA_VIEJA });
    expect(r).toMatchObject({ type: "payroll", last4: "1848", occurredOn: "2026-07-17" });
  });

  it("avisos y promociones del banco son ruido", () => {
    expect(parseBankEmail({ sender: POPULAR, subject: "Actualización de Límite", text: "" })).toBe("noise");
    expect(parseBankEmail({ sender: "popularteinforma@popularenlinea.com", subject: "¡35% de ahorro! - Publicidad", text: "" })).toBe("noise");
  });

  it("formatos desconocidos o de otros remitentes van a la IA", () => {
    expect(parseBankEmail({ sender: POPULAR, subject: "Transferencia recibida", text: "..." })).toBeNull();
    expect(parseBankEmail({ sender: "alertas@otrobanco.com", subject: "Consumo", text: CONSUMO_EUR })).toBeNull();
  });
});

describe("prettyMerchant y guessCategory", () => {
  it("pone en formato título solo lo que viene en mayúsculas", () => {
    expect(prettyMerchant("SEGUROS RESERVAS INTERM 3")).toBe("Seguros Reservas Interm 3");
    expect(prettyMerchant("Wolt")).toBe("Wolt");
  });
  it("adivina categorías comunes", () => {
    expect(guessCategory("Wolt")).toBe("Comida");
    expect(guessCategory("UBER *TRIP")).toBe("Transporte");
    expect(guessCategory("Google Workspace_grull")).toBe("Suscripciones");
    expect(guessCategory("SUPERMERCADOS NACIONAL")).toBe("Supermercado");
    expect(guessCategory("XYZ 123")).toBeNull();
  });
});
