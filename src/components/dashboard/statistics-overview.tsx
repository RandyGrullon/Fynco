"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatisticsSummary, TimePeriodFilter } from "@/lib/statistics";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  PiggyBank,
  Target,
  Users,
  Calendar,
  BarChart3,
  Calculator,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface StatisticsOverviewProps {
  summary: StatisticsSummary;
  timePeriod: TimePeriodFilter;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function StatisticsOverview({
  summary,
  timePeriod,
}: StatisticsOverviewProps) {
  const { formatCurrency, currencySymbol } = useCurrencyFormatter();

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case "daily":
        return "Last 30 days";
      case "weekly":
        return "Last 12 weeks";
      case "monthly":
        return "Last 12 months";
      case "quarterly":
        return "Last 4 quarters";
      case "yearly":
        return "Last 3 years";
      case "all":
        return "All time";
      default:
        return "All time";
    }
  };

  const getPercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const incomeChange = getPercentageChange(
    summary.thisMonthIncome,
    summary.lastMonthIncome
  );
  const expenseChange = getPercentageChange(
    summary.thisMonthExpenses,
    summary.lastMonthExpenses
  );

  // Format data for charts
  const topExpenseData = summary.topExpenseCategories.slice(0, 5);
  const monthlyTrendsData = summary.monthlyTrends.slice(-6); // Last 6 months

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">
            Financial Statistics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive overview for {getTimePeriodLabel().toLowerCase()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            {getTimePeriodLabel()}
          </Badge>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {summary.totalAccounts} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            {summary.netIncome >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              Income - Expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.savingsRate.toFixed(1)}%
            </div>
            <Progress
              value={Math.max(0, Math.min(100, summary.savingsRate))}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalTransactions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.transactionsThisMonth} this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Comparison */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Month Income
            </CardTitle>
            {incomeChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.thisMonthIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {incomeChange >= 0 ? "+" : ""}
              {incomeChange.toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Month Expenses
            </CardTitle>
            {expenseChange <= 0 ? (
              <TrendingDown className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingUp className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.thisMonthExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenseChange >= 0 ? "+" : ""}
              {expenseChange.toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recurring Transactions
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.activeRecurringTransactions}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalRecurringTransactions} total configured
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Trends */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `${currencySymbol}${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    borderColor: "hsl(var(--border))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="hsl(var(--chart-2))"
                  name="Income"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="hsl(var(--chart-1))"
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="netIncome"
                  stroke="hsl(var(--chart-3))"
                  name="Net Income"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Expense Categories */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Top Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topExpenseData}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ category, percentage }) =>
                    `${category} (${percentage.toFixed(1)}%)`
                  }
                >
                  {topExpenseData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Amount"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    borderColor: "hsl(var(--border))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Financial Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Financial Health Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Expense to Income Ratio</p>
              <div className="text-2xl font-bold">
                {summary.expenseToIncomeRatio.toFixed(2)}
              </div>
              <Progress
                value={Math.min(100, summary.expenseToIncomeRatio * 100)}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {summary.expenseToIncomeRatio < 0.8
                  ? "Healthy"
                  : summary.expenseToIncomeRatio < 1
                  ? "Moderate"
                  : "High Risk"}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Average Daily Expense</p>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.averageDailyExpense)}
              </div>
              <p className="text-xs text-muted-foreground">
                Based on transaction history
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Average Transaction</p>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.averageTransactionAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                Income: {formatCurrency(summary.averageIncomeAmount)}
                <br />
                Expense: {formatCurrency(summary.averageExpenseAmount)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Account Distribution</p>
              <div className="text-2xl font-bold">
                {summary.accountsWithPositiveBalance}/{summary.totalAccounts}
              </div>
              <p className="text-xs text-muted-foreground">
                Accounts with positive balance
                <br />
                Highest: {formatCurrency(summary.highestAccountBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account & Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Account Types */}
        <Card>
          <CardHeader>
            <CardTitle>Account Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.accountsByType.map((accountType) => (
                <div key={accountType.type} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium">{accountType.type}</span>
                    <span className="text-sm text-muted-foreground">
                      {accountType.count} account{accountType.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(accountType.totalBalance)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {accountType.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recurring Transaction Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Estimated Monthly Recurring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">
                  Recurring Income
                </span>
                <span className="font-bold text-green-600">
                  {formatCurrency(summary.estimatedMonthlyRecurringIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-600">
                  Recurring Expenses
                </span>
                <span className="font-bold text-red-600">
                  {formatCurrency(summary.estimatedMonthlyRecurringExpenses)}
                </span>
              </div>
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="font-medium">Net Recurring</span>
                <span
                  className={`font-bold ${
                    summary.estimatedMonthlyRecurringIncome -
                      summary.estimatedMonthlyRecurringExpenses >=
                    0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(
                    summary.estimatedMonthlyRecurringIncome -
                      summary.estimatedMonthlyRecurringExpenses
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
