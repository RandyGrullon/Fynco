"use client";

import { CurrencyProvider } from "@/contexts/currency-context";
import React from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <CurrencyProvider>{children}</CurrencyProvider>;
}
