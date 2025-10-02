"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SecuritySettings,
  DEFAULT_SECURITY_SETTINGS,
  getSecurityLocalKey,
  getSecuritySessionKey,
  loadSecuritySettings,
  mergeAndPersistSecuritySettings,
  computePinHash,
  verifyPin,
  bufferToBase64Url,
  base64UrlToBuffer,
  LocalSecuritySnapshot,
  isBiometricSupported,
} from "@/lib/security";
import { User } from "firebase/auth";
import { toast } from "@/hooks/use-toast";

interface SecurityContextValue {
  settings: SecuritySettings;
  isUnlocked: boolean;
  loading: boolean;
  isBiometricAvailable: boolean;
  enableAppLock: (options?: { requirePin?: boolean }) => Promise<void>;
  disableAppLock: () => Promise<void>;
  updatePin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  registerBiometricCredential: () => Promise<boolean>;
  lock: () => void;
  refreshingCredential: boolean;
  localSnapshot: LocalSecuritySnapshot | null;
}

const SecurityContext = createContext<SecurityContextValue | undefined>(
  undefined
);

interface SecurityProviderProps {
  user: User;
  children: React.ReactNode;
}

const SESSION_UNLOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function SecurityProvider({ user, children }: SecurityProviderProps) {
  const [settings, setSettings] = useState<SecuritySettings>(
    DEFAULT_SECURITY_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [refreshingCredential, setRefreshingCredential] = useState(false);
  const [localSnapshot, setLocalSnapshot] = useState<LocalSecuritySnapshot | null>(
    null
  );

  const localKeyRef = useRef<string>("");
  const sessionKeyRef = useRef<string>("");

  useEffect(() => {
    localKeyRef.current = getSecurityLocalKey(user.uid);
    sessionKeyRef.current = getSecuritySessionKey(user.uid);
  }, [user.uid]);

  const loadLocalState = useCallback(() => {
    if (typeof window === "undefined") return;

    const localKey = localKeyRef.current;
    const sessionKey = sessionKeyRef.current;

    try {
      const stored = window.localStorage.getItem(localKey);
      const snapshot = stored
        ? (JSON.parse(stored) as LocalSecuritySnapshot)
        : null;
      setLocalSnapshot(snapshot);

      const sessionData = window.sessionStorage.getItem(sessionKey);
      if (sessionData) {
        const parsed = JSON.parse(sessionData) as {
          unlocked: boolean;
          unlockedAt: number;
        };
        if (parsed.unlocked) {
          const stillValid =
            Date.now() - parsed.unlockedAt < SESSION_UNLOCK_TIMEOUT_MS;
          setIsUnlocked(stillValid);
        }
      } else {
        setIsUnlocked(false);
      }
    } catch (error) {
      console.error("SecurityProvider: Failed to parse stored state", error);
      setLocalSnapshot(null);
      setIsUnlocked(false);
    }
  }, []);

  const persistLocalSnapshot = useCallback(
    (snapshot: LocalSecuritySnapshot | null) => {
      if (typeof window === "undefined") return;
      setLocalSnapshot(snapshot);
      if (!snapshot) {
        window.localStorage.removeItem(localKeyRef.current);
        return;
      }
      window.localStorage.setItem(
        localKeyRef.current,
        JSON.stringify(snapshot)
      );
    },
    []
  );

  const persistSessionUnlock = useCallback((unlocked: boolean) => {
    if (typeof window === "undefined") return;
    if (!unlocked) {
      window.sessionStorage.removeItem(sessionKeyRef.current);
      setIsUnlocked(false);
      return;
    }

    const payload = {
      unlocked: true,
      unlockedAt: Date.now(),
    };

    window.sessionStorage.setItem(
      sessionKeyRef.current,
      JSON.stringify(payload)
    );
    setIsUnlocked(true);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      const [remoteSettings, biometricSupported] = await Promise.all([
        loadSecuritySettings(user.uid),
        isBiometricSupported(),
      ]);
      setSettings(remoteSettings);
      setIsBiometricAvailable(biometricSupported);
      loadLocalState();
    } catch (error) {
      console.error("SecurityProvider: initialization error", error);
    } finally {
      setLoading(false);
    }
  }, [loadLocalState, user.uid]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const lock = useCallback(() => {
    persistSessionUnlock(false);
  }, [persistSessionUnlock]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handler = () => {
      if (document.visibilityState === "hidden" && settings.appLockEnabled) {
        lock();
      }
    };

    document.addEventListener("visibilitychange", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
    };
  }, [lock, settings.appLockEnabled]);

  const enableAppLock = useCallback(
    async (options?: { requirePin?: boolean }) => {
      const next = await mergeAndPersistSecuritySettings(user.uid, settings, {
        appLockEnabled: true,
        pinEnabled: options?.requirePin
          ? settings.pinEnabled
          : settings.pinEnabled,
      });
      setSettings(next);
      lock();
    },
    [lock, settings, user.uid]
  );

  const disableAppLock = useCallback(async () => {
    const next = await mergeAndPersistSecuritySettings(user.uid, settings, {
      appLockEnabled: false,
    });
    setSettings(next);
    persistSessionUnlock(false);
  }, [persistSessionUnlock, settings, user.uid]);

  const updatePin = useCallback(
    async (pin: string) => {
      if (pin.length < 4 || pin.length > 12) {
        throw new Error("El PIN debe tener entre 4 y 12 dígitos.");
      }

      setRefreshingCredential(true);
      try {
        const { salt, hash } = await computePinHash(pin);
        const next = await mergeAndPersistSecuritySettings(user.uid, settings, {
          appLockEnabled: true,
          pinEnabled: true,
          pinSalt: salt,
          pinHash: hash,
        });
        setSettings(next);
        toast({
          title: "PIN actualizado",
          description: "Tu nuevo PIN ha sido guardado correctamente.",
        });
        lock();
      } finally {
        setRefreshingCredential(false);
      }
    },
    [lock, settings, user.uid]
  );

  const clearPin = useCallback(async () => {
    const next = await mergeAndPersistSecuritySettings(user.uid, settings, {
      pinEnabled: false,
      pinHash: null,
      pinSalt: null,
    });
    setSettings(next);
  }, [settings, user.uid]);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      if (!settings.pinEnabled || !settings.pinSalt || !settings.pinHash) {
        return false;
      }

      const isValid = await verifyPin(pin, settings.pinSalt, settings.pinHash);
      if (!isValid) {
        return false;
      }

      persistSessionUnlock(true);
      persistLocalSnapshot({
        ...localSnapshot,
        lastUnlockMethod: "pin",
        lastUnlockAt: Date.now(),
      });
      return true;
    },
    [localSnapshot, persistLocalSnapshot, persistSessionUnlock, settings]
  );

  const registerBiometricCredential = useCallback(async () => {
    if (!isBiometricAvailable) {
      toast({
        variant: "destructive",
        title: "Biometría no disponible",
        description:
          "Tu dispositivo no soporta autenticación biométrica o no está habilitada.",
      });
      return false;
    }

    if (typeof navigator === "undefined" || !navigator.credentials) {
      toast({
        variant: "destructive",
        title: "No compatible",
        description:
          "El navegador actual no soporta autenticación biométrica web.",
      });
      return false;
    }

    setRefreshingCredential(true);
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "Fynco",
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(user.uid),
            name: user.email ?? user.uid,
            displayName: user.displayName ?? user.email ?? user.uid,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          timeout: 60_000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          attestation: "none",
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        return false;
      }

      const id = bufferToBase64Url(credential.rawId);
      persistLocalSnapshot({
        ...localSnapshot,
        credentialId: id,
        lastUnlockMethod: "biometric",
        lastUnlockAt: Date.now(),
      });

      const next = await mergeAndPersistSecuritySettings(user.uid, settings, {
        appLockEnabled: true,
        biometricEnabled: true,
      });
      setSettings(next);
      toast({
        title: "Biometría activada",
        description: "Podrás usar FaceID o huella para desbloquear la app.",
      });
      lock();
      return true;
    } catch (error: any) {
      console.error("SecurityProvider: biometric registration failed", error);
      toast({
        variant: "destructive",
        title: "No se pudo registrar",
        description:
          error?.message ||
          "Ocurrió un error configurando la autenticación biométrica.",
      });
      return false;
    } finally {
      setRefreshingCredential(false);
    }
  }, [isBiometricAvailable, localSnapshot, lock, persistLocalSnapshot, settings, user]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!settings.biometricEnabled) {
      return false;
    }

    const credentialId = localSnapshot?.credentialId;
    if (!credentialId) {
      toast({
        variant: "destructive",
        title: "Configura la biometría",
        description:
          "Debes registrar esta biometría en el dispositivo antes de usarla.",
      });
      return false;
    }

    if (typeof navigator === "undefined" || !navigator.credentials) {
      toast({
        variant: "destructive",
        title: "No compatible",
        description:
          "El navegador actual no soporta autenticación biométrica web.",
      });
      return false;
    }

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60_000,
          userVerification: "required",
          allowCredentials: [
            {
              id: base64UrlToBuffer(credentialId),
              type: "public-key",
              transports: ["internal"],
            },
          ],
        },
      });

      persistSessionUnlock(true);
      persistLocalSnapshot({
        ...localSnapshot,
        lastUnlockMethod: "biometric",
        lastUnlockAt: Date.now(),
      });
      return true;
    } catch (error: any) {
      console.error("SecurityProvider: biometric unlock failed", error);
      toast({
        variant: "destructive",
        title: "Autenticación cancelada",
        description:
          error?.message || "No se pudo usar la biometría para desbloquear.",
      });
      return false;
    }
  }, [localSnapshot, persistLocalSnapshot, persistSessionUnlock, settings.biometricEnabled]);

  const value = useMemo<SecurityContextValue>(
    () => ({
      settings,
      isUnlocked: !settings.appLockEnabled || isUnlocked,
      loading,
      isBiometricAvailable,
      enableAppLock,
      disableAppLock,
      updatePin,
      clearPin,
      unlockWithPin,
      unlockWithBiometrics,
      registerBiometricCredential,
      lock,
      refreshingCredential,
      localSnapshot,
    }),
    [
      clearPin,
      disableAppLock,
      enableAppLock,
      isBiometricAvailable,
      isUnlocked,
      loading,
      lock,
      localSnapshot,
      refreshingCredential,
      registerBiometricCredential,
      settings,
      unlockWithBiometrics,
      unlockWithPin,
      updatePin,
    ]
  );

  return (
    <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error("useSecurity debe usarse dentro de SecurityProvider");
  }
  return context;
}
