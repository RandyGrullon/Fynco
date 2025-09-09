"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  getAllAccountTransactions,
  getAccounts,
  AccountTransaction,
  Account,
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
import { ArrowUp, ArrowDown, Repeat, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function AllTransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      if (user) {
        setLoading(true);
        const fetchedAccounts = await getAccounts(user.uid);

        // Create a lookup map for account data
        const accountsMap: Record<string, Account> = {};
        fetchedAccounts.forEach((account) => {
          if (account.id) {
            accountsMap[account.id] = account;
          }
        });
        setAccounts(accountsMap);

        const fetchedTransactions = await getAllAccountTransactions(user.uid);
        setTransactions(fetchedTransactions);
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

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
        return "bg-green-100 text-green-800";
      case "debit":
        return "bg-red-100 text-red-800";
      case "transfer":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAccountName = (accountId: string) => {
    if (accounts[accountId]) {
      return accounts[accountId].name;
    }
    return "Unknown Account";
  };

  const getAccountCurrency = (accountId: string) => {
    if (accounts[accountId]) {
      return accounts[accountId].currency;
    }
    return "USD";
  };

  // Filter transactions based on selected filters
  const filteredTransactions = transactions.filter((transaction) => {
    // Filter by transaction type
    if (filterType !== "all" && transaction.type !== filterType) {
      return false;
    }

    // Filter by account
    if (filterAccount !== "all" && transaction.accountId !== filterAccount) {
      return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          All Transactions
        </h1>

        <div className="flex flex-col space-y-2 md:flex-row md:space-x-2 md:space-y-0">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="credit">Income</SelectItem>
              <SelectItem value="debit">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAccount} onValueChange={setFilterAccount}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {Object.values(accounts).map((account) => (
                <SelectItem key={account.id} value={account.id || ""}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setFilterType("all");
              setFilterAccount("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions History</CardTitle>
          <CardDescription>
            All your account transactions in one place
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No transactions found with the current filters.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center">
                          <CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />
                          {typeof transaction.date === "string"
                            ? format(new Date(transaction.date), "dd MMM yyyy")
                            : format(transaction.date as Date, "dd MMM yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {getAccountName(transaction.accountId)}
                        </div>
                        {transaction.toAccountId && (
                          <div className="text-xs text-muted-foreground">
                            To: {getAccountName(transaction.toAccountId)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${getTransactionTypeColor(
                            transaction.type
                          )}`}
                        >
                          <span className="flex items-center">
                            {getTransactionTypeIcon(transaction.type)}
                            <span className="ml-1 capitalize">
                              {transaction.type}
                            </span>
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {transaction.description}
                          </span>
                          {transaction.category && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {transaction.category}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          transaction.type === "credit"
                            ? "text-green-600"
                            : transaction.type === "debit"
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: getAccountCurrency(transaction.accountId),
                        }).format(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
