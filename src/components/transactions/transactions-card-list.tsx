"use client";

import { useState, useMemo } from "react";
import { Transaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Download,
  CalendarIcon,
  WalletIcon,
  TagIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { Timestamp } from "firebase/firestore";

interface TransactionsCardListProps {
  transactions: Transaction[];
  accounts: Account[];
  title?: string;
  limit?: number;
  showViewAll?: boolean;
}

export function TransactionsCardList({
  transactions,
  accounts,
  title = "Transactions",
  limit = Infinity,
  showViewAll = false,
}: TransactionsCardListProps) {
  const { formatCurrency } = useCurrencyFormatter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Find account name by ID
  const getAccountName = (accountId: string): string => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.name : "Unknown Account";
  };

  // Helper to convert various date formats to JavaScript Date
  const toJsDate = (date: Date | Timestamp | string): Date => {
    if (date instanceof Date) {
      return date;
    } else if (typeof date === "string") {
      return new Date(date);
    } else if (date && typeof date === "object" && "toDate" in date) {
      // It's a Firestore Timestamp
      return date.toDate();
    }
    return new Date(); // Fallback
  };

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      const matchesSearch =
        transaction.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.category &&
          transaction.category
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));

      const matchesFilter =
        filterType === "all" || transaction.type === filterType;

      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "date") {
        const dateA = toJsDate(a.date).getTime();
        const dateB = toJsDate(b.date).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      } else {
        return sortOrder === "asc" ? a.amount - b.amount : b.amount - a.amount;
      }
    });
  }, [transactions, searchTerm, filterType, sortBy, sortOrder]);

  // Limit the number of transactions to display
  const displayedTransactions = filteredAndSortedTransactions.slice(0, limit);

  const handleExportCSV = () => {
    // Create CSV content
    let csvContent = "Date,Source,Category,Account,Type,Amount\n";

    filteredAndSortedTransactions.forEach((transaction) => {
      const row = [
        format(toJsDate(transaction.date), "yyyy-MM-dd"),
        `"${transaction.source}"`,
        `"${transaction.category || ""}"`,
        `"${getAccountName(transaction.accountId)}"`,
        transaction.type,
        transaction.amount,
      ];
      csvContent += row.join(",") + "\n";
    });

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get transaction card color based on type
  const getTransactionColor = (type: string) => {
    switch (type) {
      case "income":
        return "bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200 dark:from-emerald-950/40 dark:to-emerald-900/40 dark:border-emerald-800/40";
      case "expense":
        return "bg-gradient-to-r from-rose-50 to-rose-100 border-rose-200 dark:from-rose-950/40 dark:to-rose-900/40 dark:border-rose-800/40";
      default:
        return "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 dark:from-blue-950/40 dark:to-blue-900/40 dark:border-blue-800/40";
    }
  };

  // Get badge color based on transaction type
  const getTransactionBadgeColor = (type: string) => {
    switch (type) {
      case "income":
        return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
      case "expense":
        return "bg-rose-100 text-rose-800 hover:bg-rose-100";
      default:
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search transactions..."
            className="pl-8 w-full sm:w-[250px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[130px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value: "date" | "amount") => setSortBy(value)}
          >
            <SelectTrigger className="w-[130px]">
              {sortOrder === "asc" ? (
                <SortAsc className="mr-2 h-4 w-4" />
              ) : (
                <SortDesc className="mr-2 h-4 w-4" />
              )}
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? "Oldest first" : "Newest first"}
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedTransactions.length > 0 ? (
          displayedTransactions.map((transaction) => (
            <Card
              key={transaction.id}
              className={`${getTransactionColor(
                transaction.type
              )} border overflow-hidden relative`}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base truncate">
                      {transaction.source}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge
                        className={`${getTransactionBadgeColor(
                          transaction.type
                        )} text-xs`}
                      >
                        {transaction.type === "income" ? (
                          <ArrowUp className="mr-1 h-3 w-3" />
                        ) : transaction.type === "expense" ? (
                          <ArrowDown className="mr-1 h-3 w-3" />
                        ) : (
                          "↔"
                        )}
                        {transaction.type}
                      </Badge>
                      {transaction.category && (
                        <Badge
                          variant="outline"
                          className="font-normal text-xs"
                        >
                          <TagIcon className="mr-1 h-3 w-3" />
                          {transaction.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        transaction.type === "income"
                          ? "text-emerald-600"
                          : transaction.type === "expense"
                          ? "text-rose-600"
                          : ""
                      }`}
                    >
                      {transaction.type === "income" ? "+" : ""}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    <span>
                      {format(toJsDate(transaction.date), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <WalletIcon className="h-3 w-3 mr-1" />
                    <span>{getAccountName(transaction.accountId)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center p-8 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No transactions found.</p>
          </div>
        )}
      </div>

      {showViewAll && filteredAndSortedTransactions.length > limit && (
        <div className="text-center mt-4">
          <Button variant="outline">
            View all {filteredAndSortedTransactions.length} transactions
          </Button>
        </div>
      )}
    </div>
  );
}
