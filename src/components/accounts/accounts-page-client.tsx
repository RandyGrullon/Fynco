"use client";

import React, { Suspense } from "react";
import { Account } from "@/lib/accounts";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountsList } from "@/components/accounts/accounts-list";

interface AccountsPageClientProps {
  accounts: Account[];
  refreshAccounts: () => Promise<void>;
}

const AccountsPageClient: React.FC<AccountsPageClientProps> = ({
  accounts,
  refreshAccounts,
}) => {
  return (
    <Suspense fallback={<Skeleton className="h-[500px]" />}>
      <AccountsList accounts={accounts} refreshAccounts={refreshAccounts} />
    </Suspense>
  );
};

export default AccountsPageClient;
