"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  where,
  getDoc,
} from "firebase/firestore";
import { Account, updateAccount } from "@/lib/accounts";

export type GoalStatus = "active" | "completed" | "canceled";

export type Goal = {
  id?: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  accountId?: string; // The account this goal is linked to
  currency: string;
  deadline?: Date | Timestamp | string;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
  status: GoalStatus;
  description?: string;
};

function getGoalsCollection(userId: string) {
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return collection(db, "users", userId, "goals");
}

export async function addGoal(
  userId: string,
  goalData: Partial<Goal>,
  createAccount: boolean = false,
  accountData?: Partial<Account>
): Promise<{ goalId: string; accountId?: string }> {
  try {
    // If not creating a new account and no existing accountId provided, reject
    if (!createAccount && !goalData.accountId) {
      throw new Error("A Goal must be linked to an account or a new account must be created");
    }
    const goalsCollection = getGoalsCollection(userId);

    // Format the goal data
    const newGoal: Omit<Goal, "id"> = {
      userId,
      name: goalData.name || "",
      targetAmount: goalData.targetAmount || 0,
      currentAmount: goalData.currentAmount || 0,
      currency: goalData.currency || "USD",
      status: goalData.status || "active",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      description: goalData.description || "",
      ...(goalData.deadline && { deadline: goalData.deadline }),
      ...(goalData.accountId && { accountId: goalData.accountId }),
    };

    // Create a new account if requested
    let newAccountId: string | undefined;
    if (createAccount && accountData) {
      const accountsCollection = collection(db, "users", userId, "accounts");
      const newAccountDoc = await addDoc(accountsCollection, {
        userId,
        name: accountData.name || goalData.name || "Goal Account",
        type: accountData.type || "savings",
        balance: accountData.balance || 0,
        currency: accountData.currency || goalData.currency || "USD",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        description: accountData.description || goalData.description || "",
        isGoalAccount: true, // Mark this as a goal account
      });
      newAccountId = newAccountDoc.id;
      newGoal.accountId = newAccountId;
    }

    const docRef = await addDoc(goalsCollection, newGoal);

    // If we linked to an existing account, update the account to indicate it's linked to a goal
    if (goalData.accountId && !createAccount) {
      const accountRef = doc(
        db,
        "users",
        userId,
        "accounts",
        goalData.accountId
      );
      await updateDoc(accountRef, {
        isGoalAccount: true,
        goalId: docRef.id,
        updatedAt: Timestamp.now(),
      });
    }

    // If we created a new account, update it with the goal ID
    if (newAccountId) {
      const accountRef = doc(db, "users", userId, "accounts", newAccountId);
      await updateDoc(accountRef, {
        goalId: docRef.id,
        updatedAt: Timestamp.now(),
      });
    }

    return { goalId: docRef.id, accountId: newAccountId || goalData.accountId };
  } catch (error) {
    console.error("Error adding goal:", error);
    throw error;
  }
}

export async function getGoals(userId: string) {
  try {
    const goalsCollection = getGoalsCollection(userId);
    const goalsQuery = query(goalsCollection, orderBy("createdAt", "desc"));

    const snapshot = await getDocs(goalsQuery);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : data.createdAt,
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : data.updatedAt,
        ...(data.deadline && {
          deadline:
            data.deadline instanceof Timestamp
              ? data.deadline.toDate()
              : data.deadline,
        }),
      } as Goal;
    });
  } catch (error) {
    console.error("Error getting goals:", error);
    throw error;
  }
}

export async function getGoal(userId: string, goalId: string) {
  try {
    const goalRef = doc(db, "users", userId, "goals", goalId);
    const snapshot = await getDoc(goalRef);

    if (!snapshot.exists()) {
      throw new Error("Goal not found");
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate()
          : data.updatedAt,
      ...(data.deadline && {
        deadline:
          data.deadline instanceof Timestamp
            ? data.deadline.toDate()
            : data.deadline,
      }),
    } as Goal;
  } catch (error) {
    console.error("Error getting goal:", error);
    throw error;
  }
}

