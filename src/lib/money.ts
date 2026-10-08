// Dinero en centavos (enteros). Nunca operar con flotantes de pesos.

export const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  DOP: { symbol: "RD$", name: "Peso dominicano" },
  USD: { symbol: "US$", name: "Dólar estadounidense" },
  EUR: { symbol: "€", name: "Euro" },
  MXN: { symbol: "MX$", name: "Peso mexicano" },
  COP: { symbol: "COL$", name: "Peso colombiano" },
  CAD: { symbol: "CA$", name: "Dólar canadiense" },
  GBP: { symbol: "£", name: "Libra esterlina" },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);

export function currencySymbol(code: string) {
  return CURRENCIES[code]?.symbol ?? code;
}

const grouped = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export interface FormatOptions {
  /** "always": +/− siempre; "negative": solo − (por defecto); "never": valor absoluto */
  sign?: "always" | "negative" | "never";
  /** Mostrar ".00" aunque no haya centavos */
  cents?: "auto" | "always" | "never";
  symbol?: boolean;
}

/** 18432050 → "RD$ 184,320.50"; 425000 → "RD$ 4,250" */
export function formatMoney(amount: number, currency = "DOP", opts: FormatOptions = {}) {
  const { sign = "negative", cents = "auto", symbol = true } = opts;
  const abs = Math.abs(Math.round(amount));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  let body = grouped.format(whole);
  if (cents === "always" || (cents === "auto" && frac !== 0)) body += `.${String(frac).padStart(2, "0")}`;
  const prefix = symbol ? `${currencySymbol(currency)} ` : "";
  const s = amount < 0 ? "−" : amount > 0 && sign === "always" ? "+" : "";
  return sign === "never" ? `${prefix}${body}` : `${s}${prefix}${body}`;
}

/** Partes para pintar "184,320" + ".50" con estilos distintos. */
export function splitMoney(amount: number) {
  const abs = Math.abs(Math.round(amount));
  return { whole: grouped.format(Math.floor(abs / 100)), cents: String(abs % 100).padStart(2, "0") };
}

/**
 * Convierte texto a centavos. Acepta "1,234.56", "1234.5", "1234,56" y "RD$ 1,234".
 * Devuelve null si no es un número válido.
 */
export function parseMoney(input: string): number | null {
  let s = input.replace(/[^\d.,-]/g, "").trim();
  if (!s || s === "-" || s === "." || s === ",") return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // El último separador es el decimal.
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    // Solo comas: decimal si hay 1-2 dígitos después de la última, si no son miles.
    const after = s.length - lastComma - 1;
    s = after > 0 && after <= 2 && s.indexOf(",") === lastComma ? s.replace(",", ".") : s.split(",").join("");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Centavos → texto editable sin símbolo: 178750 → "1787.50" */
export function centsToInput(amount: number) {
  const abs = Math.abs(amount);
  return abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
}

/** Suma por moneda. */
export function sumByCurrency<T>(items: T[], currency: (t: T) => string, amount: (t: T) => number) {
  const out: Record<string, number> = {};
  for (const it of items) out[currency(it)] = (out[currency(it)] ?? 0) + amount(it);
  return out;
}
