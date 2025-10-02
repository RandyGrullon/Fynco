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
import type { Transaction } from "./transactions";

const RECURRING_CATCH_UP_LIMIT = 730;

type AddTransactionInput = Omit<Transaction, "id" | "userId">;
type AddTransactionResult = {
  success: boolean;
  id?: string;
  error?: string;
};
type AddTransactionFn = (
  transaction: AddTransactionInput,
  userId: string
) => Promise<AddTransactionResult>;

const TRANSACTION_CATEGORY_VALUES: Transaction["category"][] = [
  "Food",
  "Transport",
  "Shopping",
  "Salary",
  "Utilities",
  "Entertainment",
  "Investment",
  "Gift",
  "Refund",
  "Other",
];

const RECURRING_METHOD_INCOME: Transaction["method"] = "Direct Deposit";
const RECURRING_METHOD_EXPENSE: Transaction["method"] = "Bank Transfer";

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
  payOnWeekends?: boolean; // Whether to pay on weekends or adjust to previous weekday
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
      return {
        success: false,
        error: "Account is required for recurring transactions",
      };
    }
    const recurringTransactionsCollection =
      getRecurringTransactionsCollection(userId);
    const now = Timestamp.now();

    const parsedStartDate = parseDate(transaction.startDate);
    if (!parsedStartDate) {
      return {
        success: false,
        error: "Invalid start date provided for recurring transaction",
      };
    }

    // Calculate next process date based on start date and frequency (unadjusted for weekends)
    const nextProcessDate =
      calculateNextProcessDate(
        parsedStartDate,
        transaction.frequency,
        transaction.payOnWeekends ?? true
      ) || startOfDay(parsedStartDate);

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
    await processDueRecurringTransactions(userId);

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
    if (
      transaction.frequency ||
      transaction.startDate ||
      transaction.isActive === true
    ) {
      // Get current transaction data to merge with updates
      const currentDoc = await getDoc(recurringTransactionRef);
      if (currentDoc.exists()) {
        const currentData = currentDoc.data() as RecurringTransaction;

        const startDate = parseDate(
          transaction.startDate ?? currentData.startDate
        );

        const frequency = transaction.frequency || currentData.frequency;
        const payOnWeekends =
          transaction.payOnWeekends ?? currentData.payOnWeekends ?? true;

        if (startDate) {
          const referenceDate =
            transaction.isActive === true
              ? new Date()
              : parseDate(currentData.nextProcessDate) ?? startDate;
          const nextProcessDate = calculateNextProcessDate(
            startDate,
            frequency,
            payOnWeekends,
            referenceDate
          );
          updateData.nextProcessDate = nextProcessDate
            ? Timestamp.fromDate(nextProcessDate)
            : null;
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
    await processDueRecurringTransactions(userId);

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
    await processDueRecurringTransactions(userId);

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

export async function processDueRecurringTransactions(
  userId: string
): Promise<number> {
  if (!userId) {
    return 0;
  }

  const recurringTransactionsCollection =
    getRecurringTransactionsCollection(userId);
  const activeQuery = query(
    recurringTransactionsCollection,
    where("isActive", "==", true)
  );

  const snapshot = await getDocs(activeQuery);
  if (snapshot.empty) {
    return 0;
  }

  const today = startOfDay(new Date());
  let processedCount = 0;

  let addTransactionFn: AddTransactionFn | null = null;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as RecurringTransaction;

    if (!data.accountId || !data.amount || data.amount <= 0) {
      continue;
    }

    const startDate = parseDate(data.startDate);
    if (!startDate) {
      continue;
    }

    const payOnWeekends = data.payOnWeekends ?? true;
    const endDate = parseDate(data.endDate);

    const lastScheduledOccurrence = parseDate(data.lastProcessed);
    let scheduledPointer: Date | null = null;

    if (lastScheduledOccurrence) {
      scheduledPointer = addFrequency(lastScheduledOccurrence, data.frequency);
    }

    if (!scheduledPointer) {
      scheduledPointer = parseDate(data.nextProcessDate);
    }

    if (!scheduledPointer) {
      scheduledPointer = calculateNextProcessDate(
        startDate,
        data.frequency,
        payOnWeekends,
        today
      );
    }

    if (!scheduledPointer) {
      continue;
    }

    scheduledPointer = startOfDay(scheduledPointer);

    let iterations = 0;
    let processedForDoc = false;
    let lastScheduledProcessed: Date | null = null;

    while (
      scheduledPointer &&
      scheduledPointer <= today &&
      (!endDate || scheduledPointer <= endDate) &&
      iterations < RECURRING_CATCH_UP_LIMIT
    ) {
      if (!addTransactionFn) {
        const module = await import("./transactions");
        addTransactionFn = module.addTransaction as AddTransactionFn;
      }

      const addTransaction = addTransactionFn;
      if (!addTransaction) {
        console.error("Recurring processing: addTransaction not available");
        break;
      }

      const executionDate = adjustForWeekends(
        new Date(scheduledPointer),
        payOnWeekends
      );

      try {
        const category = TRANSACTION_CATEGORY_VALUES.includes(
          data.category as Transaction["category"]
        )
          ? (data.category as Transaction["category"])
          : ("Other" as Transaction["category"]);

        const method =
          data.type === "income"
            ? RECURRING_METHOD_INCOME
            : RECURRING_METHOD_EXPENSE;

        const sourceDescription =
          (data.description && data.description.trim().length > 0
            ? data.description
            : undefined) ||
          `Recurring ${data.type === "income" ? "income" : "expense"}`;

        const result = await addTransaction(
          {
            amount: data.amount,
            type: data.type,
            category,
            date: executionDate,
            source: sourceDescription,
            method,
            accountId: data.accountId,
          },
          userId
        );

        if (!result.success) {
          console.error(
            "Failed to record recurring transaction:",
            result.error
          );
          break;
        }

        processedCount += 1;
        processedForDoc = true;
        lastScheduledProcessed = scheduledPointer;
        iterations += 1;

        scheduledPointer = addFrequency(scheduledPointer, data.frequency);
      } catch (error) {
        console.error("Error processing recurring transaction:", error);
        break;
      }
    }

    if (processedForDoc) {
      const updatePayload: Record<string, any> = {
        updatedAt: Timestamp.now(),
        lastProcessed: lastScheduledProcessed
          ? Timestamp.fromDate(lastScheduledProcessed)
          : null,
        nextProcessDate:
          scheduledPointer && (!endDate || scheduledPointer <= endDate)
            ? Timestamp.fromDate(scheduledPointer)
            : null,
      };

      if (
        updatePayload.nextProcessDate === null &&
        endDate &&
        today > endDate
      ) {
        updatePayload.isActive = false;
      }

      await updateDoc(docSnap.ref, updatePayload);
    } else if (endDate && today > endDate) {
      await updateDoc(docSnap.ref, {
        isActive: false,
        nextProcessDate: null,
        updatedAt: Timestamp.now(),
      });
    }
  }

  return processedCount;
}

function calculateNextProcessDate(
  startDate: Date,
  frequency: RecurrenceFrequency,
  _payOnWeekends: boolean = true,
  referenceDate: Date = new Date()
): Date | null {
  const normalizedStart = startOfDay(startDate);
  const normalizedReference = startOfDay(referenceDate);

  let candidate = normalizedStart;
  let iterations = 0;

  while (
    candidate < normalizedReference &&
    iterations < RECURRING_CATCH_UP_LIMIT
  ) {
    candidate = addFrequency(candidate, frequency);
    iterations += 1;
  }

  return candidate;
}

function addFrequency(baseDate: Date, frequency: RecurrenceFrequency): Date {
  const next = startOfDay(baseDate);

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly": {
      const day = baseDate.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const daysInMonth = getDaysInMonth(next.getFullYear(), next.getMonth());
      next.setDate(Math.min(day, daysInMonth));
      break;
    }
    case "quarterly": {
      const day = baseDate.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 3);
      const daysInMonth = getDaysInMonth(next.getFullYear(), next.getMonth());
      next.setDate(Math.min(day, daysInMonth));
      break;
    }
    case "yearly": {
      const day = baseDate.getDate();
      const month = baseDate.getMonth();
      next.setFullYear(next.getFullYear() + 1, month, 1);
      const daysInMonth = getDaysInMonth(next.getFullYear(), month);
      next.setDate(Math.min(day, daysInMonth));
      break;
    }
    default:
      break;
  }

  return startOfDay(next);
}

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function parseDate(value?: Date | Timestamp | string | null): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

// Helper to get days in month (accounting for leap years)
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Helper to adjust date if it falls on weekend and payOnWeekends is false
function adjustForWeekends(date: Date, payOnWeekends: boolean): Date {
  if (payOnWeekends) return date;

  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // If Sunday or Saturday, move to previous Friday
    const adjusted = new Date(date);
    adjusted.setDate(date.getDate() - (dayOfWeek === 0 ? 2 : 1));
    return adjusted;
  }
  return date;
}
