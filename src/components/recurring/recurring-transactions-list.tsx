"use client";

import { RecurringTransactionWithAccount } from "@/lib/recurring-transactions";
import { Account } from "@/lib/accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  MoreHorizontal,
  Trash2,
  Calendar,
  Repeat,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
import { useState } from "react";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { format } from "date-fns";
import {
  deleteRecurringTransaction,
  updateRecurringTransaction,
} from "@/lib/recurring-transactions";
import { Switch } from "@/components/ui/switch";
import { EditRecurringTransactionDialog } from "./edit-recurring-transaction-dialog";

interface RecurringTransactionsListProps {
  transactions: RecurringTransactionWithAccount[];
  accounts: Account[];
  onTransactionUpdated?: () => Promise<void>;
}

export function RecurringTransactionsList({
  transactions,
  accounts,
  onTransactionUpdated,
}: RecurringTransactionsListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const [deletingTransactionId, setDeletingTransactionId] = useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "biweekly":
        return "Every 2 Weeks";
      case "monthly":
        return "Monthly";
      case "quarterly":
        return "Quarterly";
      case "yearly":
        return "Yearly";
      default:
        return frequency;
    }
  };

  const getTypeColor = (type: string) => {
    return type === "income"
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";
  };

  const handleDelete = async (transactionId: string) => {
    if (!user) return;
    setIsDeleting(true);

    try {
      const result = await deleteRecurringTransaction(transactionId, user.uid);
      if (result.success) {
        toast({
          title: "Transaction deleted",
          description: "Your recurring transaction was successfully deleted",
        });
        if (onTransactionUpdated) {
          onTransactionUpdated();
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
        description: (error as Error).message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDeletingTransactionId(null);
      setIsDeleting(false);
    }
  };

  const toggleActive = async (transaction: RecurringTransactionWithAccount) => {
    if (!user || !transaction.id) return;
    setIsTogglingActive(true);

    try {
      const result = await updateRecurringTransaction(
        transaction.id,
        { isActive: !transaction.isActive },
        user.uid
      );

      if (result.success) {
        toast({
          title: transaction.isActive
            ? "Transaction deactivated"
            : "Transaction activated",
          description: `Recurring ${
            transaction.isActive ? "deactivated" : "activated"
          } successfully`,
        });
        if (onTransactionUpdated) {
          onTransactionUpdated();
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Format date to be more readable
  const formatDate = (date: Date | string | any) => {
    if (!date) return "N/A";

    // Handle Timestamp objects
    if (date && typeof date === "object" && "toDate" in date) {
      return format(date.toDate(), "MMM d, yyyy");
    }

    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, "MMM d, yyyy");
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {transactions.map((transaction) => (
        <Card
          key={transaction.id}
          className={`relative ${!transaction.isActive ? "opacity-60" : ""}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-center text-base sm:text-lg">
              <span className="truncate pr-2">{transaction.description}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Transaction Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <EditRecurringTransactionDialog
                      transaction={transaction}
                      accounts={accounts}
                      onTransactionUpdated={onTransactionUpdated}
                    >
                      <button className="w-full flex items-center">
                        <Edit className="mr-2 h-4 w-4" /> Edit Transaction
                      </button>
                    </EditRecurringTransactionDialog>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toggleActive(transaction)}
                    disabled={isTogglingActive}
                  >
                    {transaction.isActive ? (
                      <>
                        <ToggleLeft className="mr-2 h-4 w-4" /> Deactivate
                      </>
                    ) : (
                      <>
                        <ToggleRight className="mr-2 h-4 w-4" /> Activate
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-red-600 focus:text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Transaction
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete Recurring Transaction
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this recurring
                          transaction? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            transaction.id && handleDelete(transaction.id)
                          }
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleting &&
                          deletingTransactionId === transaction.id
                            ? "Deleting..."
                            : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardTitle>
            <div className="flex gap-2 flex-wrap mt-1">
              <Badge className={getTypeColor(transaction.type)}>
                {transaction.type === "income" ? "Income" : "Expense"}
              </Badge>
              <Badge variant="outline" className="flex items-center">
                <Repeat className="mr-1 h-3 w-3" />
                {getFrequencyLabel(transaction.frequency)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative pt-2 pb-6">
            <div className="text-xl sm:text-2xl font-bold truncate">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: transaction.account?.currency || "USD",
              }).format(transaction.amount)}
            </div>

            <div className="text-xs sm:text-sm text-muted-foreground mt-2 flex flex-col gap-1">
              <div className="flex items-center">
                <span className="font-medium">Account:</span>
                <span className="ml-2">
                  {transaction.account?.name || "Unknown Account"}
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-medium">Next date:</span>
                <span className="ml-2">
                  {transaction.nextProcessDate
                    ? formatDate(transaction.nextProcessDate)
                    : "N/A"}
                </span>
              </div>
              {transaction.category && (
                <div className="flex items-center">
                  <span className="font-medium">Category:</span>
                  <span className="ml-2">{transaction.category}</span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={transaction.isActive}
                onCheckedChange={() => toggleActive(transaction)}
                disabled={isTogglingActive}
              />
              <span className="text-xs text-muted-foreground">
                {transaction.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Started: {formatDate(transaction.startDate)}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default RecurringTransactionsList;
