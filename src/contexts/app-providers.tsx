"use client";

import { CurrencyProvider } from "@/contexts/currency-context";
import { DataProvider } from "@/contexts/data-context";
import React from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <DataProvider>
        {children}
      </DataProvider>
    </CurrencyProvider>
  );
}
