import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GraphicQuality, LabelDensity, TemporalMode } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';

@Component({
  selector: 'app-floating-controls',
  styleUrl: './floating-controls.component.scss',
  templateUrl: './floating-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingControlsComponent {
  protected readonly facade = inject(UniverseEngineFacade);

  protected focus(objectId: string): void {
    void this.facade.focus(objectId);
  }

  protected setQuality(value: string): void {
    this.facade.setQuality(value as GraphicQuality);
  }

  protected setDensity(value: string): void {
    this.facade.setLabelDensity(value as LabelDensity);
  }

  protected setMode(value: string): void {
    this.facade.setTemporalMode(value as TemporalMode);
  }

  protected changeMode(event: Event): void {
    this.setMode((event.target as HTMLSelectElement).value);
  }

  protected changeDensity(event: Event): void {
    this.setDensity((event.target as HTMLSelectElement).value);
  }
}
