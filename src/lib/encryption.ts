/**
 * Sistema de encriptación end-to-end para datos sensibles
 *
 * ARQUITECTURA DE SEGURIDAD:
 * - Usa AES-GCM para encriptación simétrica (256 bits)
 * - Clave derivada del UID del usuario usando PBKDF2
 * - Salt único almacenado en Firestore por usuario
 * - IV (Initialization Vector) único por cada dato encriptado
 * - Los datos nunca se almacenan en texto plano en Firestore
 *
 * IMPORTANTE: Si el usuario pierde acceso a su cuenta de Firebase Auth,
 * no podrá recuperar sus datos encriptados (by design para máxima seguridad).
 */

/**
 * Datos encriptados con metadata necesaria para desencriptar
 */
export interface EncryptedData {
  encrypted: string; // Datos encriptados en base64
  iv: string; // Initialization Vector en base64
  version: number; // Versión del algoritmo (para futuras migraciones)
}

/**
 * Configuración de encriptación del usuario
 */
export interface EncryptionConfig {
  salt: string; // Salt en base64
  createdAt: string;
  version: number;
}

const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * Genera un salt aleatorio para derivar la clave
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16)) as Uint8Array;
}

/**
 * Genera un IV aleatorio para encriptación
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)) as Uint8Array; // 12 bytes para GCM
}

/**
 * Convierte Uint8Array a base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convierte base64 a Uint8Array
 */
export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Deriva una clave criptográfica del UID del usuario
 * Usa PBKDF2 con salt único para cada usuario
 */
export async function deriveKey(
  userId: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Convertir el userId a ArrayBuffer
  const encoder = new TextEncoder();
  const userIdBuffer = encoder.encode(userId);

  // Importar el userId como clave base
  const baseKey = await crypto.subtle.importKey(
    "raw",
    userIdBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derivar la clave usando PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH },
    false, // No extraíble (más seguro)
    ["encrypt", "decrypt"]
  );

  return derivedKey;
}

/**
 * Encripta un dato usando AES-GCM
 */
export async function encryptData(
  plaintext: string,
  key: CryptoKey,
  iv?: Uint8Array
): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ivToUse = iv || generateIV();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivToUse as BufferSource,
    },
    key,
    data
  );

  return {
    encrypted: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(ivToUse.buffer as ArrayBuffer),
    version: ENCRYPTION_VERSION,
  };
}

/**
 * Desencripta un dato usando AES-GCM
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(encryptedData.encrypted);
  const iv = base64ToArrayBuffer(encryptedData.iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
    },
    key,
    encryptedBuffer as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encripta un número (como montos)
 */
export async function encryptNumber(
  value: number,
  key: CryptoKey
): Promise<EncryptedData> {
  return encryptData(value.toString(), key);
}

/**
 * Desencripta un número
 */
export async function decryptNumber(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<number> {
  const decrypted = await decryptData(encryptedData, key);
  return parseFloat(decrypted);
}

/**
 * Encripta múltiples campos de un objeto
 */
export async function encryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToEncrypt: (keyof T)[],
  key: CryptoKey
): Promise<T> {
  const result = { ...data };

  for (const field of fieldsToEncrypt) {
    const value = data[field];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "number") {
      result[field] = (await encryptNumber(value, key)) as any;
    } else if (typeof value === "string") {
      result[field] = (await encryptData(value, key)) as any;
    }
  }

  return result;
}

/**
 * Desencripta múltiples campos de un objeto
 */
export async function decryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToDecrypt: (keyof T)[],
  key: CryptoKey,
  fieldTypes: Record<keyof T, "string" | "number">
): Promise<T> {
  const result = { ...data };

  for (const field of fieldsToDecrypt) {
    const encryptedValue = data[field];

    if (!encryptedValue || !isEncryptedData(encryptedValue)) {
      continue;
    }

    const fieldType = fieldTypes[field];

    if (fieldType === "number") {
      result[field] = (await decryptNumber(encryptedValue, key)) as any;
    } else {
      result[field] = (await decryptData(encryptedValue, key)) as any;
    }
  }

  return result;
}

/**
 * Verifica si un valor es un dato encriptado válido
 */
export function isEncryptedData(value: any): value is EncryptedData {
  return (
    value &&
    typeof value === "object" &&
    typeof value.encrypted === "string" &&
    typeof value.iv === "string" &&
    typeof value.version === "number"
  );
}

/**
 * Crea la configuración inicial de encriptación para un nuevo usuario
 */
export async function createEncryptionConfig(): Promise<EncryptionConfig> {
  const salt = generateSalt();

  return {
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    createdAt: new Date().toISOString(),
    version: ENCRYPTION_VERSION,
  };
}

/**
 * Obtiene la clave de encriptación para un usuario
 * Debe llamarse una vez al inicio de sesión y cachear la clave
 */
export async function getUserEncryptionKey(
  userId: string,
  encryptionConfig: EncryptionConfig
): Promise<CryptoKey> {
  const salt = base64ToArrayBuffer(encryptionConfig.salt);
  return deriveKey(userId, salt);
}

/**
 * Clase para manejar el caché de claves de encriptación
 * Mejora el rendimiento al evitar derivar la clave en cada operación
 */
export class EncryptionKeyCache {
  private static instance: EncryptionKeyCache;
  private keyCache: Map<string, CryptoKey> = new Map();
  private configCache: Map<string, EncryptionConfig> = new Map();

  private constructor() {}

  static getInstance(): EncryptionKeyCache {
    if (!EncryptionKeyCache.instance) {
      EncryptionKeyCache.instance = new EncryptionKeyCache();
    }
    return EncryptionKeyCache.instance;
  }

  async getKey(userId: string, config: EncryptionConfig): Promise<CryptoKey> {
    const cached = this.keyCache.get(userId);
    if (cached) {
      return cached;
    }

    const key = await getUserEncryptionKey(userId, config);
    this.keyCache.set(userId, key);
    this.configCache.set(userId, config);

    return key;
  }

  clearCache(userId?: string) {
    if (userId) {
      this.keyCache.delete(userId);
      this.configCache.delete(userId);
    } else {
      this.keyCache.clear();
      this.configCache.clear();
    }
  }

  hasKey(userId: string): boolean {
    return this.keyCache.has(userId);
  }
}

/**
 * Utilidades para trabajar con datos encriptados en formularios
 */

/**
 * Convierte un EncryptedData a string para mostrar en UI
 * (muestra puntos para indicar que está encriptado)
 */
export function encryptedDataToDisplay(
  encryptedData: EncryptedData | string
): string {
  if (isEncryptedData(encryptedData)) {
    return "••••••••";
  }
  return encryptedData;
}

/**
 * Verifica si necesita encriptación
 * (si el dato ya está encriptado, no lo encripta de nuevo)
 */
export function needsEncryption(value: any): boolean {
  return !isEncryptedData(value);
}

/**
 * Exporta configuración de encriptación para backup
 * ADVERTENCIA: El usuario debe guardar esto de forma segura
 */
export function exportEncryptionConfig(config: EncryptionConfig): string {
  return JSON.stringify(config);
}

/**
 * Importa configuración de encriptación desde backup
 */
export function importEncryptionConfig(configString: string): EncryptionConfig {
  return JSON.parse(configString);
}
