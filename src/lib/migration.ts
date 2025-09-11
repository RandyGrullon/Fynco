"use client";

import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Transaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { Goal } from "@/lib/goals";
import { recordTransactionCreation, recordAccountCreation, recordGoalCreation } from "@/lib/movements";

// Función para migrar transacciones existentes a movimientos
export async function migrateExistingTransactions(userId: string): Promise<void> {
  try {
    console.log("Starting migration of existing transactions...");
    
    // Obtener todas las transacciones existentes
    const transactionsRef = collection(db, "users", userId, "transactions");
    const transactionsQuery = query(transactionsRef, orderBy("date", "desc"));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    // Obtener todas las cuentas para mapear nombres
    const accountsRef = collection(db, "users", userId, "accounts");
    const accountsSnapshot = await getDocs(accountsRef);
    const accountsMap: Record<string, Account> = {};
    
    accountsSnapshot.forEach((doc) => {
      const account = { id: doc.id, ...doc.data() } as Account;
      accountsMap[doc.id] = account;
    });
    
    let migrated = 0;
    const promises: Promise<void>[] = [];
    
    transactionsSnapshot.forEach((doc) => {
      const transaction = { id: doc.id, ...doc.data() } as Transaction;
      const account = accountsMap[transaction.accountId];
      
      if (account) {
        const promise = recordTransactionCreation(
          userId,
          doc.id,
          transaction.type,
          transaction.amount,
          transaction.category,
          transaction.source,
          transaction.accountId,
          account.name,
          account.currency || "USD"
        ).catch((error) => {
          console.error(`Error migrating transaction ${doc.id}:`, error);
        });
        
        promises.push(promise);
        migrated++;
      }
    });
    
    await Promise.all(promises);
    console.log(`Migration completed: ${migrated} transactions migrated`);
    
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

// Función para migrar cuentas existentes a movimientos
export async function migrateExistingAccounts(userId: string): Promise<void> {
  try {
    console.log("Starting migration of existing accounts...");
    
    const accountsRef = collection(db, "users", userId, "accounts");
    const accountsSnapshot = await getDocs(accountsRef);
    
    let migrated = 0;
    const promises: Promise<void>[] = [];
    
    accountsSnapshot.forEach((doc) => {
      const account = { id: doc.id, ...doc.data() } as Account;
      
      const promise = recordAccountCreation(
        userId,
        doc.id,
        account.name,
        account.type,
        account.balance,
        account.currency
      ).catch((error) => {
        console.error(`Error migrating account ${doc.id}:`, error);
      });
      
      promises.push(promise);
      migrated++;
    });
    
    await Promise.all(promises);
    console.log(`Migration completed: ${migrated} accounts migrated`);
    
  } catch (error) {
    console.error("Error during accounts migration:", error);
    throw error;
  }
}

// Función para migrar metas existentes a movimientos
export async function migrateExistingGoals(userId: string): Promise<void> {
  try {
    console.log("Starting migration of existing goals...");
    
    const goalsRef = collection(db, "users", userId, "goals");
    const goalsSnapshot = await getDocs(goalsRef);
    
    let migrated = 0;
    const promises: Promise<void>[] = [];
    
    goalsSnapshot.forEach((doc) => {
      const goal = { id: doc.id, ...doc.data() } as Goal;
      
      const promise = recordGoalCreation(
        userId,
        doc.id,
        goal.name,
        goal.targetAmount,
        goal.currency
      ).catch((error) => {
        console.error(`Error migrating goal ${doc.id}:`, error);
      });
      
      promises.push(promise);
      migrated++;
    });
    
    await Promise.all(promises);
    console.log(`Migration completed: ${migrated} goals migrated`);
    
  } catch (error) {
    console.error("Error during goals migration:", error);
    throw error;
  }
}

// Función principal para ejecutar todas las migraciones
export async function migrateAllExistingData(userId: string): Promise<void> {
  try {
    console.log("Starting full data migration...");
    
    await migrateExistingAccounts(userId);
    await migrateExistingGoals(userId);
    await migrateExistingTransactions(userId);
    
    console.log("Full migration completed successfully!");
    
  } catch (error) {
    console.error("Error during full migration:", error);
    throw error;
  }
}
