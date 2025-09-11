import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, addDoc, collection, Timestamp } from "firebase/firestore";
import { Goal } from "@/lib/goals";
import { Account } from "@/lib/accounts";
import { recordGoalFundsAdded } from "@/lib/movements";

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

    // Registrar el movimiento de fondos agregados a la meta
    try {
      await recordGoalFundsAdded(
        userId,
        goalId,
        goalData.name,
        amount,
        goalData.currency,
        accountData.name
      );
    } catch (error) {
      console.error("Error recording goal funds added movement:", error);
    }

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
