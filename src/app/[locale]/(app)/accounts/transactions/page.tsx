"use client";

import { redirect } from "next/navigation";

export default function LocaleAccountTransactionsPage() {
  redirect("/accounts/transactions");
  return null;
}
