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
} from "firebase/firestore";

export type Transaction = {
  id?: string;
  userId: string;
  date: Date | Timestamp | string;
  amount: number;
  type: "income" | "expense";
  category:
    | "Food"
    | "Transport"
    | "Shopping"
    | "Salary"
    | "Utilities"
    | "Entertainment"
    | "Other";
  source: string;
  method: "Credit Card" | "Debit Card" | "Cash" | "Bank Transfer";
};

function getTransactionsCollection(userId: string) {
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return collection(db, "users", userId, "transactions");
}

export async function addTransaction(
  transaction: Omit<Transaction, "id" | "userId">,
  userId: string
) {
  try {
    const transactionsCollection = getTransactionsCollection(userId);

    // Convert date to Timestamp properly
    let dateToStore: Timestamp;
    if (transaction.date instanceof Date) {
      dateToStore = Timestamp.fromDate(transaction.date);
    } else if (typeof transaction.date === "string") {
      dateToStore = Timestamp.fromDate(new Date(transaction.date));
    } else {
      // Already a Timestamp
      dateToStore = transaction.date as Timestamp;
    }

    const docRef = await addDoc(transactionsCollection, {
      ...transaction,
      userId,
      date: dateToStore,
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding document: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTransaction(
  id: string,
  transaction: Partial<Transaction>,
  userId: string
) {
  try {
    const transactionRef = doc(db, "users", userId, "transactions", id);
    const dataToUpdate = { ...transaction };

    // Handle date conversion properly
    if (transaction.date) {
      if (transaction.date instanceof Date) {
        dataToUpdate.date = Timestamp.fromDate(transaction.date);
      } else if (typeof transaction.date === "string") {
        dataToUpdate.date = Timestamp.fromDate(new Date(transaction.date));
      }
      // If it's already a Timestamp, leave it as is
    }

    await updateDoc(transactionRef, dataToUpdate);
    return { success: true };
  } catch (error) {
    console.error("Error updating document: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTransaction(id: string, userId: string) {
  try {
    const transactionRef = doc(db, "users", userId, "transactions", id);
    await deleteDoc(transactionRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting document: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getTransactions(
  userId: string,
  count?: number
): Promise<Transaction[]> {
  if (!userId) {
    console.error("No user ID provided to getTransactions");
    return [];
  }
  try {
    const transactionsCollection = getTransactionsCollection(userId);
    const q = count
      ? query(transactionsCollection, orderBy("date", "desc"), limit(count))
      : query(transactionsCollection, orderBy("date", "desc"));

    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate().toISOString(),
      } as Transaction;
    });
    return transactions;
  } catch (error) {
    console.error("Error getting documents for user", userId, error);
    return [];
  }
}
