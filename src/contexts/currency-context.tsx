"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Currency, defaultCurrency } from "@/lib/currency";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => Promise<void>;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: defaultCurrency,
  setCurrency: async () => {},
  isLoading: true,
});

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadUserCurrency = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().currency) {
          setCurrencyState(userDoc.data().currency);
        }
      } catch (error) {
        console.error("Error loading user currency:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserCurrency();
  }, [user]);

  const setCurrency = async (newCurrency: Currency) => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Actualizar en Firestore
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { currency: newCurrency }, { merge: true });

      // Actualizar el estado local
      setCurrencyState(newCurrency);
    } catch (error) {
      console.error("Error setting currency:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}
