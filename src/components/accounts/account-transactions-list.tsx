"use client";

import { useState, useEffect } from "react";
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
import { ArrowUp, ArrowDown, Repeat, CalendarClock } from "lucide-react";
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions History</CardTitle>
        <CardDescription>All transactions for {account.name}</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No transactions found for this account.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
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
                        currency: account.currency,
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
  );
}

export default AccountTransactionsList;
