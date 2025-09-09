"use client";

import { useCurrency } from "@/contexts/currency-context";
import {
  formatCurrency as formatCurrencyUtil,
  getCurrencySymbol,
} from "@/lib/currency";

export function useCurrencyFormatter() {
  const { currency } = useCurrency();

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currency.code);
  };

  const getSymbol = (): string => {
    return getCurrencySymbol(currency.code);
  };

  return {
    formatCurrency,
    getSymbol,
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
  };
}