export async function updateGoal(
  userId: string,
  goalId: string,
  updates: Partial<Goal>
) {
  try {
    const goalRef = doc(db, "users", userId, "goals", goalId);

    // Get the current goal data to check if accountId is changing
    const goalSnapshot = await getDoc(goalRef);
    if (!goalSnapshot.exists()) {
      throw new Error("Goal not found");
    }

    const currentGoal = goalSnapshot.data() as Goal;
    const oldAccountId = currentGoal.accountId;
    const newAccountId = updates.accountId;

    // Update the goal
    await updateDoc(goalRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });

    // If the account association has changed
    if (newAccountId !== oldAccountId) {
      // If there was a previous account, update it to remove goal association
      if (oldAccountId) {
        const oldAccountRef = doc(
          db,
          "users",
          userId,
          "accounts",
          oldAccountId
        );
        await updateDoc(oldAccountRef, {
          isGoalAccount: false,
          goalId: null,
          updatedAt: Timestamp.now(),
        });
      }

      // If there's a new account, update it to add goal association
      if (newAccountId) {
        const newAccountRef = doc(
          db,
          "users",
          userId,
          "accounts",
          newAccountId
        );
        await updateDoc(newAccountRef, {
          isGoalAccount: true,
          goalId: goalId,
          updatedAt: Timestamp.now(),
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating goal:", error);
    throw error;
  }
}

export async function deleteGoal(userId: string, goalId: string) {
  try {
    // Get the goal to check if it has an associated account
    const goalRef = doc(db, "users", userId, "goals", goalId);
    const goalSnapshot = await getDoc(goalRef);

    if (!goalSnapshot.exists()) {
      throw new Error("Goal not found");
    }

    const goalData = goalSnapshot.data() as Goal;

    // If there's an associated account, update it to remove the goal association
    if (goalData.accountId) {
      const accountRef = doc(
        db,
        "users",
        userId,
        "accounts",
        goalData.accountId
      );
      await updateDoc(accountRef, {
        isGoalAccount: false,
        goalId: null,
        updatedAt: Timestamp.now(),
      });
    }

    // Delete the goal
    await deleteDoc(goalRef);

    return { success: true };
  } catch (error) {
    console.error("Error deleting goal:", error);
    throw error;
  }
}

export async function updateGoalProgress(
  userId: string,
  goalId: string,
  amount: number
) {
  try {
    const goalRef = doc(db, "users", userId, "goals", goalId);
    const goalSnapshot = await getDoc(goalRef);

    if (!goalSnapshot.exists()) {
      throw new Error("Goal not found");
    }

    const goalData = goalSnapshot.data() as Goal;
    const newCurrentAmount = goalData.currentAmount + amount;

    // Update the goal's current amount
    await updateDoc(goalRef, {
      currentAmount: newCurrentAmount,
      updatedAt: Timestamp.now(),
      // If the goal is reached, update the status
      ...(newCurrentAmount >= goalData.targetAmount && { status: "completed" }),
    });

    return {
      success: true,
      completed: newCurrentAmount >= goalData.targetAmount,
    };
  } catch (error) {
    console.error("Error updating goal progress:", error);
    throw error;
  }
}

export async function addFundsToGoalFromAccount(
  userId: string,
  goalId: string,
  amount: number
) {
  try {
    // Obtener información de la meta
    const goalRef = doc(db, "users", userId, "goals", goalId);
    const goalSnapshot = await getDoc(goalRef);

    if (!goalSnapshot.exists()) {
      throw new Error("Meta no encontrada");
    }

    const goalData = goalSnapshot.data() as Goal;

    // Verificar que la meta tenga una cuenta asociada
    if (!goalData.accountId) {
      throw new Error("Esta meta no tiene una cuenta asociada");
    }

    // Obtener información de la cuenta
    const accountRef = doc(db, "users", userId, "accounts", goalData.accountId);
    const accountSnapshot = await getDoc(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("Cuenta asociada no encontrada");
    }

    const accountData = accountSnapshot.data() as Account;

    // Verificar que la cuenta tenga suficiente saldo
    if (accountData.balance < amount) {
      throw new Error(
        "La cuenta no tiene suficiente saldo para esta operación"
      );
    }

    // Actualizar el saldo de la cuenta (restando el monto)
    await updateDoc(accountRef, {
      balance: accountData.balance - amount,
      updatedAt: Timestamp.now(),
    });

    // Actualizar el progreso de la meta (añadiendo el monto)
    const newCurrentAmount = goalData.currentAmount + amount;
    const isCompleted = newCurrentAmount >= goalData.targetAmount;

    await updateDoc(goalRef, {
      currentAmount: newCurrentAmount,
      updatedAt: Timestamp.now(),
      ...(isCompleted && { status: "completed" }),
    });

    // Añadir una transacción a la cuenta
    const accountTransactionsCollection = collection(
      db,
      "users",
      userId,
      "accounts",
      goalData.accountId,
      "transactions"
    );

    await addDoc(accountTransactionsCollection, {
      userId,
      accountId: goalData.accountId,
      amount: amount,
      type: "debit",
      description: `Fondos para meta: ${goalData.name}`,
      date: Timestamp.now(),
      category: "Goal",
    });

    return {
      success: true,
      completed: isCompleted,
      newBalance: accountData.balance - amount,
      newGoalAmount: newCurrentAmount,
    };
  } catch (error) {
    console.error("Error al añadir fondos a la meta:", error);
    throw error;
  }
}
