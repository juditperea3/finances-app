import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FinanceService } from '../../core/services/finance.service';
import { Account, Category, MovementKind, Transaction, Transfer } from '../../core/models/finance.models';
import { FinanceUpdatesService } from '../../core/services/finance-updates.service';

function localToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type KindFilter = 'all' | MovementKind;
type EditDraft = {
    id: string;
    kind: MovementKind;
    amount: number | null;
    occurred_on: string;
    account_id: string;
    category_id: string;
    description: string;
};

@Component({
    standalone: true,
    imports: [FormsModule, CurrencyPipe, DatePipe],
    styleUrl: './transactions.component.scss',
    template: `
    <section class="movements-heading">
      <div>
        <p class="eyebrow">CONTROL DE DESPESES</p>
        <h1>Moviments</h1>
        <p>Consulta, filtra i edita els teus ingressos i despeses.</p>
      </div>
      <button type="button" class="primary-action" (click)="showCreate.set(!showCreate())">
        {{showCreate() ? 'Tancar formulari' : '+ Nou moviment'}}
      </button>
    </section>

    @if (error()) { <p class="error notice" role="alert">{{ error() }}</p> }
    @if (success()) { <p class="success notice" role="status">{{ success() }}</p> }

    @if (showCreate()) {
      <section class="panel form-panel" aria-labelledby="create-title">
        <div class="section-title"><h2 id="create-title">Nou moviment</h2></div>
        <form (ngSubmit)="save()" class="movement-form">
          <label>Tipus
            <select name="kind" [(ngModel)]="kind" (ngModelChange)="category_id = ''">
              <option value="expense">Despesa</option><option value="income">Ingrés</option><option value="transfer">Transferència</option>
            </select>
          </label>
          <label>Import (€)
            <input name="amount" type="number" min="0.01" step="0.01" [(ngModel)]="amount" required />
          </label>
          <label>Data
            <input name="date" type="date" [(ngModel)]="date" required />
          </label>
          <label>Compte origen
            <select name="account" [(ngModel)]="account_id" required>
              <option value="">Selecciona...</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
            </select>
          </label>
          @if (kind === 'transfer') {
            <label>Compte destí
              <select name="to" [(ngModel)]="to_account_id" required>
                <option value="">Selecciona...</option>
                @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
              </select>
            </label>
          } @else {
            <label>Categoria
              <select name="category" [(ngModel)]="category_id" required>
                <option value="">Selecciona...</option>
                @for (c of categories(); track c.id) {
                  @if (c.kind === kind) { <option [value]="c.id">{{ c.name }}</option> }
                }
              </select>
            </label>
          }
          <label class="wide">Concepte (opcional)
            <input name="description" [(ngModel)]="description" placeholder="Ex. Compra al supermercat" />
          </label>
          <div class="form-actions wide">
            <button type="button" class="quiet-action" (click)="showCreate.set(false)">Cancel·lar</button>
            <button type="submit" [disabled]="busy()">{{ busy() ? 'Guardant...' : 'Guardar moviment' }}</button>
          </div>
        </form>
      </section>
    }

    <section class="panel filters-panel" aria-labelledby="filter-title">
      <div class="section-title">
        <h2 id="filter-title">Filtrar moviments</h2>
        <button type="button" class="text-action" (click)="clearFilters()">Netejar filtres</button>
      </div>
      <div class="filters-grid">
        <label class="search-field">Cercar
          <input type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Concepte o categoria..." aria-label="Cercar moviments" />
        </label>
        <label>Mes
          <input type="month" [ngModel]="month()" (ngModelChange)="month.set($event)" />
        </label>
        <label>Tipus
          <select [ngModel]="kindFilter()" (ngModelChange)="kindFilter.set($event)">
            <option value="all">Tots</option><option value="expense">Despeses</option><option value="income">Ingressos</option>
          </select>
        </label>
        <label>Compte
          <select [ngModel]="accountFilter()" (ngModelChange)="accountFilter.set($event)">
            <option value="all">Tots els comptes</option>
            @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
          </select>
        </label>
        <label>Categoria
          <select [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event)">
            <option value="all">Totes les categories</option>
            @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
          </select>
        </label>
      </div>
    </section>

    <section class="summary-grid" aria-label="Resum dels moviments filtrats">
      <article class="summary-card"><span>Ingressos</span><strong class="positive">{{ filteredIncome() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong></article>
      <article class="summary-card"><span>Despeses</span><strong class="negative">{{ filteredExpenses() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong></article>
      <article class="summary-card"><span>Balanç</span><strong [class.negative]="filteredBalance() < 0" [class.positive]="filteredBalance() > 0">{{ filteredBalance() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong></article>
    </section>

    <section class="panel history-panel" aria-labelledby="history-title">
      <div class="section-title"><h2 id="history-title">Historial</h2><span class="count">{{ filteredTransactions().length }} moviments</span></div>
      @for (group of groupedTransactions(); track group.date) {
        <div class="date-heading">{{ group.date | date:'EEEE, d MMMM y':'':'ca' }}</div>
        @for (t of group.items; track t.id) {
          <div class="movement-row">
            <div class="movement-icon" [class.income-icon]="t.kind === 'income'" aria-hidden="true">{{ t.kind === 'income' ? '↙' : '↗' }}</div>
            <div class="movement-description"><strong>{{ t.description || categoryName(t.category_id) }}</strong><small>{{ categoryName(t.category_id) }} · {{ accountName(t.account_id) }}</small></div>
            <strong class="movement-amount" [class.negative]="t.kind === 'expense'" [class.positive]="t.kind === 'income'">{{ t.kind === 'expense' ? '−' : '+' }}{{ t.amount | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong>
            <div class="row-actions">
              <button type="button" class="icon-button" (click)="startEdit(t)" [attr.aria-label]="'Editar ' + (t.description || 'moviment')" title="Editar">✎</button>
              <button type="button" class="icon-button delete-button" (click)="remove(t.id)" [attr.aria-label]="'Eliminar ' + (t.description || 'moviment')" title="Eliminar">✕</button>
            </div>
          </div>
        }
      } @empty {
        <div class="empty-state"><span aria-hidden="true">⌕</span><strong>No hem trobat moviments</strong><p>Prova de canviar els filtres o afegeix un moviment nou.</p></div>
      }
    </section>

    @if (filteredTransfers().length) {
      <section class="panel history-panel" aria-labelledby="transfers-title">
        <div class="section-title"><h2 id="transfers-title">Transferències</h2><span class="count">{{ filteredTransfers().length }}</span></div>
        @for (t of filteredTransfers(); track t.id) {
          <div class="movement-row">
            <div class="movement-icon transfer-icon" aria-hidden="true">⇄</div>
            <div class="movement-description"><strong>{{ t.description || 'Transferència' }}</strong><small>{{ accountName(t.from_account_id) }} → {{ accountName(t.to_account_id) }} · {{ t.occurred_on | date:'dd/MM/yyyy' }}</small></div>
            <strong class="movement-amount">{{ t.amount | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong>
          </div>
        }
      </section>
    }

    @if (editDraft()) {
      <div class="dialog-backdrop" (click)="closeEdit()">
        <section class="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" (click)="$event.stopPropagation()" (keydown.escape)="closeEdit()">
          <div class="section-title"><h2 id="edit-title">Editar moviment</h2><button type="button" class="icon-button" (click)="closeEdit()" aria-label="Tancar">✕</button></div>
          <form (ngSubmit)="saveEdit()" class="edit-form">
            <label>Tipus
              <select name="edit-kind" [ngModel]="editDraft()!.kind" (ngModelChange)="updateDraft('kind', $event)">
                <option value="expense">Despesa</option><option value="income">Ingrés</option>
              </select>
            </label>
            <label>Import (€)<input name="edit-amount" type="number" min="0.01" step="0.01" [ngModel]="editDraft()!.amount" (ngModelChange)="updateDraft('amount', $event)" required /></label>
            <label>Data<input name="edit-date" type="date" [ngModel]="editDraft()!.occurred_on" (ngModelChange)="updateDraft('occurred_on', $event)" required /></label>
            <label>Compte
              <select name="edit-account" [ngModel]="editDraft()!.account_id" (ngModelChange)="updateDraft('account_id', $event)" required>
                @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
              </select>
            </label>
            <label>Categoria
              <select name="edit-category" [ngModel]="editDraft()!.category_id" (ngModelChange)="updateDraft('category_id', $event)" required>
                <option value="">Selecciona...</option>
                @for (c of categories(); track c.id) { @if (c.kind === editDraft()!.kind) { <option [value]="c.id">{{ c.name }}</option> } }
              </select>
            </label>
            <label>Concepte<input name="edit-description" [ngModel]="editDraft()!.description" (ngModelChange)="updateDraft('description', $event)" /></label>
            <div class="form-actions"><button type="button" class="quiet-action" (click)="closeEdit()">Cancel·lar</button><button type="submit" [disabled]="busy()">{{ busy() ? 'Guardant...' : 'Guardar canvis' }}</button></div>
          </form>
        </section>
      </div>
    }
  `
})
export class TransactionsComponent implements OnInit {
    private readonly f = inject(FinanceService);
    private readonly updates = inject(FinanceUpdatesService);
    readonly accounts = signal<Account[]>([]);
    readonly categories = signal<Category[]>([]);
    readonly transactions = signal<Transaction[]>([]);
    readonly transfers = signal<Transfer[]>([]);
    readonly error = signal('');
    readonly success = signal('');
    readonly busy = signal(false);
    readonly showCreate = signal(false);
    readonly month = signal(localToday().slice(0, 7));
    readonly kindFilter = signal<KindFilter>('all');
    readonly accountFilter = signal('all');
    readonly categoryFilter = signal('all');
    readonly search = signal('');
    readonly editDraft = signal<EditDraft | null>(null);

