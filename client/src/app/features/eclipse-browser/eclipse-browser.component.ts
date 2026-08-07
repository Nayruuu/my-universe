import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EarthEclipseEvent, EarthEclipseKind } from '../../../engine/simulation/earth-eclipse';
import { SOLAR_ECLIPSE_OBSERVER_LOCATIONS } from '../../../engine/simulation/solar-eclipse-locations';
import { formatUniverseClock, julianDayToDate } from '../../../engine/simulation/time-utils';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-eclipse-browser',
  styleUrl: './eclipse-browser.component.scss',
  templateUrl: './eclipse-browser.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EclipseBrowserComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly observerLocations = SOLAR_ECLIPSE_OBSERVER_LOCATIONS;
  protected readonly selectedLocationId = signal('paris');
  protected readonly selectedLocation = computed(
    () =>
      this.observerLocations.find((location) => location.id === this.selectedLocationId()) ??
      this.observerLocations[0]!,
  );

  protected view(event: EarthEclipseEvent): void {
    void this.facade.viewEarthEclipse(event);
  }

  protected viewLocal(event: EarthEclipseEvent): void {
    void this.facade.viewLocalSolarEclipse(event, this.selectedLocation());
  }

  protected observe(event: EarthEclipseEvent): void {
    this.facade.observeEarthEclipse(event);
  }

  protected browseEarlier(): void {
    this.facade.browseEarlierEclipses();
  }

  protected browseLater(): void {
    this.facade.browseLaterEclipses();
  }

  protected returnToCurrent(): void {
    this.facade.returnToCurrentEclipses();
  }

  protected changeLocation(event: Event): void {
    this.selectedLocationId.set((event.target as HTMLSelectElement).value);
  }

  protected eventTitle(event: EarthEclipseEvent): string {
    const text = this.i18n.content().eclipses;

    return this.i18n.interpolate(text.eventTitle, {
      family: event.family === 'lunar' ? text.lunar : text.solar,
      kind: text[event.kind],
    });
  }

  protected kindLabel(kind: EarthEclipseKind): string {
    const label = this.i18n.content().eclipses[kind];

    return `${label.charAt(0).toLocaleUpperCase(this.i18n.locale())}${label.slice(1)}`;
  }

  protected peakLabel(event: EarthEclipseEvent): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    }).format(julianDayToDate(event.peak.julianDay));
  }

  protected localPeakLabel(event: EarthEclipseEvent): string {
    return formatUniverseClock(event.peak, this.facade.browserTimeZone, this.i18n.locale());
  }

  protected obscurationLabel(event: EarthEclipseEvent): string {
    if (event.obscuration === null) {
      return this.i18n.content().eclipses.visibilityByLocation;
    }

    return this.i18n.interpolate(this.i18n.content().eclipses.obscured, {
      value: Math.round(event.obscuration * 100),
    });
  }

  protected durationLabel(event: EarthEclipseEvent): string | null {
    if (event.durationMinutes === null) {
      return null;
    }

    const hours = Math.floor(event.durationMinutes / 60);
    const minutes = Math.round(event.durationMinutes % 60);

    const common = this.i18n.content().common;

    return hours > 0
      ? `${hours} ${common.hoursShort} ${minutes.toString().padStart(2, '0')}`
      : `${minutes} ${common.minutesShort}`;
  }

  protected coordinatesLabel(event: EarthEclipseEvent): string {
    if (event.latitude === null || event.longitude === null) {
      return this.i18n.content().eclipses.centralPoint;
    }

    const latitudeSuffix = event.latitude >= 0 ? 'N' : 'S';
    const longitudeSuffix = event.longitude >= 0 ? 'E' : this.i18n.content().common.west;

    return `${Math.abs(event.latitude).toFixed(1)}° ${latitudeSuffix} · ${Math.abs(event.longitude).toFixed(1)}° ${longitudeSuffix}`;
  }
}
