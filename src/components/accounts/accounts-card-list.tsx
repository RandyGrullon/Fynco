"use client";

import { Account, deleteAccount } from "@/lib/accounts";
import {
  Card,
  CardContent,
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
  CreditCard,
  Building,
  PiggyBank,
  Wallet,
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

interface AccountsCardListProps {
  accounts: Account[];
  refreshAccounts: () => Promise<void>;
}

export function AccountsCardList({
  accounts,
  refreshAccounts,
}: AccountsCardListProps) {
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

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "checking":
        return <CreditCard className="h-5 w-5 text-blue-600" />;
      case "savings":
        return <PiggyBank className="h-5 w-5 text-green-600" />;
      case "investment":
        return <Building className="h-5 w-5 text-purple-600" />;
      case "credit":
        return <Wallet className="h-5 w-5 text-orange-600" />;
      default:
        return <Banknote className="h-5 w-5 text-gray-600" />;
    }
  };

  // Safely format an updatedAt value that may be a Firestore Timestamp or a string/Date
  const formatUpdatedAt = (value: string | Date | any) => {
    try {
      if (value && typeof (value as any).toDate === "function") {
        return (value as any).toDate().toLocaleDateString();
      }
      return new Date(value as any).toLocaleDateString();
    } catch (e) {
      return "";
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!user) return;

    setDeletingAccountId(accountId);
    setIsDeleting(true);

    try {
      const result = await deleteAccount(accountId, user.uid);
      if (result.success) {
        toast({
          title: "Account deleted",
          description: "The account has been successfully deleted",
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
      {accounts.length === 0 ? (
        <div className="col-span-full text-center py-10 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground">No accounts available.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first account to get started.
          </p>
        </div>
      ) : (
        accounts.map((account) => (
          <Card
            key={account.id}
            className={`${getAccountTypeColor(
              account.type
            )} relative overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200`}
          >
            {/* Accent stripe */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${getAccountAccentColor(
                account.type
              )}`}
            />

            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
              <div
                className={`w-full h-full rounded-full ${getAccountAccentColor(
                  account.type
                )} -translate-y-12 translate-x-12`}
              />
            </div>

            {/* Default badge */}
            {account.isDefault && (
              <div className="absolute -top-2 -right-2 z-10">
                <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg border-0 px-3 py-1">
                  ✨ Default
                </Badge>
              </div>
            )}

            {/* Loading overlay when deleting */}
            {deletingAccountId === account.id && isDeleting && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
                <div className="flex items-center gap-2 bg-background/90 px-4 py-2 rounded-md shadow-lg">
                  <span className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                  <span>Deleting...</span>
                </div>
              </div>
            )}

            <CardHeader className="pb-2 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getAccountIcon(account.type)}
                  <CardTitle className="text-xl font-bold truncate max-w-[12rem]">
                    {account.name}
                  </CardTitle>
                </div>

                <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-w-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Account options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <EditAccountDialog
                      account={account}
                      onAccountUpdated={refreshAccounts}
                    >
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    </EditAccountDialog>
                    <TransferDialog
                      fromAccount={account}
                      accounts={accounts.filter((a) => a.id !== account.id)}
                      onTransferCompleted={refreshAccounts}
                    >
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <svg
                          className="mr-2 h-4 w-4"
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          ></path>
                        </svg>
                        Transfer
                      </DropdownMenuItem>
                    </TransferDialog>
                    <AccountTransactionDialog
                      account={account}
                      transactionType="debit"
                      onTransactionAdded={refreshAccounts}
                    >
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <svg
                          className="mr-2 h-4 w-4"
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          ></path>
                        </svg>
                        Add Transaction
                      </DropdownMenuItem>
                    </AccountTransactionDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete account "{account.name}"?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the account and all associated transactions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              account.id && handleDelete(account.id)
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  className="text-xs font-semibold border"
                  variant="secondary"
                >
                  {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {account.currency}
                </span>
                {account.isGoalAccount && (
                  <Badge
                    className="bg-amber-100 text-amber-700 text-xs font-semibold border"
                    variant="secondary"
                  >
                    Goal Account
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0 min-w-0">
              <div className="text-2xl font-bold mt-2 truncate min-w-0">
                {formatCurrency(account.balance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {formatUpdatedAt(account.updatedAt)}
              </p>
            </CardContent>

            <CardFooter className="gap-2 pt-0 pb-4 flex flex-wrap">
              <EditAccountDialog
                account={account}
                onAccountUpdated={refreshAccounts}
              >
                <Button size="sm" variant="outline" className="h-8 min-w-0">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  <span className="truncate">Edit</span>
                </Button>
              </EditAccountDialog>

              <AccountTransactionDialog
                account={account}
                transactionType="debit"
                onTransactionAdded={refreshAccounts}
              >
                <Button size="sm" variant="outline" className="h-8 min-w-0">
                  <svg
                    className="h-3.5 w-3.5 mr-1"
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  <span className="truncate">Add</span>
                </Button>
              </AccountTransactionDialog>

              <TransferDialog
                fromAccount={account}
                accounts={accounts.filter((a) => a.id !== account.id)}
                onTransferCompleted={refreshAccounts}
              >
                <Button size="sm" variant="outline" className="h-8 min-w-0">
                  <svg
                    className="h-3.5 w-3.5 mr-1"
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  <span className="truncate">Transfer</span>
                </Button>
              </TransferDialog>
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  );
}
