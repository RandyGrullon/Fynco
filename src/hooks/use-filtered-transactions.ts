"use client";

import { useMemo } from 'react';
import { Transaction } from '@/lib/transactions';
import { isAfter, subDays, subWeeks, subMonths, subQuarters, subYears } from 'date-fns';

export type TimeFilterPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all';

export function useFilteredTransactions(transactions: Transaction[], timePeriod: TimeFilterPeriod) {
  return useMemo(() => {
    if (timePeriod === 'all') return transactions;

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date.toString());
      const today = new Date();

      switch (timePeriod) {
        case 'daily':
          return isAfter(transactionDate, subDays(today, 30)); // Last 30 days
        case 'weekly':
          return isAfter(transactionDate, subWeeks(today, 12)); // Last 12 weeks
        case 'monthly':
          return isAfter(transactionDate, subMonths(today, 12));
        case 'quarterly':
          return isAfter(transactionDate, subQuarters(today, 4));
        case 'yearly':
          return isAfter(transactionDate, subYears(today, 3));
        default:
          return true;
      }
    });
  }, [transactions, timePeriod]);
}

export function useTransactionStats(transactions: Transaction[]) {
  return useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netIncome = totalIncome - totalExpenses;
    
    const transactionsByCategory = transactions.reduce((acc, transaction) => {
      const category = transaction.category;
      if (!acc[category]) {
        acc[category] = { income: 0, expense: 0, count: 0 };
      }
      if (transaction.type === 'income') {
        acc[category].income += transaction.amount;
      } else {
        acc[category].expense += transaction.amount;
      }
      acc[category].count += 1;
      return acc;
    }, {} as Record<string, { income: number; expense: number; count: number }>);

    return {
      totalIncome,
      totalExpenses,
      netIncome,
      transactionCount: transactions.length,
      transactionsByCategory,
    };
  }, [transactions]);
}
