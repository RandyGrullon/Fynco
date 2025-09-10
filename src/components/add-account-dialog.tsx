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
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AccountType, addAccount } from "@/lib/accounts";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface AddAccountDialogProps {
  onAccountAdded?: () => void;
  children?: React.ReactNode;
}

export function AddAccountDialog({
  onAccountAdded,
  children,
}: AddAccountDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; balance?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add an account",
        variant: "destructive",
      });
      return;
    }

    // client-side validation with inline errors
    const newErrors: typeof errors = {};
    if (!name) newErrors.name = "Account name is required";
    const numericBalance = parseFloat(balance);
    if (isNaN(numericBalance))
      newErrors.balance = "Balance must be a valid number";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const numericBalance = parseFloat(balance);

      const result = await addAccount(
        {
          name,
          balance: numericBalance,
          type,
          currency,
          description,
          isDefault,
        },
        user.uid
      );

      if (result.success) {
        toast({
          title: "Success",
          description: "Account added successfully",
        });
        setOpen(false);
        setName("");
        setBalance("0");
        setType("checking");
        setCurrency("USD");
        setDescription("");
        setIsDefault(false);
        setErrors({});
        if (onAccountAdded) {
          onAccountAdded();
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add account",
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
      <DialogTrigger asChild>
        {children || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogDescription>
              Create a new account to track your finances.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <div className="col-span-3">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((s) => ({ ...s, name: undefined }));
                  }}
                  className={`w-full ${
                    errors.name ? "border-red-500 ring-1 ring-red-300" : ""
                  }`}
                  placeholder="Main Checking Account"
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="balance" className="text-right">
                Balance
              </Label>
              <div className="col-span-3">
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => {
                    setBalance(e.target.value);
                    setErrors((s) => ({ ...s, balance: undefined }));
                  }}
                  className={`w-full ${
                    errors.balance ? "border-red-500 ring-1 ring-red-300" : ""
                  }`}
                  placeholder="0.00"
                  aria-invalid={!!errors.balance}
                />
                {errors.balance && (
                  <p className="mt-1 text-sm text-red-600">{errors.balance}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as AccountType)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currency" className="text-right">
                Currency
              </Label>
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="DOP">DOP (RD$)</SelectItem>
                </SelectContent>
              </Select>
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
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="default" className="text-right">
                Default
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Checkbox
                  id="default"
                  checked={isDefault}
                  onCheckedChange={(checked) => {
                    setIsDefault(checked === true);
                  }}
                />
                <Label htmlFor="default" className="font-normal">
                  Set as default account
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
