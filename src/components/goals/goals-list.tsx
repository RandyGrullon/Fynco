"use client";

import {
  Goal,
  GoalStatus,
  deleteGoal,
  updateGoal,
  verifyGoalPin,
} from "@/lib/goals";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  MoreHorizontal,
  Trash2,
  Target,
  Wallet,
  PiggyBank,
  Lock,
  Unlock,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { EditGoalDialog } from "./edit-goal-dialog";
import { AddFundsToGoalDialog } from "./add-funds-to-goal-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GoalsListProps {
  goals: Goal[];
  onUpdate?: string; // Using a string trigger instead of a function
}

export function GoalsList({ goals, onUpdate }: GoalsListProps) {
  const refreshGoals = async () => {
    // We'll use client-side event triggering
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("goals:refresh"));
    }
  };
  const { user } = useAuth();
  const { toast } = useToast();
  const formatter = useCurrencyFormatter();
  const router = useRouter();
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [goalToUnlock, setGoalToUnlock] = useState<Goal | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockedGoals, setUnlockedGoals] = useState<Set<string>>(new Set());

  const storageKey = user ? `fynco-goal-unlocked:${user.uid}` : null;

  useEffect(() => {
    if (!storageKey) {
      setUnlockedGoals(new Set());
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) {
        setUnlockedGoals(new Set());
        return;
      }

      const parsed = JSON.parse(stored) as string[];
      setUnlockedGoals(new Set(parsed));
    } catch (error) {
      console.warn("GoalsList: no se pudieron cargar metas desbloqueadas", error);
      setUnlockedGoals(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) {
      return;
    }

    if (unlockedGoals.size === 0) {
      window.sessionStorage.removeItem(storageKey);
    } else {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(Array.from(unlockedGoals))
      );
    }
  }, [storageKey, unlockedGoals]);

  useEffect(() => {
    setUnlockedGoals((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      goals.forEach((goal) => {
        if (goal.id && !goal.security?.enabled && next.has(goal.id)) {
          next.delete(goal.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [goals]);

  if (!goals.length) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <CardTitle>No Goals Yet</CardTitle>
          <CardDescription>
            Start setting financial goals to reach your dreams
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusBadge = (status: GoalStatus) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-600">
            Active
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-600">
            Completed
          </Badge>
        );
      case "canceled":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-600">
            Canceled
          </Badge>
        );
    }
  };

  const handleDeleteGoal = async () => {
    if (!user || !goalToDelete) return;

    setIsDeleting(true);
    try {
      await deleteGoal(user.uid, goalToDelete);
      toast({
        title: "Goal Deleted",
        description: "The goal has been successfully deleted.",
      });

      // Trigger refresh event
      window.dispatchEvent(new CustomEvent("goals:refresh"));
      refreshGoals();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete goal: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setGoalToDelete(null);
    }
  };

  const openUnlockDialog = (goal: Goal) => {
    if (!goal.id) return;
    setGoalToUnlock(goal);
    setPinInput("");
    setPinError(null);
    setUnlockDialogOpen(true);
  };

  const closeUnlockDialog = () => {
    setUnlockDialogOpen(false);
    setGoalToUnlock(null);
    setPinInput("");
    setPinError(null);
    setIsUnlocking(false);
  };

  const handleUnlockGoal = async () => {
    if (!user || !goalToUnlock?.id) return;

    if (!/^[0-9]{4,12}$/.test(pinInput)) {
      setPinError("El PIN debe tener entre 4 y 12 dígitos.");
      return;
    }

    setIsUnlocking(true);
    try {
      const success = await verifyGoalPin(user.uid, goalToUnlock.id, pinInput);
      if (!success) {
        setPinError("PIN incorrecto. Intenta nuevamente.");
        return;
      }

      setUnlockedGoals((prev) => {
        const next = new Set(prev);
        next.add(goalToUnlock.id!);
        return next;
      });

      toast({
        title: "Meta desbloqueada",
        description: `Ya puedes ver ${goalToUnlock.name}.`,
      });

      closeUnlockDialog();
    } catch (error) {
      toast({
        title: "Error al desbloquear",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo verificar el PIN de la meta.",
        variant: "destructive",
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleCardClick = (
    e: React.MouseEvent,
    goal: Goal,
    isLocked: boolean
  ) => {
    if (isLocked) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("a,button,[data-no-nav]")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      openUnlockDialog(goal);
      return;
    }

    // Only navigate on mobile (under md breakpoint)
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;

    // Don't navigate if there's no linked account
    if (!goal.accountId) return;

    // If the click originated from an interactive element (link/button/menu), ignore
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("a,button,[data-no-nav]")) return;

    // Navigate to the linked account
    router.push(`/accounts?id=${goal.accountId}`);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {goals.map((goal) => {
        const progressPercentage = Math.min(
          Math.round((goal.currentAmount / goal.targetAmount) * 100),
          100
        );
        const goalId = goal.id ?? "";
        const isProtected = goal.security?.enabled ?? false;
        const isUnlocked = goalId ? unlockedGoals.has(goalId) : false;
        const isLocked = isProtected && !isUnlocked;

        return (
          <Card
            key={goal.id}
            className="flex flex-col h-full overflow-hidden cursor-pointer"
            onClick={(e) => handleCardClick(e, goal, isLocked)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl overflow-hidden truncate max-w-[70%]">
                  {goal.name}
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-no-nav>
                      <MoreHorizontal className="h-5 w-5" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <EditGoalDialog
                      goal={goal}
                      onGoalEdited={() => refreshGoals()}
                    >
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Goal
                      </DropdownMenuItem>
                    </EditGoalDialog>
                    <DropdownMenuItem
                      onClick={() => {
                        setGoalToDelete(goal.id || null);
                        setConfirmOpen(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Goal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(goal.status)}
                {isProtected && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" /> Protegida
                  </Badge>
                )}
                {goal.deadline && (
                  <Badge variant="outline">
                    {goal.deadline instanceof Date
                      ? goal.deadline.toLocaleDateString()
                      : typeof goal.deadline === "string"
                      ? new Date(goal.deadline).toLocaleDateString()
                      : goal.deadline.toDate().toLocaleDateString()}
                  </Badge>
                )}
              </div>
              {goal.description && !isLocked && (
                <CardDescription
                  className="overflow-hidden text-sm text-muted-foreground break-words line-clamp-3"
                  data-no-nav
                >
                  {goal.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pb-2 flex-grow overflow-hidden">
              {isLocked ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <Lock className="h-8 w-8" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Meta protegida
                    </p>
                    <p className="text-sm">
                      Ingresa el PIN para ver el progreso y los montos.
                    </p>
                    {goal.security?.hint && (
                      <p className="text-xs text-muted-foreground italic">
                        Pista: {goal.security.hint}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    data-no-nav
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openUnlockDialog(goal);
                    }}
                  >
                    <Unlock className="mr-2 h-4 w-4" /> Desbloquear meta
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{progressPercentage}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Current</p>
                      <p className="font-medium">
                        {formatter.formatCurrency(goal.currentAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Target</p>
                      <p className="font-medium">
                        {formatter.formatCurrency(goal.targetAmount)}
                      </p>
                    </div>
                  </div>
                  {goal.accountId && (
                    <div
                      className="flex items-center gap-2 text-sm mt-4"
                      data-no-nav
                    >
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <Link
                        href={`/accounts?id=${goal.accountId}`}
                        className="text-primary hover:underline"
                        data-no-nav
                      >
                        Linked Account
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-0">
              {isLocked ? (
                <Button
                  variant="default"
                  className="w-full"
                  data-no-nav
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openUnlockDialog(goal);
                  }}
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Desbloquear meta
                </Button>
              ) : (
                goal.status === "active" && (
                  <div className="w-full flex flex-col gap-2">
                    {goal.accountId && (
                      <AddFundsToGoalDialog
                        goal={goal}
                        onFundsAdded={refreshGoals}
                      >
                        <Button variant="default" className="w-full" data-no-nav>
                          <PiggyBank className="mr-2 h-4 w-4" />
                          Añadir fondos
                        </Button>
                      </AddFundsToGoalDialog>
                    )}
                    <Button variant="outline" className="w-full" asChild>
                      <Link
                        href={
                          goal.accountId
                            ? `/accounts?id=${goal.accountId}`
                            : "/accounts"
                        }
                        data-no-nav
                      >
                        <Target className="mr-2 h-4 w-4" />
                        {goal.accountId ? "Ver cuenta" : "Añadir cuenta"}
                      </Link>
                    </Button>
                  </div>
                )
              )}
            </CardFooter>
          </Card>
        );
      })}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this goal. If the goal has a linked
              account, the account will remain but will no longer be associated
              with this goal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGoal}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={unlockDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setUnlockDialogOpen(true);
          } else {
            closeUnlockDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desbloquear meta</DialogTitle>
            <DialogDescription>
              Introduce el PIN configurado para acceder a
              {goalToUnlock ? ` “${goalToUnlock.name}”` : " la meta"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              inputMode="numeric"
              autoFocus
              placeholder="••••"
              value={pinInput}
              onChange={(event) => {
                const value = event.target.value.replace(/[^0-9]/g, "");
                setPinInput(value.slice(0, 12));
                setPinError(null);
              }}
              disabled={isUnlocking}
            />
            {goalToUnlock?.security?.hint && (
              <p className="text-sm text-muted-foreground">
                Pista: {goalToUnlock.security.hint}
              </p>
            )}
            {pinError && (
              <p className="text-sm text-destructive">{pinError}</p>
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeUnlockDialog}
              disabled={isUnlocking}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleUnlockGoal} disabled={isUnlocking}>
              {isUnlocking ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verificando
                </span>
              ) : (
                "Desbloquear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
