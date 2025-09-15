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
import {
  recordAccountCreation,
  recordTransfer,
  recordTransactionCreation,
} from "@/lib/movements";

/**
 * Verifica que el userId proporcionado sea válido y no esté vacío
 * Esto previene acceso no autorizado a datos de otros usuarios
 */
function validateUserId(userId: string, operationName: string): boolean {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    console.error(`Security: Invalid userId provided to ${operationName}`);
    throw new Error("Unauthorized access: Invalid user ID");
  }
  return true;
}

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

    // Registrar el movimiento de creación de cuenta
    try {
      await recordAccountCreation(
        userId,
        docRef.id,
        account.name,
        account.type,
        account.balance,
        account.currency
      );
    } catch (error) {
      console.error("Error recording account creation movement:", error);
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
    // Debug function to check the structure of goals
    async function debugGoals() {
      const goalsCollection = collection(db, "users", userId, "goals");
      const allGoalsSnapshot = await getDocs(goalsCollection);

      allGoalsSnapshot.forEach((goalDoc) => {
        const goal = goalDoc.data();
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

    // If this is a default account and there are multiple accounts, set another one as default
    const accounts = await getAccounts(userId);
    if (accountData.isDefault && accounts.length > 1) {
      // Find another account to set as default
      const newDefaultAccount = accounts.find((acc) => acc.id !== id);
      if (newDefaultAccount?.id) {
        await updateAccount(newDefaultAccount.id, { isDefault: true }, userId);
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

    // Delete all recurring transactions associated with this account
    const recurringTransactionsDeleted = await deleteCollection(
      `users/${userId}/recurringTransactions`,
      "accountId",
      id
    );

    // Handle goals associated with this account in two ways:

    // 1. If this account is a special goal account (created specifically for a goal)
    if (accountData.isGoalAccount && accountData.goalId) {
      const goalRef = doc(db, "users", userId, "goals", accountData.goalId);
      const goalSnap = await getDoc(goalRef);

      if (goalSnap.exists()) {
        // Delete the goal completely since its dedicated account is being deleted
        await deleteDoc(goalRef);
      }
    }

    // 2. Find and delete any other goals that reference this account
    try {
      const goalsQuery = query(
        collection(db, "users", userId, "goals"),
        where("accountId", "==", id)
      );

      const goalsSnapshot = await getDocs(goalsQuery);

      // If we have goals associated with this account, delete them
      if (!goalsSnapshot.empty) {
        const batch = writeBatch(db);
        goalsSnapshot.forEach((goalDoc) => {
          batch.delete(goalDoc.ref);
        });
        await batch.commit();
      } else {
      }
    } catch (error) {
      console.error(`Error deleting goals for account ${id}:`, error);
    }

    // Finally, delete the account
    await deleteDoc(accountRef);

    // Debug goals after deletion to confirm they were removed
    await debugGoals();

    return { success: true };
  } catch (error) {
    console.error("Error deleting account: ", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getAccounts(userId: string): Promise<Account[]> {
  try {
    // Validar que el userId es válido (previene acceso no autorizado)
    validateUserId(userId, "getAccounts");

    const accountsCollection = getAccountsCollection(userId);
    const q = query(accountsCollection, orderBy("createdAt", "desc"));

    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();

        // Verificación adicional: asegurar que los datos pertenecen al usuario correcto
        if (data.userId && data.userId !== userId) {
          console.error(
            `Security: Account ${doc.id} does not belong to user ${userId}`
          );
          return null;
        }

        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
          updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
        } as Account;
      })
      .filter((account) => account !== null); // Filtrar cuentas nulas por seguridad

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

      // Also create transactions in the main transactions collection
      // so transfers appear in the general transactions page
      // We create them manually to avoid double balance updates
      const transactionsCollection = collection(
        db,
        "users",
        userId,
        "transactions"
      );

      // Create expense transaction for source account
      await addDoc(transactionsCollection, {
        type: "expense",
        amount: transaction.amount,
        source: `Transfer to ${destAccountName}: ${transaction.description}`,
        date: dateToStore,
        method: "Bank Transfer",
        category: "Transfer",
        accountId: transaction.accountId,
        userId,
      });

      // Create income transaction for destination account
      await addDoc(transactionsCollection, {
        type: "income",
        amount: transaction.amount,
        source: `Transfer from ${sourceAccountName}: ${transaction.description}`,
        date: dateToStore,
        method: "Bank Transfer",
        category: "Transfer",
        accountId: transaction.toAccountId,
        userId,
      });

      // Registrar el movimiento de transferencia
      try {
        await recordTransfer(
          userId,
          transaction.accountId,
          transaction.toAccountId,
          transaction.amount,
          sourceAccount?.currency || "USD",
          sourceAccountName,
          destAccountName,
          debitDocRef.id
        );
      } catch (error) {
        console.error("Error recording transfer movement:", error);
      }

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

      // Registrar el movimiento de transacción de cuenta directamente
      try {
        const account = await getAccountById(userId, transaction.accountId);
        const mainTransactionType =
          transaction.type === "credit" ? "income" : "expense";
        const defaultCategory =
          transaction.category ||
          (transaction.type === "credit" ? "Other" : "Other");
        const description =
          transaction.description ||
          (transaction.type === "credit" ? "Account Credit" : "Account Debit");

        await recordTransactionCreation(
          userId,
          docRef.id, // usar el ID de la transacción de cuenta
          mainTransactionType,
          transaction.amount,
          defaultCategory,
          description,
          transaction.accountId,
          account?.name || "Cuenta Desconocida",
          account?.currency || "USD"
        );
      } catch (error) {
        console.error("Error recording account transaction movement:", error);
      }

      // Also create a transaction in the main transactions collection
      // so it appears in the general transactions page
      // We create it manually to avoid double balance updates
      const transactionsCollection = collection(
        db,
        "users",
        userId,
        "transactions"
      );
      const mainTransactionType =
        transaction.type === "credit" ? "income" : "expense";

      // Use better default categories and descriptions for account transactions
      const defaultCategory =
        transaction.category ||
        (transaction.type === "credit" ? "Other" : "Other");
      const description =
        transaction.description ||
        (transaction.type === "credit" ? "Account Credit" : "Account Debit");

      await addDoc(transactionsCollection, {
        type: mainTransactionType,
        amount: transaction.amount,
        source: description,
        date: dateToStore,
        method: transaction.type === "credit" ? "Direct Deposit" : "Cash",
        category: defaultCategory,
        accountId: transaction.accountId,
        userId,
      });

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
    // Get accounts and their transactions in parallel
    const accounts = await getAccounts(userId);

    if (accounts.length === 0) {
      return [];
    }

    // Use Promise.all to fetch all account transactions in parallel
    const transactionPromises = accounts
      .filter((account) => account.id)
      .map((account) => getAccountTransactions(userId, account.id!));

    const transactionArrays = await Promise.all(transactionPromises);

    // Flatten all transactions into a single array
    const allTransactions = transactionArrays.flat();

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
      return allTransactions.slice(0, count);
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

export async function deleteAccountTransaction(
  userId: string,
  accountId: string,
  transactionId: string
) {
  try {
    // Get the transaction first to know the amount and type for balance reversal
    const transactionRef = doc(
      db,
      "users",
      userId,
      "accounts",
      accountId,
      "transactions",
      transactionId
    );
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error("Transaction not found");
    }

    const transactionData = transactionSnap.data() as AccountTransaction;

    // Calculate the amount to reverse from the account balance
    const amountChange =
      transactionData.type === "credit"
        ? -transactionData.amount
        : transactionData.amount;

    // If it's a transfer, handle the related transaction
    if (
      transactionData.type === "transfer" &&
      transactionData.relatedTransactionId
    ) {
      // Find and delete the related transaction in the other account
      if (transactionData.toAccountId) {
        const relatedTransactionRef = doc(
          db,
          "users",
          userId,
          "accounts",
          transactionData.toAccountId,
          "transactions",
          transactionData.relatedTransactionId
        );

        const relatedTransactionSnap = await getDoc(relatedTransactionRef);
        if (relatedTransactionSnap.exists()) {
          // Reverse balance in the target account
          const relatedTransactionData =
            relatedTransactionSnap.data() as AccountTransaction;
          const relatedAmountChange =
            relatedTransactionData.type === "credit"
              ? -relatedTransactionData.amount
              : relatedTransactionData.amount;

          await updateAccountBalance(
            userId,
            transactionData.toAccountId,
            relatedAmountChange
          );
          await deleteDoc(relatedTransactionRef);
        }
      }
    }

    // Delete the main transaction
    await deleteDoc(transactionRef);

    // Update the account balance
    await updateAccountBalance(userId, accountId, amountChange);

    // Also try to find and delete the corresponding transaction in the main transactions collection
    try {
      const mainTransactionsQuery = query(
        collection(db, "users", userId, "transactions"),
        where("accountId", "==", accountId),
        where("amount", "==", transactionData.amount),
        where("source", "==", transactionData.description)
      );

      const mainTransactionsSnap = await getDocs(mainTransactionsQuery);
      mainTransactionsSnap.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
    } catch (error) {
      console.warn("Could not delete corresponding main transaction:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting account transaction: ", error);
    return { success: false, error: (error as Error).message };
  }
}
