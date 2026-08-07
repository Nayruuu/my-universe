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
import type { EarthObserverFraming } from '../../../engine/camera/earth-observer-camera-control';
import type { EarthObserverCelestialPresentation } from '../../../engine/objects/earth-observer-celestial-presenter';
import type { ObjectVisualDiagnostics } from '../../../engine/objects/object-visual-diagnostics';
import {
  type CosmicMapLayer,
  type CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
} from '../../../engine/rendering/cosmic-map-policy';
import { type EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import { UniverseStartupPerformanceTrace } from '../../../engine/performance/universe-startup-performance-trace';
import { type SolarEclipseObserverLocation } from '../../../engine/simulation/solar-eclipse-locations';
import type {
  StellarObservationCatalogEntry,
  StellarObservationConstellation,
} from '../../../engine/simulation/stellar-observation';
import {
  currentUniverseTime,
  formatUniverseClock,
  localTimeZone,
  universeTimeToIsoDateTime,
} from '../../../engine/simulation/time-utils';
import { SearchService } from '../search/search.service';
import { I18nService } from '../i18n/i18n.service';
import { NavigationUrlService } from '../url/navigation-url.service';
import { UniverseDisplayCommandRuntime } from './universe-display-command-runtime';
import { UniverseEclipsePresenter } from './universe-eclipse-presentation';
import { UniverseEclipseRuntime } from './universe-eclipse-runtime';
import { UniverseEngineEventBridge } from './universe-engine-event-bridge';
import { UniverseEngineFacadeLifecycle } from './universe-engine-facade-lifecycle';
import { LazyUniverseEngineClient, type UniverseEngineClient } from './lazy-universe-engine-client';
import {
  type NavigationDebugCopyResult,
  serializeNavigationDebugReport,
} from './navigation-debug-report';
import {
  installUniverseEngineObservability,
  shouldInstallUniverseEngineObservability,
} from './universe-engine-observability';
import { UniverseNavigationStateSynchronizer } from './universe-navigation-state-synchronizer';
import { UniverseShellRuntime } from './universe-shell-runtime';
import { UniverseTimeCommandRuntime } from './universe-time-command-runtime';
import { UniverseViewCommandRuntime } from './universe-view-command-runtime';

type EarthEclipseCatalogModule = typeof import('../../../engine/simulation/earth-eclipse-catalog');
type LocalSolarEclipseCalculatorModule =
  typeof import('../../../engine/simulation/local-solar-eclipse-calculator');

export async function loadUniverseEngine(
  startupPerformance = new UniverseStartupPerformanceTrace(),
): Promise<UniverseEngineClient> {
  const { UniverseEngine } = await import('../../../engine/core/universe-engine');

  return new UniverseEngine(undefined, startupPerformance);
}

export const UNIVERSE_ENGINE = new InjectionToken<UniverseEngineClient>('UniverseEngine', {
  providedIn: 'root',
  factory: () => new LazyUniverseEngineClient(loadUniverseEngine),
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
  public readonly eclipseCatalogAtPresent = signal(true);
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
  public readonly cosmicMapLayers = signal<CosmicMapLayers>({
    ...DEFAULT_COSMIC_MAP_LAYERS,
  });
  public readonly selectedObject = computed(() => {
    const selectedId = this.selectedId();

    return this.objects().find((object) => object.id === selectedId) ?? this.selectedEventObject();
  });
  public readonly browserTimeZone = localTimeZone();
  public readonly currentIsoDateTime = computed(() =>
    universeTimeToIsoDateTime(this.currentTime()),
  );
  public readonly currentLocalClock = computed(() =>
    formatUniverseClock(this.currentTime(), this.browserTimeZone, this.i18n.locale()),
  );
  public readonly currentSolarEclipse = computed<EarthEclipseEvent | null>(() =>
    this.eclipsePresenter.createCurrentEvent(this.solarEclipseState(), this.currentTime()),
  );
  public readonly timelineSolarEclipse = computed<EarthEclipseEvent | null>(() =>
    this.eclipsePresenter.selectTimelineEvent(
      this.currentSolarEclipse(),
      this.activeSolarEclipse(),
    ),
  );
  public readonly solarObserverLocation = computed(() =>
    this.eclipsePresenter.formatObserverLocation(this.timelineSolarEclipse()),
  );
  public readonly eclipseContextLabel = computed(() =>
    this.eclipsePresenter.formatContextLabel(
      this.solarObserverActive(),
      this.timelineSolarEclipse(),
    ),
  );
  public readonly localEclipseSummary = computed(() =>
    this.eclipsePresenter.formatLocalSummary(this.timelineSolarEclipse()),
  );
  public readonly localEclipseContactsSummary = computed(() =>
    this.eclipsePresenter.formatContactSummary(this.timelineSolarEclipse()),
  );

  private readonly engine = inject(UNIVERSE_ENGINE);
  private readonly removeEngineObservability = installUniverseEngineObservability(
    this.engine,
    shouldInstallUniverseEngineObservability(new URL(window.location.href)),
  );
  private readonly i18n = inject(I18nService);
  private readonly eclipsePresenter = new UniverseEclipsePresenter({
    browserTimeZone: this.browserTimeZone,
    getContent: () => this.i18n.content(),
    getLocale: () => this.i18n.locale(),
    interpolate: (template, values) => this.i18n.interpolate(template, values),
    formatNumber: (value, maximumFractionDigits) =>
      this.i18n.formatNumber(value, maximumFractionDigits),
  });
  private readonly eclipseCatalogLoader = inject(EARTH_ECLIPSE_CATALOG_LOADER);
  private readonly localSolarEclipseCalculatorLoader = inject(
    LOCAL_SOLAR_ECLIPSE_CALCULATOR_LOADER,
  );
  private readonly searchService = inject(SearchService);
  private readonly urlService = inject(NavigationUrlService);
  private readonly selectedEventObject = signal<SpaceObject | null>(null);
  private readonly eventBridge = new UniverseEngineEventBridge({
    setObjects: (objects) => this.objects.set(objects),
    setSearchData: (objects, catalogEntries) => this.searchService.setData(objects, catalogEntries),
    setSelection: (objectId, object) => {
      this.selectedId.set(objectId);
      this.selectedEventObject.set(object);
    },
    setTarget: (objectId) => this.targetId.set(objectId),
    setCameraDistance: (zoom) => this.cameraDistance.set(zoom),
    setTime: (time) => this.currentTime.set(time),
    setSolarEclipseState: (state) => this.solarEclipseState.set(state),
    setLodLevel: (level) => this.lodLevel.set(level),
    setLoading: (loading) => {
      if (loading || this.ready()) {
        this.loading.set(loading);
      }
    },
    setPerformanceWarning: (message) => this.performanceWarning.set(message),
    setDebugStats: (stats) => this.debugStats.set(stats),
    setError: (message) => this.error.set(message),
    scheduleNavigationWrite: () => this.scheduleUrlUpdate(),
  });
  private readonly navigationStateSynchronizer = new UniverseNavigationStateSynchronizer({
    isReady: () => this.ready(),
    getTargetId: () => this.targetId(),
    getSelectedId: () => this.selectedId(),
    getTime: () => this.currentTime(),
    getCameraDistance: () => this.cameraDistance(),
    getEngineCameraDistance: () => this.engine.cameraDistance,
    getDisplayOptions: () => this.displayOptions(),
    scheduleWrite: (state) => this.urlService.scheduleWrite(state),
  });
  private readonly eclipseRuntime = new UniverseEclipseRuntime(
    this.engine,
    this.eclipseCatalogLoader,
    this.localSolarEclipseCalculatorLoader,
    {
      getCurrentTime: () => this.currentTime(),
      getUpcomingEclipses: () => this.upcomingEclipses(),
      getActiveSolarEclipse: () => this.activeSolarEclipse(),
      getCurrentSolarEclipse: () => this.currentSolarEclipse(),
      isSolarPathVisible: () => this.solarPathVisible(),
      setUpcomingEclipses: (events) => this.upcomingEclipses.set(events),
      setCatalogAtPresent: (atPresent) => this.eclipseCatalogAtPresent.set(atPresent),
      setEventsLoading: (loading) => this.eclipseEventsLoading.set(loading),
      setLocalLoading: (loading) => this.localEclipseLoading.set(loading),
      setPlaying: (playing) => this.playing.set(playing),
      setBrowserOpen: (open) => this.eclipseBrowserOpen.set(open),
      setActiveSolarEclipse: (event) => this.activeSolarEclipse.set(event),
      setSolarPathVisible: (visible) => this.solarPathVisible.set(visible),
      setSolarObserverActive: (active) => this.solarObserverActive.set(active),
      focus: (objectId) => this.focus(objectId),
      setError: (message) => this.error.set(message),
      setPerformanceWarning: (message) => this.performanceWarning.set(message),
      getCatalogUnavailableMessage: () => this.i18n.content().facade.eclipseCatalogUnavailable,
      describeEclipseViewError: (error) =>
        error instanceof Error ? error.message : this.i18n.content().facade.eclipseViewUnavailable,
      describeObserverError: (error) =>
        error instanceof Error ? error.message : this.i18n.content().facade.observerUnavailable,
      describeLocalMaximumError: (error, location) =>
        error instanceof Error
          ? error.message
          : this.i18n.interpolate(this.i18n.content().facade.localMaximumUnavailable, {
              location: location.name,
            }),
    },
  );
  private readonly shellRuntime = new UniverseShellRuntime({
    isSettingsOpen: () => this.settingsOpen(),
    setSettingsOpen: (open) => this.settingsOpen.set(open),
    isHelpOpen: () => this.helpOpen(),
    setHelpOpen: (open) => this.helpOpen.set(open),
    isEclipseBrowserOpen: () => this.eclipseBrowserOpen(),
    setEclipseBrowserOpen: (open) => this.eclipseBrowserOpen.set(open),
    returnToCurrentEclipses: () => this.returnToCurrentEclipses(),
    createShareUrl: () => this.urlService.createShareUrl(this.createNavigationState()),
    writeClipboardText: (url) => navigator.clipboard.writeText(url),
    setShareNotice: (notice) => this.shareNotice.set(notice),
    getShareCopiedMessage: () => this.i18n.content().facade.shareCopied,
    getShareFailedMessage: () => this.i18n.content().facade.shareFailed,
  });
  private readonly displayCommandRuntime = new UniverseDisplayCommandRuntime(this.engine, {
    getDisplayOptions: () => this.displayOptions(),
    setDisplayOptions: (options) => this.displayOptions.set(options),
    getCosmicMapLayers: () => this.cosmicMapLayers(),
    setCosmicMapLayers: (layers) => this.cosmicMapLayers.set(layers),
    scheduleUrlUpdate: () => this.scheduleUrlUpdate(),
    setPerformanceWarning: (message) => this.performanceWarning.set(message),
    getObservableWarning: () => this.i18n.content().facade.observableWarning,
  });
  private readonly viewCommandRuntime = new UniverseViewCommandRuntime(this.engine, {
    getSelectedId: () => this.selectedId(),
    areOrbitsVisible: () => this.displayOptions().showOrbits,
    resetPresentation: () => this.resetSolarEclipsePresentation(),
    showOrbits: () => this.displayCommandRuntime.updateDisplayOptions({ showOrbits: true }),
    setError: (message) => this.error.set(message),
    describeTargetError: (error) =>
      error instanceof Error ? error.message : this.i18n.content().facade.targetUnavailable,
    describeRotationError: (error) =>
      error instanceof Error ? error.message : this.i18n.content().facade.rotationUnavailable,
    describeOrbitError: (error) =>
      error instanceof Error ? error.message : this.i18n.content().facade.orbitUnavailable,
    getScaleUnavailableMessage: () => this.i18n.content().facade.scaleUnavailable,
  });
  private readonly timeCommandRuntime = new UniverseTimeCommandRuntime(this.engine, {
    isPlaying: () => this.playing(),
    isPresentationActive: () => Boolean(this.activeSolarEclipse()) || this.solarObserverActive(),
    getSpeed: () => this.speed(),
    getTargetId: () => this.targetId(),
    getPresentTime: () => currentUniverseTime(),
    setPlaying: (playing) => this.playing.set(playing),
    setSpeed: (speed) => this.speed.set(speed),
    resetPresentation: () => this.resetSolarEclipsePresentation(),
    presentCurrentSolarEclipse: () => this.presentCurrentSolarEclipse(),
  });
  private readonly lifecycle = new UniverseEngineFacadeLifecycle(this.engine, {
    readNavigation: () => this.urlService.read(),
    setDisplayOptions: (options) => this.displayOptions.set(options),
    getCosmicMapLayers: () => this.cosmicMapLayers(),
    getSpeed: () => this.speed(),
    setCurrentTime: (time) => this.currentTime.set(time),
    handleEngineEvent: (event) => this.handleEngineEvent(event),
    presentCurrentSolarEclipse: () => this.presentCurrentSolarEclipse(),
    setReady: (ready) => {
      this.ready.set(ready);
      if (ready) {
        this.loading.set(false);
      }
    },
    setLoading: (loading) => this.loading.set(loading),
    setError: (message) => this.error.set(message),
    scheduleNavigationWrite: () => this.scheduleUrlUpdate(),
    describeInitializationError: (error) =>
      error instanceof Error ? error.message : this.i18n.content().facade.initializationUnavailable,
  });

  constructor() {
    this.engine.setNavigationDebugTracing(this.debugEnabled());
    this.engine.setLabelNameResolver((objectId, fallback) =>
      this.i18n.objectName(objectId, fallback),
    );
  }

  public targetVisualDiagnostics(): ObjectVisualDiagnostics | null {
    const objectId = this.targetId();

    return objectId ? this.engine.getObjectVisualDiagnostics(objectId) : null;
  }

  public navigationDebugTraceCount(): number {
    return this.engine.getNavigationDebugTrace().length;
  }

  public clearNavigationDebugTrace(): void {
    this.engine.clearNavigationDebugTrace();
  }

  public async copyNavigationDebugTrace(): Promise<NavigationDebugCopyResult> {
    const entries = this.engine.getNavigationDebugTrace();

    if (entries.length === 0) {
      return 'empty';
    }
    const report = serializeNavigationDebugReport({
      capturedAt: new Date().toISOString(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      state: {
        targetId: this.targetId(),
        selectedId: this.selectedId(),
        cameraDistance: this.cameraDistance(),
        time: this.currentTime(),
        displayOptions: this.displayOptions(),
      },
      entries,
    });

    try {
      await navigator.clipboard.writeText(report);

      return 'copied';
    } catch {
      return 'failed';
    }
  }

  public initialize(container: HTMLElement): Promise<void> {
    return this.lifecycle.initialize(container);
  }

  public dispose(): void {
    this.eclipseRuntime.cancelPendingRequests();
    this.shellRuntime.dispose();
    this.lifecycle.dispose();
    this.removeEngineObservability();
  }

  public async focus(objectId: string): Promise<void> {
    await this.viewCommandRuntime.focus(objectId);
  }

  public prepareEarthObservation(
    objectId: string,
    framing?: EarthObserverFraming,
    selectedObjectId?: string | null,
  ): Promise<void> {
    return this.engine.prepareEarthObservation(objectId, framing, selectedObjectId);
  }

  public exitEarthObservation(): void {
    this.engine.exitEarthObservation();
  }

  public setEarthObserverCelestialPresentations(
    presentations: readonly EarthObserverCelestialPresentation[],
  ): void {
    this.engine.setEarthObserverCelestialPresentations(presentations);
  }

  public resolveObject(objectId: string): Promise<SpaceObject | null> {
    return this.engine.resolveObject(objectId);
  }

  public isCameraTransitioning(): boolean {
    return this.engine.cameraTransitioning;
  }

  public focusSelected(): void {
    this.viewCommandRuntime.focusSelected();
  }

  public selectObject(objectId: string | null): void {
    this.engine.selectObject(objectId);
  }

  public async viewRotation(objectId: string): Promise<void> {
    await this.viewCommandRuntime.viewRotation(objectId);
  }

  public viewOrbit(objectId: string): void {
    this.viewCommandRuntime.viewOrbit(objectId);
  }

  public viewScale(scale: NavigationScaleDefinition): void {
    this.viewCommandRuntime.viewScale(scale);
  }

  public closeDetails(): void {
    this.viewCommandRuntime.closeDetails();
  }

  public togglePlaying(): void {
    this.timeCommandRuntime.togglePlaying();
  }

  public setSpeed(daysPerSecond: number): void {
    this.timeCommandRuntime.setSpeed(daysPerSecond);
  }

  public cycleSpeed(direction: 1 | -1): void {
    this.timeCommandRuntime.cycleSpeed(direction);
  }

  public setDateTime(isoDateTime: string): void {
    this.timeCommandRuntime.setDateTime(isoDateTime);
  }

  public setTime(time: UniverseTime): void {
    this.timeCommandRuntime.setTime(time);
  }

  public returnToPresent(): void {
    this.timeCommandRuntime.returnToPresent();
  }

  public zoomIn(): void {
    this.viewCommandRuntime.zoomIn();
  }

  public zoomOut(): void {
    this.viewCommandRuntime.zoomOut();
  }

  public resize(width: number, height: number): void {
    this.viewCommandRuntime.resize(width, height);
  }

  public toggleOrbits(): void {
    this.displayCommandRuntime.toggleOrbits();
  }

  public toggleLabels(): void {
    this.displayCommandRuntime.toggleLabels();
  }

  public toggleConstellations(): void {
    this.displayCommandRuntime.toggleConstellations();
  }

  public setQuality(quality: GraphicQuality): void {
    this.displayCommandRuntime.setQuality(quality);
  }

  public setLabelDensity(labelDensity: LabelDensity): void {
    this.displayCommandRuntime.setLabelDensity(labelDensity);
  }

  public setTemporalMode(temporalMode: TemporalMode): void {
    this.displayCommandRuntime.setTemporalMode(temporalMode);
  }

  public getStellarObservationCatalog(
    maximumCount: number,
  ): readonly StellarObservationCatalogEntry[] {
    return this.engine.getStellarObservationCatalog(maximumCount);
  }

  public getStellarObservationConstellations(): readonly StellarObservationConstellation[] {
    return this.engine.getStellarObservationConstellations();
  }

  public toggleCosmicMapLayer(layer: CosmicMapLayer): void {
    this.displayCommandRuntime.toggleCosmicMapLayer(layer);
  }

  public resetCosmicMapLayers(): void {
    this.displayCommandRuntime.resetCosmicMapLayers();
  }

  public toggleSettings(): void {
    this.shellRuntime.toggleSettings();
  }

  public toggleHelp(): void {
    this.shellRuntime.toggleHelp();
  }

  public toggleEclipseBrowser(): void {
    this.shellRuntime.toggleEclipseBrowser();
  }

  public browseEarlierEclipses(): void {
    void this.eclipseRuntime.browseEarlierEclipses();
  }

  public browseLaterEclipses(): void {
    void this.eclipseRuntime.browseLaterEclipses();
  }

  public returnToCurrentEclipses(): void {
    void this.eclipseRuntime.returnToCurrentEclipses();
  }

  public async viewEarthEclipse(event: EarthEclipseEvent): Promise<void> {
    await this.eclipseRuntime.viewEarthEclipse(event);
  }

  public observeEarthEclipse(event: EarthEclipseEvent): void {
    this.eclipseRuntime.observeEarthEclipse(event);
  }

  public async viewLocalSolarEclipse(
    event: EarthEclipseEvent,
    location: SolarEclipseObserverLocation,
  ): Promise<void> {
    await this.eclipseRuntime.viewLocalSolarEclipse(event, location);
  }

  public showSolarShadow(): void {
    this.eclipseRuntime.showSolarShadow();
  }

  public toggleSolarPath(event: EarthEclipseEvent): void {
    this.eclipseRuntime.toggleSolarPath(event);
  }

  public async copyShareUrl(): Promise<void> {
    await this.shellRuntime.copyShareUrl();
  }

  private handleEngineEvent(event: UniverseEngineEvent): void {
    this.eventBridge.handle(event);
  }

  private scheduleUrlUpdate(): void {
    this.navigationStateSynchronizer.schedule();
  }

  private createNavigationState(): NavigationState {
    return this.navigationStateSynchronizer.create();
  }

  private resetSolarEclipsePresentation(): void {
    this.eclipseRuntime.resetPresentation();
  }

  private presentCurrentSolarEclipse(): void {
    this.eclipseRuntime.presentCurrentSolarEclipse();
  }
}
