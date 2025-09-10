"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Goal, getGoals } from "@/lib/goals";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { AddGoalDialog } from "@/components/goals/add-goal-dialog";
import { GoalsList } from "@/components/goals/goals-list";

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadGoals() {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const goalsData = await getGoals(user.uid);
      setGoals(goalsData);
    } catch (error) {
      console.error("Error loading goals:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.uid) {
      loadGoals();
    }
  }, [user?.uid]);

  useEffect(() => {
    // Add event listener for goals refresh
    const handleGoalsRefresh = () => {
      loadGoals();
    };

    window.addEventListener("goals:refresh", handleGoalsRefresh);

    // Clean up the event listener
    return () => {
      window.removeEventListener("goals:refresh", handleGoalsRefresh);
    };
  }, [user?.uid]);

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Goals
          </h1>
          <p className="text-muted-foreground">
            Set and track your financial goals
          </p>
        </div>
        <AddGoalDialog onGoalAdded={loadGoals} />
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        }
      >
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <GoalsList goals={goals} onUpdate="trigger" />
        )}
      </Suspense>
    </div>
  );
}
