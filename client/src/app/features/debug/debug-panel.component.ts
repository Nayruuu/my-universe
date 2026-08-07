import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type ZoomDebugStatus } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-debug-panel',
  styleUrl: './debug-panel.component.scss',
  templateUrl: './debug-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugPanelComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);

  protected format(value: number): string {
    return Math.abs(value) >= 1_000 ? value.toExponential(2) : value.toFixed(2);
  }

  protected zoomStatus(status: ZoomDebugStatus): string {
    const debug = this.i18n.content().debug;
    const labels: Readonly<Record<ZoomDebugStatus, string>> = {
      applied: debug.statusApplied,
      minimum: debug.statusMinimum,
      maximum: debug.statusMaximum,
      ignored: debug.statusIgnored,
      unchanged: debug.statusUnchanged,
    };

    return labels[status];
  }

  protected milliseconds(value: number | null): string {
    return value === null ? '—' : `${this.format(value)} ms`;
  }

  protected preloadOutcome(value: boolean | null): string {
    return value === null ? '—' : value ? 'hit' : 'miss';
  }

  protected percentage(value: number | null): string {
    return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  }
}
