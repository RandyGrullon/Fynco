"use client";

import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useCallback } from "react";
import {
  RecurringTransaction,
  RecurringTransactionWithAccount,
  getRecurringTransactions,
} from "@/lib/recurring-transactions";
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
import { AddRecurringTransactionDialog } from "@/components/recurring/add-recurring-transaction-dialog";
import RecurringTransactionsList from "@/components/recurring/recurring-transactions-list";

export default function RecurringTransactionsPage() {
  const { user } = useAuth();
  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransactionWithAccount[]
  >([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    if (user) {
      setLoading(true);
      const [fetchedTransactions, fetchedAccounts] = await Promise.all([
        getRecurringTransactions(user.uid),
        getAccounts(user.uid),
      ]);
      setRecurringTransactions(fetchedTransactions);
      setAccounts(fetchedAccounts);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Calculate summary statistics
  const activeRecurringCount = recurringTransactions.filter(
    (t) => t.isActive
  ).length;
  const monthlyIncome = recurringTransactions
    .filter(
      (t) => t.isActive && t.type === "income" && t.frequency === "monthly"
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpenses = recurringTransactions
    .filter(
      (t) => t.isActive && t.type === "expense" && t.frequency === "monthly"
    )
    .reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <Skeleton className="h-9 w-48" />
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 mb-4">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          Recurring Transactions
        </h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <Button
            variant="outline"
            size="icon"
            onClick={refreshData}
            className="shrink-0"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <AddRecurringTransactionDialog
            accounts={accounts}
            onTransactionAdded={refreshData}
          />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Recurring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRecurringCount}</div>
            <p className="text-xs text-muted-foreground">
              Active recurring transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(monthlyIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              Expected monthly recurring income
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(monthlyExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Expected monthly recurring expenses
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4 w-full sm:w-auto">
          <TabsTrigger value="all" className="flex-1 sm:flex-none">
            All
          </TabsTrigger>
          <TabsTrigger value="income" className="flex-1 sm:flex-none">
            Income
          </TabsTrigger>
          <TabsTrigger value="expense" className="flex-1 sm:flex-none">
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {recurringTransactions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10">
                <p className="mb-4 text-center text-sm sm:text-base text-muted-foreground">
                  You don't have any recurring transactions yet.
                </p>
                <AddRecurringTransactionDialog
                  accounts={accounts}
                  onTransactionAdded={refreshData}
                >
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create your first recurring transaction
                  </Button>
                </AddRecurringTransactionDialog>
              </CardContent>
            </Card>
          ) : (
            <RecurringTransactionsList
              transactions={recurringTransactions}
              accounts={accounts}
              onTransactionUpdated={refreshData}
            />
          )}
        </TabsContent>

        <TabsContent value="income">
          {recurringTransactions.filter((t) => t.type === "income").length ===
          0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10">
                <p className="mb-4 text-center text-sm sm:text-base text-muted-foreground">
                  You don't have any recurring income yet.
                </p>
                <AddRecurringTransactionDialog
                  accounts={accounts}
                  onTransactionAdded={refreshData}
                  initialType="income"
                >
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add recurring income
                  </Button>
                </AddRecurringTransactionDialog>
              </CardContent>
            </Card>
          ) : (
            <RecurringTransactionsList
              transactions={recurringTransactions.filter(
                (t) => t.type === "income"
              )}
              accounts={accounts}
              onTransactionUpdated={refreshData}
            />
          )}
        </TabsContent>

        <TabsContent value="expense">
          {recurringTransactions.filter((t) => t.type === "expense").length ===
          0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-10">
                <p className="mb-4 text-center text-sm sm:text-base text-muted-foreground">
                  You don't have any recurring expenses yet.
                </p>
                <AddRecurringTransactionDialog
                  accounts={accounts}
                  onTransactionAdded={refreshData}
                  initialType="expense"
                >
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add recurring expense
                  </Button>
                </AddRecurringTransactionDialog>
              </CardContent>
            </Card>
          ) : (
            <RecurringTransactionsList
              transactions={recurringTransactions.filter(
                (t) => t.type === "expense"
              )}
              accounts={accounts}
              onTransactionUpdated={refreshData}
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
