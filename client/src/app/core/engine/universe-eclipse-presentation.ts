import { type SolarEclipseState, type UniverseTime } from '../../../data/models/universe.models';
import { type EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import { formatUniverseClock } from '../../../engine/simulation/time-utils';
import { type AppContent } from '../i18n/i18n.service';

export interface UniverseEclipsePresentationContext {
  readonly browserTimeZone: string;
  readonly getContent: () => AppContent;
  readonly getLocale: () => string;
  readonly interpolate: (
    template: string,
    values: Readonly<Record<string, string | number>>,
  ) => string;
  readonly formatNumber: (value: number, maximumFractionDigits: number) => string;
}

export class UniverseEclipsePresenter {
  constructor(private readonly context: UniverseEclipsePresentationContext) {}

  public createCurrentEvent(
    state: SolarEclipseState,
    time: UniverseTime,
  ): EarthEclipseEvent | null {
    if (state.phase === 'none') {
      return null;
    }

    return {
      id: `solar-current-${Math.round(time.julianDay * 1_440)}`,
      family: 'solar',
      kind: state.phase,
      scope: 'instant',
      peak: time,
      obscuration: null,
      durationMinutes: null,
      latitude: state.centralLatitude,
      longitude: state.centralLongitude,
      observerName: null,
      observerTimeZone: null,
      sunAltitudeDegrees: null,
    };
  }

  public selectTimelineEvent(
    current: EarthEclipseEvent | null,
    active: EarthEclipseEvent | null,
  ): EarthEclipseEvent | null {
    if (!current) {
      return null;
    }

    return active && Math.abs(active.peak.julianDay - current.peak.julianDay) < 0.5
      ? active
      : current;
  }

  public formatObserverLocation(event: EarthEclipseEvent | null): string {
    const content = this.context.getContent();
    const coordinates = event
      ? formatCoordinates(
          event.latitude,
          event.longitude,
          content.facade.centralPointCalculated,
          content.common.west,
        )
      : content.facade.centralPoint;

    return event?.observerName ? `${event.observerName} · ${coordinates}` : coordinates;
  }

  public formatContextLabel(observerActive: boolean, event: EarthEclipseEvent | null): string {
    const facade = this.context.getContent().facade;

    if (observerActive) {
      return facade.localObservation;
    }
    if (event?.scope === 'local') {
      return this.context.interpolate(facade.localMaximum, {
        location: event.observerName ?? facade.chosenLocation,
      });
    }

    return event?.scope === 'global' ? facade.globalMaximum : facade.phenomenonCurrent;
  }

  public formatLocalSummary(event: EarthEclipseEvent | null): string | null {
    if (event?.scope !== 'local') {
      return null;
    }
    const facade = this.context.getContent().facade;
    const obscuration =
      event.obscuration === null
        ? facade.obscurationUnavailable
        : this.context.interpolate(facade.obscured, {
            value: this.context.formatNumber(event.obscuration * 100, 1),
          });
    const clock = formatUniverseClock(
      event.peak,
      event.observerTimeZone ?? this.context.browserTimeZone,
      this.context.getLocale(),
    );
    const altitude =
      event.sunAltitudeDegrees === null
        ? ''
        : ` · ${this.context.interpolate(facade.sunAltitude, {
            value: this.context.formatNumber(event.sunAltitudeDegrees, 1),
          })}`;

    return `${obscuration} · ${clock}${altitude}`;
  }
}

function formatCoordinates(
  latitude: number | null,
  longitude: number | null,
  centralPoint: string,
  west: string,
): string {
  if (latitude === null || longitude === null) {
    return centralPoint;
  }

  const latitudeSuffix = latitude >= 0 ? 'N' : 'S';
  const longitudeSuffix = longitude >= 0 ? 'E' : west;

  return `${Math.abs(latitude).toFixed(1)}° ${latitudeSuffix} · ${Math.abs(longitude).toFixed(1)}° ${longitudeSuffix}`;
}
