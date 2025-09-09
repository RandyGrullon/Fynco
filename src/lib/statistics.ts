"use client";

import { Transaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { RecurringTransactionWithAccount } from "@/lib/recurring-transactions";
import {
  format,
  isAfter,
  isBefore,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
} from "date-fns";

export interface StatisticsSummary {
  // General overview
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  
  // Account statistics
  totalAccounts: number;
  averageAccountBalance: number;
  accountsWithPositiveBalance: number;
  accountsWithNegativeBalance: number;
  highestAccountBalance: number;
  lowestAccountBalance: number;
  
  // Transaction statistics
  totalTransactions: number;
  averageTransactionAmount: number;
  averageIncomeAmount: number;
  averageExpenseAmount: number;
  transactionsThisMonth: number;
  transactionsLastMonth: number;
  
  // Category analysis
  topExpenseCategories: CategorySummary[];
  topIncomeCategories: CategorySummary[];
  
  // Monthly trends
  monthlyTrends: MonthlyTrend[];
  
  // Recurring transactions
  activeRecurringTransactions: number;
  totalRecurringTransactions: number;
  estimatedMonthlyRecurringIncome: number;
  estimatedMonthlyRecurringExpenses: number;
  
  // Time period comparisons
  thisMonthIncome: number;
  thisMonthExpenses: number;
  lastMonthIncome: number;
  lastMonthExpenses: number;
  thisYearIncome: number;
  thisYearExpenses: number;
  lastYearIncome: number;
  lastYearExpenses: number;
  
  // Financial health indicators
  savingsRate: number; // (Income - Expenses) / Income * 100
  expenseToIncomeRatio: number;
  averageDailyExpense: number;
  averageDailyIncome: number;
  
  // Account distribution
  accountsByType: AccountTypeSummary[];
}

export interface CategorySummary {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  income: number;
  expenses: number;
  netIncome: number;
  transactionCount: number;
}

export interface AccountTypeSummary {
  type: string;
  count: number;
  totalBalance: number;
  percentage: number;
}

export type TimePeriodFilter = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "all";

export class StatisticsService {
  static generateSummary(
    transactions: Transaction[],
    accounts: Account[],
    recurringTransactions?: RecurringTransactionWithAccount[],
    timePeriod: TimePeriodFilter = "all"
  ): StatisticsSummary {
    const filteredTransactions = this.filterTransactionsByPeriod(transactions, timePeriod);
    const today = new Date();
    
    // Basic calculations
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalIncome = filteredTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = filteredTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const netIncome = totalIncome - totalExpenses;
    
    // Account statistics
    const accountBalances = accounts.map(acc => acc.balance);
    const totalAccounts = accounts.length;
    const averageAccountBalance = totalAccounts > 0 ? totalBalance / totalAccounts : 0;
    const accountsWithPositiveBalance = accounts.filter(acc => acc.balance > 0).length;
    const accountsWithNegativeBalance = accounts.filter(acc => acc.balance < 0).length;
    const highestAccountBalance = accountBalances.length > 0 ? Math.max(...accountBalances) : 0;
    const lowestAccountBalance = accountBalances.length > 0 ? Math.min(...accountBalances) : 0;
    
    // Transaction statistics
    const totalTransactions = filteredTransactions.length;
    const incomeTransactions = filteredTransactions.filter(t => t.type === "income");
    const expenseTransactions = filteredTransactions.filter(t => t.type === "expense");
    
    const averageTransactionAmount = totalTransactions > 0 
      ? filteredTransactions.reduce((sum, t) => sum + t.amount, 0) / totalTransactions 
      : 0;
    const averageIncomeAmount = incomeTransactions.length > 0 
      ? totalIncome / incomeTransactions.length 
      : 0;
    const averageExpenseAmount = expenseTransactions.length > 0 
      ? totalExpenses / expenseTransactions.length 
      : 0;
    
    // Monthly transaction counts
    const thisMonth = startOfMonth(today);
    const lastMonth = startOfMonth(subMonths(today, 1));
    const endLastMonth = endOfMonth(subMonths(today, 1));
    
    const transactionsThisMonth = transactions.filter(t => {
      const date = new Date(t.date.toString());
      return isAfter(date, thisMonth) || date.getTime() === thisMonth.getTime();
    }).length;
    
    const transactionsLastMonth = transactions.filter(t => {
      const date = new Date(t.date.toString());
      return (isAfter(date, lastMonth) || date.getTime() === lastMonth.getTime()) &&
             (isBefore(date, endLastMonth) || date.getTime() === endLastMonth.getTime());
    }).length;
    
    // Category analysis
    const topExpenseCategories = this.calculateCategoryBreakdown(expenseTransactions, totalExpenses);
    const topIncomeCategories = this.calculateCategoryBreakdown(incomeTransactions, totalIncome);
    
    // Monthly trends
    const monthlyTrends = this.calculateMonthlyTrends(transactions);
    
    // Recurring transactions analysis
    const activeRecurring = recurringTransactions?.filter(rt => rt.isActive) || [];
    const activeRecurringTransactions = activeRecurring.length;
    const totalRecurringTransactions = recurringTransactions?.length || 0;
    
    const estimatedMonthlyRecurringIncome = this.calculateMonthlyEstimate(
      activeRecurring.filter(rt => rt.type === "income")
    );
    const estimatedMonthlyRecurringExpenses = this.calculateMonthlyEstimate(
      activeRecurring.filter(rt => rt.type === "expense")
    );
    
    // Time period comparisons
    const thisYearStart = startOfYear(today);
    const lastYearStart = startOfYear(subYears(today, 1));
    const lastYearEnd = endOfYear(subYears(today, 1));
    
    const thisMonthTransactions = transactions.filter(t => {
      const date = new Date(t.date.toString());
      return isAfter(date, thisMonth) || date.getTime() === thisMonth.getTime();
    });
    
    const lastMonthTransactions = transactions.filter(t => {
      const date = new Date(t.date.toString());
      return (isAfter(date, lastMonth) || date.getTime() === lastMonth.getTime()) &&
             (isBefore(date, endLastMonth) || date.getTime() === endLastMonth.getTime());
    });
    
    const thisYearTransactions = transactions.filter(t => {
      const date = new Date(t.date.toString());
      return isAfter(date, thisYearStart) || date.getTime() === thisYearStart.getTime();
    });
    
    const lastYearTransactions = transactions.filter(t => {
      const date = new Date(t.date.toString());
      return (isAfter(date, lastYearStart) || date.getTime() === lastYearStart.getTime()) &&
             (isBefore(date, lastYearEnd) || date.getTime() === lastYearEnd.getTime());
    });
    
    const thisMonthIncome = thisMonthTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const thisMonthExpenses = thisMonthTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const lastMonthIncome = lastMonthTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const lastMonthExpenses = lastMonthTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const thisYearIncome = thisYearTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const thisYearExpenses = thisYearTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const lastYearIncome = lastYearTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const lastYearExpenses = lastYearTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Financial health indicators
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    const expenseToIncomeRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0;
    
    const daysSinceFirstTransaction = this.getDaysSinceFirstTransaction(transactions);
    const averageDailyExpense = daysSinceFirstTransaction > 0 ? totalExpenses / daysSinceFirstTransaction : 0;
    const averageDailyIncome = daysSinceFirstTransaction > 0 ? totalIncome / daysSinceFirstTransaction : 0;
    
    // Account distribution by type
    const accountsByType = this.calculateAccountTypeDistribution(accounts, totalBalance);
    
    return {
      totalBalance,
      totalIncome,
      totalExpenses,
      netIncome,
      totalAccounts,
      averageAccountBalance,
      accountsWithPositiveBalance,
      accountsWithNegativeBalance,
      highestAccountBalance,
      lowestAccountBalance,
      totalTransactions,
      averageTransactionAmount,
      averageIncomeAmount,
      averageExpenseAmount,
      transactionsThisMonth,
      transactionsLastMonth,
      topExpenseCategories,
      topIncomeCategories,
      monthlyTrends,
      activeRecurringTransactions,
      totalRecurringTransactions,
      estimatedMonthlyRecurringIncome,
      estimatedMonthlyRecurringExpenses,
      thisMonthIncome,
      thisMonthExpenses,
      lastMonthIncome,
      lastMonthExpenses,
      thisYearIncome,
      thisYearExpenses,
      lastYearIncome,
      lastYearExpenses,
      savingsRate,
      expenseToIncomeRatio,
      averageDailyExpense,
      averageDailyIncome,
      accountsByType,
    };
  }
  
  private static filterTransactionsByPeriod(
    transactions: Transaction[],
    timePeriod: TimePeriodFilter
  ): Transaction[] {
    if (timePeriod === "all") return transactions;
    
    const today = new Date();
    
    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date.toString());
      
      switch (timePeriod) {
        case "daily":
          return isAfter(transactionDate, subDays(today, 30));
        case "weekly":
          return isAfter(transactionDate, subWeeks(today, 12));
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
  }
  
  private static calculateCategoryBreakdown(
    transactions: Transaction[],
    total: number
  ): CategorySummary[] {
    const categoryMap: Record<string, { amount: number; count: number }> = {};
    
    transactions.forEach((transaction) => {
      const category = transaction.category || "Other";
      if (!categoryMap[category]) {
        categoryMap[category] = { amount: 0, count: 0 };
      }
      categoryMap[category].amount += transaction.amount;
      categoryMap[category].count += 1;
    });
    
    return Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
        percentage: total > 0 ? (data.amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 categories
  }
  
  private static calculateMonthlyTrends(transactions: Transaction[]): MonthlyTrend[] {
    if (transactions.length === 0) return [];
    
    const sortedTransactions = transactions.sort((a, b) => 
      new Date(a.date.toString()).getTime() - new Date(b.date.toString()).getTime()
    );
    
    const firstDate = new Date(sortedTransactions[0].date.toString());
    const lastDate = new Date();
    
    const months = eachMonthOfInterval({ start: firstDate, end: lastDate });
    
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTransactions = transactions.filter((transaction) => {
        const date = new Date(transaction.date.toString());
        return (isAfter(date, monthStart) || date.getTime() === monthStart.getTime()) &&
               (isBefore(date, monthEnd) || date.getTime() === monthEnd.getTime());
      });
      
      const income = monthTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        month: format(month, "MMMM"),
        year: month.getFullYear(),
        income,
        expenses,
        netIncome: income - expenses,
        transactionCount: monthTransactions.length,
      };
    }).slice(-12); // Last 12 months
  }
  
  private static calculateMonthlyEstimate(
    recurringTransactions: RecurringTransactionWithAccount[]
  ): number {
    return recurringTransactions.reduce((sum, rt) => {
      let monthlyAmount = 0;
      
      switch (rt.frequency) {
        case "daily":
          monthlyAmount = rt.amount * 30; // Approximate 30 days per month
          break;
        case "weekly":
          monthlyAmount = rt.amount * 4.33; // Approximate 4.33 weeks per month
          break;
        case "biweekly":
          monthlyAmount = rt.amount * 2.17; // Approximate 2.17 biweeks per month
          break;
        case "monthly":
          monthlyAmount = rt.amount;
          break;
        case "quarterly":
          monthlyAmount = rt.amount / 3;
          break;
        case "yearly":
          monthlyAmount = rt.amount / 12;
          break;
        default:
          monthlyAmount = 0;
      }
      
      return sum + monthlyAmount;
    }, 0);
  }
  
  private static getDaysSinceFirstTransaction(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0;
    
    const sortedTransactions = transactions.sort((a, b) => 
      new Date(a.date.toString()).getTime() - new Date(b.date.toString()).getTime()
    );
    
    const firstDate = new Date(sortedTransactions[0].date.toString());
    const today = new Date();
    
    return Math.ceil((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  private static calculateAccountTypeDistribution(
    accounts: Account[],
    totalBalance: number
  ): AccountTypeSummary[] {
    const typeMap: Record<string, { count: number; totalBalance: number }> = {};
    
    accounts.forEach((account) => {
      const type = account.type || "Other";
      if (!typeMap[type]) {
        typeMap[type] = { count: 0, totalBalance: 0 };
      }
      typeMap[type].count += 1;
      typeMap[type].totalBalance += account.balance;
    });
    
    return Object.entries(typeMap)
      .map(([type, data]) => ({
        type,
        count: data.count,
        totalBalance: data.totalBalance,
        percentage: totalBalance > 0 ? (data.totalBalance / totalBalance) * 100 : 0,
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance);
  }
}
