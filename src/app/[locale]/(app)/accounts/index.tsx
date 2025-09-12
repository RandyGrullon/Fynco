"use client";

import dynamicImport from "next/dynamic";

export const dynamic = 'force-dynamic';

const AccountsPageWrapper = dynamicImport(
  () => import("@/components/accounts/accounts-page-wrapper").then(mod => ({ default: mod.AccountsPageWrapper })),
  { ssr: false }
);

export default function AccountsPage() {
  return <AccountsPageWrapper />;
}
