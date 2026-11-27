import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { QuickMovementComponent } from './shared/components/quick-movement.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, QuickMovementComponent],
  styleUrl: './app.scss',
  template: `
    @if (!isLogin()) {
      <header class="finance-header">
        <div class="finance-header-inner">
          <a class="finance-brand" routerLink="/" aria-label="Finances - Inici">
            <span class="brand-mark" aria-hidden="true">◉</span>
            <span>Finances</span>
          </a>

          <nav class="desktop-nav" aria-label="Navegació principal">
            <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }"
               routerLinkActive="active" ariaCurrentWhenActive="page">Inici</a>
            <a routerLink="/moviments" routerLinkActive="active" ariaCurrentWhenActive="page">Moviments</a>
            <a routerLink="/comptes" routerLinkActive="active" ariaCurrentWhenActive="page">Comptes</a>
            <a routerLink="/categories" routerLinkActive="active" ariaCurrentWhenActive="page">Categories</a>
            <a routerLink="/recurrents" routerLinkActive="active" ariaCurrentWhenActive="page">Recurrents</a>

            <details class="planning-menu" [class.active]="planningActive()" #planningMenu>
              <summary>Planificació <span aria-hidden="true">⌄</span></summary>
              <div class="planning-menu-links">
                <a routerLink="/pressupostos" routerLinkActive="active"
                   ariaCurrentWhenActive="page" (click)="planningMenu.open = false">Pressupostos</a>
                <a routerLink="/objectius" routerLinkActive="active"
                   ariaCurrentWhenActive="page" (click)="planningMenu.open = false">Objectius d'estalvi</a>
                <a routerLink="/copies" routerLinkActive="active"
                   ariaCurrentWhenActive="page" (click)="planningMenu.open = false">Còpies de seguretat</a>
              </div>
            </details>
          </nav>

          <div class="finance-actions">
            <button type="button" class="header-quick-add" (click)="openQuick()">
              <span aria-hidden="true">+</span> Nou moviment
            </button>
            <button type="button" class="icon-action" (click)="theme.toggle()"
              [attr.aria-label]="theme.dark() ? 'Activar tema clar' : 'Activar tema fosc'"
              [title]="theme.dark() ? 'Tema clar' : 'Tema fosc'">
              {{ theme.dark() ? '☀️' : '🌙' }}
            </button>
            <button type="button" class="logout-action" (click)="logout()" [disabled]="loggingOut()">
              <span aria-hidden="true">↪</span> Sortir
            </button>
          </div>
        </div>
      </header>
    }

    <main class="finance-main" [class.finance-main-login]="isLogin()">
      <router-outlet />
    </main>

    @if (!isLogin()) {
      <nav class="mobile-nav" aria-label="Navegació mòbil">
        <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }"
           routerLinkActive="active" ariaCurrentWhenActive="page">
          <span class="nav-symbol" aria-hidden="true">⌂</span>
          <span>Inici</span>
        </a>
        <a routerLink="/comptes" routerLinkActive="active" ariaCurrentWhenActive="page">
          <span class="nav-symbol" aria-hidden="true">▤</span>
          <span>Comptes</span>
        </a>
        <button type="button" class="add-nav" (click)="openQuick()" aria-label="Afegir moviment">
          <span class="add-circle" aria-hidden="true">+</span>
          <span>Afegir</span>
        </button>
        <a routerLink="/moviments" routerLinkActive="active" ariaCurrentWhenActive="page">
          <span class="nav-symbol" aria-hidden="true">⇄</span>
          <span>Moviments</span>
        </a>
        <a routerLink="/mes" [class.active]="moreActive()"
           [attr.aria-current]="currentPath() === '/mes' ? 'page' : null">
          <span class="nav-symbol" aria-hidden="true">☷</span>
          <span>Més</span>
        </a>
      </nav>
    }

    @if (quickOpen() && !isLogin()) {
      <app-quick-movement (closed)="closeQuick()" (saved)="onQuickSaved()" />
    }
  `
})
export class App {
  readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentPath = signal(this.cleanPath(this.router.url));
  readonly isLogin = computed(() => this.currentPath() === '/login');
  readonly planningActive = computed(() =>
    ['/pressupostos', '/objectius', '/copies'].includes(this.currentPath())
  );
  readonly moreActive = computed(() =>
    ['/mes', '/categories', '/recurrents', '/pressupostos', '/objectius', '/copies'].includes(this.currentPath())
  );
  readonly loggingOut = signal(false);
  readonly quickOpen = signal(false);

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe(event => {
      this.currentPath.set(this.cleanPath(event.urlAfterRedirects));
      this.quickOpen.set(false);
    });
  }

  private cleanPath(url: string): string {
    return url.split(/[?#]/)[0] || '/';
  }

  openQuick(): void {
    this.quickOpen.set(true);
  }

  closeQuick(): void {
    this.quickOpen.set(false);
  }

  onQuickSaved(): void {
    this.quickOpen.set(false);
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.quickOpen.set(false);
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      console.error('Error en tancar sessió', error);
    } finally {
      this.loggingOut.set(false);
    }
  }
}
