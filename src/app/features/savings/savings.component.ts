import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SavingsService } from '../../core/services/savings.service';
import {
  SavingsGoal, SavingsContribution, SavingsContributionKind, SavingsGoalInput
} from '../../core/models/savings.models';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type GoalsFilter = 'active' | 'completed' | 'all';
type GoalCard = {
  goal: SavingsGoal;
  saved: number;
  remaining: number;
  percent: number;
  barPercent: number;
  entries: SavingsContribution[];
};

@Component({
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, DecimalPipe],
  styleUrl: './savings.component.scss',
  template: `
    <section class="savings-heading">
      <div>
        <p class="savings-eyebrow">PLANIFICACIÓ</p>
        <h1>Objectius d'estalvi</h1>
        <p>Guarda les teves metes i segueix el progrés dels diners que hi reserves.</p>
      </div>
      <button type="button" class="savings-primary" (click)="startCreate()">+ Nou objectiu</button>
    </section>

    <p class="savings-note">Les aportacions són un registre de planificació: no fan cap càrrec ni transferència bancària.</p>
    @if (error()) { <p class="savings-alert savings-alert-error" role="alert">{{ error() }}</p> }
    @if (success()) { <p class="savings-alert savings-alert-success" role="status">{{ success() }}</p> }

    <section class="savings-stats" aria-label="Resum dels objectius actius">
      <article class="savings-stat">
        <span>Objectius actius</span>
        <strong>{{ activeCards().length }}</strong>
      </article>
      <article class="savings-stat">
        <span>Reservat per a objectius actius</span>
        <strong class="savings-positive">{{ activeSaved() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong>
      </article>
      <article class="savings-stat">
        <span>Pendent d'aconseguir</span>
        <strong>{{ activeRemaining() | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong>
      </article>
    </section>

    @if (showEditor()) {
      <section class="savings-panel savings-editor" aria-labelledby="savings-editor-title">
        <div class="savings-section-title">
          <h2 id="savings-editor-title">{{ editingId() ? 'Editar objectiu' : 'Crear un objectiu' }}</h2>
          <button type="button" class="savings-icon-button" (click)="closeEditor()" [disabled]="busy()" aria-label="Tancar formulari">✕</button>
        </div>
        <form class="savings-editor-grid" (ngSubmit)="saveGoal()">
          <label>Nom de l'objectiu
            <input name="title" type="text" maxlength="80" [(ngModel)]="draftTitle" placeholder="Ex. Viatge als Alps" required />
          </label>
          <label>Import objectiu (€)
            <input name="target" type="number" min="0.01" step="0.01" [(ngModel)]="draftTarget" placeholder="Ex. 2000" required />
          </label>
          <label>Data límit (opcional)
            <input name="date" type="date" [(ngModel)]="draftDate" />
          </label>
          <label>Icona
            <select name="icon" [(ngModel)]="draftIcon">
              <option value="🎯">🎯 Objectiu</option>
              <option value="🏔️">🏔️ Muntanya</option>
              <option value="✈️">✈️ Viatge</option>
              <option value="🚗">🚗 Cotxe</option>
              <option value="🏠">🏠 Casa</option>
              <option value="💻">💻 Tecnologia</option>
              <option value="💰">💰 Estalvi</option>
              <option value="🎁">🎁 Regal</option>
            </select>
          </label>
          <div class="savings-form-actions">
            <button type="button" class="savings-quiet" (click)="closeEditor()" [disabled]="busy()">Cancel·lar</button>
            <button type="submit" class="savings-primary" [disabled]="busy()">
              {{ busy() ? 'Guardant...' : editingId() ? 'Guardar canvis' : 'Crear objectiu' }}
            </button>
          </div>
        </form>
      </section>
    }

    <section class="savings-list-header">
      <div>
        <h2>Els meus objectius</h2>
        <span>{{ visibleCards().length }} objectius</span>
      </div>
      <div class="savings-filter" role="group" aria-label="Filtrar objectius">
        <button type="button" [class.selected]="filter() === 'active'" (click)="filter.set('active')">Actius</button>
        <button type="button" [class.selected]="filter() === 'completed'" (click)="filter.set('completed')">Completats</button>
        <button type="button" [class.selected]="filter() === 'all'" (click)="filter.set('all')">Tots</button>
      </div>
    </section>

    @if (loading()) {
      <div class="savings-panel savings-empty"><p>Carregant objectius...</p></div>
    } @else {
      <div class="savings-goals-grid">
        @for (card of visibleCards(); track card.goal.id) {
          <article class="savings-panel savings-goal-card" [class.savings-goal-complete]="card.goal.completed">
            <div class="savings-goal-top">
              <div class="savings-goal-title">
                <div class="savings-emoji" aria-hidden="true">{{ card.goal.icon }}</div>
                <div>
                  <h3>{{ card.goal.title }}</h3>
                  @if (card.goal.target_date) {
                    <small>Data límit: {{ card.goal.target_date | date:'dd MMM yyyy':'':'ca' }}</small>
                  } @else { <small>Sense data límit</small> }
                </div>
              </div>
              @if (card.goal.completed) { <span class="savings-complete-tag">Completat</span> }
            </div>

            <div class="savings-progress-numbers">
              <strong>{{ card.saved | currency:'EUR':'symbol':'1.2-2':'ca' }}</strong>
              <span>de {{ card.goal.target_amount | currency:'EUR':'symbol':'1.2-2':'ca' }}</span>
            </div>
            <div class="savings-progress-track" role="progressbar"
              [attr.aria-label]="'Progrés de ' + card.goal.title"
              [attr.aria-valuenow]="card.barPercent" aria-valuemin="0" aria-valuemax="100">
              <div class="savings-progress-fill" [style.width.%]="card.barPercent"></div>
            </div>
            <div class="savings-progress-caption">
              <span>{{ card.percent | number:'1.0-0':'ca' }}% aconseguit</span>
              @if (card.remaining > 0) { <span>Falten {{ card.remaining | currency:'EUR':'symbol':'1.2-2':'ca' }}</span> }
              @else { <span>Objectiu econòmic assolit!</span> }
            </div>

            @if (!card.goal.completed) {
              <div class="savings-goal-actions">
                <button type="button" class="savings-primary savings-action-small"
                  (click)="startContribution(card.goal.id, 'deposit')">+ Aportació</button>
                <button type="button" class="savings-quiet savings-action-small"
                  [disabled]="card.saved <= 0" (click)="startContribution(card.goal.id, 'withdrawal')">Retirar</button>
              </div>
            }

            @if (contributionGoalId() === card.goal.id) {
              <form class="savings-contribution-form" (ngSubmit)="saveContribution()">
                <div class="savings-section-title">
                  <h4>{{ contributionKind === 'deposit' ? 'Nova aportació' : 'Nova retirada' }}</h4>
                  <button type="button" class="savings-icon-button" (click)="closeContribution()" [disabled]="busy()" aria-label="Tancar">✕</button>
                </div>
                <label>Import (€)
                  <input name="contribution-amount" type="number" min="0.01" step="0.01"
                    [(ngModel)]="contributionAmount" required />
                </label>
                <label>Data
                  <input name="contribution-date" type="date" [(ngModel)]="contributionDate" required />
                </label>
                <label>Nota (opcional)
                  <input name="contribution-note" type="text" maxlength="300"
                    [(ngModel)]="contributionNote" placeholder="Ex. Estalvi del mes" />
                </label>
                <button type="submit" class="savings-primary" [disabled]="busy()">
                  {{ busy() ? 'Guardant...' : contributionKind === 'deposit' ? 'Guardar aportació' : 'Guardar retirada' }}
                </button>
              </form>
            }

            <div class="savings-activity">
              <strong>Últimes aportacions i retirades</strong>
              @for (entry of card.entries; track entry.id) {
                <div class="savings-entry">
                  <div><span>{{ entry.note || (entry.kind === 'deposit' ? 'Aportació' : 'Retirada') }}</span>
                    <small>{{ entry.occurred_on | date:'dd/MM/yyyy' }}</small>
                  </div>
                  <b [class.savings-withdrawal]="entry.kind === 'withdrawal'">
                    {{ entry.kind === 'deposit' ? '+' : '−' }}{{ entry.amount | currency:'EUR':'symbol':'1.2-2':'ca' }}
                  </b>
                </div>
              } @empty { <p>Encara no hi ha aportacions.</p> }
            </div>
            <div class="savings-card-footer">
              <button type="button" class="savings-text-action" (click)="startEdit(card.goal)" [disabled]="busy()">Editar</button>
              <button type="button" class="savings-text-action" (click)="toggleCompleted(card.goal)" [disabled]="busy()">
                {{ card.goal.completed ? 'Reobrir' : 'Marcar completat' }}
              </button>
              <button type="button" class="savings-text-action savings-danger" (click)="removeGoal(card.goal)" [disabled]="busy()">Eliminar</button>
            </div>
          </article>
        } @empty {
          <div class="savings-panel savings-empty">
            <div class="savings-empty-icon" aria-hidden="true">🎯</div>
            <h3>No hi ha objectius en aquesta vista</h3>
            <p>Crea'n un de nou o canvia el filtre per consultar els altres objectius.</p>
            <button type="button" class="savings-primary" (click)="startCreate()">+ Crear objectiu</button>
          </div>
        }
      </div>
    }
  `
})
export class SavingsComponent implements OnInit {
  private readonly savings = inject(SavingsService);
  readonly goals = signal<SavingsGoal[]>([]);
  readonly contributions = signal<SavingsContribution[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly filter = signal<GoalsFilter>('active');
  readonly showEditor = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly contributionGoalId = signal<string | null>(null);

  draftTitle = '';
  draftTarget: number | null = null;
  draftDate = '';
  draftIcon = '🎯';

  contributionKind: SavingsContributionKind = 'deposit';
  contributionAmount: number | null = null;
  contributionDate = localToday();
  contributionNote = '';

  readonly cards = computed<GoalCard[]>(() => {
    const allEntries = this.contributions();
    return this.goals().map(goal => {
      const entries = allEntries.filter(c => c.goal_id === goal.id);
      const saved = Math.round(entries.reduce((sum, entry) =>
        sum + (entry.kind === 'deposit' ? 1 : -1) * Number(entry.amount), 0) * 100) / 100;
      const target = Number(goal.target_amount);
      const percent = target > 0 ? saved / target * 100 : 0;
      const remaining = Math.max(0, Math.round((target - saved) * 100) / 100);
      return {
        goal, saved, remaining, percent,
        barPercent: Math.min(100, Math.max(0, percent)),
        entries: [...entries].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)).slice(0, 3)
      };
    });
  });
  readonly activeCards = computed(() => this.cards().filter(c => !c.goal.completed));
  readonly activeSaved = computed(() => this.activeCards().reduce((s, c) => s + c.saved, 0));
  readonly activeRemaining = computed(() => this.activeCards().reduce((s, c) => s + c.remaining, 0));
  readonly visibleCards = computed(() => this.cards().filter(c =>
    this.filter() === 'all' || (this.filter() === 'active' ? !c.goal.completed : c.goal.completed)));

  async ngOnInit(): Promise<void> { await this.refresh(); }

  async refresh(): Promise<void> {
    try {
      const [goals, contributions] = await Promise.all([this.savings.goals(), this.savings.contributions()]);
      this.goals.set(goals);
      this.contributions.set(contributions);
    } catch (e: unknown) {
      this.error.set(this.errorMessage(e));
    } finally { this.loading.set(false); }
  }

  startCreate(): void {
    this.resetNotices();
    this.editingId.set(null);
    this.draftTitle = '';
    this.draftTarget = null;
    this.draftDate = '';
    this.draftIcon = '🎯';
    this.showEditor.set(true);
    this.contributionGoalId.set(null);
  }

  startEdit(goal: SavingsGoal): void {
    this.resetNotices();
    this.editingId.set(goal.id);
    this.draftTitle = goal.title;
    this.draftTarget = Number(goal.target_amount);
    this.draftDate = goal.target_date ?? '';
    this.draftIcon = goal.icon;
    this.showEditor.set(true);
    this.contributionGoalId.set(null);
  }

  closeEditor(): void {
    if (!this.busy()) { this.showEditor.set(false); this.editingId.set(null); }
  }

  async saveGoal(): Promise<void> {
    this.resetNotices();
    const title = this.draftTitle.trim();
    const target = Number(this.draftTarget);
    if (!title || title.length > 80 || !Number.isFinite(target) || target <= 0) {
      this.error.set('Introdueix un nom i un import objectiu superior a zero.'); return;
    }
    const input: SavingsGoalInput = {
      title, icon: this.draftIcon, target_amount: Math.round(target * 100) / 100,
      target_date: this.draftDate || null
    };
    this.busy.set(true);
    try {
      const id = this.editingId();
      if (id) await this.savings.updateGoal(id, input);
      else await this.savings.createGoal(input);
      await this.refresh();
      this.showEditor.set(false); this.editingId.set(null);
      this.filter.set('active');
      this.success.set(id ? 'Objectiu actualitzat correctament.' : 'Objectiu creat correctament.');
    } catch (e: unknown) { this.error.set(this.errorMessage(e)); }
    finally { this.busy.set(false); }
  }

  startContribution(id: string, kind: SavingsContributionKind): void {
    this.resetNotices();
    this.showEditor.set(false);
    this.contributionGoalId.set(id);
    this.contributionKind = kind;
    this.contributionAmount = null;
    this.contributionNote = '';
    this.contributionDate = localToday();
  }

  closeContribution(): void {
    if (!this.busy()) this.contributionGoalId.set(null);
  }

  async saveContribution(): Promise<void> {
    this.resetNotices();
    const goalId = this.contributionGoalId();
    const amount = Number(this.contributionAmount);
    const current = this.cards().find(c => c.goal.id === goalId);
    if (!goalId || !current || current.goal.completed) {
      this.error.set('Selecciona un objectiu actiu.'); return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || !this.contributionDate) {
      this.error.set('Introdueix un import i una data vàlids.'); return;
    }
    const rounded = Math.round(amount * 100) / 100;
    if (rounded <= 0) { this.error.set('L’import mínim és 0,01 €.'); return; }
    if (this.contributionKind === 'withdrawal' && rounded > current.saved) {
      this.error.set('No pots retirar més del que has reservat per a aquest objectiu.'); return;
    }
    this.busy.set(true);
    try {
      await this.savings.addContribution({
        goal_id: goalId, kind: this.contributionKind, amount: rounded,
        occurred_on: this.contributionDate, note: this.contributionNote.trim()
      });
      await this.refresh();
      this.contributionGoalId.set(null);
      this.success.set(this.contributionKind === 'deposit' ? 'Aportació guardada.' : 'Retirada guardada.');
    } catch (e: unknown) { this.error.set(this.errorMessage(e)); }
    finally { this.busy.set(false); }
  }

  async toggleCompleted(goal: SavingsGoal): Promise<void> {
    this.resetNotices();
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.savings.setCompleted(goal.id, !goal.completed);
      await this.refresh();
      this.success.set(goal.completed ? 'Objectiu reobert.' : 'Objectiu marcat com a completat.');
    } catch (e: unknown) { this.error.set(this.errorMessage(e)); }
    finally { this.busy.set(false); }
  }

  async removeGoal(goal: SavingsGoal): Promise<void> {
    if (!confirm(`Eliminar l'objectiu «${goal.title}» i tot el seu historial d'aportacions? Aquesta acció no es pot desfer.`)) return;
    this.resetNotices();
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.savings.deleteGoal(goal.id);
      await this.refresh();
      this.success.set('Objectiu eliminat.');
    } catch (e: unknown) { this.error.set(this.errorMessage(e)); }
    finally { this.busy.set(false); }
  }

  private resetNotices(): void { this.error.set(''); this.success.set(''); }
  private errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === 'object' && e !== null && 'message' in e) return String(e.message);
    return 'S’ha produït un error. Torna-ho a provar.';
  }
}
