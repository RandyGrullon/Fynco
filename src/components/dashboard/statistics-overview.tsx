"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatisticsSummary, TimePeriodFilter } from "@/lib/statistics";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("statistics.overview");

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case "daily":
        return "Last 30 days";
      case "weekly":
        return t("thisWeek");
      case "monthly":
        return t("thisMonth");
      case "quarterly":
        return "Last 4 quarters";
      case "yearly":
        return t("thisYear");
      case "all":
        return t("allTime");
      default:
        return t("allTime");
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">
            {t("title")}
          </h2>
          <p className="text-muted-foreground">
            {t("comprehensiveOverview", { period: getTimePeriodLabel().toLowerCase() })}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm py-1.5">
            {getTimePeriodLabel()}
          </Badge>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalBalance")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("acrossAccounts", { count: summary.totalAccounts })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("netIncome")}</CardTitle>
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
            <p className="text-xs text-muted-foreground">{t("incomeMinusExpenses")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("savingsRate")}</CardTitle>
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
              {t("totalTransactions")}
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalIncome")}
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
            <div className="flex items-center mt-1">
              <div
                className={`text-xs px-2 py-0.5 rounded-md ${
                  incomeChange >= 0
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {incomeChange >= 0 ? "+" : ""}
                {incomeChange.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground ml-2">
                {t("fromLastMonth")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalExpenses")}
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
            <div className="flex items-center mt-1">
              <div
                className={`text-xs px-2 py-0.5 rounded-md ${
                  expenseChange <= 0
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {expenseChange >= 0 ? "+" : ""}
                {expenseChange.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground ml-2">
                {t("fromLastMonth")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("recurringTransactions")}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.activeRecurringTransactions}
            </div>
            <div className="w-full bg-muted h-2 rounded-full mt-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{
                  width: `${
                    (summary.activeRecurringTransactions /
                      Math.max(1, summary.totalRecurringTransactions)) *
                    100
                  }%`,
                }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("activeOutOfTotal", { 
                active: summary.activeRecurringTransactions, 
                total: summary.totalRecurringTransactions 
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Monthly Trends */}
        <Card className="col-span-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              {t("monthlyTrends")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyTrendsData}
                  margin={{ right: 10, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickMargin={10}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `${currencySymbol}${value}`}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                    }}
                    formatter={(value: number) => [formatCurrency(value)]}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="hsl(var(--chart-2))"
                    name="Income"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="hsl(var(--chart-1))"
                    name="Expenses"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netIncome"
                    stroke="hsl(var(--chart-3))"
                    name="Net Income"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Expense Categories */}
        <Card className="col-span-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              {t("topExpenseCategories")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topExpenseData}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, percentage }) =>
                      `${category.substring(0, 10)}${
                        category.length > 10 ? "..." : ""
                      } (${percentage.toFixed(1)}%)`
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
                    formatter={(value: number) => [
                      formatCurrency(value),
                      "Amount",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t("financialHealthIndicators")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
              <p className="text-sm font-medium">{t("expenseToIncomeRatio")}</p>
              <div className="text-2xl font-bold">
                {summary.expenseToIncomeRatio.toFixed(2)}
              </div>
              <Progress
                value={Math.min(100, summary.expenseToIncomeRatio * 100)}
                className="h-2"
              />
              <div className="flex items-center mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-md ${
                    summary.expenseToIncomeRatio < 0.8
                      ? "bg-green-100 text-green-800"
                      : summary.expenseToIncomeRatio < 1
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {summary.expenseToIncomeRatio < 0.8
                    ? t("healthy")
                    : summary.expenseToIncomeRatio < 1
                    ? t("moderate")
                    : t("highRisk")}
                </span>
              </div>
            </div>

            <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
              <p className="text-sm font-medium">Average Daily Expense</p>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.averageDailyExpense)}
              </div>
              <div className="text-xs text-muted-foreground flex items-center mt-2">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Based on transaction history
              </div>
            </div>

            <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
              <p className="text-sm font-medium">Average Transaction</p>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.averageTransactionAmount)}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-xs text-green-600 bg-green-100/50 p-1 rounded">
                  Income: {formatCurrency(summary.averageIncomeAmount)}
                </div>
                <div className="text-xs text-red-600 bg-red-100/50 p-1 rounded">
                  Expense: {formatCurrency(summary.averageExpenseAmount)}
                </div>
              </div>
            </div>

            <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
              <p className="text-sm font-medium">{t("accountBalanceStatus")}</p>
              <div className="text-2xl font-bold">
                {summary.accountsWithPositiveBalance}/{summary.totalAccounts}
              </div>
              <div className="w-full bg-muted h-2 rounded-full mt-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{
                    width: `${
                      (summary.accountsWithPositiveBalance /
                        Math.max(1, summary.totalAccounts)) *
                      100
                    }%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground flex justify-between mt-1">
                <span>{t("positiveAccounts")}</span>
                <span>
                  {t("highest")}: {formatCurrency(summary.highestAccountBalance)}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account & Category Breakdown */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Account Types */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              {t("accountDistribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.accountsByType.map((accountType) => (
                <div
                  key={accountType.type}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col mb-2 sm:mb-0">
                    <span className="font-medium">{accountType.type}</span>
                    <span className="text-sm text-muted-foreground">
                      {accountType.count} {accountType.count === 1 ? t("account") : t("accounts")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end sm:space-x-4">
                    <div className="flex flex-col sm:items-end">
                      <div className="font-semibold">
                        {formatCurrency(accountType.totalBalance)}
                      </div>
                      <Progress
                        value={accountType.percentage}
                        className="h-1.5 w-20 sm:w-24 mt-1"
                      />
                    </div>
                    <div className="text-sm rounded-full bg-muted px-2 py-1 w-16 text-center">
                      {accountType.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recurring Transaction Summary */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              {t("estimatedMonthlyRecurring")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("recurringIncome")}</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(summary.estimatedMonthlyRecurringIncome)}
                  </span>
                </div>
                <Progress
                  value={summary.estimatedMonthlyRecurringIncome > 0 ? 100 : 0}
                  className="h-2 bg-green-100"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t("recurringExpenses")}
                  </span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(summary.estimatedMonthlyRecurringExpenses)}
                  </span>
                </div>
                <Progress
                  value={
                    summary.estimatedMonthlyRecurringExpenses > 0 ? 100 : 0
                  }
                  className="h-2 bg-red-100"
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t("netRecurring")}</span>
                  <span
                    className={`text-lg font-bold ${
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
                <Progress
                  value={50}
                  className={`h-2 mt-2 ${
                    summary.estimatedMonthlyRecurringIncome -
                      summary.estimatedMonthlyRecurringExpenses >=
                    0
                      ? "bg-green-200"
                      : "bg-red-200"
                  }`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
