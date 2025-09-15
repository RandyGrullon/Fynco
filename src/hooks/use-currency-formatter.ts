"use client";

import { useCurrency } from "@/contexts/currency-context";
import { useAmountVisibility } from "@/contexts/amount-visibility-context";
import {
  formatCurrency as formatCurrencyUtil,
  getCurrencySymbol,
} from "@/lib/currency";

// Utility function for formatting currency without hooks
export function formatCurrencyStatic(
  amount: number,
  hideAmounts: boolean,
  currencyCode: string = "USD"
): string {
  if (hideAmounts) {
    return "••••";
  }
  return formatCurrencyUtil(amount, currencyCode);
}

export function useCurrencyFormatter() {
  const { currency } = useCurrency();
  const { hideAmounts } = useAmountVisibility();

  const formatCurrency = (
    amount: number,
    forChart: boolean = false
  ): string => {
    if (hideAmounts) {
      return "••••";
    }
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
