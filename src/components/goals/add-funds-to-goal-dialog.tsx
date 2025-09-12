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
import { PiggyBank, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { Goal, addFundsToGoalFromAccount } from "@/lib/goals";
import { useToast } from "@/hooks/use-toast";
import { Account, getAccountById } from "@/lib/accounts";
import { useEffect } from "react";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";

interface AddFundsToGoalDialogProps {
  goal: Goal;
  onFundsAdded?: () => void;
  children?: React.ReactNode;
}

export function AddFundsToGoalDialog({
  goal,
  onFundsAdded,
  children,
}: AddFundsToGoalDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const formatter = useCurrencyFormatter();
  const t = useTranslations("goals");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  useEffect(() => {
    if (user && open && goal.accountId) {
      loadAccount();
    }
  }, [user, open, goal.accountId]);

  const loadAccount = async () => {
    if (!user || !goal.accountId) return;
    setLoadingAccount(true);
    try {
      const accountData = await getAccountById(user.uid, goal.accountId);
      setAccount(accountData);
    } catch (error) {
      console.error("Error loading account:", error);
      toast({
  title: t("errors.loadAccountTitle") || "Error",
  description: t("errors.loadAccount") || "No se pudo cargar la información de la cuenta",
        variant: "destructive",
      });
    } finally {
      setLoadingAccount(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goal.id || !goal.accountId) {
      toast({
        title: t("errors.genericTitle") || "Error",
        description: t("errors.accountRequired") || "Debe haber una cuenta asociada a esta meta",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: t("errors.genericTitle") || "Error",
        description: t("errors.amountGreaterThanZero") || "El monto debe ser mayor que cero",
        variant: "destructive",
      });
      return;
    }

    const amountValue = parseFloat(amount);

    if (account && account.balance < amountValue) {
      toast({
        title: "Error",
        description: "La cuenta no tiene suficiente saldo para esta operación",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await addFundsToGoalFromAccount(
        user.uid,
        goal.id,
        amountValue
      );

      toast({
        title: result.completed ? t("toasts.completedTitle") : t("toasts.fundsAddedTitle"),
        description: result.completed
          ? t("toasts.completedDescription")
          : t("toasts.fundsAddedDescription"),
      });

      // Trigger goals refresh event
      window.dispatchEvent(new CustomEvent("goals:refresh"));

      // Use setTimeout to ensure state updates happen after render is complete
      setTimeout(() => {
        setOpen(false);
        setAmount("");
        if (onFundsAdded) {
          onFundsAdded();
        }
      }, 0);
    } catch (error) {
      toast({
        title: t("errors.genericTitle") || "Error",
        description: `${t("errors.addFundsFailed") || "No se pudieron añadir fondos"}: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const remainingToTarget = Math.max(0, goal.targetAmount - goal.currentAmount);
  const suggestedAmount = account
    ? Math.min(remainingToTarget, account.balance)
    : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm">
            <PiggyBank className="mr-2 h-4 w-4" />
            {t("addFunds")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("addFundsTitle")}</DialogTitle>
          <DialogDescription>
            {t("addFundsDescription", { account: account?.name ?? "", goal: goal.name })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
                {loadingAccount ? (
              <div className="text-center py-4">
                {t("loadingAccount")}
              </div>
            ) : (
              <>
                {account && (
                  <div className="grid gap-2">
                    <Label>{t("labels.availableBalance")}</Label>
                    <div className="p-2 bg-muted rounded-md">
                      <p className="font-medium">
                        {formatter.formatCurrency(account.balance)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="amount">{t("labels.amountToAdd")}</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={account?.balance.toString()}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={suggestedAmount.toString()}
                    disabled={loading || !account}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("labels.remainingToTarget")} {formatter.formatCurrency(remainingToTarget)}
                  </p>
                </div>

                <div className="grid gap-2">
          <Label>{t("labels.currentStatus")}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
            <p className="text-sm text-muted-foreground">{t("labels.current")}</p>
                      <p className="font-medium">
                        {formatter.formatCurrency(goal.currentAmount)}
                      </p>
                    </div>
                    <div>
            <p className="text-sm text-muted-foreground">{t("labels.target")}</p>
                      <p className="font-medium">
                        {formatter.formatCurrency(goal.targetAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                {amount && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <p className="text-sm">
                      {t("labels.newAccountBalance")} {formatter.formatCurrency(
                        account ? account.balance - parseFloat(amount) : 0
                      )}
                    </p>
                    <p className="text-sm">
                      {t("labels.goalProgress")} {formatter.formatCurrency(
                        goal.currentAmount + parseFloat(amount)
                      )} / {formatter.formatCurrency(goal.targetAmount)}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading || !account}>
              {loading ? t("adding") : t("addFunds")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
