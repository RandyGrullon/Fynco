"use client";

import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useCallback } from "react";
import { Account, getAccounts } from "@/lib/accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import AccountsPageClient from "@/components/accounts/accounts-page-client";
import { AddAccountDialog } from "@/components/add-account-dialog";
import AccountsOverview from "@/components/accounts/accounts-overview";

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    if (user) {
      setLoading(true);
      const fetchedAccounts = await getAccounts(user.uid);
      setAccounts(fetchedAccounts);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Calculate total balance across all accounts
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="mt-6">
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          Accounts
        </h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={refreshData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/accounts/transactions")}
          >
            View All Transactions
          </Button>
          <AddAccountDialog onAccountAdded={refreshData} />
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Accounts List</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(totalBalance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all accounts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{accounts.length}</div>
                <p className="text-xs text-muted-foreground">Active accounts</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            {accounts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <p className="mb-4 text-center text-muted-foreground">
                    You don't have any accounts yet.
                  </p>
                  <AddAccountDialog onAccountAdded={refreshData}>
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create your first account
                    </Button>
                  </AddAccountDialog>
                </CardContent>
              </Card>
            ) : (
              <div>
                <AccountsPageClient
                  accounts={accounts}
                  refreshAccounts={refreshData}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <AccountsOverview accounts={accounts} />
        </TabsContent>
      </Tabs>
    </>
  );
}
