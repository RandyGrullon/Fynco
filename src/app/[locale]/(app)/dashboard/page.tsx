"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Overview } from "@/components/dashboard/overview";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import {
  DollarSign,
  CreditCard,
  ArrowDown,
  ArrowUp,
  Wallet,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslations } from "next-intl";
import { Transaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import Link from "next/link";
import {
  TimeFilter,
  TimeFilterPeriod,
} from "@/components/dashboard/time-filter";
import {
  isAfter,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/data-context";
import { OptimizedLoading } from "@/components/ui/optimized-loading";
import { useFilteredTransactions, useTransactionStats } from "@/hooks/use-filtered-transactions";

export default function DashboardPage() {
  const { user } = useAuth();
  const { transactions, accounts, isLoading, refreshData } = useData();
  const [timePeriod, setTimePeriod] = useState<TimeFilterPeriod>("monthly");
  const { formatCurrency } = useCurrencyFormatter();
  const t = useTranslations();
  
  // Use optimized filtered transactions and stats
  const filteredTransactions = useFilteredTransactions(transactions, timePeriod);
  const transactionStats = useTransactionStats(filteredTransactions);

  // Filter transactions based on time period
  const filterTransactionsByPeriod = (transactions: Transaction[]) => {
    if (timePeriod === "all") return transactions;

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date.toString());
      const today = new Date();

      switch (timePeriod) {
        case "daily":
          return isAfter(transactionDate, subDays(today, 30)); // Last 30 days
        case "weekly":
          return isAfter(transactionDate, subWeeks(today, 12)); // Last 12 weeks
        case "monthly":
          return isAfter(transactionDate, subMonths(today, 12));
        case "quarterly":
          return isAfter(transactionDate, subQuarters(today, 4));
        case "yearly":
          return isAfter(transactionDate, subYears(today, 3));
        default:
          return true;
      }
    });
  };

  // Calculations
  // Filter out transactions without an account and apply time filter
  const validTransactions = transactions
    .filter((t) => t.accountId)
    .filter((transaction) => {
      if (timePeriod === "all") return true;

      const transactionDate = new Date(transaction.date.toString());
      const today = new Date();

      switch (timePeriod) {
        case "daily":
          return isAfter(transactionDate, subDays(today, 30)); // Last 30 days
        case "weekly":
          return isAfter(transactionDate, subWeeks(today, 12)); // Last 12 weeks
        case "monthly":
          return isAfter(transactionDate, subMonths(today, 12));
        case "quarterly":
          return isAfter(transactionDate, subQuarters(today, 4));
        case "yearly":
          return isAfter(transactionDate, subYears(today, 3));
        default:
          return true;
      }
    });

  const totalIncome = validTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = validTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  // Net income is now the total of all account balances
  const netIncome = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalTransactions = validTransactions.length;

  if (isLoading) {
    return <OptimizedLoading type="dashboard" />;
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          {t('dashboard.title')}
        </h2>
        <div className="flex items-center space-x-2">
          <TimeFilter
            selectedPeriod={timePeriod}
            onPeriodChange={(period) => setTimePeriod(period)}
          />
          {/* Add transaction UI removed */}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('financial.totalBalance')}</CardTitle>
            {netIncome >= 0 ? (
              <ArrowUp className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('financial.allAccountsCombined')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('financial.totalIncome')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {timePeriod === "all"
                ? t('financial.allTimeIncome')
                : timePeriod === "daily"
                ? t('financial.last30Days')
                : timePeriod === "weekly"
                ? t('financial.last12Weeks')
                : timePeriod === "monthly"
                ? t('financial.last12Months')
                : timePeriod === "quarterly"
                ? t('financial.last4Quarters')
                : t('financial.last3Years')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('financial.totalExpenses')}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              {timePeriod === "all"
                ? t('financial.allTimeExpenses')
                : timePeriod === "daily"
                ? t('financial.last30Days')
                : timePeriod === "weekly"
                ? t('financial.last12Weeks')
                : timePeriod === "monthly"
                ? t('financial.last12Months')
                : timePeriod === "quarterly"
                ? t('financial.last4Quarters')
                : t('financial.last3Years')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('financial.financialHub')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p className="text-muted-foreground mb-2">
                {t('financial.comprehensiveReports')}
              </p>
              <Link href="/statistics">
                <Button variant="outline" size="sm" className="w-full">
                  {t('financial.goToStatistics')}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-1 lg:col-span-4">
          <Overview data={validTransactions} timePeriod={timePeriod} />
        </div>
        <div className="col-span-1 lg:col-span-3">
          <RecentTransactions
            transactions={validTransactions.slice(0, 6)}
            totalCount={validTransactions.length}
            accounts={accounts}
          />
        </div>
      </div>
    </>
  );
}
