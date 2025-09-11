"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Account, getAccountById } from "@/lib/accounts";
import { useParams, useRouter } from "next/navigation";
import { AccountTransactionsList } from "@/components/accounts/account-transactions-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditAccountDialog } from "@/components/edit-account-dialog";
import { AccountTransactionDialog } from "@/components/account-transaction-dialog";
import { ArrowUpDown, ArrowDown, ArrowUp, Edit } from "lucide-react";
import { TransferDialog } from "@/components/transfer-dialog";
import { AccountSwitcher } from "@/components/accounts/account-switcher";

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [otherAccounts, setOtherAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccountData() {
      if (user && accountId) {
        setLoading(true);
        const fetchedAccount = await getAccountById(
          user.uid,
          accountId as string
        );
        if (fetchedAccount) {
          setAccount(fetchedAccount);

          // We'll also need to fetch other accounts for transfers
          const { getAccounts } = await import("@/lib/accounts");
          const allAccounts = await getAccounts(user.uid);
          setOtherAccounts(allAccounts.filter((acc) => acc.id !== accountId));
        } else {
          // If account doesn't exist, redirect to accounts list
          router.push("/accounts");
        }
        setLoading(false);
      }
    }

    fetchAccountData();
  }, [user, accountId, router]);

  const refreshAccount = useCallback(async () => {
    if (user && accountId) {
      const fetchedAccount = await getAccountById(
        user.uid,
        accountId as string
      );
      if (fetchedAccount) {
        setAccount(fetchedAccount);
        
        // Also refresh other accounts in case of transfers
        const { getAccounts } = await import("@/lib/accounts");
        const allAccounts = await getAccounts(user.uid);
        setOtherAccounts(allAccounts.filter((acc) => acc.id !== accountId));
      }
    }
  }, [user, accountId]);

  // Create a stable refresh function that doesn't cause loops
  const handleAccountChange = useCallback(async () => {
    await refreshAccount();
  }, [refreshAccount]);

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "checking":
        return "bg-blue-100 text-blue-800";
      case "savings":
        return "bg-green-100 text-green-800";
      case "investment":
        return "bg-purple-100 text-purple-800";
      case "credit":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-4 max-w-6xl space-y-4">
        {/* Header skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </div>

        {/* Balance and actions skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>

        {/* Transactions skeleton */}
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center bg-white dark:bg-gray-800 rounded-xl p-8 lg:p-12 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-2xl">🔍</span>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            Account Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            The account you're looking for doesn't exist or you don't have
            access to it.
          </p>
          <Button
            onClick={() => router.push("/accounts")}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Go to Accounts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto  max-w-2xl space-y-4">
      {/* Header Section - Fully Responsive */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          {/* Left side - Account info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-headline truncate">
                  {account.name}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    className={`${getAccountTypeColor(
                      account.type
                    )} text-xs font-medium`}
                    variant="secondary"
                  >
                    {account.type.charAt(0).toUpperCase() +
                      account.type.slice(1)}
                  </Badge>
                  {account.isDefault && (
                    <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium">
                      Default Account
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
            <div className="lg:hidden">
              <AccountSwitcher
                currentAccount={account}
                otherAccounts={otherAccounts}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/accounts")}
              size="sm"
              className="text-sm"
            >
              ← Back to Accounts
            </Button>
            <div className="hidden lg:block">
              <AccountSwitcher
                currentAccount={account}
                otherAccounts={otherAccounts}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Balance and Quick Actions Section - Two Column Layout on Large Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balance Card - Spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <Card className="h-full shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">
                    Current Balance
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                    {account.currency} • Last updated now
                  </CardDescription>
                </div>
                <div
                  className={`w-3 h-3 rounded-full ${
                    account.balance > 0
                      ? "bg-green-400 shadow-lg shadow-green-400/30"
                      : account.balance === 0
                      ? "bg-yellow-400 shadow-lg shadow-yellow-400/30"
                      : "bg-red-400 shadow-lg shadow-red-400/30"
                  }`}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div
                  className={`text-3xl lg:text-4xl font-bold ${
                    account.balance > 0
                      ? "text-green-600 dark:text-green-400"
                      : account.balance === 0
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: account.currency,
                  }).format(account.balance)}
                </div>

                {account.description && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {account.description}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Card */}
        <div className="lg:col-span-1">
          <Card className="h-full shadow-sm border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-gray-900 dark:text-white">
                Quick Actions
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                Manage your transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <AccountTransactionDialog
                account={account}
                transactionType="credit"
                onTransactionAdded={handleAccountChange}
              >
                <Button
                  className="w-full justify-start text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
                  variant="outline"
                  size="sm"
                >
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </AccountTransactionDialog>

              <AccountTransactionDialog
                account={account}
                transactionType="debit"
                onTransactionAdded={handleAccountChange}
              >
                <Button
                  className="w-full justify-start text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                  variant="outline"
                  size="sm"
                >
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </AccountTransactionDialog>

              <TransferDialog
                fromAccount={account}
                accounts={otherAccounts}
                onTransferCompleted={handleAccountChange}
              >
                <Button
                  className="w-full justify-start text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
                  variant="outline"
                  size="sm"
                  disabled={otherAccounts.length === 0}
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Transfer Funds
                </Button>
              </TransferDialog>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <EditAccountDialog
                  account={account}
                  onAccountUpdated={handleAccountChange}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-gray-600 dark:text-gray-400"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Account
                  </Button>
                </EditAccountDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="w-full">
        <AccountTransactionsList 
          account={account} 
          onTransactionChange={handleAccountChange}
        />
      </div>
    </div>
  );
}
