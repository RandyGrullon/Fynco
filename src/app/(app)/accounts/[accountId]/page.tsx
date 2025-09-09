"use client";

import { useState, useEffect } from "react";
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

  const refreshAccount = async () => {
    if (user && accountId) {
      const fetchedAccount = await getAccountById(
        user.uid,
        accountId as string
      );
      if (fetchedAccount) {
        setAccount(fetchedAccount);
      }
    }
  };

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
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Account Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The account you're looking for doesn't exist or you don't have access
          to it.
        </p>
        <Button onClick={() => router.push("/accounts")}>Go to Accounts</Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {account.name}
        </h1>
        <div className="flex items-center space-x-2">
          <AccountSwitcher
            currentAccount={account}
            otherAccounts={otherAccounts}
          />
          <Button variant="outline" onClick={() => router.push("/accounts")}>
            Back to Accounts
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              <Badge className={getAccountTypeColor(account.type)}>
                {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
              </Badge>
              {account.isDefault && (
                <Badge className="ml-2 bg-primary">Default</Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Balance
                </h3>
                <p className="text-3xl font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: account.currency,
                  }).format(account.balance)}
                </p>
              </div>

              {account.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Description
                  </h3>
                  <p>{account.description}</p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <EditAccountDialog
              account={account}
              onAccountUpdated={refreshAccount}
            >
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
            </EditAccountDialog>

            <AccountSwitcher
              currentAccount={account}
              otherAccounts={otherAccounts}
            />
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your account transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <AccountTransactionDialog
                account={account}
                transactionType="credit"
                onTransactionAdded={refreshAccount}
              >
                <Button className="w-full" variant="outline">
                  <ArrowUp className="mr-2 h-4 w-4 text-green-600" /> Add Income
                </Button>
              </AccountTransactionDialog>

              <AccountTransactionDialog
                account={account}
                transactionType="debit"
                onTransactionAdded={refreshAccount}
              >
                <Button className="w-full" variant="outline">
                  <ArrowDown className="mr-2 h-4 w-4 text-red-600" /> Add
                  Expense
                </Button>
              </AccountTransactionDialog>
            </div>

            <TransferDialog
              fromAccount={account}
              accounts={otherAccounts}
              onTransferCompleted={refreshAccount}
            >
              <Button className="w-full" variant="outline">
                <ArrowUpDown className="mr-2 h-4 w-4 text-blue-600" /> Transfer
                Money
              </Button>
            </TransferDialog>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <AccountTransactionsList account={account} />
      </div>
    </>
  );
}
