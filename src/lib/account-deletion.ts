/**
 * Sistema completo de eliminación de cuenta de usuario
 *
 * ADVERTENCIA: Esta funcionalidad elimina PERMANENTEMENTE:
 * - Todos los datos financieros del usuario (cuentas, transacciones, metas, etc.)
 * - El documento de usuario en Firestore
 * - La cuenta de Firebase Authentication
 * - Toda la información de sesión local
 *
 * Esta acción es IRREVERSIBLE y no puede deshacerse.
 */

import { User } from "firebase/auth";
import { auth, db } from "./firebase";
import { deleteUser } from "firebase/auth";
import { doc, deleteDoc, getDoc } from "firebase/firestore";
import { deleteCollection, validateUserId } from "./firestore-utils";
import { EncryptionKeyCache } from "./encryption";

/**
 * Resultado de la eliminación de cuenta
 */
export interface DeletionResult {
  success: boolean;
  error?: string;
  deletedItems?: {
    accounts: number;
    transactions: number;
    goals: number;
    recurringTransactions: number;
    movements: number;
  };
}

/**
 * Opciones de eliminación
 */
interface DeletionOptions {
  verificationPhrase?: string; // Frase que el usuario debe escribir para confirmar
  requirePIN?: boolean; // Si se requiere PIN para eliminar
}

/**
 * Verifica que el usuario existe antes de intentar eliminar
 */
async function verifyUserExists(userId: string): Promise<boolean> {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    return userDoc.exists();
  } catch (error) {
    console.error("Error verifying user existence:", error);
    return false;
  }
}

/**
 * Elimina todas las colecciones de datos del usuario
 */
async function deleteUserCollections(userId: string): Promise<{
  accounts: number;
  transactions: number;
  goals: number;
  recurringTransactions: number;
  movements: number;
}> {
  const deletedItems = {
    accounts: 0,
    transactions: 0,
    goals: 0,
    recurringTransactions: 0,
    movements: 0,
  };

  try {
    // Eliminar cuentas
    console.log("Deleting accounts...");
    const accountsResult = await deleteCollection(`users/${userId}/accounts`);
    if (accountsResult.success && accountsResult.data) {
      deletedItems.accounts = accountsResult.data;
    }

    // Eliminar transacciones
    console.log("Deleting transactions...");
    const transactionsResult = await deleteCollection(
      `users/${userId}/transactions`
    );
    if (transactionsResult.success && transactionsResult.data) {
      deletedItems.transactions = transactionsResult.data;
    }

    // Eliminar metas
    console.log("Deleting goals...");
    const goalsResult = await deleteCollection(`users/${userId}/goals`);
    if (goalsResult.success && goalsResult.data) {
      deletedItems.goals = goalsResult.data;
    }

    // Eliminar transacciones recurrentes
    console.log("Deleting recurring transactions...");
    const recurringResult = await deleteCollection(
      `users/${userId}/recurringTransactions`
    );
    if (recurringResult.success && recurringResult.data) {
      deletedItems.recurringTransactions = recurringResult.data;
    }

    // Eliminar movimientos
    console.log("Deleting movements...");
    const movementsResult = await deleteCollection(`users/${userId}/movements`);
    if (movementsResult.success && movementsResult.data) {
      deletedItems.movements = movementsResult.data;
    }

    console.log("All collections deleted:", deletedItems);
  } catch (error) {
    console.error("Error deleting user collections:", error);
    throw new Error("Error al eliminar las colecciones de datos");
  }

  return deletedItems;
}

/**
 * Elimina el documento principal del usuario
 */
async function deleteUserDocument(userId: string): Promise<void> {
  try {
    const userDocRef = doc(db, "users", userId);
    await deleteDoc(userDocRef);
    console.log("User document deleted");
  } catch (error) {
    console.error("Error deleting user document:", error);
    throw new Error("Error al eliminar el documento de usuario");
  }
}

/**
 * Elimina la cuenta de Firebase Authentication
 */
async function deleteAuthAccount(user: User): Promise<void> {
  try {
    await deleteUser(user);
    console.log("Firebase Auth account deleted");
  } catch (error: any) {
    console.error("Error deleting Firebase Auth account:", error);

    // Si el error es por autenticación reciente requerida, lanzar error específico
    if (error.code === "auth/requires-recent-login") {
      throw new Error(
        "Por seguridad, debes volver a iniciar sesión antes de eliminar tu cuenta. " +
          "Por favor, cierra sesión e inicia sesión nuevamente."
      );
    }

    throw new Error("Error al eliminar la cuenta de autenticación");
  }
}

/**
 * Limpia todos los datos locales (localStorage, sessionStorage, caché)
 */
