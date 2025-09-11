"use client";

import { Goal, GoalStatus, deleteGoal, updateGoal } from "@/lib/goals";
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
import { useState } from "react";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { EditGoalDialog } from "./edit-goal-dialog";
import { AddFundsToGoalDialog } from "./add-funds-to-goal-dialog";

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

  const handleCardClick = (e: React.MouseEvent, goal: Goal) => {
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

        return (
          <Card
            key={goal.id}
            className="flex flex-col h-full overflow-hidden cursor-pointer"
            onClick={(e) => handleCardClick(e, goal)}
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
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
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
              {goal.description && (
                <CardDescription
                  className="overflow-hidden text-sm text-muted-foreground break-words line-clamp-3"
                  data-no-nav
                >
                  {goal.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pb-2 flex-grow overflow-hidden">
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
            </CardContent>
            <CardFooter className="pt-0">
              {goal.status === "active" && (
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
    </div>
  );
}
