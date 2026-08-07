import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  type RenderingPrewarmOperationStats,
  type ZoomDebugStatus,
} from '../../../data/models/universe.models';
import type { NavigationDebugCopyResult } from '../../core/engine/navigation-debug-report';
import type { MilkyWayReviewStop } from '../../core/engine/milky-way-review-stops';
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
  protected readonly traceNotice = signal<string | null>(null);
  protected readonly reviewNotice = signal<string | null>(null);
  protected readonly reviewPlaying = computed(() => this.facade.milkyWayReviewPlaying());
  protected readonly reviewStop = computed(() => this.facade.milkyWayReviewStop());

  protected async copyNavigationTrace(): Promise<void> {
    const result = await this.facade.copyNavigationDebugTrace();
    const debug = this.i18n.content().debug;
    const notices: Readonly<Record<NavigationDebugCopyResult, string>> = {
      copied: debug.navigationTraceCopied,
      empty: debug.navigationTraceEmpty,
      failed: debug.navigationTraceCopyFailed,
    };

    this.traceNotice.set(notices[result]);
  }

  protected clearNavigationTrace(): void {
    this.facade.clearNavigationDebugTrace();
    this.traceNotice.set(this.i18n.content().debug.navigationTraceCleared);
  }

  /**
   * Event handlers must return synchronously so Angular can paint the current stop while the
   * engine advances the camera in the background.
   */
  protected startMilkyWayReview(): void {
    this.reviewNotice.set(null);
    void this.playMilkyWayReview();
  }

  protected async playMilkyWayReview(): Promise<void> {
    const result = await this.facade.playMilkyWayReview();
    const debug = this.i18n.content().debug;
    const notices = {
      completed: debug.milkyWayReviewCompleted,
      interrupted: debug.milkyWayReviewInterrupted,
      failed: debug.milkyWayReviewFailed,
    } as const;

    this.reviewNotice.set(notices[result]);
  }

  protected async copyMilkyWayReviewUrl(): Promise<void> {
    const result = await this.facade.copyMilkyWayReviewUrl();
    const debug = this.i18n.content().debug;

    this.reviewNotice.set(
      result === 'copied' ? debug.milkyWayReviewUrlCopied : debug.milkyWayReviewUrlCopyFailed,
    );
  }

  protected reviewStopLabel(stop: MilkyWayReviewStop): string {
    return this.i18n.content().debug[stop.labelKey];
  }

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

  protected renderingPrewarmStatus(status: RenderingPrewarmOperationStats['status']): string {
    const debug = this.i18n.content().debug;
    const labels: Readonly<Record<RenderingPrewarmOperationStats['status'], string>> = {
      idle: debug.renderingPrewarmIdle,
      running: debug.renderingPrewarmRunning,
      ready: debug.renderingPrewarmReady,
      failed: debug.renderingPrewarmFailed,
    };

    return labels[status];
  }

  protected percentage(value: number | null): string {
    return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  }
}
