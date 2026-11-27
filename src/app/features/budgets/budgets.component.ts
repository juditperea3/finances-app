import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { BudgetsService } from '../../core/services/budgets.service';
import { Budget } from '../../core/models/budget.model';
import { Category, Transaction } from '../../core/models/finance.models';

type BudgetRow = { category: Category; budget: Budget | undefined; spent: number; limit: number; percent: number; remaining: number };
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DecimalPipe],
  styleUrl: './budgets.component.scss',
  template: `
    <section class="budgets-heading">
      <div><p class="eyebrow">PLANIFICACIÓ</p><h1>Pressupostos</h1>
        <p>Defineix límits mensuals i controla quant et queda per gastar.</p></div>
      <div class="month-controls">
        <button type="button" class="month-arrow" (click)="changeMonth(-1)" aria-label="Mes anterior">‹</button>
        <input aria-label="Mes dels pressupostos" type="month" [ngModel]="month()" (ngModelChange)="setMonth($event)" />
        <button type="button" class="month-arrow" (click)="changeMonth(1)" aria-label="Mes següent">›</button>
      </div>
    </section>

    @if (error()) { <p class="budget-alert budget-error" role="alert">{{ error() }}</p> }
    @if (success()) { <p class="budget-alert" role="status">{{ success() }}</p> }

    <section class="budgets-stats" aria-label="Resum pressupostari">
      <article class="budget-stat"><span>Pressupost total</span><strong>{{ totalLimit() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong></article>
      <article class="budget-stat"><span>Gastat en categories pressupostades</span><strong>{{ totalSpent() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong></article>
      <article class="budget-stat"><span>Disponible</span><strong [class.negative]="totalRemaining() < 0">{{ totalRemaining() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong></article>
    </section>

    <section class="panel budget-create">
      <div class="section-title"><h2>{{ editingId() ? 'Modificar pressupost' : 'Afegir pressupost' }}</h2></div>
      <form class="budget-form" (ngSubmit)="save()">
        <label>Categoria de despesa
          <select name="categoryId" [(ngModel)]="categoryId" required>
            <option value="">Selecciona una categoria</option>
            @for (c of expenseCategories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
          </select>
        </label>
        <label>Límit mensual (€)
          <input name="amount" type="number" min="0.01" step="0.01" [(ngModel)]="amount" placeholder="Ex. 250" required />
        </label>
        <div class="budget-actions">
          @if (editingId()) { <button type="button" class="subtle budget-cancel" (click)="cancelEdit()">Cancel·lar</button> }
          <button type="submit" [disabled]="busy()">{{ busy() ? 'Guardant...' : editingId() ? 'Guardar canvis' : 'Crear pressupost' }}</button>
        </div>
      </form>
      <p class="budget-help">Si ja tens un pressupost per a aquesta categoria i mes, en guardarem el nou import.</p>
    </section>

    <section class="panel budget-list">
      <div class="section-title"><h2>Seguiment del mes</h2><span class="count">{{ rows().length }} pressupostos</span></div>
      @if (loading()) { <p>Carregant pressupostos...</p> }
      @else {
        @for (row of rows(); track row.category.id) {
          <article class="budget-row">
            <div class="budget-row-top">
              <div><strong>{{ row.category.name }}</strong><small>{{ row.spent | currency:'EUR':'symbol':'1.2-2':'ca' }} de {{ row.limit | currency:'EUR':'symbol':'1.2-2':'ca' }}</small></div>
              <div class="budget-row-right">
                <span [class.negative]="row.remaining < 0">{{ row.remaining >= 0 ? 'Queden ' : 'Superat en ' }}{{ abs(row.remaining) | currency:'EUR':'symbol':'1.2-2':'ca' }}</span>
                <button type="button" class="subtle budget-icon" (click)="edit(row)" [attr.aria-label]="'Editar pressupost de ' + row.category.name">✎</button>
                <button type="button" class="subtle budget-icon" (click)="remove(row)" [attr.aria-label]="'Eliminar pressupost de ' + row.category.name">✕</button>
              </div>
            </div>
            <div class="budget-track" role="progressbar" [attr.aria-label]="'Pressupost de ' + row.category.name" [attr.aria-valuenow]="MathMin(row.percent)" aria-valuemin="0" aria-valuemax="100">
              <div class="budget-fill" [class.budget-warning]="row.percent >= 80 && row.percent < 100" [class.budget-over]="row.percent >= 100" [style.width.%]="MathMin(row.percent)"></div>
            </div>
            <small class="budget-percent">{{ row.percent | number:'1.0-0':'ca' }}% utilitzat</small>
          </article>
        } @empty { <div class="budget-empty"><strong>Encara no tens pressupostos per aquest mes.</strong><p>Tria una categoria, introdueix un límit i comença a controlar les teves despeses.</p></div> }
      }
    </section>
    @if (unbudgetedSpent() > 0) {
      <p class="budget-unbudgeted">També has gastat {{ unbudgetedSpent() | currency:'EUR':'symbol':'1.2-2':'ca' }} en categories sense pressupost aquest mes.</p>
    }
  `
})
export class BudgetsComponent implements OnInit {
  private readonly finance = inject(FinanceService);
  private readonly budgetsService = inject(BudgetsService);
  readonly month = signal(currentMonth());
  readonly categories = signal<Category[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly budgets = signal<Budget[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly editingId = signal<string | null>(null);
  categoryId = '';
  amount: number | null = null;

  readonly expenseCategories = computed(() => this.categories().filter(c => c.kind === 'expense' && !c.archived));
  readonly rows = computed<BudgetRow[]>(() => this.budgets().map(budget => {
    const category = this.categories().find(c => c.id === budget.category_id);
    if (!category) return null;
    const spent = this.transactions().filter(t => t.kind === 'expense' && t.category_id === budget.category_id && t.occurred_on.startsWith(this.month()))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const limit = Number(budget.amount);
    return { category, budget, spent, limit, percent: limit > 0 ? spent / limit * 100 : 0, remaining: limit - spent };
  }).filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.percent - a.percent));
  readonly totalLimit = computed(() => this.rows().reduce((s, r) => s + r.limit, 0));
  readonly totalSpent = computed(() => this.rows().reduce((s, r) => s + r.spent, 0));
  readonly totalRemaining = computed(() => this.totalLimit() - this.totalSpent());
  readonly unbudgetedSpent = computed(() => {
    const included = new Set(this.budgets().map(b => b.category_id));
    return this.transactions().filter(t => t.kind === 'expense' && t.occurred_on.startsWith(this.month()) && !included.has(t.category_id))
      .reduce((s, t) => s + Number(t.amount), 0);
  });
  readonly MathMin = (n: number) => Math.min(100, Math.max(0, n));
  readonly abs = Math.abs;

  async ngOnInit() {
    this.loading.set(true);
    try {
      const [categories, transactions] = await Promise.all([this.finance.categories(), this.finance.transactions()]);
      this.categories.set(categories);
      this.transactions.set(transactions);
      await this.loadMonth();
    } catch (e: unknown) { this.error.set(this.message(e)); }
    finally { this.loading.set(false); }
  }
  private message(e: unknown): string { return e instanceof Error ? e.message : 'Error desconegut'; }
  private async loadMonth(): Promise<void> {
    this.budgets.set(await this.budgetsService.byMonth(this.month()));
  }
  async setMonth(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
    this.month.set(value); this.cancelEdit(); this.error.set(''); this.success.set('');
    this.loading.set(true);
    try { await this.loadMonth(); } catch (e: unknown) { this.error.set(this.message(e)); }
    finally { this.loading.set(false); }
  }
  changeMonth(offset: number) {
    const [y, m] = this.month().split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    void this.setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  edit(row: BudgetRow) {
    this.categoryId = row.category.id;
    this.amount = row.limit;
    this.editingId.set(row.budget?.id ?? null);
    this.success.set(''); this.error.set('');
  }
  cancelEdit() { this.categoryId = ''; this.amount = null; this.editingId.set(null); }
  async save() {
    this.error.set(''); this.success.set('');
    if (!this.categoryId || !this.expenseCategories().some(c => c.id === this.categoryId) || !this.amount || !Number.isFinite(Number(this.amount)) || Number(this.amount) <= 0) {
      this.error.set('Selecciona una categoria de despesa i un import superior a zero.'); return;
    }
    this.busy.set(true);
    try {
      await this.budgetsService.save(this.categoryId, this.month(), Number(this.amount));
      await this.loadMonth(); this.cancelEdit(); this.success.set('Pressupost guardat correctament.');
    } catch (e: unknown) { this.error.set(this.message(e)); }
    finally { this.busy.set(false); }
  }
  async remove(row: BudgetRow) {
    if (!row.budget || !confirm(`Eliminar el pressupost de ${row.category.name} per aquest mes?`)) return;
    this.error.set(''); this.success.set(''); this.busy.set(true);
    try { await this.budgetsService.remove(row.budget.id); await this.loadMonth(); this.success.set('Pressupost eliminat.'); }
    catch (e: unknown) { this.error.set(this.message(e)); }
    finally { this.busy.set(false); }
  }
}
