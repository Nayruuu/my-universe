import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { StellarObservation } from '../../../engine/simulation/stellar-observation';
import { I18nService } from '../../core/i18n/i18n.service';
import { EarthCityscapeComponent } from './earth-cityscape.component';
import {
  createEarthHorizonProfile,
  type EarthHorizonPerspective,
  projectEarthHorizonLandmark,
} from './earth-horizon-profile';
import type { EarthSkyViewPhase } from './earth-sky-view-state';
import { earthTerrainObstructionDegrees } from './earth-terrain-horizon-catalog';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';
import { projectEarthTerrainHorizon } from './earth-terrain-horizon-projection';

@Component({
  selector: 'app-earth-horizon',
  styleUrl: './earth-horizon.component.scss',
  templateUrl: './earth-horizon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EarthCityscapeComponent],
})
export class EarthHorizonComponent {
  public readonly location = input.required<EarthObserverLocation>();
  public readonly observation = input.required<StellarObservation>();
  public readonly phase = input.required<EarthSkyViewPhase>();
  public readonly horizonPosition = input.required<string>();
  public readonly perspective = input.required<EarthHorizonPerspective>();
  public readonly terrainHorizon = input<EarthTerrainHorizonProfile | null>(null);
  protected readonly i18n = inject(I18nService);
  protected readonly profile = computed(() => createEarthHorizonProfile(this.location()));
  protected readonly landmark = computed(() => {
    const landmark = this.profile().landmark;

    return landmark ? projectEarthHorizonLandmark(landmark, this.perspective()) : null;
  });
  protected readonly terrainProjection = computed(() => {
    const terrainHorizon = this.terrainHorizon();

    return terrainHorizon ? projectEarthTerrainHorizon(terrainHorizon, this.perspective()) : null;
  });
  protected readonly terrainObstructionDegrees = computed(() => {
    const terrainHorizon = this.terrainHorizon();

    return terrainHorizon
      ? earthTerrainObstructionDegrees(terrainHorizon, this.observation().azimuthDegrees)
      : null;
  });
}
