# **App Name**: Fynco

## Core Features:

- Manual Expense Registration: Allows users to manually input expense details such as amount, currency, method, source, and date, directly into the app.
- Gmail Sync: Enables users to synchronize their Gmail accounts to automatically parse and record expenses from email receipts.
- Outlook Sync: Enables users to synchronize their Outlook accounts to automatically parse and record expenses from email receipts.
- Voice Expense Recording Tool: Users can verbally record expenses using voice assistants. The LLM tool intelligently processes the voice input to extract relevant details, and determines when and whether to incorporate that input into the recorded expense details.
- Dashboard Overview: Provides a summarized view of the user's financial data, including spending trends and key metrics, displayed in an easily digestible format.
- Transaction List: Presents a detailed list of all recorded transactions, with options to filter by date and type for easy tracking and analysis.
- Multi-user Authentication: Secure multi-user authentication using Firebase Auth, allowing users to register and access their financial data with email/password or Google Sign-In.

## Style Guidelines:

- Primary color: A calm blue (#64B5F6) evoking trust and stability, suitable for finance management.
- Background color: Light grayish-blue (#F0F4F8), offering a clean and unobtrusive backdrop.
- Accent color: A vibrant green (#4CAF50) for positive actions like adding income, visually distinct from the primary color.
- Body and headline font: 'PT Sans', a modern sans-serif font, for a clean and readable UI.
- Mobile-first responsive design using TailwindCSS to ensure a seamless experience on various devices.
- Consistent and clear icons for transaction types and categories to improve user experience.
- Subtle animations for transitions and feedback, enhancing the app's interactivity without being distracting.