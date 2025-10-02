"use client";

import { getDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SecuritySettings {
  appLockEnabled: boolean;
  pinEnabled: boolean;
  pinHash?: string | null;
  pinSalt?: string | null;
  biometricEnabled: boolean;
  updatedAt?: string;
}

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  appLockEnabled: false,
  pinEnabled: false,
  biometricEnabled: false,
};

export const SECURITY_LOCAL_KEY_PREFIX = "fynco-security";

export interface LocalSecuritySnapshot {
  credentialId?: string;
  lastUnlockMethod?: "pin" | "biometric";
  lastUnlockAt?: number;
}

export function getSecurityLocalKey(userId: string) {
  return `${SECURITY_LOCAL_KEY_PREFIX}:${userId}`;
}

export function getSecuritySessionKey(userId: string) {
  return `${SECURITY_LOCAL_KEY_PREFIX}:session:${userId}`;
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateSalt(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes.buffer);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${pin}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToBase64Url(digest);
}

export async function loadSecuritySettings(userId: string): Promise<SecuritySettings> {
  const docRef = doc(db, "users", userId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return DEFAULT_SECURITY_SETTINGS;
  }

  const data = snapshot.data() as { securitySettings?: Partial<SecuritySettings> };
  return {
    ...DEFAULT_SECURITY_SETTINGS,
    ...(data.securitySettings ?? {}),
  };
}

export async function persistSecuritySettings(
  userId: string,
  updates: Partial<SecuritySettings>
) {
  const docRef = doc(db, "users", userId);
  const payload: SecuritySettings = {
    ...DEFAULT_SECURITY_SETTINGS,
    ...(updates ?? {}),
  } as SecuritySettings;

  await setDoc(
    docRef,
    {
      securitySettings: {
        ...payload,
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );

  return payload;
}

export async function mergeAndPersistSecuritySettings(
  userId: string,
  existing: SecuritySettings | null,
  updates: Partial<SecuritySettings>
) {
  const docRef = doc(db, "users", userId);
  const nextSettings: SecuritySettings = {
    ...DEFAULT_SECURITY_SETTINGS,
    ...(existing ?? {}),
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const cleanedSettings = Object.fromEntries(
    Object.entries(nextSettings).filter(([, value]) => value !== undefined)
  ) as SecuritySettings;

  await setDoc(
    docRef,
    {
      securitySettings: cleanedSettings,
    },
    { merge: true }
  );

  return cleanedSettings;
}

export async function computePinHash(pin: string) {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  return { salt, hash };
}

export async function verifyPin(
  pin: string,
  salt: string | null | undefined,
  expectedHash?: string | null
) {
  if (!expectedHash || !salt) return false;
  const computed = await hashPin(pin, salt);
  return computed === expectedHash;
}

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (error) {
    console.warn("Security: Error detecting biometric support", error);
    return false;
  }
}
