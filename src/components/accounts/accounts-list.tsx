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
        return "bg-blue-100 text-blue-800";
      case "savings":
        return "bg-green-100 text-green-800";
      case "investment":
        return "bg-purple-100 text-purple-800";
      case "credit":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <Card key={account.id} className="relative">
          {account.isDefault && (
            <Badge className="absolute top-2 right-2 bg-primary">Default</Badge>
          )}
          <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-center text-base sm:text-lg">
              <span className="truncate pr-2">{account.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
            </CardTitle>
            <CardDescription>
              <Badge className={`${getAccountTypeColor(account.type)}`}>
                {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pt-2 pb-10">
            <div className="text-xl sm:text-2xl font-bold truncate">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: account.currency,
              }).format(account.balance)}
            </div>
            {account.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2">
                {account.description}
              </p>
            )}
            <Button
              variant="link"
              className="absolute bottom-0 right-0 p-0 text-xs sm:text-sm"
              onClick={() => (window.location.href = `/accounts/${account.id}`)}
            >
              View Transactions
            </Button>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 justify-between">
            <AccountTransactionDialog
              account={account}
              transactionType="credit"
              onTransactionAdded={refreshAccounts}
            >
              <Button variant="outline" size="sm" className="text-xs h-8">
                <Banknote className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> Add
                Income
              </Button>
            </AccountTransactionDialog>
            <AccountTransactionDialog
              account={account}
              transactionType="debit"
              onTransactionAdded={refreshAccounts}
            >
              <Button variant="outline" size="sm" className="text-xs h-8">
                <Banknote className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> Add
                Expense
              </Button>
            </AccountTransactionDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default AccountsList;
