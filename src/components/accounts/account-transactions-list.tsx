"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Account,
  AccountTransaction,
  getAccountTransactions,
} from "@/lib/accounts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUp,
  ArrowDown,
  Repeat,
  CalendarClock,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  SortAsc,
  SortDesc,
} from "lucide-react";
import { format } from "date-fns";

interface AccountTransactionsListProps {
  account: Account;
}

export function AccountTransactionsList({
  account,
}: AccountTransactionsListProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function fetchTransactions() {
      if (user && account.id) {
        setLoading(true);
        const fetchedTransactions = await getAccountTransactions(
          user.uid,
          account.id
        );
        setTransactions(fetchedTransactions);
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [user, account.id]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      const matchesSearch =
        transaction.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (transaction.category &&
          transaction.category
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));

      const matchesFilter =
        filterType === "all" || transaction.type === filterType;

      return matchesSearch && matchesFilter;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      if (sortBy === "date") {
        const dateA =
          typeof a.date === "string" ? new Date(a.date) : (a.date as Date);
        const dateB =
          typeof b.date === "string" ? new Date(b.date) : (b.date as Date);
        return sortOrder === "desc"
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      } else {
        return sortOrder === "desc" ? b.amount - a.amount : a.amount - b.amount;
      }
    });

    return filtered;
  }, [transactions, searchTerm, filterType, sortBy, sortOrder]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalIncome = transactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalTransfers = transactions
      .filter((t) => t.type === "transfer")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpenses,
      totalTransfers,
      netFlow: totalIncome - totalExpenses,
      transactionCount: transactions.length,
    };
  }, [transactions]);

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case "credit":
        return <ArrowUp className="h-4 w-4 text-green-600" />;
      case "debit":
        return <ArrowDown className="h-4 w-4 text-red-600" />;
      case "transfer":
        return <Repeat className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "credit":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "debit":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "transfer":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>

        {/* Main Card Skeleton */}
        <Card>
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">
                  Total Income
                </p>
                <p className="text-lg font-bold text-green-900 dark:text-green-100">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: account.currency,
                  }).format(statistics.totalIncome)}
                </p>
              </div>
              <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-700 dark:text-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">
                  Total Expenses
                </p>
                <p className="text-lg font-bold text-red-900 dark:text-red-100">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: account.currency,
                  }).format(statistics.totalExpenses)}
                </p>
              </div>
              <div className="p-2 bg-red-200 dark:bg-red-800 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-700 dark:text-red-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Net Flow
                </p>
                <p
                  className={`text-lg font-bold ${
                    statistics.netFlow >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {statistics.netFlow >= 0 ? "+" : ""}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: account.currency,
                  }).format(statistics.netFlow)}
                </p>
              </div>
              <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                  Transactions
                </p>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                  {statistics.transactionCount}
                </p>
              </div>
              <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <CalendarClock className="h-5 w-5 text-purple-700 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Transactions Card */}
      <Card className="shadow-sm border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {filteredAndSortedTransactions.length} of {transactions.length}{" "}
                transactions for {account.name}
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {transactions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center">
                <CalendarClock className="h-10 w-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No transactions yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Start building your financial history by adding your first
                transaction using the Quick Actions above.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-200"
                >
                  Income
                </Badge>
                <Badge
                  variant="outline"
                  className="text-red-600 border-red-200"
                >
                  Expense
                </Badge>
                <Badge
                  variant="outline"
                  className="text-blue-600 border-blue-200"
                >
                  Transfer
                </Badge>
              </div>
            </div>
          ) : (
            <>
              {/* Filters and Search */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-32">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="credit">Income</SelectItem>
                      <SelectItem value="debit">Expenses</SelectItem>
                      <SelectItem value="transfer">Transfers</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={`${sortBy}-${sortOrder}`}
                    onValueChange={(value) => {
                      const [newSortBy, newSortOrder] = value.split("-") as [
                        typeof sortBy,
                        typeof sortOrder
                      ];
                      setSortBy(newSortBy);
                      setSortOrder(newSortOrder);
                    }}
                  >
                    <SelectTrigger className="w-40">
                      {sortOrder === "desc" ? (
                        <SortDesc className="h-4 w-4 mr-2" />
                      ) : (
                        <SortAsc className="h-4 w-4 mr-2" />
                      )}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Newest First</SelectItem>
                      <SelectItem value="date-asc">Oldest First</SelectItem>
                      <SelectItem value="amount-desc">
                        Highest Amount
                      </SelectItem>
                      <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredAndSortedTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <Search className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    No matching transactions
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Try adjusting your search terms or filters.
                  </p>
                </div>
              ) : (
                <>
                  {/* Responsive card view for all screen sizes */}
                  <div className="space-y-3">
                    {filteredAndSortedTransactions.map((transaction) => {
                      console.log(
                        "Transaction description:",
                        transaction.description
                      );
                      return (
                        <div
                          key={transaction.id}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Left side - Type icon and badge */}
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0
                              ${
                                transaction.type === "credit"
                                  ? "bg-green-100 dark:bg-green-900"
                                  : transaction.type === "debit"
                                  ? "bg-red-100 dark:bg-red-900"
                                  : "bg-blue-100 dark:bg-blue-900"
                              }`}
                              >
                                {getTransactionTypeIcon(transaction.type)}
                              </div>
                              <Badge
                                className={`${getTransactionTypeColor(
                                  transaction.type
                                )} font-medium hidden sm:flex`}
                                variant="secondary"
                              >
                                <span className="flex items-center">
                                  <span className="capitalize">
                                    {transaction.type === "credit"
                                      ? "Income"
                                      : transaction.type === "debit"
                                      ? "Expense"
                                      : "Transfer"}
                                  </span>
                                </span>
                              </Badge>
                            </div>

                            {/* Middle - Description and category */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {transaction.description}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                  <CalendarClock className="h-3 w-3 mr-1" />
                                  {typeof transaction.date === "string"
                                    ? format(
                                        new Date(transaction.date),
                                        "MMM dd, yyyy • h:mm a"
                                      )
                                    : format(
                                        transaction.date as Date,
                                        "MMM dd, yyyy • h:mm a"
                                      )}
                                </div>
                                {transaction.category && (
                                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                                    {transaction.category}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right - Amount */}
                            <div className="sm:text-right">
                              <div
                                className={`font-semibold text-lg ${
                                  transaction.type === "credit"
                                    ? "text-green-600 dark:text-green-400"
                                    : transaction.type === "debit"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {transaction.type === "credit"
                                  ? "+"
                                  : transaction.type === "debit"
                                  ? "-"
                                  : ""}
                                {new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: account.currency,
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                }).format(transaction.amount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountTransactionsList;
