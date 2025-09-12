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
import { Target, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { GoalStatus, addGoal } from "@/lib/goals";
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

interface AddGoalDialogProps {
  onGoalAdded?: () => void;
  children?: React.ReactNode;
}

export function AddGoalDialog({ onGoalAdded, children }: AddGoalDialogProps) {
  const t = useTranslations("goals");
  const tCommon = useTranslations("common");
  const tSuccess = useTranslations("success");
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
        title: tCommon("permissionDenied") || "Error",
        description: t("errors.loginRequired") || "You must be logged in to add a goal",
        variant: "destructive",
      });
      return;
    }

    if (!name) {
      setErrors((s) => ({ ...s, name: t("errors.nameRequired") }));
      return;
    }

    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      setErrors((s) => ({
        ...s,
        targetAmount: t("errors.targetAmountInvalid"),
      }));
      return;
    }

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
          account: t("errors.accountRequired"),
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

      toast({
  title: tSuccess("goalCreated") || "Goal Added",
  description: tSuccess("goalCreated") || "Your goal has been successfully added",
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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addGoal")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("addGoal")}</DialogTitle>
          <DialogDescription>{t("addDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t("goalName")}</Label>
              <div>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((s) => ({ ...s, name: undefined }));
                  }}
                  placeholder={t("placeholders.name")}
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
                <Label htmlFor="targetAmount">{t("targetAmount")}</Label>
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
                <Label htmlFor="currentAmount">{t("currentAmount")}</Label>
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
                    disabled={(date) => date < new Date()}
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
                placeholder={t("placeholders.description")}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2 pt-2">
              <Label>{t("account")}</Label>
              <Tabs
                defaultValue="existing"
                onValueChange={(v) => setAccountOption(v as "existing" | "new")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">{t("accounts.useExisting")}</TabsTrigger>
                    <TabsTrigger value="new">{t("accounts.createNew")}</TabsTrigger>
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
                    {errors.account && (
                      <p className="text-sm text-red-600 mt-2">
                        {errors.account}
                      </p>
                    )}
                    {accounts.length === 0 && !loadingAccounts && (
                      <p className="text-sm text-muted-foreground">
                        {t("accounts.noAvailableAccounts")}
                      </p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="new">
                  <div className="grid gap-4 mt-2">
                    <div className="grid gap-2">
                      <Label htmlFor="newAccountName">{t("accounts.accountName")}</Label>
                      <Input
                        id="newAccountName"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder={name ? `${name} ${tCommon("goalAccount")}` : t("accounts.newAccountPlaceholder")}
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="newAccountBalance">{t("accounts.initialBalance")}</Label>
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
                        <Label htmlFor="newAccountType">{t("accounts.accountType")}</Label>
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
                            <SelectItem value="savings">{t("accounts.accountTypes.savings")}</SelectItem>
                            <SelectItem value="checking">{t("accounts.accountTypes.checking")}</SelectItem>
                            <SelectItem value="investment">{t("accounts.accountTypes.investment")}</SelectItem>
                            <SelectItem value="credit">{t("accounts.accountTypes.credit")}</SelectItem>
                            <SelectItem value="other">{t("accounts.accountTypes.other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newAccountDescription">{t("accounts.descriptionOptional")}</Label>
                      <Textarea
                        id="newAccountDescription"
                        value={newAccountDescription}
                        onChange={(e) =>
                          setNewAccountDescription(e.target.value)
                        }
                        placeholder={t("accounts.newAccountDescriptionPlaceholder")}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon("loading") : t("addGoal")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
