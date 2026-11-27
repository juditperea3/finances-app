export interface SavingsGoal {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  target_amount: number;
  target_date: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export type SavingsContributionKind = 'deposit' | 'withdrawal';

export interface SavingsContribution {
  id: string;
  user_id: string;
  goal_id: string;
  kind: SavingsContributionKind;
  amount: number;
  occurred_on: string;
  note: string;
  created_at: string;
}

export type SavingsGoalInput = Pick<SavingsGoal, 'title' | 'icon' | 'target_amount' | 'target_date'>;
export type SavingsContributionInput = Pick<SavingsContribution, 'goal_id' | 'kind' | 'amount' | 'occurred_on' | 'note'>;
