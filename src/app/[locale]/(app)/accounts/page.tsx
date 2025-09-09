"use client";

import { redirect } from "next/navigation";

export default function LocaleAccountsPage() {
  redirect("/accounts");
  return null;
}
