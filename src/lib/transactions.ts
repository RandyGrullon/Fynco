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
    | "Investment"
    | "Gift"
    | "Refund"
    | "Other";
  source: string;
  method:
    | "Credit Card"
    | "Debit Card"
    | "Cash"
    | "Bank Transfer"
    | "Direct Deposit";
  accountId: string; // The account this transaction belongs to
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
    // Validate that a target account is provided
    if (!transaction.accountId) {
      return { success: false, error: "Account is required for a transaction" };
    }
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

    // Update account balance based on transaction type
    const amountChange =
      transaction.type === "income" ? transaction.amount : -transaction.amount;

    // Import and use the updateAccountBalance function from accounts.ts
    const { updateAccountBalance } = require("./accounts");
    await updateAccountBalance(userId, transaction.accountId, amountChange);

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

    // Get the original transaction to calculate balance changes
    const { updateAccountBalance } = require("./accounts");
    const originalSnap = await getDoc(transactionRef);

    if (originalSnap.exists()) {
      const originalData = originalSnap.data() as Transaction;

      // If amount or type has changed, we need to update account balances
      if (
        (transaction.amount && transaction.amount !== originalData.amount) ||
        (transaction.type && transaction.type !== originalData.type) ||
        (transaction.accountId &&
          transaction.accountId !== originalData.accountId)
      ) {
        // First, reverse the original transaction's effect on the account
        const originalAmountChange =
          originalData.type === "income"
            ? -originalData.amount
            : originalData.amount;
        await updateAccountBalance(
          userId,
          originalData.accountId,
          originalAmountChange
        );

        // Then apply the new transaction's effect
        const newAmount = transaction.amount || originalData.amount;
        const newType = transaction.type || originalData.type;
        const newAccountId = transaction.accountId || originalData.accountId;

        const newAmountChange = newType === "income" ? newAmount : -newAmount;
        await updateAccountBalance(userId, newAccountId, newAmountChange);
      }
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

    // Get transaction details before deleting
    const transactionSnap = await getDoc(transactionRef);
    if (transactionSnap.exists()) {
      const transactionData = transactionSnap.data() as Transaction;

      // Reverse the effect of the transaction on the account balance
      const { updateAccountBalance } = require("./accounts");
      const amountChange =
        transactionData.type === "income"
          ? -transactionData.amount
          : transactionData.amount;
      await updateAccountBalance(
        userId,
        transactionData.accountId,
        amountChange
      );
    }

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
