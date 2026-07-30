import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  DisplayOptions,
  EngineDebugStats,
  GraphicQuality,
  LabelDensity,
  NavigationState,
  SolarEclipseState,
  SpaceObject,
  TemporalMode,
  UniverseEngineEvent,
  UniverseTime,
} from '../../../data/models/universe.models';
import { type NavigationScaleDefinition } from '../../../engine/camera/navigation-scales';
import { UniverseEngine } from '../../../engine/core/universe-engine';
import { type EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import { MAX_EARTH_VISUAL_DAYS_PER_SECOND } from '../../../engine/simulation/earth-rotation-playback';
import { type SolarEclipseObserverLocation } from '../../../engine/simulation/solar-eclipse-locations';
import {
  currentUniverseTime,
  formatUniverseClock,
  isoDateTimeToUniverseTime,
  localTimeZone,
  universeTimeToIsoDateTime,
} from '../../../engine/simulation/time-utils';
import { SearchService } from '../search/search.service';
import { findSpeedIndex, TIME_SPEED_OPTIONS } from '../settings/time-speeds';
import { NavigationUrlService } from '../url/navigation-url.service';

type EarthEclipseCatalogModule = typeof import('../../../engine/simulation/earth-eclipse-catalog');
type LocalSolarEclipseCalculatorModule =
  typeof import('../../../engine/simulation/local-solar-eclipse-calculator');

export const UNIVERSE_ENGINE = new InjectionToken<UniverseEngine>('UniverseEngine', {
  providedIn: 'root',
  factory: () => new UniverseEngine(),
});

export const EARTH_ECLIPSE_CATALOG_LOADER = new InjectionToken<
  () => Promise<EarthEclipseCatalogModule>
>('EarthEclipseCatalogLoader', {
  providedIn: 'root',
  factory: () => () => import('../../../engine/simulation/earth-eclipse-catalog'),
});

export const LOCAL_SOLAR_ECLIPSE_CALCULATOR_LOADER = new InjectionToken<
  () => Promise<LocalSolarEclipseCalculatorModule>
>('LocalSolarEclipseCalculatorLoader', {
  providedIn: 'root',
  factory: () => () => import('../../../engine/simulation/local-solar-eclipse-calculator'),
});

@Injectable({ providedIn: 'root' })
export class UniverseEngineFacade {
  public readonly loading = signal(true);
  public readonly ready = signal(false);
  public readonly error = signal<string | null>(null);
  public readonly performanceWarning = signal<string | null>(null);
  public readonly objects = signal<readonly SpaceObject[]>([]);
  public readonly selectedId = signal<string | null>(null);
  public readonly targetId = signal<string | null>(null);
  public readonly currentTime = signal<UniverseTime>(currentUniverseTime());
  public readonly playing = signal(false);
  public readonly speed = signal(1);
  public readonly cameraDistance = signal(0);
  public readonly lodLevel = signal(0);
  public readonly debugStats = signal<EngineDebugStats | null>(null);
  public readonly shareNotice = signal<string | null>(null);
  public readonly settingsOpen = signal(false);
  public readonly helpOpen = signal(false);
  public readonly eclipseBrowserOpen = signal(false);
  public readonly eclipseEventsLoading = signal(false);
  public readonly localEclipseLoading = signal(false);
  public readonly upcomingEclipses = signal<readonly EarthEclipseEvent[]>([]);
  public readonly activeSolarEclipse = signal<EarthEclipseEvent | null>(null);
  public readonly solarEclipseState = signal<SolarEclipseState>({
    phase: 'none',
    centralLatitude: null,
    centralLongitude: null,
  });
  public readonly solarPathVisible = signal(false);
  public readonly solarObserverActive = signal(false);
  public readonly debugEnabled = signal(
    new URL(window.location.href).searchParams.get('debug') === 'true',
  );
  public readonly displayOptions = signal<DisplayOptions>({
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'medium',
    labelDensity: 'balanced',
    temporalMode: 'state',
  });
  public readonly selectedObject = computed(() => {
    const selectedId = this.selectedId();

    return this.objects().find((object) => object.id === selectedId) ?? this.selectedEventObject();
  });
  public readonly earthRotationStabilized = computed(
    () => this.playing() && Math.abs(this.speed()) > MAX_EARTH_VISUAL_DAYS_PER_SECOND,
  );
  public readonly browserTimeZone = localTimeZone();
  public readonly currentIsoDateTime = computed(() =>
    universeTimeToIsoDateTime(this.currentTime()),
  );
  public readonly currentLocalClock = computed(() =>
    formatUniverseClock(this.currentTime(), this.browserTimeZone),
  );
  public readonly currentSolarEclipse = computed<EarthEclipseEvent | null>(() => {
    const state = this.solarEclipseState();

    if (state.phase === 'none') {
      return null;
    }
    const time = this.currentTime();

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
  });
  public readonly timelineSolarEclipse = computed<EarthEclipseEvent | null>(() => {
    const current = this.currentSolarEclipse();
    const active = this.activeSolarEclipse();

    if (!current) {
      return null;
    }

    return active && Math.abs(active.peak.julianDay - current.peak.julianDay) < 0.5
      ? active
      : current;
  });
  public readonly solarObserverLocation = computed(() => {
    const event = this.timelineSolarEclipse();
    const coordinates = event
      ? formatCoordinates(event.latitude, event.longitude)
      : 'Point central';

    return event?.observerName ? `${event.observerName} · ${coordinates}` : coordinates;
  });
  public readonly eclipseContextLabel = computed(() => {
    if (this.solarObserverActive()) {
      return 'Observation locale';
    }
    const event = this.timelineSolarEclipse();

    if (event?.scope === 'local') {
      return `Maximum local · ${event.observerName ?? 'lieu choisi'}`;
    }

    return event?.scope === 'global' ? 'Maximum mondial' : 'Phénomène en cours';
  });
  public readonly localEclipseSummary = computed(() => {
    const event = this.timelineSolarEclipse();

    if (event?.scope !== 'local') {
      return null;
    }
    const obscuration =
      event.obscuration === null
        ? 'occultation indisponible'
        : `${new Intl.NumberFormat('fr-FR', {
            maximumFractionDigits: 1,
          }).format(event.obscuration * 100)} % occulté`;
    const clock = formatUniverseClock(event.peak, event.observerTimeZone ?? this.browserTimeZone);
    const altitude =
      event.sunAltitudeDegrees === null
        ? ''
        : ` · Soleil à ${new Intl.NumberFormat('fr-FR', {
            maximumFractionDigits: 1,
          }).format(event.sunAltitudeDegrees)}°`;

    return `${obscuration} · ${clock}${altitude}`;
  });

  private readonly engine = inject(UNIVERSE_ENGINE);
  private readonly eclipseCatalogLoader = inject(EARTH_ECLIPSE_CATALOG_LOADER);
  private readonly localSolarEclipseCalculatorLoader = inject(
    LOCAL_SOLAR_ECLIPSE_CALCULATOR_LOADER,
  );
  private readonly searchService = inject(SearchService);
  private readonly urlService = inject(NavigationUrlService);
  private readonly selectedEventObject = signal<SpaceObject | null>(null);
  private unsubscribeEngine: (() => void) | null = null;
  private initialization: Promise<void> | null = null;
  private initialNavigation: Partial<NavigationState> = {};

  public initialize(container: HTMLElement): Promise<void> {
    if (this.initialization) {
      return this.initialization;
    }

    this.initialization = this.initializeEngine(container);

    return this.initialization;
  }

  public dispose(): void {
    this.unsubscribeEngine?.();
    this.unsubscribeEngine = null;
    this.engine.dispose();
    this.initialization = null;
    this.ready.set(false);
  }

  public async focus(objectId: string): Promise<void> {
    try {
      this.resetSolarEclipsePresentation();
      await this.engine.setTarget(objectId);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Cible inaccessible.');
    }
  }

  public focusSelected(): void {
    const selectedId = this.selectedId();

    if (selectedId) {
      void this.focus(selectedId);
    }
  }

  public viewOrbit(objectId: string): void {
    this.resetSolarEclipsePresentation();
    if (!this.displayOptions().showOrbits) {
      this.updateDisplayOptions({ showOrbits: true });
    }
    try {
      this.engine.viewOrbit(objectId);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Orbite inaccessible.');
    }
  }

  public viewScale(scale: NavigationScaleDefinition): void {
    this.resetSolarEclipsePresentation();
    try {
      this.engine.viewScale(scale);
    } catch {
      this.error.set('Échelle inaccessible.');
    }
  }

  public closeDetails(): void {
    this.engine.selectObject(null);
  }

  public togglePlaying(): void {
    const playing = !this.playing();

    if (playing && (this.activeSolarEclipse() || this.solarObserverActive())) {
      this.resetSolarEclipsePresentation();
    }
    this.playing.set(playing);
    this.engine.setPlaying(playing);
  }

  public setSpeed(daysPerSecond: number): void {
    this.speed.set(daysPerSecond);
    this.engine.setTimeSpeed(daysPerSecond);
  }

  public cycleSpeed(direction: 1 | -1): void {
    const currentIndex = findSpeedIndex(this.speed());
    const nextIndex = Math.max(
      0,
      Math.min(TIME_SPEED_OPTIONS.length - 1, currentIndex + direction),
    );

    this.setSpeed(TIME_SPEED_OPTIONS[nextIndex]!.daysPerSecond);
  }

  public setDateTime(isoDateTime: string): void {
    const time = isoDateTimeToUniverseTime(isoDateTime);

    if (time) {
      this.resetSolarEclipsePresentation();
      this.engine.setTime(time);
      if (this.targetId() === 'earth') {
        this.presentCurrentSolarEclipse();
      }
    }
  }

  public setTime(time: UniverseTime): void {
    this.resetSolarEclipsePresentation();
    this.engine.setTime(time);
  }

  public returnToPresent(): void {
    this.resetSolarEclipsePresentation();
    this.engine.setTime(currentUniverseTime());
  }

  public zoomIn(): void {
    this.engine.zoomBy(0.72);
  }

  public zoomOut(): void {
    this.engine.zoomBy(1.38);
  }

  public resize(width: number, height: number): void {
    this.engine.resize(width, height);
  }

  public toggleOrbits(): void {
    this.updateDisplayOptions({ showOrbits: !this.displayOptions().showOrbits });
  }

  public toggleLabels(): void {
    this.updateDisplayOptions({ showLabels: !this.displayOptions().showLabels });
  }

  public toggleConstellations(): void {
    this.updateDisplayOptions({
      showConstellations: !this.displayOptions().showConstellations,
    });
  }

  public setQuality(quality: GraphicQuality): void {
    this.updateDisplayOptions({ quality });
  }

  public setLabelDensity(labelDensity: LabelDensity): void {
    this.updateDisplayOptions({ labelDensity });
  }

  public setTemporalMode(temporalMode: TemporalMode): void {
    this.updateDisplayOptions({ temporalMode });
    if (temporalMode === 'observable') {
      this.performanceWarning.set(
        'La Vue observable est préparée dans l’architecture ; ce prototype affiche encore un état simultané.',
      );
    }
  }

  public toggleSettings(): void {
    this.settingsOpen.update((open) => !open);
    this.helpOpen.set(false);
    this.eclipseBrowserOpen.set(false);
  }

  public toggleHelp(): void {
    this.helpOpen.update((open) => !open);
    this.settingsOpen.set(false);
    this.eclipseBrowserOpen.set(false);
  }

  public toggleEclipseBrowser(): void {
    const open = !this.eclipseBrowserOpen();

    this.eclipseBrowserOpen.set(open);
    this.settingsOpen.set(false);
    this.helpOpen.set(false);
    if (open) {
      void this.loadUpcomingEclipses();
    }
  }

  public async viewEarthEclipse(event: EarthEclipseEvent): Promise<void> {
    this.playing.set(false);
    this.engine.setPlaying(false);
    this.eclipseBrowserOpen.set(false);
    this.solarPathVisible.set(false);
    if (event.family === 'lunar') {
      this.activeSolarEclipse.set(null);
      this.solarObserverActive.set(false);
      this.engine.setTime(event.peak);
      await this.focus('moon');

      return;
    }

    try {
      this.activeSolarEclipse.set(event);
      this.solarObserverActive.set(false);
      this.engine.viewSolarEclipse(event);
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Visualisation de l’éclipse impossible.',
      );
    }
  }

  public observeEarthEclipse(event: EarthEclipseEvent): void {
    if (event.family !== 'solar') {
      return;
    }

    this.playing.set(false);
    this.engine.setPlaying(false);
    this.eclipseBrowserOpen.set(false);
    this.solarPathVisible.set(false);
    try {
      this.activeSolarEclipse.set(event);
      this.solarObserverActive.set(true);
      this.engine.observeSolarEclipse(event);
    } catch (error) {
      this.solarObserverActive.set(false);
      this.error.set(error instanceof Error ? error.message : 'Point d’observation inaccessible.');
    }
  }

  public async viewLocalSolarEclipse(
    event: EarthEclipseEvent,
    location: SolarEclipseObserverLocation,
  ): Promise<void> {
    this.localEclipseLoading.set(true);
    try {
      const { calculateLocalSolarEclipse } = await this.localSolarEclipseCalculatorLoader();
      const localEvent = calculateLocalSolarEclipse(event, location);

      await this.viewEarthEclipse(localEvent);
    } catch (error) {
      this.performanceWarning.set(
        error instanceof Error
          ? error.message
          : `Le maximum local est indisponible pour ${location.name}.`,
      );
    } finally {
      this.localEclipseLoading.set(false);
    }
  }

  public showSolarShadow(): void {
    const event = this.activeSolarEclipse();

    if (!event) {
      return;
    }

    this.solarObserverActive.set(false);
    this.engine.viewSolarEclipse(event);
  }

  public toggleSolarPath(event: EarthEclipseEvent): void {
    const visible = !this.solarPathVisible();

    this.activeSolarEclipse.set(event);
    this.solarPathVisible.set(visible);
    this.engine.setSolarEclipsePathVisible(event, visible);
  }

  public async copyShareUrl(): Promise<void> {
    const url = this.urlService.createShareUrl(this.createNavigationState());

    try {
      await navigator.clipboard.writeText(url);
      this.shareNotice.set('Lien copié');
    } catch {
      this.shareNotice.set('Copie impossible — utilisez l’URL du navigateur');
    }
    window.setTimeout(() => this.shareNotice.set(null), 2_400);
  }

  private async initializeEngine(container: HTMLElement): Promise<void> {
    this.initialNavigation = this.urlService.read();
    this.unsubscribeEngine = this.engine.subscribe((event) => this.handleEngineEvent(event));
    const options: DisplayOptions = {
      showOrbits: this.initialNavigation.showOrbits ?? true,
      showConstellations: this.initialNavigation.showConstellations ?? true,
      showLabels: this.initialNavigation.showLabels ?? true,
      quality: this.initialNavigation.quality ?? this.engine.recommendedQuality,
      labelDensity: this.initialNavigation.labelDensity ?? 'balanced',
      temporalMode: this.initialNavigation.mode ?? 'state',
    };

    this.displayOptions.set(options);

    try {
      await this.engine.initialize(container, options);

      if (this.initialNavigation.julianDay) {
        this.engine.setTime({ julianDay: this.initialNavigation.julianDay });
      } else {
        this.currentTime.set(this.engine.currentTime);
      }
      this.engine.setTimeSpeed(this.speed());

      const requestedTarget = this.initialNavigation.targetId ?? 'earth';
      const target = this.engine.hasObject(requestedTarget) ? requestedTarget : 'earth';

      await this.engine.setTarget(target, this.initialNavigation.zoom);
      this.engine.completeTargetTransition();

      if (
        this.initialNavigation.selectedId === null ||
        (this.initialNavigation.selectedId &&
          this.initialNavigation.selectedId !== this.initialNavigation.targetId)
      ) {
        this.engine.selectObject(this.initialNavigation.selectedId ?? null);
      }
      if (target === 'earth') {
        this.presentCurrentSolarEclipse();
      }

      this.engine.start();
      this.ready.set(true);
      this.scheduleUrlUpdate();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Initialisation impossible.');
      this.loading.set(false);
    }
  }

  private async loadUpcomingEclipses(): Promise<void> {
    this.eclipseEventsLoading.set(true);
    try {
      const { findUpcomingEarthEclipses } = await this.eclipseCatalogLoader();

      this.upcomingEclipses.set(findUpcomingEarthEclipses(this.currentTime(), 6));
    } catch {
      this.performanceWarning.set('Le catalogue des éclipses n’a pas pu être calculé.');
    } finally {
      this.eclipseEventsLoading.set(false);
    }
  }

  private handleEngineEvent(event: UniverseEngineEvent): void {
    switch (event.type) {
      case 'data-ready':
        this.objects.set(event.objects);
        this.searchService.setData(event.objects, event.catalogEntries);
        break;
      case 'objects-changed':
        this.objects.set(event.objects);
        break;
      case 'object-selected':
        this.selectedId.set(event.objectId);
        this.selectedEventObject.set(event.object);
        this.scheduleUrlUpdate();
        break;
      case 'target-changed':
        this.targetId.set(event.objectId);
        this.scheduleUrlUpdate();
        break;
      case 'camera-changed':
        this.cameraDistance.set(event.zoom);
        this.scheduleUrlUpdate();
        break;
      case 'time-changed':
        this.currentTime.set(event.time);
        this.scheduleUrlUpdate();
        break;
      case 'solar-eclipse-state':
        this.solarEclipseState.set(event.state);
        break;
      case 'lod-changed':
        this.lodLevel.set(event.level);
        break;
      case 'loading-state':
        this.loading.set(event.loading);
        break;
      case 'performance-warning':
        this.performanceWarning.set(event.message);
        break;
      case 'debug-stats':
        this.debugStats.set(event.stats);
        break;
      case 'error':
        this.error.set(event.message);
        break;
    }
  }

  private updateDisplayOptions(changes: Partial<DisplayOptions>): void {
    const options = { ...this.displayOptions(), ...changes };

    this.displayOptions.set(options);
    this.engine.setDisplayOptions(options);
    this.scheduleUrlUpdate();
  }

  private scheduleUrlUpdate(): void {
    if (!this.ready()) {
      return;
    }
    this.urlService.scheduleWrite(this.createNavigationState());
  }

  private createNavigationState(): NavigationState {
    return {
      targetId: this.targetId(),
      selectedId: this.selectedId(),
      julianDay: this.currentTime().julianDay,
      zoom: this.cameraDistance() || this.engine.cameraDistance || 24,
      mode: this.displayOptions().temporalMode,
      quality: this.displayOptions().quality,
      labelDensity: this.displayOptions().labelDensity,
      showOrbits: this.displayOptions().showOrbits,
      showConstellations: this.displayOptions().showConstellations,
      showLabels: this.displayOptions().showLabels,
    };
  }

  private resetSolarEclipsePresentation(): void {
    this.activeSolarEclipse.set(null);
    this.solarObserverActive.set(false);
    this.solarPathVisible.set(false);
    this.engine.clearSolarEclipsePresentation();
  }

  private presentCurrentSolarEclipse(): void {
    const eclipse = this.currentSolarEclipse();

    if (eclipse) {
      void this.viewEarthEclipse(eclipse);
    }
  }
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) {
    return 'Point central calculé';
  }

  const latitudeSuffix = latitude >= 0 ? 'N' : 'S';
  const longitudeSuffix = longitude >= 0 ? 'E' : 'O';

  return `${Math.abs(latitude).toFixed(1)}° ${latitudeSuffix} · ${Math.abs(longitude).toFixed(1)}° ${longitudeSuffix}`;
}
