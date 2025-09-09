"use client";

import { Account, deleteAccount } from "@/lib/accounts";
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
  Banknote,
  ArrowDownUp,
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
import { EditAccountDialog } from "@/components/edit-account-dialog";
import { AccountTransactionDialog } from "@/components/account-transaction-dialog";
import { TransferDialog } from "@/components/transfer-dialog";

interface AccountsListProps {
  accounts: Account[];
  refreshAccounts: () => Promise<void>;
}

export function AccountsList({ accounts, refreshAccounts }: AccountsListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "checking":
        return "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-200 dark:from-blue-950 dark:to-blue-900 dark:text-blue-200 dark:border-blue-700";
      case "savings":
        return "bg-gradient-to-r from-green-50 to-green-100 text-green-800 border-green-200 dark:from-green-950 dark:to-green-900 dark:text-green-200 dark:border-green-700";
      case "investment":
        return "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 border-purple-200 dark:from-purple-950 dark:to-purple-900 dark:text-purple-200 dark:border-purple-700";
      case "credit":
        return "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-200 dark:from-orange-950 dark:to-orange-900 dark:text-orange-200 dark:border-orange-700";
      default:
        return "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border-gray-200 dark:from-gray-800 dark:to-gray-700 dark:text-gray-200 dark:border-gray-600";
    }
  };

  const getAccountAccentColor = (type: string) => {
    switch (type) {
      case "checking":
        return "bg-blue-500";
      case "savings":
        return "bg-green-500";
      case "investment":
        return "bg-purple-500";
      case "credit":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!user) return;
    setIsDeleting(true);

    try {
      const result = await deleteAccount(accountId, user.uid);
      if (result.success) {
        toast({
          title: "Account deleted",
          description: "Your account was successfully deleted",
        });
        refreshAccounts();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete account",
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
      setDeletingAccountId(null);
      setIsDeleting(false);
    }
  };

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {accounts.map((account) => (
        <Card
          key={account.id}
          className="relative group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-gray-200 dark:border-gray-700 shadow-md bg-white dark:bg-gray-800 overflow-hidden"
        >
          {/* Accent stripe */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 ${getAccountAccentColor(
              account.type
            )}`}
          />
          <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
            <div
              className={`w-full h-full rounded-full ${getAccountAccentColor(
                account.type
              )} -translate-y-12 translate-x-12`}
            />
          </div>

          {account.isDefault && (
            <div className="absolute -top-2 -right-2 z-10">
              <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg border-0 px-3 py-1">
                ✨ Default
              </Badge>
            </div>
          )}

          <CardHeader className="pb-4 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl font-bold truncate mb-3 text-gray-900 dark:text-gray-100">
                  {account.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    className={`${getAccountTypeColor(
                      account.type
                    )} text-xs font-semibold border`}
                    variant="secondary"
                  >
                    {account.type.charAt(0).toUpperCase() +
                      account.type.slice(1)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {account.currency}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <EditAccountDialog
                      account={account}
                      onAccountUpdated={refreshAccounts}
                    >
                      <button className="w-full flex items-center">
                        <Edit className="mr-2 h-4 w-4" /> Edit Account
                      </button>
                    </EditAccountDialog>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <AccountTransactionDialog
                      account={account}
                      transactionType="credit"
                      onTransactionAdded={refreshAccounts}
                    >
                      <button className="w-full flex items-center">
                        <Banknote className="mr-2 h-4 w-4" /> Add Income
                      </button>
                    </AccountTransactionDialog>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <AccountTransactionDialog
                      account={account}
                      transactionType="debit"
                      onTransactionAdded={refreshAccounts}
                    >
                      <button className="w-full flex items-center">
                        <Banknote className="mr-2 h-4 w-4" /> Add Expense
                      </button>
                    </AccountTransactionDialog>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <TransferDialog
                      fromAccount={account}
                      accounts={accounts.filter((a) => a.id !== account.id)}
                      onTransferCompleted={refreshAccounts}
                    >
                      <button className="w-full flex items-center">
                        <ArrowDownUp className="mr-2 h-4 w-4" /> Transfer
                      </button>
                    </TransferDialog>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this account? This
                          action cannot be undone.
                          {account.isDefault && (
                            <p className="mt-2 font-bold text-red-600">
                              This is your default account. Deleting it will set
                              another account as default.
                            </p>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => account.id && handleDelete(account.id)}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleting && deletingAccountId === account.id
                            ? "Deleting..."
                            : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent className="pb-4 relative">
            <div className="space-y-4">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: account.currency,
                    }).format(account.balance)}
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      account.balance > 0
                        ? "bg-green-400 shadow-lg shadow-green-400/30"
                        : account.balance === 0
                        ? "bg-yellow-400 shadow-lg shadow-yellow-400/30"
                        : "bg-red-400 shadow-lg shadow-red-400/30"
                    }`}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Current Balance
                </div>
              </div>

              {account.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                  {account.description}
                </p>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 p-0 h-auto justify-start font-medium"
                onClick={() =>
                  (window.location.href = `/accounts/${account.id}`)
                }
              >
                View All Transactions →
              </Button>
            </div>
          </CardContent>

          <CardFooter className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-0">
            <AccountTransactionDialog
              account={account}
              transactionType="credit"
              onTransactionAdded={refreshAccounts}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all duration-200 font-medium"
              >
                <Banknote className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add </span>Income
              </Button>
            </AccountTransactionDialog>

            <AccountTransactionDialog
              account={account}
              transactionType="debit"
              onTransactionAdded={refreshAccounts}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-200 font-medium"
              >
                <Banknote className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add </span>Expense
              </Button>
            </AccountTransactionDialog>

            <TransferDialog
              fromAccount={account}
              accounts={accounts.filter((a) => a.id !== account.id)}
              onTransferCompleted={refreshAccounts}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 font-medium"
                disabled={
                  accounts.filter((a) => a.id !== account.id).length === 0
                }
                title={
                  accounts.filter((a) => a.id !== account.id).length === 0
                    ? "No other accounts available for transfer"
                    : "Transfer money to another account"
                }
              >
                <ArrowDownUp className="mr-2 h-4 w-4" />
                Transfer
              </Button>
            </TransferDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default AccountsList;
