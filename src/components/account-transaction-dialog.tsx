"use client";

import { useState } from "react";
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
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountTransactionDialogProps {
  account: Account;
  transactionType: "debit" | "credit";
  onTransactionAdded?: () => void;
  children?: React.ReactNode;
}

export function AccountTransactionDialog({
  account,
  transactionType,
  onTransactionAdded,
  children,
}: AccountTransactionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrencyFormatter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  // Define transaction categories based on type
  const categories =
    transactionType === "credit"
      ? ["Salary", "Investment", "Gift", "Refund", "Other"]
      : [
          "Food",
          "Transport",
          "Shopping",
          "Utilities",
          "Entertainment",
          "Other",
        ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !account.id) {
      toast({
        title: "Error",
        description: "You must be logged in with a valid account",
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

    // Description is now optional

    setLoading(true);
    try {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) {
        throw new Error("Invalid amount");
      }

      const result = await addAccountTransaction(
        {
          accountId: account.id,
          amount: numericAmount,
          description,
          ...(category ? { category } : {}), // Solo incluir category si tiene un valor
          type: transactionType,
          date: new Date(),
        },
        user.uid
      );

      if (result.success) {
        toast({
          title: "Success",
          description: `Transaction added successfully`,
        });
        setOpen(false);
        setAmount("");
        setDescription("");
        setCategory("");
        if (onTransactionAdded) {
          onTransactionAdded();
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add transaction",
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
            <DialogTitle>
              {transactionType === "credit" ? "Add Income" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              {transactionType === "credit"
                ? "Add income to your account"
                : "Add an expense from your account"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="account" className="text-right">
                Account
              </Label>
              <div className="col-span-3">
                <p className="text-sm font-medium">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  Balance: {formatCurrency(account.balance)}
                </p>
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
              <Label htmlFor="category" className="text-right">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
                <span className="text-xs text-muted-foreground">
                  {" "}
                  (optional)
                </span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
                placeholder="Transaction description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
