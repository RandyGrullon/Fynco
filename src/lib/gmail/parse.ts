// Lectura de las alertas del banco con reglas fijas (sin IA).
// Formatos verificados con correos reales de notificaciones@popularenlinea.com.
// Si un correo no encaja aquí, el sincronizador se lo pasa a la IA.
import { parseMoney } from "@/lib/money";

export type ParsedEmail =
  | {
      type: "card_charge";
      cardName: string;
      last4: string;
      /** Centavos, siempre positivo, en la moneda del correo. */
      amount: number;
      currency: string;
      occurredOn: string;
      merchant: string;
      status: string;
      approved: boolean;
    }
  | { type: "cash_withdrawal"; amount: number; currency: string; occurredOn: string | null; approved: boolean }
  | { type: "payroll"; last4: string | null; amount: number | null; currency: string; occurredOn: string | null };

/** Quita guiones suaves, espacios raros, tablas en markdown y deja un solo espacio. */
export function cleanText(s: string): string {
  return s
    .replace(/[­​-‍﻿]/g, "")
    .replace(/ /g, " ")
    .replace(/\|?\s*-{3,}\s*\|/g, " ")
    .replace(/\|/g, " ")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CURRENCY_PREFIXES: [RegExp, string][] = [
  [/^(?:RD|DOP)\$?$/i, "DOP"],
  [/^(?:US|USD)\$?$/i, "USD"],
  [/^(?:EUR\$?|€)$/i, "EUR"],
];

/** "RD$4,704.75" | "US$7.56" | "EUR$25.15" | "RD 4,800.00" → { currency, amount (centavos) } */
export function parseCurrencyAmount(token: string): { currency: string; amount: number } | null {
  const m = token.trim().match(/^(RD\$?|DOP\$?|US\$?|USD\$?|EUR\$?|€)\s*([\d.,]+)$/i);
  if (!m) return null;
  const currency = CURRENCY_PREFIXES.find(([re]) => re.test(m[1]))?.[1];
  const amount = parseMoney(m[2]);
  if (!currency || !amount || amount <= 0) return null;
  return { currency, amount };
}

/** "12/10/2026" o "7/6/2026" (día/mes/año) → "2026-10-12" */
export function parseDMY(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const APPROVED = /^aprobad[ao]$/i;

/** "Notificación de Consumo": tarjeta de crédito o débito del Popular. */
export function parsePopularConsumo(raw: string): Extract<ParsedEmail, { type: "card_charge" }> | null {
  const text = cleanText(raw);
  const card = text.match(/Gracias por utilizar su (.+?),? terminada en (\d{4})/i);
  const row = text.match(
    /Estatus\s+(\S+)\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(\S+)\s+(?:En caso|Estamos|Atentamente|De no reconocer)/i,
  );
  if (!card || !row) return null;
  const money = parseCurrencyAmount(row[1]);
  const occurredOn = parseDMY(row[3]);
  if (!money || !occurredOn) return null;
  const status = row[5];
  return {
    type: "card_charge",
    cardName: card[1].trim(),
    last4: card[2],
    amount: money.amount,
    currency: money.currency,
    occurredOn,
    merchant: row[4].trim(),
    status,
    approved: APPROVED.test(status),
  };
}

/** "Notificación de retiro Código Cash": retiro en cajero desde la cuenta. */
export function parsePopularCodigoCash(raw: string): Extract<ParsedEmail, { type: "cash_withdrawal" }> | null {
  const text = cleanText(raw);
  if (!/c[oó]digo cash/i.test(text)) return null;
  const row = text.match(/Estatus\s+((?:RD|US)\$?)\s?([\d.,]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\S+)/i);
  if (!row) return null;
  const money = parseCurrencyAmount(`${row[1]}${row[2]}`);
  if (!money) return null;
  return { type: "cash_withdrawal", amount: money.amount, currency: money.currency, occurredOn: parseDMY(row[3]), approved: APPROVED.test(row[4]) };
}

/** "Notificación Depósito de Nómina": avisa el depósito pero no siempre trae el monto. */
export function parsePopularNomina(raw: string): Extract<ParsedEmail, { type: "payroll" }> | null {
  const text = cleanText(raw);
  if (!/n[oó]mina/i.test(text)) return null;
  const last4 = text.match(/cuenta terminada en (\d{4})/i)?.[1] ?? null;
  const ymd = text.match(/en fecha (\d{4})(\d{2})(\d{2})/);
  const occurredOn = ymd ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : null;
  const amountToken = text.match(/(?:RD|US)\$\s?[\d.,]+\d/)?.[0];
  const money = amountToken ? parseCurrencyAmount(amountToken.replace(/\s/g, "")) : null;
  return { type: "payroll", last4, amount: money?.amount ?? null, currency: money?.currency ?? "DOP", occurredOn };
}

/** Correos del Popular que no son movimientos (promociones, avisos, límites). */
const POPULAR_NOISE = /publicidad|mantenimiento|l[ií]mite|derechos y deberes|horario|nota de prensa|estado de cuenta/i;

/**
 * Intenta leer el correo con reglas. Devuelve:
 * - un movimiento si el formato es conocido,
 * - "noise" si es del banco pero no es un movimiento,
 * - null si no se reconoce (para que lo vea la IA).
 */
export function parseBankEmail(email: { sender: string; subject: string; text: string }): ParsedEmail | "noise" | null {
  const sender = email.sender.toLowerCase();
  if (!sender.includes("popularenlinea.com") && !sender.includes("bpd.com.do")) return null;
  const subject = email.subject;
  if (/consumo/i.test(subject)) return parsePopularConsumo(email.text);
  if (/c[oó]digo cash/i.test(subject)) return parsePopularCodigoCash(email.text);
  if (/n[oó]mina/i.test(subject)) return parsePopularNomina(email.text);
  if (POPULAR_NOISE.test(subject)) return "noise";
  return null;
}

/** "SEGUROS RESERVAS INTERM 3" → "Seguros Reservas Interm 3"; deja igual lo que ya trae minúsculas. */
export function prettyMerchant(m: string): string {
  const s = m.replace(/\s+/g, " ").trim().slice(0, 120);
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s.&/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// Palabras clave → categoría del sistema (respaldo cuando no hay IA).
const CATEGORY_RULES: [RegExp, string][] = [
  [/uber|didi|indriver|cabify|shell|texaco|esso|gulf|total ?energies|sunix|\bisla\b|peaje|parqueo|parking/i, "Transporte"],
  [/sirena|jumbo|nacional|bravo|pricesmart|carrefour|ole\b|plaza lama|supermercado|colmado|aldi|lidl|rewe|edeka/i, "Supermercado"],
  [/pedidos ?ya|wolt|uber ?eats|rappi|mcdonald|burger|pizza|kfc|wendy|starbucks|caf[eé]|restaurant|bar\b|cafeter/i, "Comida"],
  [/netflix|spotify|disney|hbo|max\b|youtube|apple\.com|icloud|google|workspace|openai|anthropic|claude|chatgpt|microsoft|github|vercel|supabase/i, "Suscripciones"],
  [/farmacia|carol|cl[ií]nica|hospital|laboratorio|referencia|amadita|\bars\b/i, "Salud"],
  [/edenorte|edesur|edeeste|claro|altice|viva\b|wind|caasd|internet|telecom/i, "Servicios"],
  [/amazon|ebay|temu|shein|aliexpress|zara|h&m|ikea|tienda|store|shop/i, "Compras"],
  [/airbnb|booking|hotel|jetblue|arajet|american airlines|iberia|lufthansa|ryanair|easyjet|bahn|sncf|flixbus|aeropuerto|airport/i, "Viajes"],
  [/cine|caribbean cinemas|palacio del cine|steam|playstation|xbox|nintendo|ticket|bowling|bolera/i, "Entretenimiento"],
  [/universidad|udemy|coursera|libro|librer/i, "Educación"],
];

export function guessCategory(merchant: string): string | null {
  for (const [re, name] of CATEGORY_RULES) if (re.test(merchant)) return name;
  return null;
}
