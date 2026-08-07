import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DistanceUnit } from '../../../data/models/universe.models';
import { calculateMapScale, type MapScaleDefinition } from '../../../engine/camera/map-scale';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-map-scale',
  styleUrl: './map-scale.component.scss',
  templateUrl: './map-scale.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapScaleComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly scale = computed(() =>
    calculateMapScale(
      this.facade.cameraDistance(),
      this.facade.lodLevel(),
      Math.max(1, window.innerHeight),
    ),
  );

  protected scaleLabel(scale: MapScaleDefinition): string {
    const value = this.i18n.formatNumber(scale.value, 2);
    const labels = {
      meter: 'm',
      kilometer: 'km',
      'astronomical-unit': this.i18n.content().common.astronomicalUnit,
      'light-year': this.i18n.content().common.lightYear,
      parsec: 'pc',
      kiloparsec: 'kpc',
      megaparsec: 'Mpc',
    } as const satisfies Record<DistanceUnit, string>;

    return `${value} ${labels[scale.unit]}`;
  }
}
