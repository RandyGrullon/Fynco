// Reglas puras para decidir a qué cuenta va cada alerta y convertir monedas.

export interface MatchableAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  last4: string | null;
  is_default: boolean;
  archived_at: string | null;
}

/**
 * Cuenta para un cargo con tarjeta terminada en `last4` en moneda `currency`.
 * - Misma terminación y misma moneda: esa.
 * - Una sola cuenta con esa terminación: esa (hay que convertir).
 * - Tarjeta de doble saldo (pesos y dólares): lo extranjero va al saldo en dólares.
 */
export function matchCardAccount<T extends MatchableAccount>(accounts: T[], last4: string, currency: string): { account: T; convert: boolean } | null {
  const candidates = accounts.filter((a) => !a.archived_at && a.last4 === last4);
  if (!candidates.length) return null;
  const exact = candidates.find((a) => a.currency === currency);
  if (exact) return { account: exact, convert: false };
  if (candidates.length === 1) return { account: candidates[0], convert: true };
  const usd = candidates.find((a) => a.currency === "USD");
  return { account: usd ?? candidates[0], convert: true };
}

/** Cuenta de efectivo para los retiros en cajero. */
export function cashAccount<T extends MatchableAccount>(accounts: T[]): T | null {
  return accounts.find((a) => !a.archived_at && a.type === "cash") ?? null;
}

/** Tasas por dólar (USD = 1). Respaldo si no hay internet: aproximadas a octubre de 2026. */
export const FALLBACK_RATES: Record<string, number> = { USD: 1, DOP: 62, EUR: 0.86 };

export function convertCents(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return amount;
  const rf = rates[from];
  const rt = rates[to];
  if (!rf || !rt) return null;
  return Math.round((amount * rt) / rf);
}

/** Tasas del día (open.er-api.com, sin llave). Si falla, las de respaldo. */
export async function fetchRates(): Promise<{ rates: Record<string, number>; live: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error("rates");
    const body = (await res.json()) as { rates?: Record<string, number> };
    if (!body.rates?.DOP || !body.rates?.EUR) throw new Error("rates");
    return { rates: { ...FALLBACK_RATES, ...body.rates }, live: true };
  } catch {
    return { rates: FALLBACK_RATES, live: false };
  } finally {
    clearTimeout(timer);
  }
}
