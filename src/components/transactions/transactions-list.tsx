"use client";

import { useState, useMemo } from "react";
import { Transaction, deleteTransaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Download,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { Timestamp } from "firebase/firestore";

interface TransactionsListProps {
  transactions: Transaction[];
  accounts: Account[];
  title?: string;
  limit?: number;
  showViewAll?: boolean;
  onTransactionDeleted?: () => void;
}

export function TransactionsList({
  transactions,
  accounts,
  title = "Transactions",
  limit = Infinity,
  showViewAll = false,
  onTransactionDeleted,
}: TransactionsListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrencyFormatter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

  // Find account name by ID
  const getAccountName = (accountId: string): string => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.name : "Unknown Account";
  };

  // Function to delete a transaction
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;

    setDeletingTransactionId(transactionId);
    try {
      const result = await deleteTransaction(transactionId, user.uid);

      if (result.success) {
        toast({
          title: "Success",
          description: "Transaction deleted successfully",
        });
        // Call the callback to refresh the transaction list
        if (onTransactionDeleted) {
          onTransactionDeleted();
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setDeletingTransactionId(null);
    }
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedTransactions.length > 0 ? (
              displayedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {format(toJsDate(transaction.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>{transaction.source}</TableCell>
                  <TableCell>
                    {transaction.category && (
                      <Badge variant="outline" className="font-normal">
                        {transaction.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getAccountName(transaction.accountId)}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${
                        transaction.type === "income"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : transaction.type === "expense"
                          ? "bg-red-100 text-red-800 hover:bg-red-100"
                          : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                      }`}
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
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span
                      className={
                        transaction.type === "income"
                          ? "text-green-600"
                          : transaction.type === "expense"
                          ? "text-red-600"
                          : ""
                      }
                    >
                      {transaction.type === "income" ? "+" : ""}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          disabled={deletingTransactionId === transaction.id || !transaction.id}
                        >
                          {deletingTransactionId === transaction.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this transaction? This action cannot be undone.
                            The account balance will be updated to reflect this change.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => transaction.id && handleDeleteTransaction(transaction.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Delete Transaction
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
