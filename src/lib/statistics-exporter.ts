"use client";

import { StatisticsSummary } from "@/lib/statistics";
import { Transaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { RecurringTransactionWithAccount } from "@/lib/recurring-transactions";
import { format } from "date-fns";

export interface ExportOptions {
  format: "json" | "csv" | "txt";
  includeSummary: boolean;
  includeTransactions: boolean;
  includeAccounts: boolean;
  includeRecurring: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export class StatisticsExporter {
  static exportData(
    summary: StatisticsSummary,
    transactions: Transaction[],
    accounts: Account[],
    recurringTransactions: RecurringTransactionWithAccount[],
    options: ExportOptions
  ): string {
    const data: any = {
      exportDate: new Date().toISOString(),
      exportOptions: options,
    };

    if (options.includeSummary) {
      data.summary = summary;
    }

    if (options.includeTransactions) {
      data.transactions = transactions.map((t) => ({
        ...t,
        date: t.date instanceof Date ? t.date.toISOString() : t.date.toString(),
      }));
    }

    if (options.includeAccounts) {
      data.accounts = accounts;
    }

    if (options.includeRecurring) {
      data.recurringTransactions = recurringTransactions.map((rt) => ({
        ...rt,
        startDate: rt.startDate instanceof Date ? rt.startDate.toISOString() : rt.startDate,
        endDate: rt.endDate instanceof Date ? rt.endDate.toISOString() : rt.endDate,
        lastProcessed: rt.lastProcessed instanceof Date ? rt.lastProcessed.toISOString() : rt.lastProcessed,
        nextProcessDate: rt.nextProcessDate instanceof Date ? rt.nextProcessDate.toISOString() : rt.nextProcessDate,
        createdAt: rt.createdAt instanceof Date ? rt.createdAt.toISOString() : rt.createdAt,
        updatedAt: rt.updatedAt instanceof Date ? rt.updatedAt.toISOString() : rt.updatedAt,
      }));
    }

    switch (options.format) {
      case "json":
        return JSON.stringify(data, null, 2);
      case "csv":
        return this.convertToCSV(data, options);
      case "txt":
        return this.convertToText(data, options);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private static convertToCSV(data: any, options: ExportOptions): string {
    let csv = "";

    if (options.includeSummary && data.summary) {
      csv += "FINANCIAL SUMMARY\\n";
      csv += "Metric,Value\\n";
      csv += `Total Balance,${data.summary.totalBalance}\\n`;
      csv += `Total Income,${data.summary.totalIncome}\\n`;
      csv += `Total Expenses,${data.summary.totalExpenses}\\n`;
      csv += `Net Income,${data.summary.netIncome}\\n`;
      csv += `Savings Rate,${data.summary.savingsRate}%\\n`;
      csv += `Total Accounts,${data.summary.totalAccounts}\\n`;
      csv += `Total Transactions,${data.summary.totalTransactions}\\n`;
      csv += `Active Recurring Transactions,${data.summary.activeRecurringTransactions}\\n`;
      csv += "\\n";
    }

    if (options.includeTransactions && data.transactions) {
      csv += "TRANSACTIONS\\n";
      csv += "Date,Amount,Type,Category,Source,Method,Account ID\\n";
      data.transactions.forEach((t: any) => {
        csv += `${t.date},${t.amount},${t.type},${t.category},${t.source},${t.method},${t.accountId}\\n`;
      });
      csv += "\\n";
    }

    if (options.includeAccounts && data.accounts) {
      csv += "ACCOUNTS\\n";
      csv += "Name,Type,Balance,Currency\\n";
      data.accounts.forEach((a: any) => {
        csv += `${a.name},${a.type},${a.balance},${a.currency}\\n`;
      });
      csv += "\\n";
    }

    if (options.includeRecurring && data.recurringTransactions) {
      csv += "RECURRING TRANSACTIONS\\n";
      csv += "Type,Amount,Description,Category,Frequency,Start Date,Active\\n";
      data.recurringTransactions.forEach((rt: any) => {
        csv += `${rt.type},${rt.amount},${rt.description},${rt.category},${rt.frequency},${rt.startDate},${rt.isActive}\\n`;
      });
    }

    return csv;
  }

  private static convertToText(data: any, options: ExportOptions): string {
    let text = "";
    text += "=".repeat(50) + "\\n";
    text += "FINANCIAL STATISTICS REPORT\\n";
    text += "Generated on: " + format(new Date(), "PPP p") + "\\n";
    text += "=".repeat(50) + "\\n\\n";

    if (options.includeSummary && data.summary) {
      text += "SUMMARY OVERVIEW\\n";
      text += "-".repeat(30) + "\\n";
      text += `Total Balance: $${data.summary.totalBalance.toFixed(2)}\\n`;
      text += `Total Income: $${data.summary.totalIncome.toFixed(2)}\\n`;
      text += `Total Expenses: $${data.summary.totalExpenses.toFixed(2)}\\n`;
      text += `Net Income: $${data.summary.netIncome.toFixed(2)}\\n`;
      text += `Savings Rate: ${data.summary.savingsRate.toFixed(1)}%\\n`;
      text += `Expense to Income Ratio: ${data.summary.expenseToIncomeRatio.toFixed(2)}\\n`;
      text += "\\n";

      text += "ACCOUNT STATISTICS\\n";
      text += "-".repeat(30) + "\\n";
      text += `Total Accounts: ${data.summary.totalAccounts}\\n`;
      text += `Accounts with Positive Balance: ${data.summary.accountsWithPositiveBalance}\\n`;
      text += `Accounts with Negative Balance: ${data.summary.accountsWithNegativeBalance}\\n`;
      text += `Highest Account Balance: $${data.summary.highestAccountBalance.toFixed(2)}\\n`;
      text += `Lowest Account Balance: $${data.summary.lowestAccountBalance.toFixed(2)}\\n`;
      text += `Average Account Balance: $${data.summary.averageAccountBalance.toFixed(2)}\\n`;
      text += "\\n";

      text += "TRANSACTION STATISTICS\\n";
      text += "-".repeat(30) + "\\n";
      text += `Total Transactions: ${data.summary.totalTransactions}\\n`;
      text += `This Month Transactions: ${data.summary.transactionsThisMonth}\\n`;
      text += `Last Month Transactions: ${data.summary.transactionsLastMonth}\\n`;
      text += `Average Transaction Amount: $${data.summary.averageTransactionAmount.toFixed(2)}\\n`;
      text += `Average Income Amount: $${data.summary.averageIncomeAmount.toFixed(2)}\\n`;
      text += `Average Expense Amount: $${data.summary.averageExpenseAmount.toFixed(2)}\\n`;
      text += `Average Daily Income: $${data.summary.averageDailyIncome.toFixed(2)}\\n`;
      text += `Average Daily Expense: $${data.summary.averageDailyExpense.toFixed(2)}\\n`;
      text += "\\n";

      text += "MONTHLY COMPARISON\\n";
      text += "-".repeat(30) + "\\n";
      text += `This Month Income: $${data.summary.thisMonthIncome.toFixed(2)}\\n`;
      text += `This Month Expenses: $${data.summary.thisMonthExpenses.toFixed(2)}\\n`;
      text += `Last Month Income: $${data.summary.lastMonthIncome.toFixed(2)}\\n`;
      text += `Last Month Expenses: $${data.summary.lastMonthExpenses.toFixed(2)}\\n`;
      text += "\\n";

      text += "RECURRING TRANSACTIONS\\n";
      text += "-".repeat(30) + "\\n";
      text += `Active Recurring Transactions: ${data.summary.activeRecurringTransactions}\\n`;
      text += `Total Recurring Transactions: ${data.summary.totalRecurringTransactions}\\n`;
      text += `Estimated Monthly Recurring Income: $${data.summary.estimatedMonthlyRecurringIncome.toFixed(2)}\\n`;
      text += `Estimated Monthly Recurring Expenses: $${data.summary.estimatedMonthlyRecurringExpenses.toFixed(2)}\\n`;
      text += "\\n";

      if (data.summary.topExpenseCategories.length > 0) {
        text += "TOP EXPENSE CATEGORIES\\n";
        text += "-".repeat(30) + "\\n";
        data.summary.topExpenseCategories.forEach((cat: any, index: number) => {
          text += `${index + 1}. ${cat.category}: $${cat.amount.toFixed(2)} (${cat.percentage.toFixed(1)}%)\\n`;
        });
        text += "\\n";
      }

      if (data.summary.accountsByType.length > 0) {
        text += "ACCOUNTS BY TYPE\\n";
        text += "-".repeat(30) + "\\n";
        data.summary.accountsByType.forEach((type: any) => {
          text += `${type.type}: ${type.count} accounts, $${type.totalBalance.toFixed(2)} (${type.percentage.toFixed(1)}%)\\n`;
        });
        text += "\\n";
      }
    }

    return text;
  }

  static downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  static exportAndDownload(
    summary: StatisticsSummary,
    transactions: Transaction[],
    accounts: Account[],
    recurringTransactions: RecurringTransactionWithAccount[],
    options: ExportOptions
  ) {
    const content = this.exportData(
      summary,
      transactions,
      accounts,
      recurringTransactions,
      options
    );

    const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
    const filename = `financial-statistics_${timestamp}.${options.format}`;

    const mimeTypes = {
      json: "application/json",
      csv: "text/csv",
      txt: "text/plain",
    };

    this.downloadFile(content, filename, mimeTypes[options.format]);
  }
}
