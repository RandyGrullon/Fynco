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
import { Target, Plus, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GoalStatus, addGoal, setGoalPin } from "@/lib/goals";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Account, getAccounts } from "@/lib/accounts";
import { useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountType } from "@/lib/accounts";
import { Switch } from "@/components/ui/switch";

interface AddGoalDialogProps {
  onGoalAdded?: () => void;
  children?: React.ReactNode;
}

export function AddGoalDialog({ onGoalAdded, children }: AddGoalDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // For account linking
  const [accountOption, setAccountOption] = useState<"existing" | "new">(
    "existing"
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // For new account
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("0");
  const [newAccountType, setNewAccountType] = useState<AccountType>("savings");
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    targetAmount?: string;
    account?: string;
  }>({});
  const [protectWithPin, setProtectWithPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirmValue, setPinConfirmValue] = useState("");
  const [pinHint, setPinHint] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (user && open) {
      loadAccounts();
    }
  }, [user, open]);

  const loadAccounts = async () => {
    if (!user) return;
    setLoadingAccounts(true);
    try {
      const accountsData = await getAccounts(user.uid);
      // Filter out accounts that are already associated with goals
      const availableAccounts = accountsData.filter(
        (acc) => !acc.isGoalAccount
      );
      setAccounts(availableAccounts);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add a goal",
        variant: "destructive",
      });
      return;
    }

    if (!name) {
      setErrors((s) => ({ ...s, name: "Goal name is required" }));
      return;
    }

    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      setErrors((s) => ({
        ...s,
        targetAmount: "Target amount must be greater than zero",
      }));
      return;
    }

    if (protectWithPin) {
      if (!/^[0-9]{4,12}$/.test(pinValue)) {
        setPinError("El PIN debe tener entre 4 y 12 dígitos.");
        return;
      }

      if (pinValue !== pinConfirmValue) {
        setPinError("Los PIN no coinciden.");
        return;
      }
    }

    setPinError(null);
    setLoading(true);
    try {
      const createNewAccount = accountOption === "new";

      // Client-side guard: if using existing account option, ensure an account is selected
      if (
        !createNewAccount &&
        (!selectedAccountId || selectedAccountId === "")
      ) {
        setErrors((s) => ({
          ...s,
          account: "Please select an account or create a new one.",
        }));
        setLoading(false);
        return;
      }

      // Prepare account data if creating a new account
      const accountData = createNewAccount
        ? {
            name: newAccountName || name,
            balance: parseFloat(newAccountBalance) || 0,
            type: newAccountType,
            currency,
            description: newAccountDescription,
          }
        : undefined;

      const result = await addGoal(
        user.uid,
        {
          name,
          targetAmount: parseFloat(targetAmount),
          currentAmount: parseFloat(currentAmount) || 0,
          currency,
          description,
          deadline,
          ...(accountOption === "existing" &&
            selectedAccountId &&
            selectedAccountId !== "none" && { accountId: selectedAccountId }),
          status: "active" as GoalStatus,
        },
        createNewAccount,
        accountData
      );

      if (protectWithPin && result.goalId) {
        await setGoalPin(user.uid, result.goalId, pinValue, {
          hint: pinHint || null,
        });
      }

      toast({
        title: "Goal Added",
        description: "Your goal has been successfully added",
      });

      // Use setTimeout to ensure state updates happen after render is complete
      setTimeout(() => {
        setOpen(false);
        resetForm();
        if (onGoalAdded) {
          onGoalAdded();
        }
      }, 0);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to add goal: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setTargetAmount("");
    setCurrentAmount("0");
    setDeadline(undefined);
    setDescription("");
    setCurrency("USD");
    setAccountOption("existing");
    setSelectedAccountId("");
    setNewAccountName("");
    setNewAccountBalance("0");
    setNewAccountType("savings");
    setNewAccountDescription("");
    setProtectWithPin(false);
    setPinValue("");
    setPinConfirmValue("");
    setPinHint("");
    setPinError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Goal</DialogTitle>
          <DialogDescription>
            Create a new financial goal to help you reach your objectives.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Goal Name</Label>
              <div>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((s) => ({ ...s, name: undefined }));
                  }}
                  placeholder="e.g., New Car, Vacation"
                  disabled={loading}
                  aria-invalid={!!errors.name}
                  className={
                    errors.name ? "border-red-500 ring-1 ring-red-300" : ""
                  }
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="targetAmount">Target Amount</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="5000"
                  disabled={loading}
                  aria-invalid={!!errors.targetAmount}
                  className={
                    errors.targetAmount
                      ? "border-red-500 ring-1 ring-red-300"
                      : ""
                  }
                />
                {errors.targetAmount && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.targetAmount}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currentAmount">Current Amount</Label>
                <Input
                  id="currentAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value)}
                disabled={loading}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="DOP">DOP - Dominican Peso</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deadline">Target Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="deadline"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deadline && "text-muted-foreground"
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your goal..."
                disabled={loading}
              />
            </div>

            <div className="grid gap-2 pt-2">
              <Label>Account</Label>
              <Tabs
                defaultValue="existing"
                onValueChange={(v) => setAccountOption(v as "existing" | "new")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">
                    Use Existing Account
                  </TabsTrigger>
                  <TabsTrigger value="new">Create New Account</TabsTrigger>
                </TabsList>
                <TabsContent value="existing">
                  <div className="grid gap-2 mt-2">
                    <Select
                      value={selectedAccountId || "none"}
                      onValueChange={(value) =>
                        setSelectedAccountId(value === "none" ? "" : value)
                      }
                      disabled={loading || loadingAccounts}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Account</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id || ""}>
                            {account.name} ({account.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.account && (
                      <p className="text-sm text-red-600 mt-2">
                        {errors.account}
                      </p>
                    )}
                    {accounts.length === 0 && !loadingAccounts && (
                      <p className="text-sm text-muted-foreground">
                        No available accounts. All accounts are already
                        associated with goals or you don't have any accounts
                        yet.
                      </p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="new">
                  <div className="grid gap-4 mt-2">
                    <div className="grid gap-2">
                      <Label htmlFor="newAccountName">Account Name</Label>
                      <Input
                        id="newAccountName"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder={name ? `${name} Account` : "Goal Account"}
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="newAccountBalance">
                          Initial Balance
                        </Label>
                        <Input
                          id="newAccountBalance"
                          type="number"
                          step="0.01"
                          min="0"
                          value={newAccountBalance}
                          onChange={(e) => setNewAccountBalance(e.target.value)}
                          placeholder="0"
                          disabled={loading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newAccountType">Account Type</Label>
                        <Select
                          value={newAccountType}
                          onValueChange={(value) =>
                            setNewAccountType(value as AccountType)
                          }
                          disabled={loading}
                        >
                          <SelectTrigger id="newAccountType">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="savings">Savings</SelectItem>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="investment">
                              Investment
                            </SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newAccountDescription">
                        Description (Optional)
                      </Label>
                      <Textarea
                        id="newAccountDescription"
                        value={newAccountDescription}
                        onChange={(e) =>
                          setNewAccountDescription(e.target.value)
                        }
                        placeholder="Account for this goal..."
                        disabled={loading}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">Protege esta meta con PIN</p>
                    <p className="text-sm text-muted-foreground">
                      Oculta los montos y el progreso hasta que ingreses un PIN.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={protectWithPin}
                  onCheckedChange={(checked) => {
                    setProtectWithPin(checked);
                    if (!checked) {
                      setPinValue("");
                      setPinConfirmValue("");
                      setPinHint("");
                      setPinError(null);
                    }
                  }}
                  disabled={loading}
                />
              </div>

              {protectWithPin && (
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="goal-pin">PIN</Label>
                    <Input
                      id="goal-pin"
                      inputMode="numeric"
                      value={pinValue}
                      onChange={(event) => {
                        const value = event.target.value.replace(/[^0-9]/g, "");
                        setPinValue(value.slice(0, 12));
                        setPinError(null);
                      }}
                      placeholder="••••"
                      disabled={loading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="goal-pin-confirm">Confirmar PIN</Label>
                    <Input
                      id="goal-pin-confirm"
                      inputMode="numeric"
                      value={pinConfirmValue}
                      onChange={(event) => {
                        const value = event.target.value.replace(/[^0-9]/g, "");
                        setPinConfirmValue(value.slice(0, 12));
                        setPinError(null);
                      }}
                      placeholder="••••"
                      disabled={loading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="goal-pin-hint">Pista (opcional)</Label>
                    <Input
                      id="goal-pin-hint"
                      value={pinHint}
                      onChange={(event) =>
                        setPinHint(event.target.value.slice(0, 60))
                      }
                      placeholder="Algo que te ayude a recordar tu PIN"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      La pista se mostrará cuando intentes desbloquear esta
                      meta.
                    </p>
                  </div>
                  {pinError && (
                    <p className="text-sm text-destructive">{pinError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
