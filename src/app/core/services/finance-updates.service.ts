import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FinanceUpdatesService {
  readonly version = signal(0);
  notify() { this.version.update(value => value + 1); }
}
