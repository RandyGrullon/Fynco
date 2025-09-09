"use client";

import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useCallback } from "react";
import { Transaction, getTransactions } from "@/lib/transactions";
import { Account, getAccounts } from "@/lib/accounts";
import {
  RecurringTransactionWithAccount,
  getRecurringTransactions,
} from "@/lib/recurring-transactions";
import {
  StatisticsService,
  StatisticsSummary,
  TimePeriodFilter,
} from "@/lib/statistics";
import { StatisticsOverview } from "@/components/dashboard/statistics-overview";
import { ExportDialog } from "@/components/dashboard/export-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function StatisticsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransactionWithAccount[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriodFilter>("monthly");
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);

  const refreshData = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const [
          fetchedTransactions,
          fetchedAccounts,
          fetchedRecurringTransactions,
        ] = await Promise.all([
          getTransactions(user.uid),
          getAccounts(user.uid),
          getRecurringTransactions(user.uid),
        ]);

        setTransactions(fetchedTransactions);
        setAccounts(fetchedAccounts);
        setRecurringTransactions(fetchedRecurringTransactions);

        // Generate statistics summary
        const statisticsSummary = StatisticsService.generateSummary(
          fetchedTransactions,
          fetchedAccounts,
          fetchedRecurringTransactions,
          timePeriod
        );
        setSummary(statisticsSummary);
      } catch (error) {
        console.error("Error fetching data for statistics:", error);
      } finally {
        setLoading(false);
      }
    }
  }, [user, timePeriod]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Regenerate summary when time period changes
  useEffect(() => {
    if (transactions.length > 0 || accounts.length > 0) {
      const statisticsSummary = StatisticsService.generateSummary(
        transactions,
        accounts,
        recurringTransactions,
        timePeriod
      );
      setSummary(statisticsSummary);
    }
  }, [timePeriod, transactions, accounts, recurringTransactions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
            <Skeleton className="h-10 w-full sm:w-[180px]" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>

        {/* Key metrics skeleton */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        {/* Income vs expenses skeleton */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>

        {/* Financial health skeleton */}
        <Skeleton className="h-64" />

        {/* Bottom cards skeleton */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          No data available for statistics generation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">
            Statistics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive financial overview and insights
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={timePeriod}
            onValueChange={(value: TimePeriodFilter) => setTimePeriod(value)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Last 30 days</SelectItem>
              <SelectItem value="weekly">Last 12 weeks</SelectItem>
              <SelectItem value="monthly">Last 12 months</SelectItem>
              <SelectItem value="quarterly">Last 4 quarters</SelectItem>
              <SelectItem value="yearly">Last 3 years</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            {summary && (
              <ExportDialog
                summary={summary}
                transactions={transactions}
                accounts={accounts}
                recurringTransactions={recurringTransactions}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Overview Component */}
      <StatisticsOverview summary={summary} timePeriod={timePeriod} />
    </div>
  );
}
