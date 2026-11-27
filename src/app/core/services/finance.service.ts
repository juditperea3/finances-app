import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Account, Category, Transaction, Transfer, RecurringTransaction, MovementKind } from '../models/finance.models';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly sb = inject(SupabaseService).client;
  private async uid() {
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) throw new Error('Sessió no vàlida');
    return data.user.id;
  }
  private unwrap<T>(result: { data: T | null; error: any }) {
    if (result.error) throw result.error;
    return result.data as T;
  }
  async accounts(): Promise<Account[]> { return this.unwrap((await this.sb.from('accounts').select('*').order('created_at')) as any); }
  async categories(): Promise<Category[]> { return this.unwrap((await this.sb.from('categories').select('*').order('name')) as any); }
  async transactions(): Promise<Transaction[]> { return this.unwrap((await this.sb.from('transactions').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false })) as any); }
  async transfers(): Promise<Transfer[]> { return this.unwrap((await this.sb.from('transfers').select('*').order('occurred_on', { ascending: false })) as any); }
  async recurrings(): Promise<RecurringTransaction[]> { return this.unwrap((await this.sb.from('recurring_transactions').select('*').order('next_run_on')) as any); }
  async addAccount(name: string, kind: Account['kind'], opening_balance: number) {
    const user_id = await this.uid(); this.unwrap(await this.sb.from('accounts').insert({ user_id, name, kind, opening_balance }));
  }
  async addCategory(name: string, kind: MovementKind) {
    const user_id = await this.uid(); this.unwrap(await this.sb.from('categories').insert({ user_id, name, kind }));
  }
  async addTransaction(input: Pick<Transaction, 'account_id' | 'category_id' | 'kind' | 'amount' | 'occurred_on' | 'description'>) {
    const user_id = await this.uid(); this.unwrap(await this.sb.from('transactions').insert({ ...input, user_id }));
  }
  async updateTransaction(id: string, input: Pick<Transaction, 'account_id' | 'category_id' | 'kind' | 'amount' | 'occurred_on' | 'description'>) {
    if (!id) throw new Error('Moviment no vàlid');
    const user_id = await this.uid();
    const { data, error } = await this.sb.from('transactions').update(input).eq('id', id).eq('user_id', user_id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No s’ha pogut actualitzar el moviment. Comprova els permisos RLS.');
  }
  async removeTransaction(id: string) { this.unwrap(await this.sb.from('transactions').delete().eq('id', id)); }
  async addTransfer(input: Pick<Transfer, 'from_account_id' | 'to_account_id' | 'amount' | 'occurred_on' | 'description'>) {
    const user_id = await this.uid(); this.unwrap(await this.sb.from('transfers').insert({ ...input, user_id }));
  }
  async addRecurring(input: Pick<RecurringTransaction, 'account_id' | 'category_id' | 'kind' | 'amount' | 'description' | 'frequency' | 'anchor_day' | 'next_run_on' | 'end_on'>) {
    const user_id = await this.uid(); this.unwrap(await this.sb.from('recurring_transactions').insert({ ...input, user_id }));
  }
  async disableRecurring(id: string) { this.unwrap(await this.sb.from('recurring_transactions').update({ active: false }).eq('id', id)); }
  async seedCategories() {
    if ((await this.categories()).length) return;
    const user_id = await this.uid();
    const rows = [['Alimentació', 'expense'], ['Habitatge', 'expense'], ['Transport', 'expense'], ['Oci', 'expense'], ['Salut', 'expense'], ['Compres', 'expense'], ['Altres', 'expense'], ['Nòmina', 'income'], ['Altres ingressos', 'income']].map(([name, kind]) => ({ user_id, name, kind }));
    this.unwrap(await this.sb.from('categories').upsert(rows, { onConflict: 'user_id,name,kind', ignoreDuplicates: true }));
  }
  balance(account: Account, tx: Transaction[], tr: Transfer[]) {
    const movements = tx.filter(t => t.account_id === account.id).reduce((sum, t) => sum + (t.kind === 'income' ? 1 : -1) * Number(t.amount), 0);
    const transfers = tr.reduce((sum, t) => sum + (t.to_account_id === account.id ? Number(t.amount) : 0) - (t.from_account_id === account.id ? Number(t.amount) : 0), 0);
    return Number(account.opening_balance) + movements + transfers;
  }
}
