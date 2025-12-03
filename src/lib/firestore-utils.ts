/**
 * Utilidades genéricas para operaciones CRUD de Firestore
 * Centraliza la lógica común de manejo de errores y operaciones de base de datos
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  DocumentReference,
  CollectionReference,
  Query,
  writeBatch,
  WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Resultado estándar de operaciones
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Opciones para crear documento
 */
interface CreateDocumentOptions {
  includeTimestamp?: boolean;
  customTimestampField?: string;
}

/**
 * Opciones para actualizar documento
 */
interface UpdateDocumentOptions {
  includeTimestamp?: boolean;
  customTimestampField?: string;
}

/**
 * Crea un documento en una colección
 */
export async function createDocument<T extends Record<string, any>>(
  collectionPath: string,
  data: T,
  options: CreateDocumentOptions = {}
): Promise<OperationResult<string>> {
  try {
    const { includeTimestamp = true, customTimestampField = "createdAt" } =
      options;

    const collectionRef = collection(db, collectionPath);
    const docData = {
      ...data,
      ...(includeTimestamp && { [customTimestampField]: Timestamp.now() }),
    };

    const docRef = await addDoc(collectionRef, docData);
    return { success: true, data: docRef.id };
  } catch (error) {
    console.error(`Error creating document in ${collectionPath}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al crear documento",
    };
  }
}

/**
 * Actualiza un documento existente
 */
export async function updateDocument<T extends Record<string, any>>(
  documentPath: string,
  data: T,
  options: UpdateDocumentOptions = {}
): Promise<OperationResult> {
  try {
    const { includeTimestamp = true, customTimestampField = "updatedAt" } =
      options;

    const docRef = doc(db, documentPath);
    const updateData = {
      ...data,
      ...(includeTimestamp && { [customTimestampField]: Timestamp.now() }),
    };

    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (error) {
    console.error(`Error updating document at ${documentPath}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al actualizar documento",
    };
  }
}

/**
 * Elimina un documento
 */
export async function deleteDocument(
  documentPath: string
): Promise<OperationResult> {
  try {
    const docRef = doc(db, documentPath);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting document at ${documentPath}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al eliminar documento",
    };
  }
}

/**
 * Obtiene un documento por su ruta
 */
export async function getDocument<T>(
  documentPath: string
): Promise<OperationResult<T>> {
  try {
    const docRef = doc(db, documentPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: "Documento no encontrado" };
    }

    return {
      success: true,
      data: { id: docSnap.id, ...docSnap.data() } as T,
    };
  } catch (error) {
    console.error(`Error getting document at ${documentPath}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al obtener documento",
    };
  }
}

/**
 * Obtiene múltiples documentos de una colección con query opcional
 */
export async function getDocuments<T>(
  collectionPath: string,
  constraints?: any[]
): Promise<OperationResult<T[]>> {
  try {
    const collectionRef = collection(db, collectionPath);
    const q = constraints
      ? query(collectionRef, ...constraints)
      : collectionRef;
    const querySnapshot = await getDocs(q);

    const documents = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];

    return { success: true, data: documents };
  } catch (error) {
    console.error(`Error getting documents from ${collectionPath}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al obtener documentos",
    };
  }
}

/**
 * Elimina una colección completa (útil para eliminación de cuenta)
 * ADVERTENCIA: Esto elimina TODOS los documentos en la colección
 */
export async function deleteCollection(
  collectionPath: string,
  batchSize: number = 100
): Promise<OperationResult<number>> {
  try {
    const collectionRef = collection(db, collectionPath);
    const q = query(collectionRef);
    const snapshot = await getDocs(q);

    let deletedCount = 0;
    const batchArray: WriteBatch[] = [];
    let currentBatch = writeBatch(db);
    let operationCounter = 0;

    snapshot.docs.forEach((document) => {
      currentBatch.delete(document.ref);
      operationCounter++;
      deletedCount++;

      // Firestore tiene límite de 500 operaciones por batch
      if (operationCounter >= batchSize) {
        batchArray.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCounter = 0;
      }
    });

    // Agregar el último batch si tiene operaciones
    if (operationCounter > 0) {
      batchArray.push(currentBatch);
    }

    // Ejecutar todos los batches
    await Promise.all(batchArray.map((batch) => batch.commit()));

    return { success: true, data: deletedCount };
  } catch (error) {
    console.error(`Error deleting collection ${collectionPath}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al eliminar colección",
    };
  }
}

/**
 * Elimina documentos que coincidan con una condición específica
 */
export async function deleteDocumentsWhere(
  collectionPath: string,
  field: string,
  operator: any,
  value: any,
  batchSize: number = 100
): Promise<OperationResult<number>> {
  try {
    const collectionRef = collection(db, collectionPath);
    const q = query(collectionRef, where(field, operator, value));
    const snapshot = await getDocs(q);

    let deletedCount = 0;
    const batchArray: WriteBatch[] = [];
    let currentBatch = writeBatch(db);
    let operationCounter = 0;

    snapshot.docs.forEach((document) => {
      currentBatch.delete(document.ref);
      operationCounter++;
      deletedCount++;

      if (operationCounter >= batchSize) {
        batchArray.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCounter = 0;
      }
    });

    if (operationCounter > 0) {
      batchArray.push(currentBatch);
    }

    await Promise.all(batchArray.map((batch) => batch.commit()));

    return { success: true, data: deletedCount };
  } catch (error) {
    console.error(
      `Error deleting documents where ${field} ${operator} ${value}:`,
      error
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al eliminar documentos",
    };
  }
}

/**
 * Convierte diferentes tipos de fecha a Timestamp de Firestore
 */
export function convertToTimestamp(date: Date | string | Timestamp): Timestamp {
  if (date instanceof Timestamp) {
    return date;
  }
  if (date instanceof Date) {
    return Timestamp.fromDate(date);
  }
  if (typeof date === "string") {
    return Timestamp.fromDate(new Date(date));
  }
  throw new Error("Tipo de fecha no válido");
}

/**
 * Valida que un userId sea válido
 */
export function validateUserId(
  userId: string | undefined,
  operationName: string
): void {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    console.error(`Security: Invalid userId provided to ${operationName}`);
    throw new Error("Unauthorized access: Invalid user ID");
  }
}

/**
 * Obtiene la referencia de una colección de usuario
 */
export function getUserCollection(
  userId: string,
  collectionName: string
): CollectionReference {
  validateUserId(userId, `getUserCollection(${collectionName})`);
  return collection(db, "users", userId, collectionName);
}

/**
 * Obtiene la referencia de un documento de usuario
 */
export function getUserDocument(
  userId: string,
  collectionName: string,
  documentId: string
): DocumentReference {
  validateUserId(userId, `getUserDocument(${collectionName}/${documentId})`);
  return doc(db, "users", userId, collectionName, documentId);
}

/**
 * Crea un batch para operaciones múltiples
 */
export function createBatch(): WriteBatch {
  return writeBatch(db);
}

/**
 * Ejecuta una operación con manejo automático de errores
 */
export async function executeOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<OperationResult<T>> {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    console.error(errorMessage, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
