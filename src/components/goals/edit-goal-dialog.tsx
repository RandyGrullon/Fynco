"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { Goal, GoalStatus, updateGoal } from "@/lib/goals";
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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const t = useTranslations("goals");
  const tCommon = useTranslations("common");
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
        title: tCommon("permissionDenied") || "Error",
        description: t("errors.loginRequired") || "You must be logged in to edit a goal",
        variant: "destructive",
      });
      return;
    }

    if (!name) {
      toast({
        title: tCommon("permissionDenied") || "Error",
        description: t("errors.nameRequired") || "Goal name is required",
        variant: "destructive",
      });
      return;
    }

    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      toast({
        title: tCommon("permissionDenied") || "Error",
        description: t("errors.targetAmountInvalid") || "Target amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

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

      toast({
        title: t("updateSuccessTitle") || "Goal Updated",
        description: t("updateSuccessDescription") || "Your goal has been successfully updated",
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
          <DialogTitle>{t("editGoal")}</DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t("goalName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="targetAmount">{t("targetAmount")}</Label>
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
                <Label htmlFor="currentAmount">{t("currentAmount")}</Label>
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
              <Label htmlFor="currency">{t("currency")}</Label>
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value)}
                disabled={loading}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder={t("selectCurrency")} />
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
        <Label htmlFor="status">{t("status")}</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as GoalStatus)}
                disabled={loading}
              >
                <SelectTrigger id="status">
          <SelectValue placeholder={t("placeholders.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
          <SelectItem value="active">{t("statuses.active")}</SelectItem>
          <SelectItem value="completed">{t("statuses.completed")}</SelectItem>
          <SelectItem value="canceled">{t("statuses.canceled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deadline">{t("targetDateOptional")}</Label>
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
                    {deadline ? format(deadline, "PPP") : t("placeholders.pickDate")}
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
              <Label htmlFor="description">{t("descriptionOptional")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountId">{t("linkedAccount")}</Label>
              <Select
                value={accountId || "none"}
                onValueChange={(value) =>
                  setAccountId(value === "none" ? undefined : value)
                }
                disabled={loading || loadingAccounts}
              >
                <SelectTrigger id="accountId">
                  <SelectValue placeholder={t("accounts.selectAccountPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("accounts.noAccount")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id || ""}>
                      {account.name} ({account.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accounts.length === 0 && !loadingAccounts && (
                <p className="text-sm text-muted-foreground">
                  {t("accounts.noAvailableAccountsEdit")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon("loading") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
