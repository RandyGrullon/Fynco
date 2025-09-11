"use client";

import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useCallback, useRef } from "react";
import { Transaction, getTransactions } from "@/lib/transactions";
import { Account, getAccounts } from "@/lib/accounts";
import {
  RecurringTransactionWithAccount,
  getRecurringTransactions,
} from "@/lib/recurring-transactions";
import { Goal, getGoals } from "@/lib/goals";
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
// replaced Tabs with a responsive section layout (left nav on desktop, collapsible sections on mobile)
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  RefreshCw,
  FileDown,
  PiggyBank,
  Calendar,
  Wallet,
  ChevronRight,
  ArrowLeftRight,
} from "lucide-react";
import { AccountsList } from "@/components/accounts/accounts-list";
import { RecurringTransactionsList } from "@/components/recurring/recurring-transactions-list";
import { GoalsList } from "@/components/goals/goals-list";
import { TransferCardList } from "@/components/transfers/transfer-card-list";

export default function StatisticsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransactionWithAccount[]
  >([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriodFilter>("monthly");
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  // responsive section visibility (collapsed state). on mobile some sections start collapsed
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  const overviewRef = useRef<HTMLDivElement | null>(null);
  const accountsRef = useRef<HTMLDivElement | null>(null);
  const transactionsRef = useRef<HTMLDivElement | null>(null);
  const transfersRef = useRef<HTMLDivElement | null>(null);
  const goalsRef = useRef<HTMLDivElement | null>(null);
  const recurringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const isSmall = typeof window !== "undefined" && window.innerWidth < 768;
    setCollapsedSections({
      overview: false,
      accounts: isSmall,
      transactions: isSmall,
      transfers: isSmall,
      goals: isSmall,
      recurring: isSmall,
    });
  }, []);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollTo = (ref: { current: HTMLElement | null } | null) => {
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const refreshData = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const [
          fetchedTransactions,
          fetchedAccounts,
          fetchedRecurringTransactions,
          fetchedGoals,
        ] = await Promise.all([
          getTransactions(user.uid),
          getAccounts(user.uid),
          getRecurringTransactions(user.uid),
          getGoals(user.uid),
        ]);

        setTransactions(fetchedTransactions);
        setAccounts(fetchedAccounts);
        setRecurringTransactions(fetchedRecurringTransactions);
        setGoals(fetchedGoals);

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

        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-full" />

        {/* Content skeleton */}
        <div className="grid gap-4 grid-cols-1">
          <Skeleton className="h-[600px]" />
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
            Financial Hub
          </h1>
          <p className="text-muted-foreground">
            Comprehensive financial overview, reports, and exports
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

      {/* Responsive sections layout
          - left navigation on md+ screens
          - collapsible sections on small screens
      */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left navigation (desktop) */}
        <aside className="hidden md:block md:col-span-1">
          <nav className="sticky top-24 space-y-2">
            <button
              onClick={() => scrollTo(overviewRef)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <BarChart className="h-4 w-4" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => scrollTo(accountsRef)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Wallet className="h-4 w-4" />
              <span>Accounts</span>
            </button>
            {/* Transactions section removed from UI (kept in logic) */}
            <button
              onClick={() => scrollTo(transfersRef)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>Transfers</span>
            </button>
            <button
              onClick={() => scrollTo(goalsRef)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <PiggyBank className="h-4 w-4" />
              <span>Goals</span>
            </button>
            <button
              onClick={() => scrollTo(recurringRef)}
              className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Calendar className="h-4 w-4" />
              <span>Recurring</span>
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="md:col-span-3 space-y-6">
          {/* Overview */}
          <div ref={overviewRef} id="overview" className="space-y-4">
            <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">
                  Overview
                </h2>
                {/* collapse toggle for mobile */}
                <button
                  onClick={() => toggleSection("overview")}
                  className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-expanded={!collapsedSections["overview"]}
                >
                  <ChevronRight
                    className={`transition-transform ${
                      collapsedSections["overview"] ? "rotate-0" : "rotate-90"
                    }`}
                  />
                </button>
              </div>

              {!collapsedSections["overview"] && (
                <StatisticsOverview summary={summary} timePeriod={timePeriod} />
              )}
            </div>
          </div>

          {/* Accounts */}
          <div ref={accountsRef} id="accounts" className="space-y-4">
            <div className="rounded-lg border-2 border-emerald-200 dark:border-emerald-900 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                    Accounts Summary
                  </h2>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    Overview of all your financial accounts
                  </p>
                </div>
                <button
                  onClick={() => toggleSection("accounts")}
                  className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-expanded={!collapsedSections["accounts"]}
                >
                  <ChevronRight
                    className={`transition-transform ${
                      collapsedSections["accounts"] ? "rotate-0" : "rotate-90"
                    }`}
                  />
                </button>
              </div>

              {!collapsedSections["accounts"] && (
                <AccountsList
                  accounts={accounts}
                  refreshAccounts={refreshData}
                />
              )}
            </div>
          </div>

          {/* Transactions */}
          <div ref={transactionsRef} id="transactions" className="space-y-4">
            <div className="rounded-lg border-2 border-amber-200 dark:border-amber-900 p-4 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-amber-800 dark:text-amber-300 mb-1">
                    Transactions History
                  </h2>
                  <p className="text-amber-700 dark:text-amber-400">
                    All transactions across all your accounts
                  </p>
                </div>
                <button
                  onClick={() => toggleSection("transactions")}
                  className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-expanded={!collapsedSections["transactions"]}
                >
                  <ChevronRight
                    className={`transition-transform ${
                      collapsedSections["transactions"]
                        ? "rotate-0"
                        : "rotate-90"
                    }`}
                  />
                </button>
              </div>

              {!collapsedSections["transactions"] && (
                <div className="p-4 text-sm text-muted-foreground">
                  Transactions UI has been removed. Transaction data is still
                  available for statistics and background logic.
                </div>
              )}
            </div>
          </div>

          {/* Transfers */}
          <div ref={transfersRef} id="transfers" className="space-y-4">
            <div className="rounded-lg border-2 border-indigo-200 dark:border-indigo-900 p-4 bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/50 dark:to-indigo-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-indigo-800 dark:text-indigo-300 mb-1">
                    Account Transfers
                  </h2>
                  <p className="text-indigo-700 dark:text-indigo-400">
                    Move funds between your accounts
                  </p>
                </div>
                <button
                  onClick={() => toggleSection("transfers")}
                  className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-expanded={!collapsedSections["transfers"]}
                >
                  <ChevronRight
                    className={`transition-transform ${
                      collapsedSections["transfers"] ? "rotate-0" : "rotate-90"
                    }`}
                  />
                </button>
              </div>

              {!collapsedSections["transfers"] && (
                <TransferCardList
                  accounts={accounts}
                  onTransferCompleted={refreshData}
                />
              )}
            </div>
          </div>

          {/* Goals */}
          <div ref={goalsRef} id="goals" className="space-y-4">
            <div className="rounded-lg border-2 border-purple-200 dark:border-purple-900 p-4 bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-purple-800 dark:text-purple-300 mb-1">
                    Financial Goals
                  </h2>
                  <p className="text-purple-700 dark:text-purple-400">
                    Track progress on your savings goals
                  </p>
                </div>
                <button
                  onClick={() => toggleSection("goals")}
                  className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-expanded={!collapsedSections["goals"]}
                >
                  <ChevronRight
                    className={`transition-transform ${
                      collapsedSections["goals"] ? "rotate-0" : "rotate-90"
                    }`}
                  />
                </button>
              </div>

              {!collapsedSections["goals"] && <GoalsList goals={goals} />}
            </div>
          </div>

          {/* Recurring */}
          <div ref={recurringRef} id="recurring" className="space-y-4">
            <div className="rounded-lg border-2 border-pink-200 dark:border-pink-900 p-4 bg-gradient-to-r from-pink-50 to-pink-100/50 dark:from-pink-950/50 dark:to-pink-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-pink-800 dark:text-pink-300 mb-1">
                    Recurring Transactions
                  </h2>
                  <p className="text-pink-700 dark:text-pink-400">
                    All your scheduled recurring payments and income
                  </p>
                </div>
                <button
                  onClick={() => toggleSection("recurring")}
                  className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-expanded={!collapsedSections["recurring"]}
                >
                  <ChevronRight
                    className={`transition-transform ${
                      collapsedSections["recurring"] ? "rotate-0" : "rotate-90"
                    }`}
                  />
                </button>
              </div>

              {!collapsedSections["recurring"] && (
                <RecurringTransactionsList
                  transactions={recurringTransactions}
                  accounts={accounts}
                  onTransactionUpdated={refreshData}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
