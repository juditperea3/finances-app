import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackupService, ExportFile } from '../../core/services/backup.service';

type PreparedDownload = { url: string; filename: string; count: number; bytes: number };

@Component({
  selector: 'app-backups',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './backups.component.scss',
  template: `
    <div class="backups-page">
      <header class="page-heading">
        <p class="eyebrow">PRIVACITAT I DADES</p>
        <h1>Còpies de seguretat</h1>
        <p>Desa una còpia de les teves finances al dispositiu quan vulguis.</p>
      </header>

      <section class="intro" aria-label="Informació de privacitat">
        <span class="intro-icon" aria-hidden="true">🔒</span>
        <div>
          <strong>Les dades són privades</strong>
          <p>Els fitxers es generen al navegador amb les dades del teu usuari de Supabase.
            No s'envien a cap servei extern, però el fitxer descarregat contindrà dades financeres personals.</p>
        </div>
      </section>

      @if (error()) { <p class="notice notice--error" role="alert">{{ error() }}</p> }
      @if (loading()) { <p class="notice" role="status">{{ progress() }}</p> }

      <div class="export-grid">
        <article class="export-card">
          <div class="export-icon" aria-hidden="true">
            {{ '{' }} {{ '}' }}
          </div>
          <h2>Còpia completa · JSON</h2>
          <p>Inclou perfil, comptes, categories, moviments, transferències, recurrències,
            pressupostos, objectius i aportacions.</p>
          <div class="export-meta"><span>9 taules</span><span>Per conservar totes les dades</span></div>
          <button type="button" class="primary-action" (click)="prepareJson()" [disabled]="loading()">
            {{ loading() ? 'Preparant…' : 'Preparar còpia JSON' }}
          </button>
          @if (jsonDownload(); as f) {
            <div class="ready" role="status">
              <span>{{ f.count }} registres · {{ fileSize(f.bytes) }}</span>
              <a [href]="f.url" [attr.download]="f.filename" class="download-action">Descarregar JSON ↓</a>
            </div>
          }
        </article>

        <article class="export-card">
          <div class="export-icon" aria-hidden="true">▤</div>
          <h2>Historial de moviments · CSV</h2>
          <p>Inclou ingressos, despeses i transferències, amb data, import, comptes,
            categoria i concepte. Es pot obrir amb Excel o Google Sheets.</p>
          <div class="export-meta"><span>Separador ;</span><span>Format d'imports europeu</span></div>
          <button type="button" class="primary-action" (click)="prepareCsv()" [disabled]="loading()">
            {{ loading() ? 'Preparant…' : 'Preparar CSV' }}
          </button>
          @if (csvDownload(); as f) {
            <div class="ready" role="status">
              <span>{{ f.count }} moviments · {{ fileSize(f.bytes) }}</span>
              <a [href]="f.url" [attr.download]="f.filename" class="download-action">Descarregar CSV ↓</a>
            </div>
          }
        </article>
      </div>

      <section class="notice-panel">
        <h2>Abans de desar la còpia</h2>
        <p>Guarda el fitxer JSON en un lloc segur, com una carpeta privada xifrada.
          Aquesta versió només exporta: encara no incorpora la restauració automàtica.
          Les contrasenyes i les claus de Supabase no s'exporten.</p>
        <a routerLink="/mes">← Tornar a Més opcions</a>
      </section>
    </div>
  `
})
export class BackupsComponent implements OnDestroy {
  private readonly backups = inject(BackupService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly progress = signal('');
  readonly jsonDownload = signal<PreparedDownload | null>(null);
  readonly csvDownload = signal<PreparedDownload | null>(null);

  async prepareJson(): Promise<void> {
    await this.prepare('json');
  }

  async prepareCsv(): Promise<void> {
    await this.prepare('csv');
  }

  private async prepare(kind: 'json' | 'csv'): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.progress.set('Llegint les dades de Supabase…');
    this.clearFile(kind);
    try {
      const onProgress = (table: string, count: number) =>
        this.progress.set(`Llegint ${table}: ${count} registres`);
      const result = kind === 'json'
        ? await this.backups.prepareJson(onProgress)
        : await this.backups.prepareMovementsCsv(onProgress);
      this.setFile(kind, result);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Error en preparar la còpia');
    } finally {
      this.loading.set(false);
      this.progress.set('');
    }
  }

  private setFile(kind: 'json' | 'csv', file: ExportFile): void {
    const entry: PreparedDownload = {
      url: URL.createObjectURL(file.blob),
      filename: file.filename,
      count: file.recordCount,
      bytes: file.blob.size
    };
    if (kind === 'json') this.jsonDownload.set(entry);
    else this.csvDownload.set(entry);
  }

  private clearFile(kind: 'json' | 'csv'): void {
    const ref = kind === 'json' ? this.jsonDownload() : this.csvDownload();
    if (ref) URL.revokeObjectURL(ref.url);
    if (kind === 'json') this.jsonDownload.set(null);
    else this.csvDownload.set(null);
  }

  fileSize(bytes: number): string {
    return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
  }

  ngOnDestroy(): void {
    this.clearFile('json');
    this.clearFile('csv');
  }
}
