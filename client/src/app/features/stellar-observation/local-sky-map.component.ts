import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { projectHorizontalSky } from '../../../engine/coordinates/horizontal-sky-projection';
import type { CompassDirection } from '../../../engine/simulation/stellar-observation';
import { I18nService } from '../../core/i18n/i18n.service';

const SKY_DISC_RADIUS_PERCENT = 39;

@Component({
  selector: 'app-local-sky-map',
  styleUrl: './local-sky-map.component.scss',
  templateUrl: './local-sky-map.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalSkyMapComponent {
  public readonly targetName = input.required<string>();
  public readonly altitudeDegrees = input.required<number>();
  public readonly azimuthDegrees = input.required<number>();

  protected readonly i18n = inject(I18nService);
  protected readonly projection = computed(() =>
    projectHorizontalSky(this.altitudeDegrees(), this.azimuthDegrees()),
  );
  protected readonly targetXPercent = computed(
    () => 50 + this.projection().x * SKY_DISC_RADIUS_PERCENT,
  );
  protected readonly targetYPercent = computed(
    () => 50 + this.projection().y * SKY_DISC_RADIUS_PERCENT,
  );
  protected readonly azimuthStyle = computed(() => `${this.azimuthDegrees()}deg`);
  protected readonly mapAriaLabel = computed(() => {
    const text = this.i18n.content().stellarObservation;
    const status = this.projection().isAboveHorizon ? text.aboveHorizon : text.belowHorizon;

    return this.i18n.interpolate(text.skyMapAria, {
      name: this.targetName(),
      altitude: this.i18n.formatNumber(this.altitudeDegrees(), 1),
      azimuth: this.i18n.formatNumber(this.azimuthDegrees(), 1),
      status,
    });
  });

  protected directionInitial(direction: CompassDirection): string {
    return this.i18n.content().stellarObservation.directions[direction].slice(0, 1);
  }
}
