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
import {
  Goal,
  GoalStatus,
  removeGoalPin,
  setGoalPin,
  updateGoal,
} from "@/lib/goals";
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
import { CalendarIcon, Lock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

interface EditGoalDialogProps {
  goal: Goal;
  onGoalEdited?: () => void;
  children?: React.ReactNode;
}

export function EditGoalDialog({
  goal,
  onGoalEdited,
  children,
}: EditGoalDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState(
    goal.targetAmount.toString()
  );
  const [currentAmount, setCurrentAmount] = useState(
    goal.currentAmount.toString()
  );
  const [deadline, setDeadline] = useState<Date | undefined>(
    goal.deadline
      ? goal.deadline instanceof Date
        ? goal.deadline
        : typeof goal.deadline === "string"
        ? new Date(goal.deadline)
        : goal.deadline.toDate()
      : undefined
  );
  const [description, setDescription] = useState(goal.description || "");
  const [currency, setCurrency] = useState(goal.currency);
  const [status, setStatus] = useState<GoalStatus>(goal.status);
  const [accountId, setAccountId] = useState<string | undefined>(
    goal.accountId
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const initialSecurityEnabled = goal.security?.enabled ?? false;
  const [protectWithPin, setProtectWithPin] = useState(initialSecurityEnabled);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirmValue, setPinConfirmValue] = useState("");
  const [pinHint, setPinHint] = useState(goal.security?.hint || "");
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (user && open) {
      loadAccounts();
    }
  }, [user, open]);

  useEffect(() => {
    if (open) {
      setProtectWithPin(goal.security?.enabled ?? false);
      setPinHint(goal.security?.hint || "");
      setPinValue("");
      setPinConfirmValue("");
      setPinError(null);
    }
  }, [open, goal.security?.enabled, goal.security?.hint]);

  const loadAccounts = async () => {
    if (!user) return;
    setLoadingAccounts(true);
    try {
      const accountsData = await getAccounts(user.uid);
      // Include accounts that are already associated with goals, but make sure to include the current goal's account
      const availableAccounts = accountsData.filter(
        (acc) => !acc.isGoalAccount || acc.goalId === goal.id
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
    if (!user || !goal.id) {
      toast({
        title: "Error",
        description: "You must be logged in to edit a goal",
        variant: "destructive",
      });
      return;
    }

    if (!name) {
      toast({
        title: "Error",
        description: "Goal name is required",
        variant: "destructive",
      });
      return;
    }

    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      toast({
        title: "Error",
        description: "Target amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

    const hadSecurity = goal.security?.enabled ?? false;
    const wantsNewPin =
      protectWithPin && (!hadSecurity || pinValue || pinConfirmValue);

    if (protectWithPin && wantsNewPin) {
      if (!/^[0-9]{4,12}$/.test(pinValue)) {
        setPinError("El PIN debe tener entre 4 y 12 dígitos.");
        return;
      }

      if (pinValue !== pinConfirmValue) {
        setPinError("Los PIN no coinciden.");
        return;
      }
    }

    if (protectWithPin && wantsNewPin) {
      setPinError(null);
    }

    setPinError(null);

    setLoading(true);
    try {
      await updateGoal(user.uid, goal.id, {
        name,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount) || 0,
        currency,
        description,
        deadline,
        status,
        accountId,
      });

      if (protectWithPin) {
        if (wantsNewPin && goal.id) {
          await setGoalPin(user.uid, goal.id, pinValue, {
            hint: pinHint || null,
          });
        } else if (!wantsNewPin && goal.security?.hint !== pinHint) {
          // If hint changed but no new PIN provided, reset local state to stored hint
          setPinHint(goal.security?.hint || "");
        }
      } else if (hadSecurity && goal.id) {
        await removeGoalPin(user.uid, goal.id);
      }

      toast({
        title: "Goal Updated",
        description: "Your goal has been successfully updated",
      });

      // Trigger goals refresh event
      window.dispatchEvent(new CustomEvent("goals:refresh"));

      // Use setTimeout to ensure state updates happen after render is complete
      setTimeout(() => {
        setOpen(false);
        if (onGoalEdited) {
          onGoalEdited();
        }
      }, 0);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update goal: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
          <DialogDescription>
            Update your financial goal information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Goal Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
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
                  disabled={loading}
                />
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
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as GoalStatus)}
                disabled={loading}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
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
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountId">Linked Account</Label>
              <Select
                value={accountId || "none"}
                onValueChange={(value) =>
                  setAccountId(value === "none" ? undefined : value)
                }
                disabled={loading || loadingAccounts}
              >
                <SelectTrigger id="accountId">
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
              {accounts.length === 0 && !loadingAccounts && (
                <p className="text-sm text-muted-foreground">
                  No available accounts. All accounts are already associated
                  with goals.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">Protección con PIN</p>
                    <p className="text-sm text-muted-foreground">
                      Oculta los datos de esta meta hasta que ingreses el PIN configurado.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={protectWithPin}
                  onCheckedChange={(checked) => {
                    setProtectWithPin(checked);
                    setPinError(null);
                    if (!checked) {
                      setPinValue("");
                      setPinConfirmValue("");
                      setPinHint(goal.security?.hint || "");
                    }
                  }}
                  disabled={loading}
                />
              </div>

              {protectWithPin && (
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-goal-pin">PIN</Label>
                    <Input
                      id="edit-goal-pin"
                      inputMode="numeric"
                      value={pinValue}
                      onChange={(event) => {
                        const value = event.target.value.replace(/[^0-9]/g, "");
                        setPinValue(value.slice(0, 12));
                        setPinError(null);
                      }}
                      placeholder={initialSecurityEnabled ? "Ingresa un nuevo PIN" : "••••"}
                      disabled={loading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-goal-pin-confirm">Confirmar PIN</Label>
                    <Input
                      id="edit-goal-pin-confirm"
                      inputMode="numeric"
                      value={pinConfirmValue}
                      onChange={(event) => {
                        const value = event.target.value.replace(/[^0-9]/g, "");
                        setPinConfirmValue(value.slice(0, 12));
                        setPinError(null);
                      }}
                      placeholder={initialSecurityEnabled ? "Confirma el nuevo PIN" : "••••"}
                      disabled={loading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-goal-pin-hint">Pista (opcional)</Label>
                    <Input
                      id="edit-goal-pin-hint"
                      value={pinHint}
                      onChange={(event) => setPinHint(event.target.value.slice(0, 60))}
                      placeholder="Esta pista se mostrará al intentar desbloquear"
                      disabled={loading || (initialSecurityEnabled && !pinValue && !pinConfirmValue)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {initialSecurityEnabled
                        ? "Ingresa el PIN actual o uno nuevo para actualizar la pista."
                        : "Configura un PIN de 4 a 12 dígitos numéricos."}
                    </p>
                  </div>
                  {pinError && (
                    <p className="text-sm text-destructive">{pinError}</p>
                  )}
                </div>
              )}
            </div>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
