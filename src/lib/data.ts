import { Timestamp } from 'firebase/firestore';

export type Transaction = {
  id: string;
  userId: string;
  date: string | Date | Timestamp;
  amount: number;
  type: 'income' | 'expense';
  category: 'Food' | 'Transport' | 'Shopping' | 'Salary' | 'Utilities' | 'Entertainment' | 'Other';
  source: string;
  method: 'Credit Card' | 'Debit Card' | 'Cash' | 'Bank Transfer';
};

// This mock data is now only for reference and will not be actively used.
export const transactions: Transaction[] = [
  {
    id: 'txn_1',
    userId: 'mock_user',
    date: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    amount: 12.50,
    type: 'expense',
    category: 'Food',
    source: 'The Coffee Shop',
    method: 'Credit Card',
  },
];
