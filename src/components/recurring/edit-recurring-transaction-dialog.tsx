"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Account, getAccountById } from "@/lib/accounts";
import { AddAccountDialog } from "../add-account-dialog";
import {
  RecurringTransactionWithAccount,
  RecurrenceFrequency,
  updateRecurringTransaction,
} from "@/lib/recurring-transactions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const recurringTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  accountId: z.string().min(1, "Account is required"),
  category: z.string().min(1, "Category is required"),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  frequency: z.enum([
    "daily",
    "weekly",
    "biweekly",
    "monthly",
    "quarterly",
    "yearly",
  ]),
  isActive: z.boolean().default(true),
});

type RecurringTransactionFormValues = z.infer<
  typeof recurringTransactionSchema
>;

interface EditRecurringTransactionDialogProps {
  transaction: RecurringTransactionWithAccount;
  accounts: Account[];
  onTransactionUpdated?: () => void; // Made optional with ?
  children?: React.ReactNode;
}

export function EditRecurringTransactionDialog({
  transaction,
  accounts,
  onTransactionUpdated,
  children,
}: EditRecurringTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: {
      type: "expense",
      amount: 0,
      description: "",
      accountId: "",
      category: "",
      startDate: new Date(),
      endDate: null,
      frequency: "monthly",
      isActive: true,
    },
  });

  // Set form values when the transaction data is available
  useEffect(() => {
    if (transaction) {
      const startDate =
        typeof transaction.startDate === "string"
          ? new Date(transaction.startDate)
          : transaction.startDate instanceof Date
          ? transaction.startDate
          : transaction.startDate?.toDate();

      const endDate = transaction.endDate
        ? typeof transaction.endDate === "string"
          ? new Date(transaction.endDate)
          : transaction.endDate instanceof Date
          ? transaction.endDate
          : transaction.endDate?.toDate()
        : null;

      form.reset({
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        accountId: transaction.accountId,
        category: transaction.category,
        startDate: startDate || new Date(),
        endDate: endDate,
        frequency: transaction.frequency as RecurrenceFrequency,
        isActive: transaction.isActive,
      });
    }
  }, [transaction, form]);

  const incomeCategories = ["Salary", "Investment", "Gift", "Refund", "Other"];
  const expenseCategories = [
    "Food",
    "Transport",
    "Shopping",
    "Utilities",
    "Entertainment",
    "Other",
  ];

  const selectedType = form.watch("type");

  // Local accounts state so we can add inline and select new account
  const [localAccounts, setLocalAccounts] = useState<Account[]>(accounts || []);

  useEffect(() => {
    setLocalAccounts(accounts || []);
  }, [accounts]);

  const handleAccountCreated = async (accountId?: string) => {
    if (!accountId) return;
    const existing = (accounts || []).find((a) => a.id === accountId);
    if (existing) {
      setLocalAccounts((s) => [
        existing,
        ...s.filter((a) => a.id !== accountId),
      ]);
      form.setValue("accountId", accountId);
      return;
    }

    try {
      const acct = await getAccountById((user && user.uid) || "", accountId);
      if (acct) {
        setLocalAccounts((s) => [acct, ...s.filter((a) => a.id !== acct.id)]);
        form.setValue("accountId", acct.id || accountId);
      } else {
        form.setValue("accountId", accountId);
      }
    } catch (e) {
      form.setValue("accountId", accountId);
    }
  };

  const handleSubmit = async (values: RecurringTransactionFormValues) => {
    if (!user || !transaction.id) {
      toast({
        title: "Error",
        description: "You must be logged in to update a recurring transaction",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateRecurringTransaction(
        transaction.id,
        {
          ...values,
        },
        user.uid
      );

      if (result.success) {
        toast({
          title: "Success",
          description: "Recurring transaction updated successfully",
        });
        setOpen(false);
        if (onTransactionUpdated) {
          onTransactionUpdated();
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update recurring transaction",
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
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Recurring Transaction</DialogTitle>
          <DialogDescription>
            Update your recurring transaction settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Transaction Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="income" id="edit-income" />
                        <label
                          htmlFor="edit-income"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Income
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <RadioGroupItem value="expense" id="edit-expense" />
                        <label
                          htmlFor="edit-expense"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Expense
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? "0" : e.target.value;
                        field.onChange(parseFloat(value));
                      }}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Monthly Rent" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <div className="flex items-center space-x-2">
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {localAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id || ""}>
                            {account.name} ({account.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <AddAccountDialog onAccountAdded={handleAccountCreated}>
                      <Button variant="outline" size="sm">
                        <PlusCircle className="mr-1 h-4 w-4" />
                        Add Account
                      </Button>
                    </AddAccountDialog>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(selectedType === "income"
                        ? incomeCategories
                        : expenseCategories
                      ).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How often this transaction should recur
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    When this recurring transaction should start
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>No end date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Leave blank for transactions that continue indefinitely
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Toggle to enable or disable this recurring transaction
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
