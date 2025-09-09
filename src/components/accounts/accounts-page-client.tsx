"use client";

import React from "react";
import { Account } from "@/lib/accounts";
import { Skeleton } from "@/components/ui/skeleton";

interface AccountsPageClientProps {
  accounts: Account[];
  refreshAccounts: () => Promise<void>;
}

const AccountsPageClient: React.FC<AccountsPageClientProps> = ({
  accounts,
  refreshAccounts,
}) => {
  const [AccountsList, setAccountsList] =
    React.useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadComponent = async () => {
      try {
        const module = await import("@/components/accounts/accounts-list");
        setAccountsList(() => module.default);
      } catch (error) {
        console.error("Error loading AccountsList component:", error);
      } finally {
        setLoading(false);
      }
    };

    loadComponent();
  }, []);

  if (loading) {
    return <Skeleton className="h-[500px]" />;
  }

  if (!AccountsList) {
    return <div>Could not load accounts list component.</div>;
  }

  return <AccountsList accounts={accounts} refreshAccounts={refreshAccounts} />;
};

export default AccountsPageClient;
