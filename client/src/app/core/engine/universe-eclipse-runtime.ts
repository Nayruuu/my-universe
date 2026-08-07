import type { UniverseTime } from '../../../data/models/universe.models';
import type { EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import type { SolarEclipseObserverLocation } from '../../../engine/simulation/solar-eclipse-locations';

const ECLIPSE_PAGE_SIZE = 8;
const PAGE_BOUNDARY_OFFSET_DAYS = 1 / 86_400;

export interface UniverseEclipseCatalogModule {
  findEarthEclipsePage(
    reference: UniverseTime,
    count: number,
    direction: 'past' | 'future',
  ): readonly EarthEclipseEvent[];
}

export interface UniverseLocalEclipseModule {
  calculateLocalSolarEclipse(
    event: EarthEclipseEvent,
    location: SolarEclipseObserverLocation,
  ): EarthEclipseEvent;
}

export type UniverseEclipseCatalogLoader = () => Promise<UniverseEclipseCatalogModule>;
export type UniverseLocalEclipseLoader = () => Promise<UniverseLocalEclipseModule>;

export interface UniverseEclipseRuntimeEngine {
  setPlaying(playing: boolean): void;
  setTime(time: UniverseTime): void;
  viewSolarEclipse(event: EarthEclipseEvent): void;
  observeSolarEclipse(event: EarthEclipseEvent): void;
  setSolarEclipsePathVisible(event: EarthEclipseEvent, visible: boolean): void;
  clearSolarEclipsePresentation(): void;
}

export interface UniverseEclipseRuntimeBindings {
  getCurrentTime(): UniverseTime;
  getUpcomingEclipses(): readonly EarthEclipseEvent[];
  getActiveSolarEclipse(): EarthEclipseEvent | null;
  getCurrentSolarEclipse(): EarthEclipseEvent | null;
  isSolarPathVisible(): boolean;
  setUpcomingEclipses(events: readonly EarthEclipseEvent[]): void;
  setCatalogAtPresent(atPresent: boolean): void;
  setEventsLoading(loading: boolean): void;
  setLocalLoading(loading: boolean): void;
  setPlaying(playing: boolean): void;
  setBrowserOpen(open: boolean): void;
  setActiveSolarEclipse(event: EarthEclipseEvent | null): void;
  setSolarPathVisible(visible: boolean): void;
  setSolarObserverActive(active: boolean): void;
  focus(objectId: string): Promise<void>;
  setError(message: string): void;
  setPerformanceWarning(message: string): void;
  getCatalogUnavailableMessage(): string;
  describeEclipseViewError(error: unknown): string;
  describeObserverError(error: unknown): string;
  describeLocalMaximumError(error: unknown, location: SolarEclipseObserverLocation): string;
}

export class UniverseEclipseRuntime {
  private eclipsePageRequestRevision = 0;
  private localEclipseRequestRevision = 0;

  constructor(
    private readonly engine: UniverseEclipseRuntimeEngine,
    private readonly catalogLoader: UniverseEclipseCatalogLoader,
    private readonly localEclipseLoader: UniverseLocalEclipseLoader,
    private readonly bindings: UniverseEclipseRuntimeBindings,
  ) {}

  public browseEarlierEclipses(): Promise<void> {
    const firstEvent = this.bindings.getUpcomingEclipses()[0];
    const reference = {
      julianDay:
        (firstEvent?.peak.julianDay ?? this.bindings.getCurrentTime().julianDay) -
        PAGE_BOUNDARY_OFFSET_DAYS,
    };

    return this.loadEclipsePage(reference, 'past', false);
  }

  public browseLaterEclipses(): Promise<void> {
    const events = this.bindings.getUpcomingEclipses();
    const lastEvent = events.at(-1);
    const reference = {
      julianDay:
        (lastEvent?.peak.julianDay ?? this.bindings.getCurrentTime().julianDay) +
        PAGE_BOUNDARY_OFFSET_DAYS,
    };

    return this.loadEclipsePage(reference, 'future', false);
  }

  public returnToCurrentEclipses(): Promise<void> {
    return this.loadEclipsePage(this.bindings.getCurrentTime(), 'future', true);
  }

  public async viewEarthEclipse(event: EarthEclipseEvent): Promise<void> {
    this.bindings.setPlaying(false);
    this.engine.setPlaying(false);
    this.bindings.setBrowserOpen(false);
    this.bindings.setSolarPathVisible(false);
    if (event.family === 'lunar') {
      this.bindings.setActiveSolarEclipse(null);
      this.bindings.setSolarObserverActive(false);
      this.engine.setTime(event.peak);
      await this.bindings.focus('moon');

      return;
    }

    try {
      this.bindings.setActiveSolarEclipse(event);
      this.bindings.setSolarObserverActive(false);
      this.engine.viewSolarEclipse(event);
    } catch (error) {
      this.bindings.setError(this.bindings.describeEclipseViewError(error));
    }
  }

  public observeEarthEclipse(event: EarthEclipseEvent): void {
    if (event.family !== 'solar') {
      return;
    }

    this.bindings.setPlaying(false);
    this.engine.setPlaying(false);
    this.bindings.setBrowserOpen(false);
    this.bindings.setSolarPathVisible(false);
    try {
      this.bindings.setActiveSolarEclipse(event);
      this.bindings.setSolarObserverActive(true);
      this.engine.observeSolarEclipse(event);
    } catch (error) {
      this.bindings.setSolarObserverActive(false);
      this.bindings.setError(this.bindings.describeObserverError(error));
    }
  }

  public async viewLocalSolarEclipse(
    event: EarthEclipseEvent,
    location: SolarEclipseObserverLocation,
  ): Promise<void> {
    const requestRevision = ++this.localEclipseRequestRevision;

    this.bindings.setLocalLoading(true);
    try {
      const { calculateLocalSolarEclipse } = await this.localEclipseLoader();

      if (requestRevision !== this.localEclipseRequestRevision) {
        return;
      }
      const localEvent = calculateLocalSolarEclipse(event, location);

      await this.viewEarthEclipse(localEvent);
    } catch (error) {
      if (requestRevision === this.localEclipseRequestRevision) {
        this.bindings.setPerformanceWarning(
          this.bindings.describeLocalMaximumError(error, location),
        );
      }
    } finally {
      if (requestRevision === this.localEclipseRequestRevision) {
        this.bindings.setLocalLoading(false);
      }
    }
  }

  public showSolarShadow(): void {
    const event = this.bindings.getActiveSolarEclipse();

    if (event) {
      this.bindings.setSolarObserverActive(false);
      this.engine.viewSolarEclipse(event);
    }
  }

  public toggleSolarPath(event: EarthEclipseEvent): void {
    const visible = !this.bindings.isSolarPathVisible();

    this.bindings.setActiveSolarEclipse(event);
    this.bindings.setSolarPathVisible(visible);
    this.engine.setSolarEclipsePathVisible(event, visible);
  }

  public resetPresentation(): void {
    this.bindings.setActiveSolarEclipse(null);
    this.bindings.setSolarObserverActive(false);
    this.bindings.setSolarPathVisible(false);
    this.engine.clearSolarEclipsePresentation();
  }

  public presentCurrentSolarEclipse(): void {
    const eclipse = this.bindings.getCurrentSolarEclipse();

    if (eclipse) {
      void this.viewEarthEclipse(eclipse);
    }
  }

  public cancelPendingRequests(): void {
    this.eclipsePageRequestRevision += 1;
    this.localEclipseRequestRevision += 1;
    this.bindings.setEventsLoading(false);
    this.bindings.setLocalLoading(false);
  }

  private async loadEclipsePage(
    reference: UniverseTime,
    direction: 'past' | 'future',
    atPresent: boolean,
  ): Promise<void> {
    const requestRevision = ++this.eclipsePageRequestRevision;

    this.bindings.setEventsLoading(true);
    try {
      const { findEarthEclipsePage } = await this.catalogLoader();

      if (requestRevision !== this.eclipsePageRequestRevision) {
        return;
      }
      this.bindings.setUpcomingEclipses(
        findEarthEclipsePage(reference, ECLIPSE_PAGE_SIZE, direction),
      );
      this.bindings.setCatalogAtPresent(atPresent);
    } catch {
      if (requestRevision === this.eclipsePageRequestRevision) {
        this.bindings.setPerformanceWarning(this.bindings.getCatalogUnavailableMessage());
      }
    } finally {
      if (requestRevision === this.eclipsePageRequestRevision) {
        this.bindings.setEventsLoading(false);
      }
    }
  }
}
