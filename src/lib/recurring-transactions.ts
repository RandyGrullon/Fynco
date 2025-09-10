"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  where,
  getDoc,
} from "firebase/firestore";
import { Account, getAccountById } from "./accounts";

export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type RecurringTransaction = {
  id?: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  accountId: string;
  startDate: Date | Timestamp | string;
  endDate?: Date | Timestamp | string | null;
  frequency: RecurrenceFrequency;
  isActive: boolean;
  lastProcessed?: Date | Timestamp | string | null;
  nextProcessDate?: Date | Timestamp | string | null;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
  type: "income" | "expense"; // Whether this is recurring income or expense
};

export type RecurringTransactionWithAccount = RecurringTransaction & {
  account?: Account;
};

function getRecurringTransactionsCollection(userId: string) {
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return collection(db, "users", userId, "recurringTransactions");
}

export async function addRecurringTransaction(
  transaction: Omit<
    RecurringTransaction,
    "id" | "userId" | "createdAt" | "updatedAt" | "nextProcessDate"
  >,
  userId: string
) {
  try {
    // Ensure account association exists
    if (!transaction.accountId) {
      return { success: false, error: "Account is required for recurring transactions" };
    }
    const recurringTransactionsCollection =
      getRecurringTransactionsCollection(userId);
    const now = Timestamp.now();

    // Calculate next process date based on start date and frequency
    const nextProcessDate = calculateNextProcessDate(
      new Date(
        transaction.startDate instanceof Timestamp
          ? transaction.startDate.toDate()
          : typeof transaction.startDate === "string"
          ? new Date(transaction.startDate)
          : transaction.startDate
      ),
      transaction.frequency
    );

    const docRef = await addDoc(recurringTransactionsCollection, {
      ...transaction,
      userId,
      nextProcessDate: nextProcessDate
        ? Timestamp.fromDate(nextProcessDate)
        : null,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding recurring transaction: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateRecurringTransaction(
  id: string,
  transaction: Partial<RecurringTransaction>,
  userId: string
) {
  try {
    const recurringTransactionRef = doc(
      db,
      "users",
      userId,
      "recurringTransactions",
      id
    );
    const now = Timestamp.now();
    const updateData = { ...transaction, updatedAt: now };

    // If frequency or start date changed, recalculate next process date
    if (transaction.frequency || transaction.startDate) {
      // Get current transaction data to merge with updates
      const currentDoc = await getDoc(recurringTransactionRef);
      if (currentDoc.exists()) {
        const currentData = currentDoc.data() as RecurringTransaction;

        const startDate = transaction.startDate
          ? transaction.startDate instanceof Date
            ? transaction.startDate
            : typeof transaction.startDate === "string"
            ? new Date(transaction.startDate)
            : (transaction.startDate as Timestamp).toDate()
          : currentData.startDate instanceof Timestamp
          ? currentData.startDate.toDate()
          : typeof currentData.startDate === "string"
          ? new Date(currentData.startDate)
          : (currentData.startDate as Date);

        const frequency = transaction.frequency || currentData.frequency;

        const nextProcessDate = calculateNextProcessDate(startDate, frequency);
        if (nextProcessDate) {
          updateData.nextProcessDate = Timestamp.fromDate(nextProcessDate);
        }
      }
    }

    await updateDoc(recurringTransactionRef, updateData);
    return { success: true };
  } catch (error) {
    console.error("Error updating recurring transaction: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteRecurringTransaction(id: string, userId: string) {
  try {
    const recurringTransactionRef = doc(
      db,
      "users",
      userId,
      "recurringTransactions",
      id
    );
    await deleteDoc(recurringTransactionRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting recurring transaction: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getRecurringTransactions(
  userId: string
): Promise<RecurringTransactionWithAccount[]> {
  try {
    const recurringTransactionsCollection =
      getRecurringTransactionsCollection(userId);
    const q = query(
      recurringTransactionsCollection,
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    const recurringTransactions: RecurringTransactionWithAccount[] = [];

    for (const doc of querySnapshot.docs) {
      const data = doc.data() as RecurringTransaction;
      const transaction: RecurringTransactionWithAccount = {
        ...data,
        id: doc.id,
        startDate:
          data.startDate instanceof Timestamp
            ? data.startDate.toDate()
            : data.startDate,
        endDate:
          data.endDate instanceof Timestamp
            ? data.endDate.toDate()
            : data.endDate,
        lastProcessed:
          data.lastProcessed instanceof Timestamp
            ? data.lastProcessed.toDate()
            : data.lastProcessed,
        nextProcessDate:
          data.nextProcessDate instanceof Timestamp
            ? data.nextProcessDate.toDate()
            : data.nextProcessDate,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : data.createdAt,
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : data.updatedAt,
      };

      // Get account details
      if (data.accountId) {
        try {
          const account = await getAccountById(userId, data.accountId);
          if (account) {
            transaction.account = account;
          }
        } catch (accountError) {
          console.error(
            "Error fetching account for recurring transaction:",
            accountError
          );
        }
      }

      recurringTransactions.push(transaction);
    }

    return recurringTransactions;
  } catch (error) {
    console.error("Error getting recurring transactions: ", error);
    return [];
  }
}

export async function getRecurringTransaction(
  userId: string,
  id: string
): Promise<RecurringTransactionWithAccount | null> {
  try {
    const recurringTransactionRef = doc(
      db,
      "users",
      userId,
      "recurringTransactions",
      id
    );
    const docSnap = await getDoc(recurringTransactionRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as RecurringTransaction;
      const transaction: RecurringTransactionWithAccount = {
        ...data,
        id: docSnap.id,
        startDate:
          data.startDate instanceof Timestamp
            ? data.startDate.toDate()
            : data.startDate,
        endDate:
          data.endDate instanceof Timestamp
            ? data.endDate.toDate()
            : data.endDate,
        lastProcessed:
          data.lastProcessed instanceof Timestamp
            ? data.lastProcessed.toDate()
            : data.lastProcessed,
        nextProcessDate:
          data.nextProcessDate instanceof Timestamp
            ? data.nextProcessDate.toDate()
            : data.nextProcessDate,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : data.createdAt,
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : data.updatedAt,
      };

      // Get account details
      if (data.accountId) {
        try {
          const account = await getAccountById(userId, data.accountId);
          if (account) {
            transaction.account = account;
          }
        } catch (accountError) {
          console.error(
            "Error fetching account for recurring transaction:",
            accountError
          );
        }
      }

      return transaction;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting recurring transaction: ", error);
    return null;
  }
}

// Helper function to calculate the next process date based on frequency
function calculateNextProcessDate(
  startDate: Date,
  frequency: RecurrenceFrequency
): Date | null {
  const now = new Date();
  const result = new Date(startDate);

  // If start date is in the future, that's the next process date
  if (startDate > now) {
    return startDate;
  }

  // Start from the start date and find the next occurrence based on frequency
  switch (frequency) {
    case "daily":
      // Move to the next day from now
      result.setDate(now.getDate() + 1);
      break;

    case "weekly":
      // Find the next occurrence of the same day of week
      const dayOfWeek = startDate.getDay();
      let daysToAdd = dayOfWeek - now.getDay();
      if (daysToAdd <= 0) daysToAdd += 7;
      result.setDate(now.getDate() + daysToAdd);
      break;

    case "biweekly":
      // Similar to weekly but with 14 days interval
      // Calculate days since start
      const msDiff = now.getTime() - startDate.getTime();
      const daysDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));
      const biweeklyCycles = Math.floor(daysDiff / 14);
      const nextBiweeklyDate = new Date(startDate);
      nextBiweeklyDate.setDate(startDate.getDate() + (biweeklyCycles + 1) * 14);
      return nextBiweeklyDate;

    case "monthly":
      // Move to the same day next month
      result.setMonth(now.getMonth() + 1);
      result.setDate(
        Math.min(
          startDate.getDate(),
          getDaysInMonth(result.getFullYear(), result.getMonth())
        )
      );
      break;

    case "quarterly":
      // Move to the same day 3 months later
      result.setMonth(now.getMonth() + 3);
      result.setDate(
        Math.min(
          startDate.getDate(),
          getDaysInMonth(result.getFullYear(), result.getMonth())
        )
      );
      break;

    case "yearly":
      // Move to the same day/month next year
      result.setFullYear(now.getFullYear() + 1);
      break;

    default:
      return null;
  }

  return result;
}

// Helper to get days in month (accounting for leap years)
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
