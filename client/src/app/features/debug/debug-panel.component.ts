import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';

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
}
