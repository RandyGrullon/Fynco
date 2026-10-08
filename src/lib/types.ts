// Tipos del dominio. Montos siempre en centavos (enteros).

export type AccountType = "checking" | "savings" | "credit" | "investment" | "cash" | "other";
export type TxKind = "income" | "expense" | "transfer" | "shared" | "settlement";
export type TxSource = "manual" | "voice" | "assistant" | "recurring" | "import";
export type SplitMethod = "equal" | "exact" | "percent" | "shares";
export type Recurrence = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
export type WeekendPolicy = "keep" | "before" | "after";

export interface Profile {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  default_currency: string;
  hide_amounts: boolean;
  app_lock_enabled: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  opening_balance: number;
  institution: string | null;
  last4: string | null;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  /** opening_balance + suma del libro (vista account_balances) */
  balance: number;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  kind: "income" | "expense";
  icon: string;
  color: string;
  sort: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  kind: TxKind;
  amount: number;
  occurred_on: string;
  description: string;
  category_id: string | null;
  transfer_id: string | null;
  shared_expense_id: string | null;
  settlement_id: string | null;
  recurring_rule_id: string | null;
  source: TxSource;
  note: string | null;
  created_at: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  account_id: string;
  kind: "income" | "expense";
  amount: number;
  description: string;
  category_id: string | null;
  frequency: Recurrence;
  start_on: string;
  end_on: string | null;
  run_count: number;
  next_run_on: string;
  weekend_policy: WeekendPolicy;
  active: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  currency: string;
  account_id: string | null;
  deadline: string | null;
  status: "active" | "completed" | "archived";
  is_private: boolean;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  profile_id: string | null;
  display_name: string;
  invite_email: string | null;
  role: "owner" | "member";
  left_at: string | null;
  created_at: string;
}

export interface MemberBalance {
  group_id: string;
  member_id: string;
  paid: number;
  owed: number;
  settled_sent: number;
  settled_received: number;
  /** > 0: le deben; < 0: debe */
  net: number;
}

export interface Group {
  id: string;
  name: string;
  currency: string;
  kind: "group" | "direct";
  simplify_debts: boolean;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
  members: GroupMember[];
  balances: MemberBalance[];
}

export interface Portion {
  member_id: string;
  amount: number;
  weight?: number | null;
}

export interface SharedExpense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  occurred_on: string;
  category_id: string | null;
  split_method: SplitMethod;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  payers: Portion[];
  shares: Portion[];
}

export interface Settlement {
  id: string;
  group_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  occurred_on: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Debt {
  from: string; // member_id
  to: string; // member_id
  amount: number;
}
