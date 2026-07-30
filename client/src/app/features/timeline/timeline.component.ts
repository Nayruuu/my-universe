import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TemporalMode } from '../../../data/models/universe.models';
import { EarthEclipseEvent, EarthEclipseKind } from '../../../engine/simulation/earth-eclipse';
import { currentUniverseTime, formatUniverseDate } from '../../../engine/simulation/time-utils';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { TIME_SPEED_OPTIONS } from '../../core/settings/time-speeds';
import { EclipseBrowserComponent } from '../eclipse-browser/eclipse-browser.component';

@Component({
  selector: 'app-timeline',
  styleUrl: './timeline.component.scss',
  templateUrl: './timeline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EclipseBrowserComponent],
})
export class TimelineComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly speeds = TIME_SPEED_OPTIONS;
  protected readonly presentJulianDay = currentUniverseTime().julianDay;
  protected readonly timelineOffset = computed(() =>
    Math.max(
      -3_652.5,
      Math.min(3_652.5, this.facade.currentTime().julianDay - this.presentJulianDay),
    ),
  );
  protected readonly epochLabel = computed(() => formatUniverseDate(this.facade.currentTime()));

  protected changeDateTime(event: Event): void {
    this.facade.setDateTime((event.target as HTMLInputElement).value);
  }

  protected changeSpeed(event: Event): void {
    this.facade.setSpeed(Number((event.target as HTMLSelectElement).value));
  }

  protected changeTimeline(event: Event): void {
    const dayOffset = Number((event.target as HTMLInputElement).value);

    this.facade.setTime({ julianDay: this.presentJulianDay + dayOffset });
  }

  protected changeMode(event: Event): void {
    this.facade.setTemporalMode((event.target as HTMLSelectElement).value as TemporalMode);
  }

  protected centerSolarShadow(event: EarthEclipseEvent): void {
    void this.facade.viewEarthEclipse(event);
  }

  protected observeSolarEclipse(event: EarthEclipseEvent): void {
    this.facade.observeEarthEclipse(event);
  }

  protected eclipseKindLabel(kind: EarthEclipseKind): string {
    const labels: Readonly<Record<EarthEclipseKind, string>> = {
      penumbral: 'pénombrale',
      partial: 'partielle',
      annular: 'annulaire',
      total: 'totale',
    };

    return labels[kind];
  }
}
