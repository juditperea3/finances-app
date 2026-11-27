import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../core/services/finance.service';
import { BudgetsService } from '../../core/services/budgets.service';
import { SavingsService } from '../../core/services/savings.service';
import { FinanceUpdatesService } from '../../core/services/finance-updates.service';
import { Account, Category, Transaction, Transfer, MovementKind } from '../../core/models/finance.models';
import { Budget } from '../../core/models/budget.model';
import { SavingsGoal, SavingsContribution } from '../../core/models/savings.models';

type MonthlyBar = {
  key: string;
  label: string;
  income: number;
  expense: number;
  incomeHeight: number;
  expenseHeight: number;
};
type AccountSummary = { id: string; name: string; balance: number };
type CategoryExpense = { id: string; name: string; amount: number; percent: number; color: string };
type BudgetProgress = {
  id: string;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
  barPercent: number;
};
type GoalProgress = {
  id: string;
  title: string;
  icon: string;
  saved: number;
  target: number;
  remaining: number;
  percent: number;
  barPercent: number;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthDate(key: string): Date {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
}
function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink],
  styleUrl: './dashboard.component.scss',
  template: `
    <div class="dashboard">
      <header class="dash-heading">
        <div>
          <span class="eyebrow">VISIÓ GENERAL</span>
          <h1>Les meves finances</h1>
          <p>Els comptes, les despeses i els teus objectius, d'un cop d'ull.</p>
        </div>
        <div class="heading-actions">
          <div class="month-selector" aria-label="Període del resum">
            <button type="button" class="month-arrow" aria-label="Mes anterior" (click)="shiftMonth(-1)">‹</button>
            <input type="month" aria-label="Mes seleccionat" [value]="selectedMonth()" (change)="onMonthChange($event)" />
            <button type="button" class="month-arrow" aria-label="Mes següent" (click)="shiftMonth(1)">›</button>
          </div>
          <a class="all-movements" routerLink="/moviments">Veure moviments <span aria-hidden="true">→</span></a>
        </div>
      </header>

      @if (coreError()) { <p class="dashboard-alert" role="alert">{{ coreError() }}</p> }

      @if (coreLoading()) {
        <div class="loading" role="status">Carregant les teves finances…</div>
      } @else if (coreError()) {
        <button type="button" class="reload-button" (click)="loadCore()">Tornar a intentar-ho</button>
      } @else {
        <section class="overview" aria-label="Resum financer">
          <article class="summary-card summary-card--primary">
            <div class="summary-top"><span>Saldo actual</span><span class="summary-icon" aria-hidden="true">◉</span></div>
            <strong>{{ money(totalBalance()) }}</strong>
            <span class="summary-bottom">Suma dels saldos actuals dels comptes</span>
          </article>
          <article class="summary-card">
            <div class="summary-top"><span>Ingressos del mes</span><span class="summary-icon income-icon" aria-hidden="true">↙</span></div>
            <strong class="positive">{{ money(income()) }}</strong>
            <span class="summary-bottom">{{ monthTitle() }}</span>
          </article>
          <article class="summary-card">
            <div class="summary-top"><span>Despeses del mes</span><span class="summary-icon expense-icon" aria-hidden="true">↗</span></div>
            <strong>{{ money(expenses()) }}</strong>
            <span class="summary-bottom">{{ monthTitle() }}</span>
          </article>
          <article class="summary-card">
            <div class="summary-top"><span>Balanç del mes</span><span class="summary-icon" aria-hidden="true">✦</span></div>
            <strong [class.positive]="savings() > 0" [class.negative]="savings() < 0">{{ money(savings()) }}</strong>
            <span class="summary-bottom">Ingressos menys despeses</span>
          </article>
        </section>

        <div class="content-grid">
          <section class="dash-panel chart-panel" aria-labelledby="evolution-title">
            <div class="section-heading">
              <div><h2 id="evolution-title">Evolució mensual</h2><p>Ingressos i despeses fins a {{ monthTitle() }}</p></div>
              <div class="legend"><span><i class="dot dot--income"></i>Ingressos</span><span><i class="dot dot--expense"></i>Despeses</span></div>
            </div>
            @if (hasChartData()) {
              <div class="bar-chart" role="img" aria-label="Ingressos i despeses dels sis mesos fins al període seleccionat">
                @for (m of chart(); track m.key) {
                  <div class="bar-group" [attr.title]="m.key + ': ' + money(m.income) + ' en ingressos i ' + money(m.expense) + ' en despeses'">
                    <div class="bar-pair">
                      <div class="bar bar--income" [style.height.%]="m.incomeHeight"></div>
                      <div class="bar bar--expense" [style.height.%]="m.expenseHeight"></div>
                    </div>
                    <span class="bar-label">{{ m.label }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state"><span aria-hidden="true">▥</span><p>Encara no hi ha moviments en aquest període.</p></div>
            }
          </section>

          <section class="dash-panel accounts-panel" aria-labelledby="accounts-title">
            <div class="section-heading">
              <div><h2 id="accounts-title">Els meus comptes</h2><p>Saldos actuals, independentment del mes seleccionat</p></div>
              <a routerLink="/comptes" class="section-link">Veure tots <span aria-hidden="true">→</span></a>
            </div>
            @for (a of accountSummaries(); track a.id; let i = $index) {
              <div class="account-row">
                <div class="account-symbol" [class.account-symbol--alt]="i % 2 === 1" aria-hidden="true">{{ accountInitial(a.name) }}</div>
                <div class="account-info"><strong>{{ a.name }}</strong><small>Compte</small></div>
                <strong class="account-value">{{ money(a.balance) }}</strong>
              </div>
            } @empty {
              <div class="empty-state empty-state--small"><p>Encara no tens comptes.</p><a routerLink="/comptes">Crea el primer →</a></div>
            }
          </section>
        </div>

        <div class="planning-grid">
          <section class="dash-panel planning-panel" aria-labelledby="budgets-title">
            <div class="section-heading">
              <div><h2 id="budgets-title">Pressupostos del mes</h2><p>Control de límits per categoria · {{ monthTitle() }}</p></div>
              <a routerLink="/pressupostos" class="section-link">Gestionar <span aria-hidden="true">→</span></a>
            </div>
            @if (budgetsLoading()) {
              <p class="section-status" role="status">Carregant pressupostos…</p>
            } @else if (budgetsError()) {
              <p class="section-error" role="alert">{{ budgetsError() }}</p>
            } @else if (budgetRows().length) {
              <div class="budget-totals">
                <div><span>Pressupost</span><strong>{{ money(budgetLimit()) }}</strong></div>
                <div><span>Gastat</span><strong>{{ money(budgetSpent()) }}</strong></div>
                <div><span>Disponible</span><strong [class.negative]="budgetRemaining() < 0">{{ money(budgetRemaining()) }}</strong></div>
              </div>
              @for (b of budgetRows().slice(0, 4); track b.id) {
                <div class="progress-entry">
                  <div class="progress-top"><strong>{{ b.name }}</strong><span [class.negative]="b.remaining < 0">{{ money(b.spent) }} / {{ money(b.amount) }}</span></div>
                  <div class="progress-track" role="progressbar" [attr.aria-label]="'Pressupost de ' + b.name"
                    [attr.aria-valuenow]="b.barPercent" aria-valuemin="0" aria-valuemax="100">
                    <span class="progress-fill" [class.progress-fill--warning]="b.percent >= 80 && b.percent < 100"
                      [class.progress-fill--danger]="b.percent >= 100" [style.width.%]="b.barPercent"></span>
                  </div>
                  <small [class.negative]="b.remaining < 0">{{ b.remaining < 0 ? 'Superat en ' + money(-b.remaining) : 'Queden ' + money(b.remaining) }}</small>
                </div>
              }
              @if (budgetRows().length > 4) {
                <a class="panel-footer-link" routerLink="/pressupostos">Veure els {{ budgetRows().length }} pressupostos →</a>
              }
            } @else {
              <div class="empty-state empty-state--small"><p>Encara no tens pressupostos per a {{ monthTitle() }}.</p><a routerLink="/pressupostos">Crear pressupost →</a></div>
            }
          </section>

          <section class="dash-panel planning-panel" aria-labelledby="goals-title">
            <div class="section-heading">
              <div><h2 id="goals-title">Objectius d'estalvi</h2><p>Estalvi reservat per a les teves metes</p></div>
              <a routerLink="/objectius" class="section-link">Gestionar <span aria-hidden="true">→</span></a>
            </div>
            @if (goalsLoading()) {
              <p class="section-status" role="status">Carregant objectius…</p>
            } @else if (goalsError()) {
              <p class="section-error" role="alert">{{ goalsError() }}</p>
            } @else if (activeGoals().length) {
              <div class="goals-totals">
                <div><span>Reservat</span><strong class="positive">{{ money(goalsSaved()) }}</strong></div>
                <div><span>Pendent</span><strong>{{ money(goalsRemaining()) }}</strong></div>
                <div><span>Actius</span><strong>{{ activeGoals().length }}</strong></div>
              </div>
              @for (goal of activeGoals().slice(0, 3); track goal.id) {
                <div class="progress-entry">
                  <div class="progress-top">
                    <div class="goal-label"><span class="goal-icon" aria-hidden="true">{{ goal.icon || '🎯' }}</span><strong>{{ goal.title }}</strong></div>
                    <span>{{ roundedPercent(goal.percent) }}%</span>
                  </div>
                  <div class="progress-track" role="progressbar" [attr.aria-label]="'Objectiu ' + goal.title"
                    [attr.aria-valuenow]="goal.barPercent" aria-valuemin="0" aria-valuemax="100">
                    <span class="progress-fill" [style.width.%]="goal.barPercent"></span>
                  </div>
                  <small>{{ money(goal.saved) }} de {{ money(goal.target) }} · Falten {{ money(goal.remaining) }}</small>
                </div>
              }
              @if (activeGoals().length > 3) {
                <a class="panel-footer-link" routerLink="/objectius">Veure els {{ activeGoals().length }} objectius →</a>
              }
              <p class="planning-note">Les aportacions als objectius no es descompten dels comptes.</p>
            } @else {
              <div class="empty-state empty-state--small"><p>Encara no tens objectius actius.</p><a routerLink="/objectius">Crear objectiu →</a></div>
            }
          </section>
        </div>

        <div class="content-grid bottom-grid">
          <section class="dash-panel categories-panel" aria-labelledby="categories-title">
            <div class="section-heading">
              <div><h2 id="categories-title">On van els diners?</h2><p>Distribució de les despeses de {{ monthTitle() }}</p></div>
              <a routerLink="/moviments" class="section-link">Moviments <span aria-hidden="true">→</span></a>
            </div>
            @if (categoryExpenses().length) {
              <div class="category-total"><span>Total gastat</span><strong>{{ money(expenses()) }}</strong></div>
              @for (c of categoryExpenses().slice(0, 6); track c.id) {
                <div class="category-entry">
                  <div class="category-meta"><span class="category-color" [style.background-color]="c.color"></span><strong>{{ c.name }}</strong><span>{{ money(c.amount) }} · {{ roundedPercent(c.percent) }}%</span></div>
                  <div class="category-track"><span [style.background-color]="c.color" [style.width.%]="c.percent"></span></div>
                </div>
              }
              @if (categoryExpenses().length > 6) { <small class="more-categories">Hi ha {{ categoryExpenses().length - 6 }} categories més. Consulta Moviments per veure-les.</small> }
            } @else {
              <div class="empty-state empty-state--small"><p>No hi ha despeses registrades en aquest mes.</p></div>
            }
          </section>

          <section class="dash-panel movements-panel" aria-labelledby="movements-title">
            <div class="section-heading">
              <div><h2 id="movements-title">Últims moviments</h2><p>Les teves operacions més recents</p></div>
              <a routerLink="/moviments" class="section-link">Veure tots <span aria-hidden="true">→</span></a>
            </div>
            @for (t of recentTransactions(); track t.id) {
              <div class="movement-row">
                <div class="movement-symbol" [class.movement-symbol--income]="t.kind === 'income'" aria-hidden="true">{{ t.kind === 'expense' ? '↗' : '↙' }}</div>
                <div class="movement-info"><strong>{{ t.description || categoryName(t.category_id) }}</strong><small>{{ t.occurred_on | date:'dd/MM/yyyy' }} · {{ categoryName(t.category_id) }}</small></div>
                <strong class="movement-value" [class.positive]="t.kind === 'income'" [class.negative]="t.kind === 'expense'">{{ t.kind === 'expense' ? '−' : '+' }}{{ money(+t.amount) }}</strong>
              </div>
            } @empty {
              <div class="empty-state empty-state--small"><p>Encara no hi ha moviments.</p><a routerLink="/moviments">Afegeix el primer →</a></div>
            }
          </section>
        </div>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private readonly finance = inject(FinanceService);
  private readonly budgetsService = inject(BudgetsService);
  private readonly savingsService = inject(SavingsService);
  private readonly updates = inject(FinanceUpdatesService);

  readonly accounts = signal<Account[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly transfers = signal<Transfer[]>([]);
  readonly budgets = signal<Budget[]>([]);
  readonly goals = signal<SavingsGoal[]>([]);
  readonly contributions = signal<SavingsContribution[]>([]);

  readonly coreLoading = signal(true);
  readonly budgetsLoading = signal(true);
  readonly goalsLoading = signal(true);
  readonly coreError = signal('');
  readonly budgetsError = signal('');
  readonly goalsError = signal('');
  readonly selectedMonth = signal(monthKey(new Date()));

  private coreRequest = 0;
  private budgetRequest = 0;
  private readonly initialUpdatesVersion = this.updates.version();
  private readonly euroFormatter = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' });
  private readonly monthFormatter = new Intl.DateTimeFormat('ca-ES', { month: 'short' });
  private readonly fullMonthFormatter = new Intl.DateTimeFormat('ca-ES', { month: 'long', year: 'numeric' });

  readonly monthTitle = computed(() => this.fullMonthFormatter.format(monthDate(this.selectedMonth())));
  readonly accountSummaries = computed<AccountSummary[]>(() => this.accounts().map(a => ({
    id: a.id, name: a.name, balance: this.finance.balance(a, this.transactions(), this.transfers())
  })));
  readonly totalBalance = computed(() => rounded(this.accountSummaries().reduce((sum, a) => sum + a.balance, 0)));
  readonly income = computed(() => this.monthTotal('income', this.selectedMonth()));
  readonly expenses = computed(() => this.monthTotal('expense', this.selectedMonth()));
  readonly savings = computed(() => rounded(this.income() - this.expenses()));
  readonly recentTransactions = computed(() => [...this.transactions()].sort((a, b) =>
    b.occurred_on.localeCompare(a.occurred_on)).slice(0, 6));

  readonly chart = computed<MonthlyBar[]>(() => {
    const selected = monthDate(this.selectedMonth());
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(selected.getFullYear(), selected.getMonth() - (5 - index), 1);
      const key = monthKey(date);
      return { key, label: this.monthFormatter.format(date), income: this.monthTotal('income', key), expense: this.monthTotal('expense', key) };
    });
    const highest = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
    return months.map(m => ({ ...m, incomeHeight: m.income / highest * 100, expenseHeight: m.expense / highest * 100 }));
  });
  readonly hasChartData = computed(() => this.chart().some(m => m.income > 0 || m.expense > 0));

  readonly categoryExpenses = computed<CategoryExpense[]>(() => {
    const totals = new Map<string, number>();
    for (const t of this.transactions()) {
      if (t.kind !== 'expense' || !t.occurred_on.startsWith(this.selectedMonth())) continue;
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + Number(t.amount));
    }
    const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
    const colors = ['#23826f', '#e7aa72', '#7a8bd1', '#bb79aa', '#52a0bd', '#b08b60'];
    return [...totals.entries()].map(([id, amount], index) => {
      const category = this.categories().find(c => c.id === id);
      const validColor = category?.color && /^#[0-9a-f]{6}$/i.test(category.color) ? category.color : colors[index % colors.length];
      return {
        id, name: category?.name ?? 'Sense categoria', amount: rounded(amount),
        percent: total > 0 ? amount / total * 100 : 0, color: validColor
      };
    }).sort((a, b) => b.amount - a.amount);
  });

  readonly budgetRows = computed<BudgetProgress[]>(() => this.budgets().map(budget => {
    const amount = Number(budget.amount);
    const spent = this.transactions().filter(t => t.kind === 'expense' &&
      t.category_id === budget.category_id && t.occurred_on.startsWith(this.selectedMonth()))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const category = this.categories().find(c => c.id === budget.category_id);
    const percent = amount > 0 ? spent / amount * 100 : 0;
    return {
      id: budget.id, name: category?.name ?? 'Categoria', amount, spent: rounded(spent),
      remaining: rounded(amount - spent), percent, barPercent: Math.min(100, Math.max(0, percent))
    };
  }).sort((a, b) => b.percent - a.percent));
  readonly budgetLimit = computed(() => rounded(this.budgetRows().reduce((s, b) => s + b.amount, 0)));
  readonly budgetSpent = computed(() => rounded(this.budgetRows().reduce((s, b) => s + b.spent, 0)));
  readonly budgetRemaining = computed(() => rounded(this.budgetLimit() - this.budgetSpent()));

  readonly activeGoals = computed<GoalProgress[]>(() => {
    const savedByGoal = new Map<string, number>();
    for (const c of this.contributions()) {
      const direction = c.kind === 'deposit' ? 1 : -1;
      savedByGoal.set(c.goal_id, (savedByGoal.get(c.goal_id) ?? 0) + direction * Number(c.amount));
    }
    return this.goals().filter(goal => !goal.completed).map(goal => {
      const saved = rounded(savedByGoal.get(goal.id) ?? 0);
      const target = Number(goal.target_amount);
      const percent = target > 0 ? saved / target * 100 : 0;
      return {
        id: goal.id, title: goal.title, icon: goal.icon, saved, target,
        remaining: Math.max(0, rounded(target - saved)), percent,
        barPercent: Math.min(100, Math.max(0, percent))
      };
    }).sort((a, b) => b.percent - a.percent);
  });
  readonly goalsSaved = computed(() => rounded(this.activeGoals().reduce((s, g) => s + g.saved, 0)));
  readonly goalsRemaining = computed(() => rounded(this.activeGoals().reduce((s, g) => s + g.remaining, 0)));

  constructor() {
    // El modal global incrementa aquesta versió quan es guarda un moviment.
    // No recarreguem innecessàriament en construir el component.
    effect(() => {
      if (this.updates.version() !== this.initialUpdatesVersion) void this.loadCore();
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadCore(), this.loadBudgets(), this.loadGoals()]);
  }

  async loadCore(): Promise<void> {
    const requestId = ++this.coreRequest;
    this.coreLoading.set(true);
    this.coreError.set('');
    try {
      const [accounts, categories, transactions, transfers] = await Promise.all([
        this.finance.accounts(), this.finance.categories(), this.finance.transactions(), this.finance.transfers()
      ]);
      if (requestId !== this.coreRequest) return;
      this.accounts.set(accounts);
      this.categories.set(categories);
      this.transactions.set(transactions);
      this.transfers.set(transfers);
    } catch (error: unknown) {
      if (requestId === this.coreRequest) this.coreError.set(this.errorMessage(error));
    } finally {
      if (requestId === this.coreRequest) this.coreLoading.set(false);
    }
  }

  async loadBudgets(): Promise<void> {
    const requestId = ++this.budgetRequest;
    const month = this.selectedMonth();
    this.budgetsLoading.set(true);
    this.budgetsError.set('');
    this.budgets.set([]);
    try {
      const budgets = await this.budgetsService.byMonth(month);
      if (requestId === this.budgetRequest && month === this.selectedMonth()) this.budgets.set(budgets);
    } catch (error: unknown) {
      if (requestId === this.budgetRequest) this.budgetsError.set(this.errorMessage(error));
    } finally {
      if (requestId === this.budgetRequest) this.budgetsLoading.set(false);
    }
  }

  async loadGoals(): Promise<void> {
    this.goalsLoading.set(true);
    this.goalsError.set('');
    try {
      const [goals, contributions] = await Promise.all([
        this.savingsService.goals(), this.savingsService.contributions()
      ]);
      this.goals.set(goals);
      this.contributions.set(contributions);
    } catch (error: unknown) {
      this.goalsError.set(this.errorMessage(error));
    } finally {
      this.goalsLoading.set(false);
    }
  }

  onMonthChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setMonth(input.value);
  }
  shiftMonth(offset: number): void {
    const date = monthDate(this.selectedMonth());
    this.setMonth(monthKey(new Date(date.getFullYear(), date.getMonth() + offset, 1)));
  }
  private setMonth(value: string): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || this.selectedMonth() === value) return;
    this.selectedMonth.set(value);
    void this.loadBudgets();
  }

  money(amount: number): string { return this.euroFormatter.format(amount); }
  accountInitial(name: string): string { return name.trim().charAt(0).toUpperCase() || '€'; }
  categoryName(id: string): string { return this.categories().find(c => c.id === id)?.name ?? 'Moviment'; }
  roundedPercent(value: number): number { return Math.round(value); }
  private monthTotal(kind: MovementKind, month: string): number {
    return rounded(this.transactions().filter(t => t.kind === kind && t.occurred_on.startsWith(month))
      .reduce((sum, t) => sum + Number(t.amount), 0));
  }
  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
    return 'No s’han pogut carregar les dades. Torna-ho a provar.';
  }
}
