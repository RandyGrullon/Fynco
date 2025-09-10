"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Account,
  AccountTransaction,
  getAccountTransactions,
} from "@/lib/accounts";
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
import { TransferDialog } from "@/components/transfer-dialog";
import {
  ArrowLeftRight,
  Search,
  Filter,
  Calendar,
  Download,
  SortAsc,
  SortDesc,
  Building,
  ChevronRight,
  BadgeDollarSign,
} from "lucide-react";
import { format } from "date-fns";

interface TransferCardListProps {
  accounts: Account[];
  onTransferCompleted?: () => void;
}

export function TransferCardList({
  accounts,
  onTransferCompleted,
}: TransferCardListProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromAccountFilter, setFromAccountFilter] = useState<string>("all");
  const [toAccountFilter, setToAccountFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function fetchTransactions() {
      if (user) {
        setLoading(true);
        const allTransactions: AccountTransaction[] = [];

        // Fetch transactions for each account
        for (const account of accounts) {
          if (account.id) {
            const accountTransactions = await getAccountTransactions(
              user.uid,
              account.id
            );

            // Filter only transfer transactions
            const transferTransactions = accountTransactions.filter(
              (transaction) => transaction.type === "transfer"
            );

            allTransactions.push(...transferTransactions);
          }
        }

        setTransactions(allTransactions);
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [user, accounts]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      // Search term filter
      const matchesSearch = transaction.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      // From account filter
      const matchesFromAccount =
        fromAccountFilter === "all" ||
        transaction.accountId === fromAccountFilter;

      // To account filter
      const matchesToAccount =
        toAccountFilter === "all" ||
        transaction.toAccountId === toAccountFilter;

      return matchesSearch && matchesFromAccount && matchesToAccount;
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
  }, [
    transactions,
    searchTerm,
    fromAccountFilter,
    toAccountFilter,
    sortBy,
    sortOrder,
  ]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalTransferAmount = transactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );
    const accountTransferCounts = accounts.reduce((acc, account) => {
      const count = transactions.filter(
        (t) => t.accountId === account.id
      ).length;
      if (count > 0) {
        acc[account.id || ""] = count;
      }
      return acc;
    }, {} as Record<string, number>);

    const mostActiveAccount = Object.entries(accountTransferCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];

    return {
      totalTransferAmount,
      transferCount: transactions.length,
      mostActiveAccountId: mostActiveAccount ? mostActiveAccount[0] : null,
      mostActiveAccountCount: mostActiveAccount ? mostActiveAccount[1] : 0,
    };
  }, [transactions, accounts]);

  const getAccountNameById = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    return account ? account.name : "Unknown Account";
  };

  const getAccountCurrencyById = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    return account ? account.currency : "USD";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                  Total Transfers
                </p>
                <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                  {transactions.length}
                </p>
              </div>
              <div className="p-2 bg-indigo-200 dark:bg-indigo-800 rounded-lg">
                <ArrowLeftRight className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900 border-violet-200 dark:border-violet-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                  Total Amount Transferred
                </p>
                <p className="text-lg font-bold text-violet-900 dark:text-violet-100">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD", // Default currency
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  }).format(statistics.totalTransferAmount)}
                </p>
              </div>
              <div className="p-2 bg-violet-200 dark:bg-violet-800 rounded-lg">
                <BadgeDollarSign className="h-5 w-5 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-950 dark:to-fuchsia-900 border-fuchsia-200 dark:border-fuchsia-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300 uppercase tracking-wide">
                  Most Active Account
                </p>
                <p className="text-lg font-bold text-fuchsia-900 dark:text-fuchsia-100 truncate">
                  {statistics.mostActiveAccountId
                    ? getAccountNameById(statistics.mostActiveAccountId)
                    : "None"}
                </p>
                <p className="text-xs text-fuchsia-700 dark:text-fuchsia-300">
                  {statistics.mostActiveAccountCount} transfers
                </p>
              </div>
              <div className="p-2 bg-fuchsia-200 dark:bg-fuchsia-800 rounded-lg">
                <Building className="h-5 w-5 text-fuchsia-700 dark:text-fuchsia-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transfer Actions */}
      {accounts.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="hover:shadow-md transition-shadow border-2 border-cyan-200 dark:border-cyan-800"
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-800 flex items-center justify-center mb-3">
                    <Building className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                  </div>
                  <h3 className="font-semibold text-center mb-1">
                    {account.name}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-3">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: account.currency,
                    }).format(account.balance)}
                  </p>
                  <TransferDialog
                    fromAccount={account}
                    accounts={accounts.filter((a) => a.id !== account.id)}
                    onTransferCompleted={onTransferCompleted}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-cyan-50 dark:bg-cyan-900 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-800"
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                      Transfer Funds
                    </Button>
                  </TransferDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Transfers Card */}
      <Card className="shadow-sm border-indigo-200 dark:border-indigo-800">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Transfer History
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {filteredAndSortedTransactions.length} of {transactions.length}{" "}
                transfers between your accounts
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
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-800 dark:to-indigo-900 rounded-full flex items-center justify-center">
                <ArrowLeftRight className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No transfers yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Start moving money between your accounts to track your financial
                management.
              </p>
              <div className="flex justify-center">
                {accounts.length > 0 && (
                  <TransferDialog
                    fromAccount={accounts[0]}
                    accounts={accounts.filter((a) => a.id !== accounts[0].id)}
                    onTransferCompleted={onTransferCompleted}
                  >
                    <Button
                      variant="outline"
                      className="bg-indigo-50 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-700"
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                      Make Your First Transfer
                    </Button>
                  </TransferDialog>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Filters and Search */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search transfers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select
                    value={fromAccountFilter}
                    onValueChange={setFromAccountFilter}
                  >
                    <SelectTrigger className="w-[150px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="From Account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id || ""}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={toAccountFilter}
                    onValueChange={setToAccountFilter}
                  >
                    <SelectTrigger className="w-[150px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="To Account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id || ""}>
                          {account.name}
                        </SelectItem>
                      ))}
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
                    <SelectTrigger className="w-[150px]">
                      {sortOrder === "desc" ? (
                        <SortDesc className="h-4 w-4 mr-2" />
                      ) : (
                        <SortAsc className="h-4 w-4 mr-2" />
                      )}
                      <SelectValue placeholder="Sort by" />
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
                  <div className="w-12 h-12 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-800 rounded-full flex items-center justify-center">
                    <Search className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    No matching transfers
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Try adjusting your search terms or filters.
                  </p>
                </div>
              ) : (
                <>
                  {/* Responsive card view for all screen sizes */}
                  <div className="space-y-3">
                    {filteredAndSortedTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Left side - From account */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center mr-3">
                                <Building className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">From</p>
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                  {getAccountNameById(transaction.accountId)}
                                </h3>
                              </div>
                            </div>
                          </div>

                          {/* Arrow */}
                          <div className="hidden sm:flex items-center justify-center">
                            <ChevronRight className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                          </div>

                          {/* Right side - To account */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center mr-3">
                                <Building className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">To</p>
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                  {transaction.toAccountId
                                    ? getAccountNameById(
                                        transaction.toAccountId
                                      )
                                    : "Unknown Account"}
                                </h3>
                              </div>
                            </div>
                          </div>

                          {/* Amount and date */}
                          <div className="sm:text-right">
                            <div className="font-semibold text-lg text-indigo-600 dark:text-indigo-400">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: getAccountCurrencyById(
                                  transaction.accountId
                                ),
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              }).format(transaction.amount)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end mt-1">
                              <Calendar className="h-3 w-3 mr-1" />
                              {typeof transaction.date === "string"
                                ? format(
                                    new Date(transaction.date),
                                    "MMM dd, yyyy"
                                  )
                                : format(
                                    transaction.date as Date,
                                    "MMM dd, yyyy"
                                  )}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {transaction.description && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {transaction.description}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
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

export default TransferCardList;
