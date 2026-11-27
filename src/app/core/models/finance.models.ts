export type MovementKind = 'income' | 'expense';
export interface Account { id: string; user_id: string; name: string; kind: 'bank'|'cash'|'savings'|'other'; opening_balance: number; archived: boolean; }
export interface Category { id: string; user_id: string; name: string; kind: MovementKind; icon: string; color: string; archived: boolean; }
export interface Transaction { id: string; user_id: string; account_id: string; category_id: string; kind: MovementKind; amount: number; occurred_on: string; description: string; recurring_id?: string | null; }
export interface Transfer { id: string; user_id: string; from_account_id: string; to_account_id: string; amount: number; occurred_on: string; description: string; }
export interface RecurringTransaction { id: string; user_id: string; account_id: string; category_id: string; kind: MovementKind; amount: number; description: string; frequency: 'daily'|'weekly'|'monthly'|'yearly'; anchor_day: number|null; next_run_on: string; active: boolean; end_on: string|null; }
