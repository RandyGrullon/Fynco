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
import { Account } from "@/lib/accounts";

const expenseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  source: z.string().min(1, "Source is required"),
  date: z.date(),
  currency: z.string().min(1, "Currency is required"), // Placeholder, not in DB schema
  method: z.string().min(1, "Payment method is required"),
  category: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface AddExpenseDialogProps {
  onExpenseAdded: () => void;
  transaction?: Transaction;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  accounts: Account[]; // Add accounts prop
}

export function AddExpenseDialog({
  onExpenseAdded,
  transaction,
  open: controlledOpen,
  setOpen: controlledSetOpen,
  accounts,
}: AddExpenseDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("manual");

  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledSetOpen ?? setInternalOpen;

  const isEditMode = !!transaction;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: undefined,
      source: "",
      date: new Date(),
      currency: "USD",
      method: "Credit Card",
      category: "Food",
      accountId: accounts.length > 0 ? accounts[0].id || "" : "",
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && transaction) {
        form.reset({
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
          amount: undefined,
          source: "",
          date: new Date(),
          currency: "USD",
          method: "Credit Card",
          category: "Food",
          accountId: accounts.length > 0 ? accounts[0].id || "" : "",
        });
      }
      setActiveTab("manual");
    }
  }, [open, isEditMode, transaction, form, accounts]);

  const onSubmit = async (data: ExpenseFormValues) => {
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
      type: "expense" as const,
      accountId: data.accountId,
    };

    const result =
      isEditMode && transaction?.id
        ? await updateTransaction(transaction.id, transactionData, user.uid)
        : await addTransaction(transactionData, user.uid);

    if (result.success) {
      toast({
        title: `Expense ${isEditMode ? "Updated" : "Added"}`,
        description: `${data.source} for $${data.amount} has been successfully recorded.`,
        className: "bg-accent text-accent-foreground",
      });
      setOpen(false);
      onExpenseAdded(); // Callback to refresh data
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to record expense: ${result.error}`,
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
      description: "Review the details and save your expense.",
    });
    setActiveTab("manual");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <DialogTrigger asChild>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit" : "Add a New"} Expense</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="voice" disabled={isEditMode}>
              Voice
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 pt-4"
              >
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
                          {accounts.map((account) => (
                            <SelectItem
                              key={account.id}
                              value={account.id || ""}
                            >
                              {account.name} ({account.type})
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
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source / Vendor</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Starbucks, Amazon"
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
                        <FormLabel>Payment Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Credit Card">
                              Credit Card
                            </SelectItem>
                            <SelectItem value="Debit Card">
                              Debit Card
                            </SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Bank Transfer">
                              Bank Transfer
                            </SelectItem>
                          </SelectContent>
                        </Select>
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
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Food">Food</SelectItem>
                            <SelectItem value="Transport">Transport</SelectItem>
                            <SelectItem value="Shopping">Shopping</SelectItem>
                            <SelectItem value="Utilities">Utilities</SelectItem>
                            <SelectItem value="Entertainment">
                              Entertainment
                            </SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
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
                      <FormLabel>Date of expense</FormLabel>
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
                  {isEditMode ? "Save Changes" : "Save Expense"}
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
