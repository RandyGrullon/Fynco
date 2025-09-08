'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Transaction } from '@/lib/transactions';
import { format } from 'date-fns';

interface OverviewProps {
  data: Transaction[];
}

export function Overview({ data }: OverviewProps) {
    const monthlyData = data.reduce((acc, transaction) => {
        const month = format(new Date(transaction.date), 'MMM');
        if (!acc[month]) {
            acc[month] = { name: month, income: 0, expense: 0 };
        }
        if (transaction.type === 'income') {
            acc[month].income += transaction.amount;
        } else {
            acc[month].expense += transaction.amount;
        }
        return acc;
    }, {} as Record<string, {name: string, income: number, expense: number}>);

    const chartData = Object.values(monthlyData).reverse();

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Overview</CardTitle>
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
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
            />
            <Bar
              dataKey="income"
              fill="hsl(var(--chart-2))"
              radius={[4, 4, 0, 0]}
              name="Income"
            />
             <Bar
              dataKey="expense"
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
              name="Expense"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
