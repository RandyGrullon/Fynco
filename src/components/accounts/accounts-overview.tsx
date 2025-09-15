"use client";

import { Account } from "@/lib/accounts";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface AccountsOverviewProps {
  accounts: Account[];
}

export function AccountsOverview({ accounts }: AccountsOverviewProps) {
  const { formatCurrency } = useCurrencyFormatter();
  // Generate chart data from accounts
  const chartData = accounts.map((account) => ({
    name: account.name,
    value: account.balance,
    type: account.type,
  }));

  // Colors for different account types
  const COLORS = {
    checking: "#3b82f6", // blue
    savings: "#22c55e", // green
    investment: "#8b5cf6", // purple
    credit: "#ef4444", // red
    other: "#6b7280", // gray
  };

  const getAccountTypeColor = (type: string) => {
    return COLORS[type as keyof typeof COLORS] || COLORS.other;
  };

  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );
  const accountsByType = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = 0;
    }
    acc[account.type] += account.balance;
    return acc;
  }, {} as Record<string, number>);

  const typeChartData = Object.entries(accountsByType).map(
    ([type, balance]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: balance,
      type,
    })
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background p-2 border rounded shadow-sm">
          <p className="font-medium">{payload[0].name}</p>
          <p>{formatCurrency(payload[0].value)}</p>
          <p className="text-xs text-muted-foreground">
            {((payload[0].value / totalBalance) * 100).toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">
            Accounts Balance
          </CardTitle>
          <CardDescription>Distribution by account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={window.innerWidth < 640 ? 60 : 80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    window.innerWidth < 400
                      ? `${(percent * 100).toFixed(0)}%`
                      : `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getAccountTypeColor(entry.type)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Account Types</CardTitle>
          <CardDescription>Distribution by account type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={window.innerWidth < 640 ? 60 : 80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    window.innerWidth < 400
                      ? `${(percent * 100).toFixed(0)}%`
                      : `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {typeChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getAccountTypeColor(entry.type)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountsOverview;
