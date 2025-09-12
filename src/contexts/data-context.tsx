"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Account, getAccounts } from '@/lib/accounts';
import { Transaction, getTransactions } from '@/lib/transactions';
import { verifyUserExistsInFirestore } from '@/lib/user-validation';

interface DataState {
  accounts: Account[];
  transactions: Transaction[];
  isLoading: boolean;
  lastFetch: number;
  error: string | null;
}

type DataAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

interface DataContextType extends DataState {
  refreshData: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ACCOUNTS':
      return { 
        ...state, 
        accounts: action.payload, 
        isLoading: false,
        lastFetch: Date.now(),
        error: null 
      };
    case 'SET_TRANSACTIONS':
      return { 
        ...state, 
        transactions: action.payload, 
        isLoading: false,
        lastFetch: Date.now(),
        error: null 
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'RESET':
      return {
        accounts: [],
        transactions: [],
        isLoading: false,
        lastFetch: 0,
        error: null,
      };
    default:
      return state;
  }
}

const initialState: DataState = {
  accounts: [],
  transactions: [],
  isLoading: false,
  lastFetch: 0,
  error: null,
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  const { user } = useAuth();

  const refreshAccounts = useCallback(async () => {
    if (!user?.uid) {
      console.warn('Security: Attempted to refresh accounts without valid user ID');
      return;
    }
    
    try {
      // Verificar que el usuario aún existe en Firestore antes de hacer consultas
      const userExists = await verifyUserExistsInFirestore(user.uid);
      if (!userExists) {
        console.error('DataContext: User no longer exists in Firestore, cannot fetch accounts');
        dispatch({ type: 'SET_ERROR', payload: 'Usuario no válido' });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      const accounts = await getAccounts(user.uid);
      
      // Verificación adicional: asegurar que todas las cuentas pertenecen al usuario
      const validAccounts = accounts.filter(account => 
        account.userId === user.uid
      );
      
      if (validAccounts.length !== accounts.length) {
        console.warn('Security: Some accounts were filtered out due to ownership mismatch');
      }
      
      dispatch({ type: 'SET_ACCOUNTS', payload: validAccounts });
    } catch (error) {
      console.error('Error fetching accounts:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load accounts' });
    }
  }, [user?.uid]);

  const refreshTransactions = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      // Verificar que el usuario aún existe en Firestore antes de hacer consultas
      const userExists = await verifyUserExistsInFirestore(user.uid);
      if (!userExists) {
        console.error('DataContext: User no longer exists in Firestore, cannot fetch transactions');
        dispatch({ type: 'SET_ERROR', payload: 'Usuario no válido' });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      const transactions = await getTransactions(user.uid);
      
      // Verificación adicional: asegurar que todas las transacciones pertenecen al usuario
      const validTransactions = transactions.filter(transaction => 
        transaction.userId === user.uid
      );
      
      if (validTransactions.length !== transactions.length) {
        console.warn('Security: Some transactions were filtered out due to ownership mismatch');
      }
      
      dispatch({ type: 'SET_TRANSACTIONS', payload: validTransactions });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load transactions' });
    }
  }, [user?.uid]);

  const refreshData = useCallback(async () => {
    if (!user?.uid) return;
    
    // Check cache validity
    const now = Date.now();
    if (state.lastFetch && (now - state.lastFetch) < CACHE_DURATION) {
      return; // Use cached data
    }
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Use optimized queries
      const { getAccountsSummary, getRecentTransactions } = await import('@/lib/optimized-queries');
      
      // Fetch both accounts and recent transactions in parallel
      const [accountsSummary, recentTransactions] = await Promise.all([
        getAccountsSummary(user.uid),
        getRecentTransactions(user.uid, 100), // Start with 100 recent transactions
      ]);
      
      dispatch({ type: 'SET_ACCOUNTS', payload: accountsSummary.accounts });
      dispatch({ type: 'SET_TRANSACTIONS', payload: recentTransactions });
    } catch (error) {
      console.error('Error fetching data:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load data' });
    }
  }, [user?.uid, state.lastFetch]);

  // Reset data when user changes
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'RESET' });
    } else {
      refreshData();
    }
  }, [user, refreshData]);

  const contextValue: DataContextType = {
    ...state,
    refreshData,
    refreshAccounts,
    refreshTransactions,
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
