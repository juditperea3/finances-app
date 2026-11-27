export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month: string; // primer dia del mes: YYYY-MM-01
  amount: number;
  created_at?: string;
  updated_at?: string;
}
