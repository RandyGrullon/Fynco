"use client";

import { Transaction, getTransactions } from "@/lib/transactions";
import { columns } from "@/components/transactions/columns";
import { DataTable } from "@/components/transactions/data-table";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshTransactions = useCallback(async () => {
    if (user) {
      setLoading(true);
      const data = await getTransactions(user.uid);
      setTransactions(data);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshTransactions();
  }, [refreshTransactions]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold tracking-tight font-headline">
            Transactions
          </h2>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="space-y-4">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          Transactions
        </h2>
        <AddTransactionDialog onTransactionAdded={refreshTransactions} />
      </div>
      <DataTable
        data={transactions}
        columns={columns(refreshTransactions)}
        onRefresh={refreshTransactions}
      />
    </div>
  );
}
