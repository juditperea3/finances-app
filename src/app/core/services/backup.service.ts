import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

// Nomes les taules de l'app. No s'exporten credencials, tokens ni secrets de Supabase.
export const BACKUP_TABLES = [
  'profiles',
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'recurring_transactions',
  'budgets',
  'savings_goals',
  'savings_contributions'
] as const;

type BackupTable = typeof BACKUP_TABLES[number];
type DbRow = Record<string, unknown>;
type BackupData = Record<BackupTable, DbRow[]>;

export interface ExportFile {
  filename: string;
  blob: Blob;
  recordCount: number;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly sb = inject(SupabaseService).client;
  private readonly pageSize = 500;

  private async userId(): Promise<string> {
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) throw new Error('La sessio ha caducat. Torna a iniciar sessio.');
    return data.user.id;
  }

  // La consulta s'ordena per una clau estable (id) i pagina per evitar el limit
  // de files de Supabase. L'RLS continua restringint totes les dades a l'usuari.
  private async readTable(table: BackupTable, userId: string): Promise<DbRow[]> {
    const rows: DbRow[] = [];
    for (let offset = 0; ; offset += this.pageSize) {
      const filterColumn = table === 'profiles' ? 'id' : 'user_id';
      const { data, error } = await this.sb.from(table)
        .select('*')
        .eq(filterColumn, userId)
        .order('id', { ascending: true })
        .range(offset, offset + this.pageSize - 1);
      if (error) throw new Error(`No s'ha pogut llegir ${table}: ${error.message}`);
      const page = (data ?? []) as DbRow[];
      rows.push(...page);
      if (page.length < this.pageSize) return rows;
    }
  }

  async prepareJson(onProgress?: (table: string, count: number) => void): Promise<ExportFile> {
    const userId = await this.userId();
    const data = {} as BackupData;
    let recordCount = 0;

    for (const table of BACKUP_TABLES) {
      data[table] = await this.readTable(table, userId);
      recordCount += data[table].length;
      onProgress?.(table, data[table].length);
    }

    const content = JSON.stringify({
      format: 'finances-personal-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      tables: data
    }, null, 2);
    return {
      filename: `finances-copia-${this.fileDate()}.json`,
      blob: new Blob([content], { type: 'application/json;charset=utf-8' }),
      recordCount
    };
  }

  async prepareMovementsCsv(onProgress?: (table: string, count: number) => void): Promise<ExportFile> {
    const userId = await this.userId();
    const [accounts, categories, transactions, transfers] = await Promise.all([
      this.readTable('accounts', userId),
      this.readTable('categories', userId),
      this.readTable('transactions', userId),
      this.readTable('transfers', userId)
    ]);
    onProgress?.('moviments i transferencies', transactions.length + transfers.length);

    const accountNames = new Map(accounts.map(a => [String(a['id']), String(a['name'] ?? '')]));
    const categoryNames = new Map(categories.map(c => [String(c['id']), String(c['name'] ?? '')]));
    const nameForAccount = (id: unknown) => accountNames.get(String(id ?? '')) ?? '';

    const lines: unknown[][] = [[
      'Data', 'Tipus', 'Import (EUR)', 'Compte origen', 'Compte desti', 'Categoria', 'Concepte', 'ID'
    ]];

    for (const t of transactions) {
      const kind = String(t['kind'] ?? '');
      const amount = Number(t['amount'] ?? 0);
      lines.push([
        String(t['occurred_on'] ?? ''),
        kind === 'expense' ? 'Despesa' : 'Ingres',
        kind === 'expense' ? -amount : amount,
        nameForAccount(t['account_id']),
        '',
        categoryNames.get(String(t['category_id'] ?? '')) ?? '',
        String(t['description'] ?? ''),
        String(t['id'] ?? '')
      ]);
    }
    for (const t of transfers) {
      lines.push([
        String(t['occurred_on'] ?? ''),
        'Transferencia',
        Number(t['amount'] ?? 0),
        nameForAccount(t['from_account_id']),
        nameForAccount(t['to_account_id']),
        '',
        String(t['description'] ?? ''),
        String(t['id'] ?? '')
      ]);
    }
    const header = lines.shift()!;
    lines.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    const content = '\uFEFF' + [header, ...lines]
      .map(row => row.map(value => this.csvCell(value)).join(';'))
      .join('\r\n') + '\r\n';

    return {
      filename: `finances-moviments-${this.fileDate()}.csv`,
      blob: new Blob([content], { type: 'text/csv;charset=utf-8' }),
      recordCount: transactions.length + transfers.length
    };
  }

  private csvCell(value: unknown): string {
    // Les quantitats son numeriques; nomes els camps de text requereixen proteccio.
    const isNumber = typeof value === 'number';
    let text = isNumber ? value.toFixed(2).replace('.', ',')
      : value === null || value === undefined ? '' : String(value);
    // Evita la injeccio de formules quan el CSV s'obre amb un full de calcul.
    if (!isNumber && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  private fileDate(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
