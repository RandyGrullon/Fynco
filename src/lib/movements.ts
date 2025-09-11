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
  startAfter,
} from "firebase/firestore";

export type MovementType = 
  | "account_created"
  | "account_updated" 
  | "account_deleted"
  | "transaction_created"
  | "transaction_updated"
  | "transaction_deleted"
  | "transfer_created"
  | "goal_created"
  | "goal_updated"
  | "goal_deleted"
  | "goal_funds_added"
  | "recurring_transaction_created"
  | "recurring_transaction_updated"
  | "recurring_transaction_deleted";

export type Movement = {
  id?: string;
  userId: string;
  type: MovementType;
  timestamp: Date | Timestamp | string;
  description: string;
  entityId?: string; // ID de la entidad afectada (cuenta, transacción, etc.)
  entityType?: "account" | "transaction" | "transfer" | "goal" | "recurring_transaction";
  metadata?: {
    [key: string]: any;
  };
  amount?: number;
  currency?: string;
  fromAccount?: string;
  toAccount?: string;
};

function getMovementsCollection(userId: string) {
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return collection(db, "users", userId, "movements");
}

export async function addMovement(
  userId: string,
  movement: Omit<Movement, "id" | "userId" | "timestamp">
): Promise<string> {
  try {
    const movementsCollection = getMovementsCollection(userId);
    const movementData = {
      ...movement,
      userId,
      timestamp: Timestamp.now(),
    };
    
    const docRef = await addDoc(movementsCollection, movementData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding movement:", error);
    throw error;
  }
}

export async function getMovements(
  userId: string,
  limitCount: number = 50,
  lastDoc?: any
): Promise<{ movements: Movement[]; lastDocument: any }> {
  try {
    const movementsCollection = getMovementsCollection(userId);
    let q = query(
      movementsCollection,
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    if (lastDoc) {
      q = query(
        movementsCollection,
        orderBy("timestamp", "desc"),
        startAfter(lastDoc),
        limit(limitCount)
      );
    }

    const querySnapshot = await getDocs(q);
    const movements: Movement[] = [];
    let lastDocument = null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      movements.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
      } as Movement);
      lastDocument = doc;
    });

    return { movements, lastDocument };
  } catch (error) {
    console.error("Error getting movements:", error);
    throw error;
  }
}

export async function getMovementsByType(
  userId: string,
  type: MovementType,
  limitCount: number = 20
): Promise<Movement[]> {
  try {
    const movementsCollection = getMovementsCollection(userId);
    const q = query(
      movementsCollection,
      where("type", "==", type),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const movements: Movement[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      movements.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
      } as Movement);
    });

    return movements;
  } catch (error) {
    console.error("Error getting movements by type:", error);
    throw error;
  }
}

export async function getMovementsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  limitCount: number = 100
): Promise<Movement[]> {
  try {
    const movementsCollection = getMovementsCollection(userId);
    const q = query(
      movementsCollection,
      where("timestamp", ">=", Timestamp.fromDate(startDate)),
      where("timestamp", "<=", Timestamp.fromDate(endDate)),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const movements: Movement[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      movements.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
      } as Movement);
    });

    return movements;
  } catch (error) {
    console.error("Error getting movements by date range:", error);
    throw error;
  }
}

export async function deleteMovement(userId: string, movementId: string): Promise<void> {
  try {
    const movementDoc = doc(getMovementsCollection(userId), movementId);
    await deleteDoc(movementDoc);
  } catch (error) {
    console.error("Error deleting movement:", error);
    throw error;
  }
}

// Funciones de utilidad para crear movimientos específicos
export async function recordAccountCreation(
  userId: string,
  accountId: string,
  accountName: string,
  accountType: string,
  initialBalance: number,
  currency: string
): Promise<void> {
  await addMovement(userId, {
    type: "account_created",
    description: `Cuenta "${accountName}" creada`,
    entityId: accountId,
    entityType: "account",
    amount: initialBalance,
    currency,
    metadata: {
      accountName,
      accountType,
      initialBalance,
    },
  });
}