function clearLocalData(userId: string): void {
  try {
    // Limpiar localStorage
    localStorage.clear();

    // Limpiar sessionStorage
    sessionStorage.clear();

    // Limpiar caché de encriptación
    const encryptionCache = EncryptionKeyCache.getInstance();
    encryptionCache.clearCache(userId);

    console.log("Local data cleared");
  } catch (error) {
    console.error("Error clearing local data:", error);
    // No lanzar error aquí, ya que es limpieza local
  }
}

/**
 * Elimina completamente la cuenta del usuario
 *
 * PROCESO:
 * 1. Valida el userId
 * 2. Verifica que el usuario existe
 * 3. Elimina todas las subcolecciones (accounts, transactions, goals, etc.)
 * 4. Elimina el documento de usuario
 * 5. Elimina la cuenta de Firebase Auth
 * 6. Limpia todos los datos locales
 *
 * @param user - Usuario autenticado de Firebase
 * @param options - Opciones adicionales de verificación
 * @returns Resultado de la eliminación con detalles
 */
export async function deleteUserAccountCompletely(
  user: User,
  options: DeletionOptions = {}
): Promise<DeletionResult> {
  try {
    const userId = user.uid;

    // Validar userId
    validateUserId(userId, "deleteUserAccountCompletely");

    console.log("Starting complete account deletion for user:", userId);

    // Verificar que el usuario existe
    const userExists = await verifyUserExists(userId);
    if (!userExists) {
      return {
        success: false,
        error: "El usuario no existe en la base de datos",
      };
    }

    // Paso 1: Eliminar todas las colecciones de datos
    console.log("Step 1/4: Deleting user data collections...");
    const deletedItems = await deleteUserCollections(userId);

    // Paso 2: Eliminar el documento de usuario
    console.log("Step 2/4: Deleting user document...");
    await deleteUserDocument(userId);

    // Paso 3: Eliminar la cuenta de Firebase Auth
    console.log("Step 3/4: Deleting Firebase Auth account...");
    await deleteAuthAccount(user);

    // Paso 4: Limpiar datos locales
    console.log("Step 4/4: Clearing local data...");
    clearLocalData(userId);

    console.log("Account deletion completed successfully");

    return {
      success: true,
      deletedItems,
    };
  } catch (error) {
    console.error("Error in deleteUserAccountCompletely:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al eliminar la cuenta",
    };
  }
}

/**
 * Verifica la frase de confirmación antes de eliminar
 */
export function verifyDeletionPhrase(
  phrase: string,
  expectedPhrase: string = "DELETE"
): boolean {
  return phrase.trim().toUpperCase() === expectedPhrase.toUpperCase();
}

/**
 * Obtiene un resumen de lo que se eliminará
 */
export async function getDeletionSummary(userId: string): Promise<{
  accountsCount: number;
  transactionsCount: number;
  goalsCount: number;
  recurringCount: number;
  movementsCount: number;
  totalItems: number;
} | null> {
  try {
    validateUserId(userId, "getDeletionSummary");

    // Importar getDocs y collection aquí para evitar dependencias circulares
    const { getDocs, collection } = await import("firebase/firestore");

    const [accounts, transactions, goals, recurring, movements] =
      await Promise.all([
        getDocs(collection(db, "users", userId, "accounts")),
        getDocs(collection(db, "users", userId, "transactions")),
        getDocs(collection(db, "users", userId, "goals")),
        getDocs(collection(db, "users", userId, "recurringTransactions")),
        getDocs(collection(db, "users", userId, "movements")),
      ]);

    const summary = {
      accountsCount: accounts.size,
      transactionsCount: transactions.size,
      goalsCount: goals.size,
      recurringCount: recurring.size,
      movementsCount: movements.size,
      totalItems:
        accounts.size +
        transactions.size +
        goals.size +
        recurring.size +
        movements.size,
    };

    return summary;
  } catch (error) {
    console.error("Error getting deletion summary:", error);
    return null;
  }
}

/**
 * Re-autentica al usuario antes de eliminar la cuenta
 * (Requerido por Firebase para operaciones sensibles)
 */
export async function reauthenticateUser(
  user: User,
  credential: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const { reauthenticateWithCredential } = await import("firebase/auth");
    await reauthenticateWithCredential(user, credential);
    return { success: true };
  } catch (error) {
    console.error("Error reauthenticating user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al re-autenticar",
    };
  }
}

/**
 * Hook para manejar el proceso de eliminación de cuenta
 * (Para usar en componentes React)
 */
export function useAccountDeletion() {
  const handleDelete = async (user: User | null): Promise<DeletionResult> => {
    if (!user) {
      return {
        success: false,
        error: "No hay usuario autenticado",
      };
    }

    return await deleteUserAccountCompletely(user);
  };

  return { handleDelete };
}
