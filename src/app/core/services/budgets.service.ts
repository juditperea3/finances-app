import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Budget } from '../models/budget.model';

@Injectable({ providedIn: 'root' })
export class BudgetsService {
  private readonly sb = inject(SupabaseService).client;

  private async uid(): Promise<string> {
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) throw new Error('Sessió no vàlida');
    return data.user.id;
  }

  async byMonth(month: string): Promise<Budget[]> {
    const userId = await this.uid();
    const { data, error } = await this.sb.from('budgets')
      .select('*').eq('user_id', userId).eq('month', `${month}-01`).order('created_at');
    if (error) throw error;
    return (data ?? []) as Budget[];
  }

  async save(categoryId: string, month: string, amount: number): Promise<void> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !categoryId || !Number.isFinite(amount) || amount <= 0)
      throw new Error('Revisa la categoria, el mes i l’import');
    const userId = await this.uid();
    const { error } = await this.sb.from('budgets').upsert({
      user_id: userId, category_id: categoryId, month: `${month}-01`, amount
    }, { onConflict: 'user_id,category_id,month' });
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const userId = await this.uid();
    const { error } = await this.sb.from('budgets').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  }
}
