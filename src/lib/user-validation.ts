"use client";

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Verifica si un usuario existe en la colección 'users' de Firestore
 * @param userId - UID del usuario a verificar
 * @returns Promise<boolean> - true si existe, false si no existe
 */
export async function verifyUserExistsInFirestore(
  userId: string
): Promise<boolean> {
  if (!userId) {
    console.warn("Security: No userId provided for verification");
    return false;
  }

  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    const exists = userDoc.exists();

    if (!exists) {
      console.error(
        `Security: User ${userId} does not exist in Firestore users collection`
      );
    } else {
    }

    return exists;
  } catch (error) {
    console.error(
      `Security: Error verifying user ${userId} in Firestore:`,
      error
    );
    // En caso de error, asumimos que el usuario no es válido por seguridad
    return false;
  }
}

/**
 * Verifica si los datos del usuario en Firestore coinciden con los datos de Firebase Auth
 * @param userId - UID del usuario
 * @param userEmail - Email del usuario de Firebase Auth
 * @returns Promise<boolean> - true si coinciden, false si no
 */
export async function verifyUserDataIntegrity(
  userId: string,
  userEmail: string | null
): Promise<boolean> {
  if (!userId || !userEmail) {
    console.warn("Security: Incomplete user data for integrity check");
    return false;
  }

  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      console.error(
        `Security: User document ${userId} does not exist for integrity check`
      );
      return false;
    }

    const userData = userDoc.data();

    // Verificar que el email coincida
    if (userData.email !== userEmail) {
      console.error(
        `Security: Email mismatch for user ${userId}. Auth: ${userEmail}, Firestore: ${userData.email}`
      );
      return false;
    }

    // Verificar que el UID coincida
    if (userData.uid !== userId) {
      console.error(
        `Security: UID mismatch for user ${userId}. Expected: ${userId}, Firestore: ${userData.uid}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `Security: Error checking user data integrity for ${userId}:`,
      error
    );
    return false;
  }
}
