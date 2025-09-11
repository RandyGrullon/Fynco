"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Calendar as CalendarIcon, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { VoiceExpenseRecorder } from "./voice-expense-recorder";
import { useToast } from "@/hooks/use-toast";
import { RecordExpenseOutput } from "@/ai/flows/voice-expense-recording";
import {
  addTransaction,
  updateTransaction,
  Transaction,
} from "@/lib/transactions";
import { useAuth } from "@/hooks/use-auth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  source: z.string().min(1, "Source is required"),
  date: z.date(),
  currency: z.string().min(1, "Currency is required"),
  method: z.string().min(1, "Payment method is required"),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

import { Account } from "@/lib/accounts";
import { AddAccountDialog } from "./add-account-dialog";
import { getAccountById } from "@/lib/accounts";

interface AddTransactionDialogProps {
  onTransactionAdded: () => void;
  transaction?: Transaction;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  initialType?: "income" | "expense";
  accounts: Account[]; // Add accounts prop
}

export function AddTransactionDialog({
  onTransactionAdded,
  transaction,
  open: controlledOpen,
  setOpen: controlledSetOpen,
  initialType = "expense",
  accounts,
}: AddTransactionDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("manual");

  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledSetOpen ?? setInternalOpen;

  const isEditMode = !!transaction;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: initialType,
      amount: undefined,
      source: "",
      date: new Date(),
      currency: "USD",
      method: initialType === "income" ? "Direct Deposit" : "Credit Card",
      category: initialType === "income" ? "Salary" : "Food",
      accountId: accounts.length > 0 ? accounts[0].id || "" : "",
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && transaction) {
        form.reset({
          type: transaction.type,
          amount: transaction.amount,
          source: transaction.source,
          date: new Date(transaction.date as string),
          method: transaction.method,
          category: transaction.category,
          currency: "USD", // Default or from settings
          accountId:
            transaction.accountId ||
            (accounts.length > 0 ? accounts[0].id || "" : ""),
        });
      } else {
        form.reset({
          type: initialType,
          amount: undefined,
          source: "",
          date: new Date(),
          currency: "USD",
          method: initialType === "income" ? "Direct Deposit" : "Credit Card",
          category: initialType === "income" ? "Salary" : "Food",
          accountId: accounts.length > 0 ? accounts[0].id || "" : "",
        });
      }
      setActiveTab("manual");
    }
  }, [open, isEditMode, transaction, form, initialType, accounts]);

  // Local accounts state so we can add inline and select new account
  const [localAccounts, setLocalAccounts] = useState<Account[]>(accounts || []);

  useEffect(() => {
    setLocalAccounts(accounts || []);
  }, [accounts]);

  const handleAccountCreated = async (accountId?: string) => {
    if (!accountId) return;
    // Try to find the newly created account in the provided accounts list
    const existing = (accounts || []).find((a) => a.id === accountId);
    if (existing) {
      setLocalAccounts((s) => [
        existing,
        ...s.filter((a) => a.id !== accountId),
      ]);
      form.setValue("accountId", accountId);
      return;
    }

    // Otherwise try to fetch it directly
    try {
      const acct = await getAccountById(user?.uid || "", accountId);
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

  // Watch for type changes to update category defaults
  const currentType = form.watch("type");

  useEffect(() => {
    // Update category and method when type changes
    if (currentType === "income") {
      if (form.getValues("category") === "Food") {
        form.setValue("category", "Salary");
      }

      // Update payment method for income
      const currentMethod = form.getValues("method");
      if (
        ["Credit Card", "Debit Card", "Cash", "Bank Transfer"].includes(
          currentMethod
        )
      ) {
        form.setValue("method", "Direct Deposit");
      }
    } else if (currentType === "expense") {
      if (form.getValues("category") === "Salary") {
        form.setValue("category", "Food");
      }

      // Update payment method for expense
      const currentMethod = form.getValues("method");
      if (currentMethod === "Direct Deposit") {
        form.setValue("method", "Credit Card");
      }
    }
  }, [currentType, form]);

  const onSubmit = async (data: TransactionFormValues) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in.",
      });
      return;
    }

    const transactionData = {
      amount: data.amount,
      source: data.source,
      date: data.date,
      method: data.method as Transaction["method"],
      category: data.category as Transaction["category"],
      type: data.type,
      accountId: data.accountId,
    };

    // Client-side guard: ensure account selected
    if (!transactionData.accountId) {
      toast({
        variant: "destructive",
        title: "Account required",
        description: "Please select an account before creating a transaction.",
      });
      return;
    }

    const result =
      isEditMode && transaction?.id
        ? await updateTransaction(transaction.id, transactionData, user.uid)
        : await addTransaction(transactionData, user.uid);

    if (result.success) {
      toast({
        title: `${data.type === "expense" ? "Expense" : "Income"} ${
          isEditMode ? "Updated" : "Added"
        }`,
        description: `${data.source} for $${data.amount} has been successfully recorded.`,
        className: "bg-accent text-accent-foreground",
      });
      setOpen(false);
      onTransactionAdded(); // Callback to refresh data
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to record transaction: ${result.error}`,
      });
    }
  };

  const handleTranscriptionComplete = (data: RecordExpenseOutput) => {
    if (data.amount) form.setValue("amount", data.amount);
    if (data.source) form.setValue("source", data.source);
    if (data.date) form.setValue("date", new Date(data.date));
    if (data.currency) form.setValue("currency", data.currency);
    if (data.method) form.setValue("method", data.method as any);
    // Use first account as default for voice transactions
    if (accounts.length > 0 && accounts[0].id) {
      form.setValue("accountId", accounts[0].id);
    }

    toast({
      title: "Transcription Complete",
      description: "Review the details and save your transaction.",
    });
    setActiveTab("manual");
  };

  // Determine which payment/receipt methods to show based on the transaction type
  const getMethodsForType = () => {
    if (currentType === "income") {
      return (
        <>
          <SelectItem value="Direct Deposit">Direct Deposit</SelectItem>
          <SelectItem value="Cash">Cash Payment</SelectItem>
          <SelectItem value="Credit Card">Credit Card Refund</SelectItem>
          <SelectItem value="Debit Card">Debit Card Refund</SelectItem>
          <SelectItem value="Bank Transfer">Electronic Transfer</SelectItem>
        </>
      );
    } else {
      return (
        <>
          <SelectItem value="Credit Card">Credit Card</SelectItem>
          <SelectItem value="Debit Card">Debit Card</SelectItem>
          <SelectItem value="Cash">Cash</SelectItem>
          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
        </>
      );
    }
  };

  // Determine which categories to show based on the transaction type
  const getCategoriesForType = () => {
    if (currentType === "income") {
      return (
        <>
          <SelectItem value="Salary">Salary / Wages</SelectItem>
          <SelectItem value="Investment">Investment Returns</SelectItem>
          <SelectItem value="Gift">Gift / Donation</SelectItem>
          <SelectItem value="Refund">Refund / Reimbursement</SelectItem>
          <SelectItem value="Transfer">Transfer In</SelectItem>
          <SelectItem value="Other">Other Income</SelectItem>
        </>
      );
    } else {
      return (
        <>
          <SelectItem value="Food">Food & Dining</SelectItem>
          <SelectItem value="Transport">Transport & Travel</SelectItem>
          <SelectItem value="Shopping">Shopping & Retail</SelectItem>
          <SelectItem value="Utilities">Bills & Utilities</SelectItem>
          <SelectItem value="Entertainment">Entertainment & Leisure</SelectItem>
          <SelectItem value="Transfer">Transfer Out</SelectItem>
          <SelectItem value="Other">Other Expenses</SelectItem>
        </>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <DialogTrigger asChild>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Transaction" : "Add a New Transaction"}
          </DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger
              value="voice"
              disabled={isEditMode || currentType === "income"}
            >
              Voice
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-1 pb-4">
                      <FormLabel className="text-base font-semibold">
                        Transaction Type
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                          value={field.value}
                        >
                          <FormItem className="flex flex-1 items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem
                                value="expense"
                                className="border-red-400"
                              />
                            </FormControl>
                            <FormLabel className="w-full cursor-pointer rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center font-medium text-red-600">
                              Expense
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex flex-1 items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem
                                value="income"
                                className="border-green-400"
                              />
                            </FormControl>
                            <FormLabel className="w-full cursor-pointer rounded-md border border-green-200 bg-green-50 px-3 py-2 text-center font-medium text-green-600">
                              Income
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
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
                            {...field}
                            value={field.value ?? ""}
                            aria-invalid={!!form.formState.errors.amount}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                          <FormMessage />
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <div className="flex items-center space-x-2">
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {localAccounts.map((account) => (
                              <SelectItem
                                key={account.id}
                                value={account.id || ""}
                              >
                                {account.name} ({account.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Inline add account button opens AddAccountDialog */}
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
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {currentType === "expense"
                          ? "Paid To / Vendor"
                          : "Received From / Source"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            currentType === "expense"
                              ? "e.g., Starbucks, Amazon, Rent"
                              : "e.g., Employer, Client, Investments"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {currentType === "expense"
                            ? "Payment Method"
                            : "Income Method"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>{getMethodsForType()}</SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {currentType === "expense"
                            ? "Expense Category"
                            : "Income Category"}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getCategoriesForType()}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        {currentType === "expense"
                          ? "Date of Payment"
                          : "Date Received"}
                      </FormLabel>
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
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  {isEditMode ? "Save Changes" : "Save Transaction"}
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="voice">
            <VoiceExpenseRecorder
              onTranscriptionComplete={handleTranscriptionComplete}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
