"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/lib/transactions";
import {
  format,
  isAfter,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { TimeFilterPeriod } from "./time-filter";
import { useTranslations } from "next-intl";

interface OverviewProps {
  data: Transaction[];
  timePeriod: TimeFilterPeriod;
}

export function Overview({ data, timePeriod = "monthly" }: OverviewProps) {
  const { currencySymbol } = useCurrencyFormatter();
  const t = useTranslations();

  // Filter data based on time period
  const filteredData = data.filter((transaction) => {
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
      case "all":
        return true;
      default:
        return true;
    }
  });

  // Format label based on time period
  const getTimeLabel = (date: Date) => {
    switch (timePeriod) {
      case "daily":
        return format(date, "dd MMM"); // Day and month abbreviation
      case "weekly":
        return `W${Math.ceil(
          (date.getDate() +
            new Date(date.getFullYear(), date.getMonth(), 0).getDay()) /
            7
        )}`;
      case "monthly":
        return format(date, "MMM");
      case "quarterly":
        return `Q${Math.floor(date.getMonth() / 3) + 1} ${format(
          date,
          "yyyy"
        )}`;
      case "yearly":
        return format(date, "yyyy");
      default:
        return format(date, "MMM");
    }
  };

  const timeData = filteredData.reduce((acc, transaction) => {
    const date = new Date(transaction.date.toString());
    const timeLabel = getTimeLabel(date);

    if (!acc[timeLabel]) {
      acc[timeLabel] = { name: timeLabel, income: 0, expense: 0 };
    }

    if (transaction.type === "income") {
      acc[timeLabel].income += transaction.amount;
    } else {
      acc[timeLabel].expense += transaction.amount;
    }

    return acc;
  }, {} as Record<string, { name: string; income: number; expense: number }>);

  const chartData = Object.values(timeData).reverse();

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>
          {timePeriod === "daily"
            ? t('overview.daily')
            : timePeriod === "weekly"
            ? t('overview.weekly')
            : timePeriod === "monthly"
            ? t('overview.monthly')
            : timePeriod === "quarterly"
            ? t('overview.quarterly')
            : timePeriod === "yearly"
            ? t('overview.yearly')
            : t('overview.all')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${currencySymbol}${value}`}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Bar
              dataKey="income"
              fill="hsl(var(--chart-2))"
              radius={[4, 4, 0, 0]}
              name={t('overview.income')}
            />
            <Bar
              dataKey="expense"
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
              name={t('overview.expense')}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
