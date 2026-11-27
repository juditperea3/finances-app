import { Component, EventEmitter, HostListener, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { FinanceUpdatesService } from '../../core/services/finance-updates.service';
import { Account, Category, MovementKind } from '../../core/models/finance.models';

@Component({
  selector: 'app-quick-movement',
  standalone: true,
  imports: [FormsModule],
  styleUrl: './quick-movement.component.scss',
  template: `
    <div class="quick-backdrop" (click)="closed.emit()">
      <section class="quick-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-title" (click)="$event.stopPropagation()">
        <header class="quick-header">
          <div>
            <span class="eyebrow">REGISTRE RÀPID</span>
            <h2 id="quick-title">Nou moviment</h2>
          </div>
          <button type="button" class="close-button" (click)="closed.emit()" aria-label="Tancar">✕</button>
        </header>

        @if (loading()) {
          <p class="status">Carregant comptes i categories...</p>
        } @else {
          <form (ngSubmit)="save()" #movementForm="ngForm">
            <div class="kind-switch" aria-label="Tipus de moviment">
              <button type="button" [class.active]="kind==='expense'" (click)="changeKind('expense')">− Despesa</button>
              <button type="button" [class.active]="kind==='income'" (click)="changeKind('income')">+ Ingrés</button>
              <button type="button" [class.active]="kind==='transfer'" (click)="changeKind('transfer')">↔ Traspàs</button>
            </div>

            <label class="amount-label" for="quick-amount">Import</label>
            <div class="amount-field">
              <input id="quick-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01"
                [ngModel]="amount" (ngModelChange)="amount=$event" placeholder="0,00" required autofocus />
              <span>€</span>
            </div>

            <div class="quick-grid">
              <label>Compte origen
                <select name="account" [(ngModel)]="account_id" required>
                  <option value="">Selecciona un compte</option>
                  @for (account of accounts(); track account.id) {
                    <option [value]="account.id">{{ account.name }}</option>
                  }
                </select>
              </label>
              @if (kind === 'transfer') {
                <label>Compte destí
                  <select name="to" [(ngModel)]="to_account_id" required>
                    <option value="">Selecciona un compte</option>
                    @for (account of accounts(); track account.id) {
                      <option [value]="account.id" [disabled]="account.id === account_id">{{ account.name }}</option>
                    }
                  </select>
                </label>
              } @else {
                <label>Categoria
                  <select name="category" [(ngModel)]="category_id" required>
                    <option value="">Selecciona una categoria</option>
                    @for (category of categories(); track category.id) {
                      @if (category.kind === kind) {
                        <option [value]="category.id">{{ category.name }}</option>
                      }
                    }
                  </select>
                </label>
              }
              <label>Data
                <input name="date" type="date" [(ngModel)]="date" required />
              </label>
              <label>Concepte <span class="optional">(opcional)</span>
                <input name="description" [(ngModel)]="description" maxlength="180" placeholder="Ex. Supermercat" />
              </label>
            </div>

            @if (error()) { <p class="error-message" role="alert">{{ error() }}</p> }
            @if (!accounts().length) { <p class="hint">Primer has de crear un compte a la secció Comptes.</p> }
            <div class="quick-actions">
              <button type="button" class="cancel" (click)="closed.emit()">Cancel·lar</button>
              <button type="submit" class="save" [disabled]="busy() || !accounts().length || !movementForm.valid">
                {{ busy() ? 'Guardant...' : 'Guardar moviment' }}
              </button>
            </div>
          </form>
        }
      </section>
    </div>
  `
})
export class QuickMovementComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  private readonly finance = inject(FinanceService);
  private readonly updates = inject(FinanceUpdatesService);
  readonly accounts = signal<Account[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  kind: MovementKind | 'transfer' = 'expense';
  amount: number | null = null;
  date = this.todayLocal();
  account_id = '';
  to_account_id = '';
  category_id = '';
  description = '';

  @HostListener('document:keydown.escape') onEscape() { if (!this.busy()) this.closed.emit(); }

  async ngOnInit(): Promise<void> {
    try {
      const [accounts, categories] = await Promise.all([this.finance.accounts(), this.finance.categories()]);
      this.accounts.set(accounts);
      this.categories.set(categories);
      const previous = localStorage.getItem('finances:last-account');
      this.account_id = accounts.find(a => a.id === previous)?.id ?? accounts[0]?.id ?? '';
    } catch (e: unknown) {
      this.error.set(this.errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  changeKind(kind: MovementKind | 'transfer') {
    this.kind = kind;
    this.category_id = '';
    this.to_account_id = '';
    this.error.set('');
  }

  async save(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    const amount = Number(this.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !this.date || !this.account_id) {
      this.error.set('Introdueix un import vàlid, una data i un compte.');
      return;
    }
    if (this.kind === 'transfer') {
      if (!this.to_account_id || this.to_account_id === this.account_id) {
        this.error.set('El compte de destí ha de ser diferent del d’origen.');
        return;
      }
    } else if (!this.category_id || !this.categories().some(c => c.id === this.category_id && c.kind === this.kind)) {
      this.error.set('Selecciona una categoria vàlida.');
      return;
    }

    this.busy.set(true);
    try {
      if (this.kind === 'transfer') {
        await this.finance.addTransfer({
          amount, occurred_on: this.date, description: this.description.trim(),
          from_account_id: this.account_id, to_account_id: this.to_account_id
        });
      } else {
        await this.finance.addTransaction({
          amount, occurred_on: this.date, description: this.description.trim(),
          account_id: this.account_id, category_id: this.category_id, kind: this.kind
        });
      }
      localStorage.setItem('finances:last-account', this.account_id);
      this.updates.notify();
      this.saved.emit();
    } catch (e: unknown) {
      this.error.set(this.errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private todayLocal(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : 'No s’ha pogut completar l’operació.';
  }
}