    kind: MovementKind | 'transfer' = 'expense';
    amount: number | null = null;
    date = localToday();
    account_id = '';
    to_account_id = '';
    category_id = '';
    description = '';

    readonly filteredTransactions = computed(() => {
        const text = this.search().trim().toLocaleLowerCase();
        return this.transactions().filter(t =>
            (!this.month() || t.occurred_on.startsWith(this.month())) &&
            (this.kindFilter() === 'all' || t.kind === this.kindFilter()) &&
            (this.accountFilter() === 'all' || t.account_id === this.accountFilter()) &&
            (this.categoryFilter() === 'all' || t.category_id === this.categoryFilter()) &&
            (!text || `${t.description ?? ''} ${this.categoryName(t.category_id)} ${this.accountName(t.account_id)}`.toLocaleLowerCase().includes(text))
        ).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
    });
    readonly groupedTransactions = computed(() => {
        const groups: { date: string; items: Transaction[] }[] = [];
        for (const t of this.filteredTransactions()) {
            const last = groups[groups.length - 1];
            if (last?.date === t.occurred_on) last.items.push(t);
            else groups.push({ date: t.occurred_on, items: [t] });
        }
        return groups;
    });
    readonly filteredIncome = computed(() => this.filteredTransactions().filter(t => t.kind === 'income').reduce((s, t) => s + Number(t.amount), 0));
    readonly filteredExpenses = computed(() => this.filteredTransactions().filter(t => t.kind === 'expense').reduce((s, t) => s + Number(t.amount), 0));
    readonly filteredBalance = computed(() => this.filteredIncome() - this.filteredExpenses());
    readonly filteredTransfers = computed(() => {
        const text = this.search().trim().toLocaleLowerCase();
        if (this.kindFilter() !== 'all' || this.categoryFilter() !== 'all') return [];
        return this.transfers().filter(t =>
            (!this.month() || t.occurred_on.startsWith(this.month())) &&
            (this.accountFilter() === 'all' || t.from_account_id === this.accountFilter() || t.to_account_id === this.accountFilter()) &&
            (!text || `${t.description ?? ''} ${this.accountName(t.from_account_id)} ${this.accountName(t.to_account_id)}`.toLocaleLowerCase().includes(text))
        );
    });