export async function recordTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  currency: string,
  fromAccountName: string,
  toAccountName: string,
  transferId?: string
): Promise<void> {
  await addMovement(userId, {
    type: "transfer_created",
    description: `Transferencia de ${currency} ${amount.toFixed(2)} desde "${fromAccountName}" hacia "${toAccountName}"`,
    entityId: transferId,
    entityType: "transfer",
    amount,
    currency,
    fromAccount: fromAccountId,
    toAccount: toAccountId,
    metadata: {
      fromAccountName,
      toAccountName,
    },
  });
}

export async function recordTransactionCreation(
  userId: string,
  transactionId: string,
  type: "income" | "expense",
  amount: number,
  category: string,
  source: string,
  accountId: string,
  accountName: string,
  currency: string
): Promise<void> {
  const description = type === "income" 
    ? `Ingreso de ${currency} ${amount.toFixed(2)} registrado en "${accountName}"`
    : `Gasto de ${currency} ${amount.toFixed(2)} registrado en "${accountName}"`;

  await addMovement(userId, {
    type: "transaction_created",
    description,
    entityId: transactionId,
    entityType: "transaction",
    amount,
    currency,
    metadata: {
      transactionType: type,
      category,
      source,
      accountName,
    },
  });
}

export async function recordGoalCreation(
  userId: string,
  goalId: string,
  goalName: string,
  targetAmount: number,
  currency: string
): Promise<void> {
  await addMovement(userId, {
    type: "goal_created",
    description: `Meta "${goalName}" creada con objetivo de ${currency} ${targetAmount.toFixed(2)}`,
    entityId: goalId,
    entityType: "goal",
    amount: targetAmount,
    currency,
    metadata: {
      goalName,
      targetAmount,
    },
  });
}

export async function recordGoalFundsAdded(
  userId: string,
  goalId: string,
  goalName: string,
  amount: number,
  currency: string,
  fromAccountName?: string
): Promise<void> {
  const description = fromAccountName 
    ? `Fondos de ${currency} ${amount.toFixed(2)} agregados a la meta "${goalName}" desde "${fromAccountName}"`
    : `Fondos de ${currency} ${amount.toFixed(2)} agregados a la meta "${goalName}"`;

  await addMovement(userId, {
    type: "goal_funds_added",
    description,
    entityId: goalId,
    entityType: "goal",
    amount,
    currency,
    metadata: {
      goalName,
      fromAccountName,
    },
  });
}

// Función para obtener el nombre legible de un tipo de movimiento
export function getMovementTypeLabel(type: MovementType): string {
  const labels: Record<MovementType, string> = {
    account_created: "Cuenta Creada",
    account_updated: "Cuenta Actualizada",
    account_deleted: "Cuenta Eliminada",
    transaction_created: "Transacción Registrada",
    transaction_updated: "Transacción Actualizada",
    transaction_deleted: "Transacción Eliminada",
    transfer_created: "Transferencia Realizada",
    goal_created: "Meta Creada",
    goal_updated: "Meta Actualizada",
    goal_deleted: "Meta Eliminada",
    goal_funds_added: "Fondos Agregados a Meta",
    recurring_transaction_created: "Transacción Recurrente Creada",
    recurring_transaction_updated: "Transacción Recurrente Actualizada",
    recurring_transaction_deleted: "Transacción Recurrente Eliminada",
  };

  return labels[type] || type;
}

// Función para obtener el ícono de un tipo de movimiento
export function getMovementTypeIcon(type: MovementType): string {
  const icons: Record<MovementType, string> = {
    account_created: "👤",
    account_updated: "✏️",
    account_deleted: "🗑️",
    transaction_created: "💰",
    transaction_updated: "✏️",
    transaction_deleted: "🗑️",
    transfer_created: "🔄",
    goal_created: "🎯",
    goal_updated: "✏️",
    goal_deleted: "🗑️",
    goal_funds_added: "💸",
    recurring_transaction_created: "🔁",
    recurring_transaction_updated: "✏️",
    recurring_transaction_deleted: "🗑️",
  };

  return icons[type] || "📋";
}
