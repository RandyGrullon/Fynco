"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatisticsSummary } from "@/lib/statistics";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  ArrowRight,
  Target,
} from "lucide-react";

interface StatisticsSummaryCardProps {
  summary: StatisticsSummary;
}

export function StatisticsSummaryCard({ summary }: StatisticsSummaryCardProps) {
  const { formatCurrency } = useCurrencyFormatter();

  const getFinancialHealthColor = (savingsRate: number) => {
    if (savingsRate >= 20) return "text-green-600";
    if (savingsRate >= 10) return "text-yellow-600";
    if (savingsRate >= 0) return "text-blue-600";
    return "text-red-600";
  };

  const getExpenseRatioStatus = (ratio: number) => {
    if (ratio <= 0.7) return { text: "Excellent", color: "text-green-600" };
    if (ratio <= 0.8) return { text: "Good", color: "text-blue-600" };
    if (ratio <= 0.9) return { text: "Fair", color: "text-yellow-600" };
    if (ratio <= 1.0) return { text: "Poor", color: "text-orange-600" };
    return { text: "Critical", color: "text-red-600" };
  };

  const expenseRatioStatus = getExpenseRatioStatus(
    summary.expenseToIncomeRatio
  );

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Financial Summary
          </CardTitle>
          <Link href="/statistics">
            <Button variant="outline" size="sm">
              View Details
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Savings Rate */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Savings Rate</span>
              </div>
              <Badge
                variant="outline"
                className={getFinancialHealthColor(summary.savingsRate)}
              >
                {summary.savingsRate.toFixed(1)}%
              </Badge>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, summary.savingsRate))}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {summary.savingsRate >= 20
                ? "Excellent savings habit!"
                : summary.savingsRate >= 10
                ? "Good savings progress"
                : summary.savingsRate >= 0
                ? "Building savings"
                : "Consider reducing expenses"}
            </p>
          </div>

          {/* Expense Ratio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Expense Ratio</span>
              </div>
              <Badge variant="outline" className={expenseRatioStatus.color}>
                {expenseRatioStatus.text}
              </Badge>
            </div>
            <div className="text-2xl font-bold">
              {summary.expenseToIncomeRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Expenses / Income ratio
            </p>
          </div>

          {/* Monthly Comparison */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">This Month</span>
              {summary.thisMonthIncome - summary.thisMonthExpenses >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Income</span>
                <span>{formatCurrency(summary.thisMonthIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Expenses</span>
                <span>{formatCurrency(summary.thisMonthExpenses)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t pt-1">
                <span>Net</span>
                <span
                  className={
                    summary.thisMonthIncome - summary.thisMonthExpenses >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {formatCurrency(
                    summary.thisMonthIncome - summary.thisMonthExpenses
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold">{summary.totalAccounts}</div>
              <div className="text-xs text-muted-foreground">Accounts</div>
            </div>
            <div>
              <div className="text-lg font-bold">
                {summary.totalTransactions.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Transactions</div>
            </div>
            <div>
              <div className="text-lg font-bold">
                {summary.activeRecurringTransactions}
              </div>
              <div className="text-xs text-muted-foreground">Recurring</div>
            </div>
            <div>
              <div className="text-lg font-bold">
                {summary.topExpenseCategories.length > 0
                  ? summary.topExpenseCategories[0].category
                  : "N/A"}
              </div>
              <div className="text-xs text-muted-foreground">Top Category</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
