"use client";

import { CurrencyProvider } from "@/contexts/currency-context";
import { DataProvider } from "@/contexts/data-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { AmountVisibilityProvider } from "@/contexts/amount-visibility-context";
import React from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="fynco-theme">
      <CurrencyProvider>
        <AmountVisibilityProvider>
          <DataProvider>{children}</DataProvider>
        </AmountVisibilityProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}
