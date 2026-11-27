import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SavingsGoal, SavingsContribution, SavingsGoalInput, SavingsContributionInput } from '../models/savings.models';

@Injectable({ providedIn: 'root' })
export class SavingsService {
  private readonly sb = inject(SupabaseService).client;

  private async uid(): Promise<string> {
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) throw new Error('Sessió no vàlida');
    return data.user.id;
  }

  async goals(): Promise<SavingsGoal[]> {
    const { data, error } = await this.sb.from('savings_goals')
      .select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavingsGoal[];
  }

  // Paginació: Supabase acostuma a limitar les consultes a 1.000 files per defecte.
  async contributions(): Promise<SavingsContribution[]> {
    const all: SavingsContribution[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.sb.from('savings_contributions')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as SavingsContribution[];
      all.push(...page);
      if (page.length < pageSize) return all;
    }
  }

  async createGoal(input: SavingsGoalInput): Promise<void> {
    const user_id = await this.uid();
    const { error } = await this.sb.from('savings_goals').insert({ ...input, user_id });
    if (error) throw error;
  }

  async updateGoal(id: string, input: SavingsGoalInput): Promise<void> {
    const user_id = await this.uid();
    const { data, error } = await this.sb.from('savings_goals')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user_id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No s’ha pogut actualitzar l’objectiu');
  }

  async setCompleted(id: string, completed: boolean): Promise<void> {
    const user_id = await this.uid();
    const { data, error } = await this.sb.from('savings_goals')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user_id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No s’ha pogut canviar l’estat de l’objectiu');
  }

  async deleteGoal(id: string): Promise<void> {
    const user_id = await this.uid();
    const { error } = await this.sb.from('savings_goals')
      .delete().eq('id', id).eq('user_id', user_id);
    if (error) throw error;
  }

  async addContribution(input: SavingsContributionInput): Promise<void> {
    const user_id = await this.uid();
    const { error } = await this.sb.from('savings_contributions').insert({ ...input, user_id });
    if (error) throw error;
  }
}
