"use client";

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  startAfter,
  endBefore,
} from "firebase/firestore";
import { Transaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { processDueRecurringTransactions } from "./recurring-transactions";

interface QueryOptions {
  userId: string;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  transactionType?: "income" | "expense";
  category?: string;
  limit?: number;
  lastDoc?: any;
}

// Optimized function to get transactions with multiple filters
export async function getOptimizedTransactions({
  userId,
  accountId,
  startDate,
  endDate,
  transactionType,
  category,
  limit: queryLimit = 50,
  lastDoc,
}: QueryOptions): Promise<{
  transactions: Transaction[];
  lastDoc: any;
  hasMore: boolean;
}> {
  try {
    await processDueRecurringTransactions(userId);

    const transactionsRef = collection(db, "users", userId, "transactions");

    // Build query constraints
    const constraints: any[] = [];

    // Note: No need to filter by userId since we're already in users/{userId}/transactions subcollection

    // Add optional filters
    if (accountId) {
      constraints.push(where("accountId", "==", accountId));
    }

    if (transactionType) {
      constraints.push(where("type", "==", transactionType));
    }

    if (category) {
      constraints.push(where("category", "==", category));
    }

    // Add date range filter if provided
    if (startDate) {
      constraints.push(where("date", ">=", Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      constraints.push(where("date", "<=", Timestamp.fromDate(endDate)));
    }

    // Order by date (descending) and limit
    constraints.push(orderBy("date", "desc"));

    // Add pagination if lastDoc is provided
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    // Add limit (get one extra to check for more results)
    constraints.push(limit(queryLimit + 1));

    const q = query(transactionsRef, ...constraints);
    const querySnapshot = await getDocs(q);

    const docs = querySnapshot.docs;
    const hasMore = docs.length > queryLimit;

    // Remove extra document if present
    const transactionDocs = hasMore ? docs.slice(0, -1) : docs;

    const transactions = transactionDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as Transaction;
    });

    const newLastDoc =
      transactionDocs.length > 0
        ? transactionDocs[transactionDocs.length - 1]
        : null;

    return { transactions, lastDoc: newLastDoc, hasMore };
  } catch (error) {
    console.error("Error getting optimized transactions:", error);
    return { transactions: [], lastDoc: null, hasMore: false };
  }
}

// Optimized function to get account summary data
export async function getAccountsSummary(userId: string): Promise<{
  accounts: Account[];
  totalBalance: number;
  accountsByType: Record<string, { count: number; balance: number }>;
}> {
  try {
    await processDueRecurringTransactions(userId);

    const accountsRef = collection(db, "users", userId, "accounts");
    const q = query(accountsRef, orderBy("createdAt", "desc"));

    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
      } as Account;
    });

    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const accountsByType = accounts.reduce((acc, account) => {
      const type = account.type;
      if (!acc[type]) {
        acc[type] = { count: 0, balance: 0 };
      }
      acc[type].count += 1;
      acc[type].balance += account.balance;
      return acc;
    }, {} as Record<string, { count: number; balance: number }>);

    return { accounts, totalBalance, accountsByType };
  } catch (error) {
    console.error("Error getting accounts summary:", error);
    return { accounts: [], totalBalance: 0, accountsByType: {} };
  }
}

// Function to get recent transactions efficiently
export async function getRecentTransactions(
  userId: string,
  limitCount: number = 10
): Promise<Transaction[]> {
  try {
    await processDueRecurringTransactions(userId);

    const transactionsRef = collection(db, "users", userId, "transactions");
    const q = query(
      transactionsRef,
      orderBy("date", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as Transaction;
    });
  } catch (error) {
    console.error("Error getting recent transactions:", error);
    return [];
  }
}
