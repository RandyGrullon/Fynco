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
  writeBatch,
} from "firebase/firestore";

export type AccountType =
  | "savings"
  | "checking"
  | "investment"
  | "credit"
  | "other";

export type Account = {
  id?: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  createdAt: Date | Timestamp | string;
  updatedAt: Date | Timestamp | string;
  description?: string;
  isDefault?: boolean;
  isGoalAccount?: boolean;
  goalId?: string;
};

export type AccountTransaction = {
  id?: string;
  userId: string;
  accountId: string;
  date: Date | Timestamp | string;
  amount: number;
  type: "debit" | "credit" | "transfer";
  description: string;
  category?: string;
  toAccountId?: string; // For transfers between accounts
  relatedTransactionId?: string; // For linking transfers
};

function getAccountsCollection(userId: string) {
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return collection(db, "users", userId, "accounts");
}

function getAccountTransactionsCollection(userId: string, accountId: string) {
  if (!userId || !accountId) {
    throw new Error("User or account not authenticated");
  }
  return collection(db, "users", userId, "accounts", accountId, "transactions");
}

// Account operations
export async function addAccount(
  account: Omit<Account, "id" | "userId" | "createdAt" | "updatedAt">,
  userId: string
) {
  try {
    const accountsCollection = getAccountsCollection(userId);
    const now = Timestamp.now();

    // If this is the first account, make it default
    const existingAccounts = await getAccounts(userId);
    const isDefault =
      existingAccounts.length === 0 ? true : !!account.isDefault;

    const docRef = await addDoc(accountsCollection, {
      ...account,
      userId,
      createdAt: now,
      updatedAt: now,
      isDefault,
    });

    // If this is set as default, unset other defaults
    if (isDefault) {
      await updateDefaultAccount(userId, docRef.id);
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding account: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateAccount(
  id: string,
  account: Partial<Account>,
  userId: string
) {
  try {
    const accountRef = doc(db, "users", userId, "accounts", id);
    const dataToUpdate = {
      ...account,
      updatedAt: Timestamp.now(),
    };

    await updateDoc(accountRef, dataToUpdate);

    // If this account is being set as default, update others
    if (account.isDefault) {
      await updateDefaultAccount(userId, id);
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating account: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteAccount(id: string, userId: string) {
  try {
    console.log(`Starting to delete account ${id} for user ${userId}`);

    // Debug function to check the structure of goals
    async function debugGoals() {
      const goalsCollection = collection(db, "users", userId, "goals");
      const allGoalsSnapshot = await getDocs(goalsCollection);

      console.log(`User has ${allGoalsSnapshot.size} total goals`);

      allGoalsSnapshot.forEach((goalDoc) => {
        const goal = goalDoc.data();
        console.log(
          `Goal ${goalDoc.id}: ${goal.name}, accountId: ${
            goal.accountId || "none"
          }`
        );
      });
    }

    // Debug goals before deletion
    await debugGoals();

    const accountRef = doc(db, "users", userId, "accounts", id);

    // Check if this is the default account
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      console.error(`Account ${id} not found for user ${userId}`);
      throw new Error("Account not found");
    }

    const accountData = accountSnap.data() as Account;
    console.log(
      `Account found: ${accountData.name}, type: ${accountData.type}`
    );

    // If this is a default account and there are multiple accounts, set another one as default
    const accounts = await getAccounts(userId);
    if (accountData.isDefault && accounts.length > 1) {
      // Find another account to set as default
      const newDefaultAccount = accounts.find((acc) => acc.id !== id);
      if (newDefaultAccount?.id) {
        await updateAccount(newDefaultAccount.id, { isDefault: true }, userId);
        console.log(
          `Set account ${newDefaultAccount.id} as the new default account`
        );
      }
    }
    // Allow deleting the last account, even if it's default

    // Helper function to delete documents in batches
    async function deleteCollection(
      collectionPath: string,
      fieldName: string,
      fieldValue: string
    ) {
      const q = query(
        collection(db, collectionPath),
        where(fieldName, "==", fieldValue)
      );
      const snapshot = await getDocs(q);

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      const totalDocs = snapshot.size;
      let processed = 0;

      while (processed < totalDocs) {
        const batch = writeBatch(db);
        const docsToProcess = snapshot.docs.slice(
          processed,
          processed + batchSize
        );

        docsToProcess.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        processed += docsToProcess.length;
      }

      return totalDocs;
    }

    // Delete all transactions associated with this account
    const transactionsDeleted = await deleteCollection(
      `users/${userId}/transactions`,
      "accountId",
      id
    );
    console.log(
      `Deleted ${transactionsDeleted} transactions for account ${id}`
    );

    // Delete all recurring transactions associated with this account
    const recurringTransactionsDeleted = await deleteCollection(
      `users/${userId}/recurringTransactions`,
      "accountId",
      id
    );
    console.log(
      `Deleted ${recurringTransactionsDeleted} recurring transactions for account ${id}`
    );

    // Handle goals associated with this account in two ways:

    // 1. If this account is a special goal account (created specifically for a goal)
    if (accountData.isGoalAccount && accountData.goalId) {
      const goalRef = doc(db, "users", userId, "goals", accountData.goalId);
      const goalSnap = await getDoc(goalRef);

      if (goalSnap.exists()) {
        // Delete the goal completely since its dedicated account is being deleted
        await deleteDoc(goalRef);
        console.log(
          `Deleted goal ${accountData.goalId} because its dedicated account was deleted`
        );
      }
    }

    // 2. Find and delete any other goals that reference this account
    try {
      const goalsQuery = query(
        collection(db, "users", userId, "goals"),
        where("accountId", "==", id)
      );

      const goalsSnapshot = await getDocs(goalsQuery);
      console.log(`Found ${goalsSnapshot.size} goals with accountId = ${id}`);

      // If we have goals associated with this account, delete them
      if (!goalsSnapshot.empty) {
        const batch = writeBatch(db);
        goalsSnapshot.forEach((goalDoc) => {
          console.log(
            `Deleting goal ${goalDoc.id} associated with account ${id}`
          );
          batch.delete(goalDoc.ref);
        });
        await batch.commit();
        console.log(
          `Deleted ${goalsSnapshot.size} goals associated with account ${id}`
        );
      } else {
        console.log(`No goals found associated with account ${id}`);
      }
    } catch (error) {
      console.error(`Error deleting goals for account ${id}:`, error);
    }

    // Finally, delete the account
    await deleteDoc(accountRef);

    // Debug goals after deletion to confirm they were removed
    console.log("Goals after account deletion:");
    await debugGoals();

    return { success: true };
  } catch (error) {
    console.error("Error deleting account: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAccounts(userId: string): Promise<Account[]> {
  if (!userId) {
    console.error("No user ID provided to getAccounts");
    return [];
  }
  try {
    const accountsCollection = getAccountsCollection(userId);
    const q = query(accountsCollection, orderBy("createdAt", "desc"));

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
    return accounts;
  } catch (error) {
    console.error("Error getting accounts for user", userId, error);
    return [];
  }
}

export async function getAccountById(
  userId: string,
  accountId: string
): Promise<Account | null> {
  try {
    const accountRef = doc(db, "users", userId, "accounts", accountId);
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      return null;
    }

    const data = accountSnap.data();
    return {
      id: accountSnap.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
    } as Account;
  } catch (error) {
    console.error("Error getting account", error);
    return null;
  }
}

export async function getDefaultAccount(
  userId: string
): Promise<Account | null> {
  try {
    const accountsCollection = getAccountsCollection(userId);
    const q = query(
      accountsCollection,
      where("isDefault", "==", true),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
    } as Account;
  } catch (error) {
    console.error("Error getting default account", error);
    return null;
  }
}

async function updateDefaultAccount(userId: string, defaultAccountId: string) {
  try {
    const accountsCollection = getAccountsCollection(userId);
    const q = query(accountsCollection, where("isDefault", "==", true));
    const querySnapshot = await getDocs(q);

    // Update each document individually rather than using batch
    const updatePromises = querySnapshot.docs.map((docSnapshot) => {
      if (docSnapshot.id !== defaultAccountId) {
        const docRef = doc(db, "users", userId, "accounts", docSnapshot.id);
        return updateDoc(docRef, { isDefault: false });
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);
    return true;
  } catch (error) {
    console.error("Error updating default accounts", error);
    return false;
  }
}

// Account transactions operations
export async function addAccountTransaction(
  transaction: Omit<AccountTransaction, "id" | "userId">,
  userId: string
) {
  try {
    const accountTransactionsCollection = getAccountTransactionsCollection(
      userId,
      transaction.accountId
    );

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

    // Handle transfer between accounts
    if (transaction.type === "transfer" && transaction.toAccountId) {
      // Get the source and destination account names
      const sourceAccount = await getAccountById(userId, transaction.accountId);
      const destAccount = await getAccountById(userId, transaction.toAccountId);

      const sourceAccountName = sourceAccount?.name || transaction.accountId;
      const destAccountName = destAccount?.name || transaction.toAccountId;

      // First create the debit (outgoing) transaction
      const debitTransactionData: any = {
        userId,
        accountId: transaction.accountId,
        date: dateToStore,
        amount: transaction.amount,
        type: "debit",
        description: `Transfer to ${destAccountName}: ${transaction.description}`,
      };

      // Only add category if it's defined
      if (transaction.category) {
        debitTransactionData.category = transaction.category;
      }

      const debitDocRef = await addDoc(
        accountTransactionsCollection,
        debitTransactionData
      );

      // Then create the credit (incoming) transaction in the target account
      const creditTransactionsCollection = getAccountTransactionsCollection(
        userId,
        transaction.toAccountId
      );

      const creditTransactionData: any = {
        userId,
        accountId: transaction.toAccountId,
        date: dateToStore,
        amount: transaction.amount,
        type: "credit",
        description: `Transfer from ${sourceAccountName}: ${transaction.description}`,
        relatedTransactionId: debitDocRef.id,
      };

      // Only add category if it's defined
      if (transaction.category) {
        creditTransactionData.category = transaction.category;
      }

      const creditDocRef = await addDoc(
        creditTransactionsCollection,
        creditTransactionData
      );

      // Update the debit transaction with the related credit transaction ID
      await updateDoc(debitDocRef, {
        relatedTransactionId: creditDocRef.id,
      });

      // Update both account balances
      await updateAccountBalance(
        userId,
        transaction.accountId,
        -transaction.amount
      );
      await updateAccountBalance(
        userId,
        transaction.toAccountId,
        transaction.amount
      );

      return { success: true, id: debitDocRef.id, relatedId: creditDocRef.id };
    } else {
      // Regular debit or credit transaction
      const transactionData: any = {
        userId,
        accountId: transaction.accountId,
        date: dateToStore,
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
      };

      // Only add optional fields if they're defined
      if (transaction.category) {
        transactionData.category = transaction.category;
      }

      if (transaction.toAccountId) {
        transactionData.toAccountId = transaction.toAccountId;
      }

      if (transaction.relatedTransactionId) {
        transactionData.relatedTransactionId = transaction.relatedTransactionId;
      }

      const docRef = await addDoc(
        accountTransactionsCollection,
        transactionData
      );

      // Update account balance
      const amountChange =
        transaction.type === "debit" ? -transaction.amount : transaction.amount;

      await updateAccountBalance(userId, transaction.accountId, amountChange);

      return { success: true, id: docRef.id };
    }
  } catch (error) {
    console.error("Error adding account transaction: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAccountTransactions(
  userId: string,
  accountId: string,
  count?: number
): Promise<AccountTransaction[]> {
  if (!userId || !accountId) {
    console.error("No user ID or account ID provided");
    return [];
  }
  try {
    const transactionsCollection = getAccountTransactionsCollection(
      userId,
      accountId
    );
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
      } as AccountTransaction;
    });
    return transactions;
  } catch (error) {
    console.error("Error getting account transactions", error);
    return [];
  }
}

export async function getAllAccountTransactions(
  userId: string,
  count?: number
): Promise<AccountTransaction[]> {
  if (!userId) {
    console.error("No user ID provided");
    return [];
  }

  try {
    const accounts = await getAccounts(userId);
    let allTransactions: AccountTransaction[] = [];

    // Get transactions from each account
    for (const account of accounts) {
      if (account.id) {
        const transactions = await getAccountTransactions(userId, account.id);
        allTransactions = [...allTransactions, ...transactions];
      }
    }

    // Sort by date descending
    allTransactions.sort((a, b) => {
      const dateA =
        typeof a.date === "string"
          ? new Date(a.date).getTime()
          : a.date instanceof Date
          ? a.date.getTime()
          : (a.date as Timestamp).toDate().getTime();
      const dateB =
        typeof b.date === "string"
          ? new Date(b.date).getTime()
          : b.date instanceof Date
          ? b.date.getTime()
          : (b.date as Timestamp).toDate().getTime();
      return dateB - dateA;
    });

    // Apply limit if provided
    if (count && count > 0) {
      allTransactions = allTransactions.slice(0, count);
    }

    return allTransactions;
  } catch (error) {
    console.error("Error getting all account transactions", error);
    return [];
  }
}

export async function updateAccountBalance(
  userId: string,
  accountId: string,
  amountChange: number
) {
  try {
    const accountRef = doc(db, "users", userId, "accounts", accountId);
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      throw new Error("Account not found");
    }

    const accountData = accountSnap.data() as Account;
    const newBalance = accountData.balance + amountChange;

    await updateDoc(accountRef, {
      balance: newBalance,
      updatedAt: Timestamp.now(),
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("Error updating account balance: ", error);
    return { success: false, error: (error as Error).message };
  }
}
