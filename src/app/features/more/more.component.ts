import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  styles: [`
    :host { display: block; }
    .more-eyebrow { color: var(--accent); font-size: .73rem; font-weight: 800; letter-spacing: .16em; margin-bottom: 10px; }
    .more-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; margin-top: 25px; }
    .more-link { display: flex; gap: 14px; align-items: center; background: var(--card); border: 1px solid var(--border); padding: 19px; border-radius: 17px; color: var(--text); min-width: 0; }
    .more-link:hover { border-color: var(--accent); }
    .more-icon { display: grid; place-items: center; flex: 0 0 43px; width: 43px; height: 43px; font-size: 1.4rem; border-radius: 12px; background: color-mix(in srgb, var(--accent) 11%, var(--card)); }
    .more-link strong { display: block; font-size: .97rem; }
    .more-link small { display: block; color: var(--muted); margin-top: 4px; line-height: 1.4; }
    @media(max-width:600px) { .more-grid { grid-template-columns: 1fr; gap: 10px; margin-top: 20px; } .more-link { padding: 15px; } }
  `],
  template: `
    <p class="more-eyebrow">ORGANITZACIÓ</p>
    <h1>Més opcions</h1>
    <p>Gestiona la planificació i la configuració de les teves finances.</p>
    <div class="more-grid">
      <a routerLink="/pressupostos" class="more-link"><span class="more-icon">📊</span><span><strong>Pressupostos</strong><small>Control mensual de les categories</small></span></a>
      <a routerLink="/objectius" class="more-link"><span class="more-icon">🎯</span><span><strong>Objectius d'estalvi</strong><small>Metes i aportacions</small></span></a>
      <a routerLink="/categories" class="more-link"><span class="more-icon">🏷️</span><span><strong>Categories</strong><small>Personalitza els tipus de moviment</small></span></a>
      <a routerLink="/recurrents" class="more-link"><span class="more-icon">🔁</span><span><strong>Recurrents</strong><small>Ingressos i despeses periòdiques</small></span></a>
      <a routerLink="/copies" class="more-link"><span class="more-icon">💾</span><span><strong>Còpies de seguretat</strong><small>Exporta les dades a JSON o CSV</small></span></a>
    </div>
  `
})
export class MoreComponent { }
