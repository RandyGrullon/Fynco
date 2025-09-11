// Firestore Indexes Configuration
// Add these composite indexes to your Firestore console for optimal performance

/*
Collection: users/{userId}/transactions
Indexes needed:

1. For filtered transaction queries:
   - userId (Ascending), date (Descending)
   - userId (Ascending), type (Ascending), date (Descending) 
   - userId (Ascending), accountId (Ascending), date (Descending)
   - userId (Ascending), category (Ascending), date (Descending)
   - userId (Ascending), accountId (Ascending), type (Ascending), date (Descending)

2. For account transaction queries:
Collection: users/{userId}/accounts/{accountId}/transactions
   - userId (Ascending), date (Descending)
   - userId (Ascending), type (Ascending), date (Descending)

3. For accounts queries:
Collection: users/{userId}/accounts
   - userId (Ascending), createdAt (Descending)
   - userId (Ascending), type (Ascending), createdAt (Descending)
   - userId (Ascending), isDefault (Ascending)

To create these indexes, run the following commands in your Firebase project:

firebase firestore:indexes

Or add them manually in the Firebase Console under Firestore > Indexes
*/

// Performance Optimization Rules for Firestore
export const FIRESTORE_PERFORMANCE_RULES = {
  // Limit query results to prevent excessive data transfer
  MAX_QUERY_LIMIT: 100,
  
  // Cache duration for different data types
  CACHE_DURATIONS: {
    ACCOUNTS: 5 * 60 * 1000, // 5 minutes
    TRANSACTIONS: 2 * 60 * 1000, // 2 minutes
    STATISTICS: 10 * 60 * 1000, // 10 minutes
  },
  
  // Pagination settings
  PAGINATION: {
    TRANSACTIONS_PER_PAGE: 50,
    ACCOUNTS_PER_PAGE: 20,
  },
  
  // Query optimization flags
  USE_COMPOSITE_INDEXES: true,
  ENABLE_OFFLINE_PERSISTENCE: true,
  
  // Performance monitoring thresholds
  QUERY_TIMEOUT: 10000, // 10 seconds
  SLOW_QUERY_THRESHOLD: 3000, // 3 seconds
};

// Recommended Firestore Security Rules
export const FIRESTORE_SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Accounts subcollection
      match /accounts/{accountId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        // Account transactions subcollection
        match /transactions/{transactionId} {
          allow read, write: if request.auth != null && request.auth.uid == userId
            && resource.data.userId == userId;
        }
      }
      
      // Main transactions collection
      match /transactions/{transactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId
          && resource.data.userId == userId;
      }
      
      // Goals subcollection
      match /goals/{goalId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      // Recurring transactions subcollection
      match /recurringTransactions/{recurringId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
`;
