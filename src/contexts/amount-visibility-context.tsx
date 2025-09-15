"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

interface AmountVisibilityContextType {
  hideAmounts: boolean;
  setHideAmounts: (hide: boolean) => Promise<void>;
  isLoading: boolean;
}

const AmountVisibilityContext = createContext<AmountVisibilityContextType>({
  hideAmounts: false,
  setHideAmounts: async () => {},
  isLoading: true,
});

export const useAmountVisibility = () => useContext(AmountVisibilityContext);

export function AmountVisibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hideAmounts, setHideAmountsState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadUserPreference = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().hideAmounts !== undefined) {
          setHideAmountsState(userDoc.data().hideAmounts);
        }
      } catch (error) {
        console.error(
          "Error loading user amount visibility preference:",
          error
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadUserPreference();
  }, [user]);

  const setHideAmounts = async (hide: boolean) => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Actualizar en Firestore
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { hideAmounts: hide }, { merge: true });

      // Actualizar el estado local
      setHideAmountsState(hide);
    } catch (error) {
      console.error("Error setting amount visibility:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AmountVisibilityContext.Provider
      value={{ hideAmounts, setHideAmounts, isLoading }}
    >
      {children}
    </AmountVisibilityContext.Provider>
  );
}