    async ngOnInit() { await this.refresh(); }
    async refresh() {
        try {
            const [a, c, t, tr] = await Promise.all([this.f.accounts(), this.f.categories(), this.f.transactions(), this.f.transfers()]);
            this.accounts.set(a); this.categories.set(c); this.transactions.set(t); this.transfers.set(tr);
            if (!this.account_id && a.length) this.account_id = a[0].id;
            this.error.set('');
        } catch (e: unknown) { this.error.set(this.errorMessage(e)); }
    }
    categoryName(id: string) { return this.categories().find(c => c.id === id)?.name || 'Sense categoria'; }
    accountName(id: string) { return this.accounts().find(a => a.id === id)?.name || 'Compte'; }
    clearFilters() { this.month.set(localToday().slice(0, 7)); this.kindFilter.set('all'); this.accountFilter.set('all'); this.categoryFilter.set('all'); this.search.set(''); }
    private errorMessage(e: unknown) { return e instanceof Error ? e.message : 'S’ha produït un error'; }
    private notifySaved(message: string) { this.success.set(message); this.updates.notify(); }

    async save() {
        this.error.set(''); this.success.set('');
        if (!this.amount || !Number.isFinite(Number(this.amount)) || Number(this.amount) <= 0 || !this.account_id || !this.date) {
            this.error.set('Completa els camps obligatoris'); return;
        }
        this.busy.set(true);
        try {
            if (this.kind === 'transfer') {
                if (!this.to_account_id || this.to_account_id === this.account_id) throw new Error('Selecciona un compte destí diferent');
                await this.f.addTransfer({ amount: Number(this.amount), occurred_on: this.date, description: this.description, from_account_id: this.account_id, to_account_id: this.to_account_id });
            } else {
                if (!this.category_id || !this.categories().some(c => c.id === this.category_id && c.kind === this.kind)) throw new Error('Selecciona una categoria vàlida');
                await this.f.addTransaction({ amount: Number(this.amount), occurred_on: this.date, description: this.description, account_id: this.account_id, category_id: this.category_id, kind: this.kind });
            }
            this.amount = null; this.description = ''; this.category_id = ''; this.to_account_id = '';
            this.month.set(this.date.slice(0, 7)); this.showCreate.set(false);
            await this.refresh(); this.notifySaved('Moviment guardat correctament');
        } catch (e: unknown) { this.error.set(this.errorMessage(e)); }
        finally { this.busy.set(false); }
    }
    startEdit(t: Transaction) {
        this.error.set(''); this.success.set('');
        this.editDraft.set({ id: t.id, kind: t.kind, amount: Number(t.amount), occurred_on: t.occurred_on, account_id: t.account_id, category_id: t.category_id, description: t.description ?? '' });
    }
    updateDraft<K extends keyof EditDraft>(key: K, value: EditDraft[K]) {
        this.editDraft.update(d => {
            if (!d) return null;
            if (key === 'kind' && d.kind !== value) return { ...d, kind: value as MovementKind, category_id: '' };
            return { ...d, [key]: value };
        });
    }
    closeEdit() { if (!this.busy()) this.editDraft.set(null); }
    async saveEdit() {
        const d = this.editDraft();
        if (!d) return;
        this.error.set(''); this.success.set('');
        if (!d.amount || !Number.isFinite(Number(d.amount)) || Number(d.amount) <= 0 || !d.occurred_on || !d.account_id ||
            !this.categories().some(c => c.id === d.category_id && c.kind === d.kind)) {
            this.error.set('Revisa els camps obligatoris i la categoria'); return;
        }
        this.busy.set(true);
        try {
            await this.f.updateTransaction(d.id, { kind: d.kind, amount: Number(d.amount), occurred_on: d.occurred_on, account_id: d.account_id, category_id: d.category_id, description: d.description });
            this.editDraft.set(null);
            await this.refresh(); this.notifySaved('Moviment actualitzat correctament');
        } catch (e: unknown) { this.error.set(this.errorMessage(e)); }
        finally { this.busy.set(false); }
    }
    async remove(id: string) {
        if (!confirm('Segur que vols eliminar aquest moviment?')) return;
        this.error.set(''); this.success.set('');
        try { await this.f.removeTransaction(id); await this.refresh(); this.notifySaved('Moviment eliminat'); }
        catch (e: unknown) { this.error.set(this.errorMessage(e)); }
    }
}
