"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Account, addAccountTransaction } from "@/lib/accounts";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TransferDialogProps {
  fromAccount: Account;
  accounts: Account[];
  onTransferCompleted?: () => void;
  children?: React.ReactNode;
}

export function TransferDialog({
  fromAccount,
  accounts,
  onTransferCompleted,
  children,
}: TransferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState(
    fromAccount.id || ""
  );

  // Keep sourceAccountId in sync when the dialog opens or when the prop changes
  useEffect(() => {
    setSourceAccountId(fromAccount.id || "");
  }, [fromAccount.id, open]);

  // Helper to swap source and destination accounts
  const handleSwapAccounts = () => {
    // If no destination is selected, swap with the original fromAccount
    if (!toAccountId) {
      if (sourceAccountId !== fromAccount.id) {
        // If current source is not the original fromAccount, swap with original
        setToAccountId(sourceAccountId);
        setSourceAccountId(fromAccount.id || "");
      }
      return;
    }

    // Normal swap when both accounts are selected
    const prevSource = sourceAccountId;
    const prevDest = toAccountId;

    setSourceAccountId(prevDest);
    setToAccountId(prevSource);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fromAccount.id) {
      toast({
        title: "Error",
        description: "You must be logged in with a valid account",
        variant: "destructive",
      });
      return;
    }

    if (!toAccountId) {
      toast({
        title: "Error",
        description: "Please select a destination account",
        variant: "destructive",
      });
      return;
    }

    if (toAccountId === sourceAccountId) {
      toast({
        title: "Error",
        description: "Source and destination accounts must be different",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

  // Description is optional for transfers

  // Check if there's enough balance for the transfer
    const transferAmount = parseFloat(amount);
    // lookup source account balance
    const allAccounts = [fromAccount, ...accounts];
    const sourceAcc = allAccounts.find((a) => a.id === sourceAccountId) ||
      fromAccount;
    if (sourceAcc.balance < transferAmount) {
      toast({
        title: "Error",
        description: "Insufficient balance for this transfer",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
    const result = await addAccountTransaction(
        {
      accountId: sourceAccountId,
          amount: transferAmount,
          description,
          type: "transfer",
          toAccountId,
          date: new Date(),
        },
        user.uid
      );

      if (result.success) {
        toast({
          title: "Success",
          description: `Transfer completed successfully`,
        });
        setOpen(false);
        setAmount("");
        setDescription("");
        setToAccountId("");
  setSourceAccountId(fromAccount.id || "");
        if (onTransferCompleted) {
          onTransferCompleted();
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to complete transfer",
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
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Transfer Funds</DialogTitle>
            <DialogDescription>
              Transfer funds between your accounts
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fromAccount" className="text-right">
                From
              </Label>
              <div className="col-span-3">
                {(() => {
                  const allAccounts = [fromAccount, ...accounts];
                  const currentSourceAccount = allAccounts.find((a) => a.id === sourceAccountId) || fromAccount;
                  return (
                    <>
                      <p className="text-sm font-medium">{currentSourceAccount.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Balance:{" "}
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: currentSourceAccount.currency,
                        }).format(currentSourceAccount.balance)}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="toAccount" className="text-right">
                To
              </Label>
              <div className="col-span-3 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-10">
                  <Select value={toAccountId} onValueChange={setToAccountId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select destination account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.length === 0 ? (
                        <SelectItem value="no-accounts" disabled>
                          No other accounts available
                        </SelectItem>
                      ) : (
                        // Include all accounts but remove duplicates and exclude the current sourceAccountId
                        [fromAccount, ...accounts]
                          .filter((account, index, arr) => 
                            account.id !== sourceAccountId &&
                            arr.findIndex(a => a.id === account.id) === index
                          )
                          .map((account) => (
                            <SelectItem key={account.id} value={account.id || ""}>
                              {account.name}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleSwapAccounts}
                    disabled={!toAccountId && sourceAccountId === fromAccount.id}
                    title="Swap From/To accounts"
                  >
                    ⇄
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-3"
                placeholder="0.00"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
                placeholder="Transfer description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading || accounts.length === 0}>
              {loading ? "Processing..." : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
