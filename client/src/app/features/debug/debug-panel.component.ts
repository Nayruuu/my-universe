import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type ZoomDebugStatus } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';

const ZOOM_STATUS_LABELS: Record<ZoomDebugStatus, string> = {
  applied: 'appliqué',
  minimum: 'limite minimale',
  maximum: 'limite maximale',
  ignored: 'ignoré',
  unchanged: 'sans déplacement',
};

@Component({
  selector: 'app-debug-panel',
  styleUrl: './debug-panel.component.scss',
  templateUrl: './debug-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugPanelComponent {
  protected readonly facade = inject(UniverseEngineFacade);

  protected format(value: number): string {
    return Math.abs(value) >= 1_000 ? value.toExponential(2) : value.toFixed(2);
  }

  protected zoomStatus(status: ZoomDebugStatus): string {
    return ZOOM_STATUS_LABELS[status];
  }
}
