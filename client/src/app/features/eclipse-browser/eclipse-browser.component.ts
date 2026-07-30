import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EarthEclipseEvent, EarthEclipseKind } from '../../../engine/simulation/earth-eclipse';
import { SOLAR_ECLIPSE_OBSERVER_LOCATIONS } from '../../../engine/simulation/solar-eclipse-locations';
import { formatUniverseClock, julianDayToDate } from '../../../engine/simulation/time-utils';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';

@Component({
  selector: 'app-eclipse-browser',
  styleUrl: './eclipse-browser.component.scss',
  templateUrl: './eclipse-browser.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EclipseBrowserComponent {
  protected readonly facade = inject(UniverseEngineFacade);
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

  protected changeLocation(event: Event): void {
    this.selectedLocationId.set((event.target as HTMLSelectElement).value);
  }

  protected eventTitle(event: EarthEclipseEvent): string {
    return `Éclipse ${event.family === 'lunar' ? 'lunaire' : 'solaire'} ${this.kindLabel(event.kind).toLowerCase()}`;
  }

  protected kindLabel(kind: EarthEclipseKind): string {
    const labels: Readonly<Record<EarthEclipseKind, string>> = {
      penumbral: 'Pénombrale',
      partial: 'Partielle',
      annular: 'Annulaire',
      total: 'Totale',
    };

    return labels[kind];
  }

  protected peakLabel(event: EarthEclipseEvent): string {
    return new Intl.DateTimeFormat('fr-FR', {
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
    return formatUniverseClock(event.peak, this.facade.browserTimeZone);
  }

  protected obscurationLabel(event: EarthEclipseEvent): string {
    if (event.obscuration === null) {
      return 'Visibilité selon le lieu';
    }

    return `${Math.round(event.obscuration * 100)} % occulté`;
  }

  protected durationLabel(event: EarthEclipseEvent): string | null {
    if (event.durationMinutes === null) {
      return null;
    }

    const hours = Math.floor(event.durationMinutes / 60);
    const minutes = Math.round(event.durationMinutes % 60);

    return hours > 0 ? `${hours} h ${minutes.toString().padStart(2, '0')}` : `${minutes} min`;
  }

  protected coordinatesLabel(event: EarthEclipseEvent): string {
    if (event.latitude === null || event.longitude === null) {
      return 'Point central calculé';
    }

    const latitudeSuffix = event.latitude >= 0 ? 'N' : 'S';
    const longitudeSuffix = event.longitude >= 0 ? 'E' : 'O';

    return `${Math.abs(event.latitude).toFixed(1)}° ${latitudeSuffix} · ${Math.abs(event.longitude).toFixed(1)}° ${longitudeSuffix}`;
  }
}
