import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import type {
  SearchEntry,
  SpaceObject,
  SpaceObjectType,
  UniverseTime,
} from '../../../data/models/universe.models';
import {
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_LOOK_AT_EVENT,
  EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT,
  EARTH_OBSERVER_VIEW_EVENT,
  EARTH_OBSERVER_ZOOM_AT_EVENT,
  type EarthObserverLookAtDetail,
  type EarthObserverViewState,
  type EarthObserverZoomAtDetail,
} from '../../../engine/camera/earth-observer-camera-control';
import {
  EARTH_OBSERVER_LOCATIONS,
  type EarthObserverLocation,
} from '../../../engine/simulation/earth-observer-location';
import { calculateSolarSystemSatelliteSky } from '../../../engine/simulation/solar-system-satellite-sky';
import {
  calculateSolarSystemSky,
  calculateSunSkyObservation,
  isSolarSystemSkyBodyId,
} from '../../../engine/simulation/solar-system-sky';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import { UniverseSearchComponent } from '../search/universe-search.component';
import {
  createEarthObservationPlan,
  EARTH_OBSERVATION_PLANNER_CATALOG_SIZE,
  type EarthObservationPlannerItem,
} from './earth-observation-planner';
import { EarthObservationPlannerComponent } from './earth-observation-planner.component';
import {
  createEarthObservationForecast,
  earthObservationTimelineStartJulianDay,
  type EarthObservationTimeline,
  type EarthObservationTimelineSample,
} from './earth-observation-timeline';
import { EarthHorizonComponent } from './earth-horizon.component';
import { EarthObserverLocationPickerComponent } from './earth-observer-location-picker.component';
import { EarthObserverSelection } from './earth-observer-selection';
import { earthSkyEntryFraming } from './earth-sky-entry-framing';
import {
  layoutEarthSkyBodyLabels,
  projectEarthSkyBodies,
  type ProjectedEarthSkyBody,
} from './earth-sky-body-projection';
import { calculateEarthSkyTargetObservation, isEarthSkyTarget } from './earth-sky-catalog';
import {
  earthTerrainObstructionDegrees,
  isEarthTerrainObstructed,
} from './earth-terrain-horizon-catalog';
import { EarthTerrainHorizonCatalogService } from './earth-terrain-horizon-catalog.service';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';
import { lunarPhasePresentation } from './lunar-phase-presentation';
import { EarthSkyViewState } from './earth-sky-view-state';
import { EarthSkyJourney } from './earth-sky-journey';

const FOCUS_CUE_DURATION_MILLISECONDS = 2_400;
const SATELLITE_REVEAL_FIELD_OF_VIEW_DEGREES = 12;

interface EarthSkyFocusCue {
  readonly sequence: number;
  readonly objectId: string;
  readonly name: string;
  readonly color: string;
  readonly altitudeDegrees: number;
  readonly compassDirection: EarthObservationPlannerItem['observation']['compassDirection'];
  readonly xPercent: number;
  readonly yPercent: number;
}

type EarthSkyFocusCueInput = Omit<EarthSkyFocusCue, 'sequence' | 'name'> & {
  readonly fallbackName: string;
};

interface EarthSkyPendingFocusCue {
  readonly cue: EarthSkyFocusCueInput;
  readonly target: EarthObserverLookAtDetail;
}

@Component({
  selector: 'app-earth-sky-view',
  styleUrl: './earth-sky-view.component.scss',
  templateUrl: './earth-sky-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EarthHorizonComponent,
    EarthObservationPlannerComponent,
    EarthObserverLocationPickerComponent,
    UniverseSearchComponent,
  ],
})
export class EarthSkyViewComponent implements OnDestroy {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly earthName = computed(() => this.i18n.objectName('earth', 'Terre'));
  protected readonly observerSelection = inject(EarthObserverSelection);
  protected readonly viewState = inject(EarthSkyViewState);
  protected readonly terrainHorizon = signal<EarthTerrainHorizonProfile | null>(null);
  protected readonly plannerOpen = signal(false);
  protected readonly focusCues = signal<readonly EarthSkyFocusCue[]>([]);
  protected readonly observableSearchTypes: readonly SpaceObjectType[] = ['star'];
  protected readonly availableLocations = computed(() => {
    const selected = this.observerSelection.location();

    return selected && !EARTH_OBSERVER_LOCATIONS.some(({ id }) => id === selected.id)
      ? [selected, ...EARTH_OBSERVER_LOCATIONS]
      : EARTH_OBSERVER_LOCATIONS;
  });
  protected readonly targetName = computed(() => {
    const target = this.target();

    return target
      ? this.i18n.objectName(target.id, target.name)
      : this.viewState.activeTargetName();
  });
  protected readonly observation = computed(() => {
    const target = this.target();
    const location = this.observerSelection.location();

    return target && location
      ? calculateEarthSkyTargetObservation(target, this.facade.currentTime(), location)
      : null;
  });
  protected readonly horizonPosition = computed(() => {
    const observation = this.observation();
    const observerView = this.effectiveObserverView();

    if (!observation) {
      return '100%';
    }
    const pitchOffsetDegrees =
      observerView?.pitchOffsetDegrees ?? this.viewState.entryPitchOffsetDegrees();
    const altitudeDegrees =
      observerView?.centerAltitudeDegrees ??
      observation.geometricAltitudeDegrees + pitchOffsetDegrees;
    const fieldOfView =
      observerView?.verticalFieldOfViewDegrees ?? this.viewState.entryVerticalFieldOfViewDegrees();

    const horizonPercentage = 50 + (altitudeDegrees / fieldOfView) * 100;

    return `${Math.min(120, Math.max(0, horizonPercentage))}%`;
  });
  protected readonly horizonPerspective = computed(() => ({
    centerAzimuthDegrees: normalizeDegrees(
      this.effectiveObserverView()?.centerAzimuthDegrees ??
        (this.observation()?.azimuthDegrees ?? 0) +
          (this.effectiveObserverView()?.azimuthOffsetDegrees ?? 0),
    ),
    verticalFieldOfViewDegrees:
      this.effectiveObserverView()?.verticalFieldOfViewDegrees ??
      this.viewState.entryVerticalFieldOfViewDegrees(),
    viewport: this.viewport(),
  }));
  protected readonly targetTitle = computed(() =>
    this.i18n.interpolate(this.i18n.content().stellarObservation.title, {
      name: this.targetName(),
    }),
  );
  protected readonly viewTitle = computed(() =>
    this.i18n.interpolate(this.i18n.content().stellarObservation.nightSky, {
      location: this.observerSelection.location()?.name ?? '',
    }),
  );
  protected readonly terrainHorizonDescription = computed(() =>
    this.terrainHorizon()
      ? this.i18n.content().stellarObservation.calculatedTerrainHorizon
      : this.i18n.content().stellarObservation.illustrativeHorizon,
  );
  protected readonly scientificNote = computed(() => {
    const target = this.target();
    const text = this.i18n.content().stellarObservation;

    if (target?.type !== 'moon' && target?.type !== 'planet') {
      return text.scientificNote;
    }

    return target.scientificConfidence === 'extrapolated'
      ? text.satelliteScientificNote
      : text.solarSystemScientificNote;
  });
  protected readonly targetTerrainObstructionDegrees = computed(() => {
    const observation = this.observation();
    const terrainHorizon = this.terrainHorizon();

    return observation && terrainHorizon
      ? earthTerrainObstructionDegrees(terrainHorizon, observation.azimuthDegrees)
      : null;
  });
  protected readonly belowHorizonMessage = computed(() => {
    const observation = this.observation();
    const location = this.observerSelection.location();

    if (!observation || !location) {
      return null;
    }
    if (!observation.isAboveHorizon) {
      return this.i18n.interpolate(this.i18n.content().stellarObservation.targetBelowHorizon, {
        name: this.targetName(),
        location: location.name,
      });
    }
    const obstructionDegrees = this.targetTerrainObstructionDegrees();

    return obstructionDegrees !== null && observation.geometricAltitudeDegrees <= obstructionDegrees
      ? this.i18n.interpolate(this.i18n.content().stellarObservation.targetBehindTerrain, {
          name: this.targetName(),
          location: location.name,
          angle: this.i18n.formatNumber(obstructionDegrees, 1),
        })
      : null;
  });
  protected readonly solarSystemSky = computed(() => {
    const location = this.observerSelection.location();

    return location
      ? [
          ...calculateSolarSystemSky(this.facade.currentTime(), location),
          ...calculateSolarSystemSatelliteSky(
            this.facade.currentTime(),
            location,
            this.facade.objects(),
          ),
        ]
      : [];
  });
  protected readonly skyBodies = computed(() => {
    const observation = this.observation();
    const location = this.observerSelection.location();

    if (!observation || !location) {
      return [];
    }

    const terrainHorizon = this.terrainHorizon();
    const fieldOfViewDegrees =
      this.effectiveObserverView()?.verticalFieldOfViewDegrees ??
      this.viewState.entryVerticalFieldOfViewDegrees();
    const selectedObjectId = this.facade.selectedObject()?.id;
    const activeTargetId = this.viewState.activeTargetId();
    const viewport = this.viewport();
    const visibleBodies = this.solarSystemSky().filter(
      ({ id, skyObjectKind }) =>
        skyObjectKind !== 'satellite' ||
        fieldOfViewDegrees <= SATELLITE_REVEAL_FIELD_OF_VIEW_DEGREES ||
        id === activeTargetId ||
        id === selectedObjectId,
    );

    const projectedBodies = projectEarthSkyBodies(
      visibleBodies,
      observation,
      this.effectiveObserverView(),
      viewport,
    ).filter(
      (body) =>
        !terrainHorizon ||
        !isEarthTerrainObstructed(
          terrainHorizon,
          body.observation.geometricAltitudeDegrees,
          body.observation.azimuthDegrees,
        ),
    );
    const namedBodies = projectedBodies.map((body) => ({
      ...body,
      name: this.i18n.objectName(body.id, body.fallbackName),
      lunarPhase: lunarPhasePresentation(body.lunarIllumination),
    }));

    return layoutEarthSkyBodyLabels(namedBodies, viewport, [selectedObjectId, activeTargetId]);
  });
  protected readonly observationPlan = computed(() => {
    const location = this.observerSelection.location();

    if (!this.plannerOpen() || !location) {
      return null;
    }
    // The object signal makes catalogue installation observable without evaluating the plan while
    // its panel is closed. The binary HYG catalogue itself is already ordered by apparent magnitude.
    this.facade.objects();

    return createEarthObservationPlan({
      time: this.facade.currentTime(),
      location,
      solarSystem: this.solarSystemSky(),
      stars: this.facade.getStellarObservationCatalog(EARTH_OBSERVATION_PLANNER_CATALOG_SIZE),
      terrainHorizon: this.terrainHorizon(),
    });
  });
  protected readonly observationForecast = computed(() => {
    const startJulianDay = this.observationTimelineStartJulianDay();
    const location = this.observerSelection.location();
    const target = this.plannerTarget() ?? this.target();

    if (!this.plannerOpen() || startJulianDay === null || !location || !target) {
      return null;
    }

    return createEarthObservationForecast({
      startTime: { julianDay: startJulianDay },
      target: {
        id: target.id,
        fallbackName: target.name,
        color: target.visual?.color ?? '#dce9ff',
      },
      terrainHorizon: this.terrainHorizon(),
      sample: (time) => this.calculateTimelineSample(target, time, location),
    });
  });
  protected readonly observationTimeline = computed(() => this.observationForecast()?.[0] ?? null);
  private readonly observerView = signal<EarthObserverViewState | null>(null);
  private readonly pendingObserverView = signal<EarthObserverViewState | null>(null);
  private readonly plannerTarget = signal<SpaceObject | null>(null);
  private readonly effectiveObserverView = computed(
    () => this.pendingObserverView() ?? this.observerView(),
  );
  private readonly viewport = signal(readViewport());
  private readonly earthSkyJourney = inject(EarthSkyJourney);
  private readonly terrainHorizonCatalog = inject(EarthTerrainHorizonCatalogService);
  private focusCueSequence = 0;
  private focusCueTimeout: number | undefined;
  private pendingFocusCue: EarthSkyPendingFocusCue | null = null;
  private plannerTargetRequest = 0;
  private readonly target = computed(() => {
    const targetId = this.viewState.activeTargetId();
    const selected = this.facade.selectedObject();

    return selected?.id === targetId
      ? selected
      : (this.viewState.activeTarget() ?? this.facade.objects().find(({ id }) => id === targetId));
  });
  private readonly observationTimelineStartJulianDay = computed(() => {
    const location = this.observerSelection.location();

    return location
      ? earthObservationTimelineStartJulianDay(this.facade.currentTime(), location.longitude)
      : null;
  });
  private appliedObserverLocationKey = observerLocationKey(this.observerSelection.location());
  private readonly loadTerrainHorizon = effect((onCleanup) => {
    const location = this.observerSelection.location();
    let active = true;

    onCleanup(() => {
      active = false;
    });
    this.terrainHorizon.set(null);
    if (!location) {
      return;
    }
    void this.terrainHorizonCatalog.load(location).then((terrainHorizon) => {
      if (active) {
        this.terrainHorizon.set(terrainHorizon);
      }
    });
  });
  private readonly recenterForSharedLocationChanges = effect(() => {
    const location = this.observerSelection.location();
    const locationKey = observerLocationKey(location);

    if (locationKey === this.appliedObserverLocationKey || this.viewState.phase() !== 'open') {
      return;
    }
    this.appliedObserverLocationKey = locationKey;
    if (!location) {
      return;
    }
    const horizonPercentage = untracked(() => Number.parseFloat(this.horizonPosition()));

    untracked(() => {
      void this.recenterSky(horizonPercentage);
    });
  });
  private readonly synchronizeCelestialPresentations = effect(() => {
    const presentations =
      this.viewState.phase() === 'open'
        ? this.skyBodies().map((body) => ({
            objectId: body.id,
            direction: body.direction,
            diameterPixels: body.displayDiameterPixels,
          }))
        : [];

    this.facade.setEarthObserverCelestialPresentations(presentations);
  });

  constructor() {
    window.addEventListener(
      EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT,
      this.handleLookAtSettled as EventListener,
    );
    window.addEventListener(EARTH_OBSERVER_VIEW_EVENT, this.handleObserverView as EventListener);
    window.addEventListener('resize', this.handleResize);
  }

  public ngOnDestroy(): void {
    window.clearTimeout(this.focusCueTimeout);
    window.removeEventListener(
      EARTH_OBSERVER_LOOK_AT_SETTLED_EVENT,
      this.handleLookAtSettled as EventListener,
    );
    window.removeEventListener(EARTH_OBSERVER_VIEW_EVENT, this.handleObserverView as EventListener);
    window.removeEventListener('resize', this.handleResize);
    this.facade.setEarthObserverCelestialPresentations([]);
    this.viewState.close();
  }

  protected close(): void {
    this.pendingFocusCue = null;
    this.resetPlanner();
    this.facade.exitEarthObservation();
    this.viewState.close();
    this.facade.setTemporalMode('state');
  }

  protected changeLocation(locationId: string): void {
    const location = this.availableLocations().find(({ id }) => id === locationId) ?? null;

    this.applyLocation(location);
  }

  protected changeCurrentPosition(location: EarthObserverLocation): void {
    this.applyLocation(location);
  }

  protected async recenterSky(preservedHorizonPercentage?: number): Promise<void> {
    const targetId = this.viewState.activeTargetId();

    if (targetId) {
      const target = this.target();
      const location = this.observerSelection.location();
      const framing =
        target && location
          ? earthSkyEntryFraming(
              target,
              this.facade.currentTime(),
              location,
              preservedHorizonPercentage,
            )
          : null;
      const observation = this.observation();

      if (framing) {
        this.pendingObserverView.set({
          active: true,
          azimuthOffsetDegrees: 0,
          pitchOffsetDegrees: framing.initialPitchOffsetDegrees,
          verticalFieldOfViewDegrees:
            framing.verticalFieldOfViewDegrees ?? EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
          ...(observation
            ? {
                centerAltitudeDegrees:
                  observation.geometricAltitudeDegrees + framing.initialPitchOffsetDegrees,
                centerAzimuthDegrees: observation.azimuthDegrees,
              }
            : {}),
        });
      }
      try {
        await this.facade.prepareEarthObservation(
          targetId,
          framing ?? undefined,
          this.facade.selectedObject()?.id ?? null,
        );
      } catch (error: unknown) {
        this.pendingObserverView.set(null);
        throw error;
      }
    }
  }

  protected toggleConstellations(): void {
    this.facade.toggleConstellations();
  }

  protected toggleLabels(): void {
    this.facade.toggleLabels();
  }

  protected togglePlanner(): void {
    if (this.plannerOpen()) {
      this.resetPlanner();
    } else {
      this.plannerTarget.set(null);
      this.plannerOpen.set(true);
    }
  }

  protected closePlanner(): void {
    this.resetPlanner();
  }

  protected focusPlannerItem(item: EarthObservationPlannerItem): void {
    this.focusPlannerObservation(item.id, item.fallbackName, item.color, item.observation);
  }

  protected async focusPlannerTimeline(timeline: EarthObservationTimeline): Promise<void> {
    const bestPoint = timeline.bestPoint;

    if (!bestPoint) {
      return;
    }
    this.facade.setTime(bestPoint.time);
    const target = this.plannerTarget() ?? this.target();

    if (target?.id === timeline.target.id && target.id !== this.viewState.activeTargetId()) {
      const retargeted = await this.earthSkyJourney.retarget(
        target,
        Number.parseFloat(this.horizonPosition()),
      );

      if (retargeted) {
        this.resetPlanner();
      }

      return;
    }
    this.focusPlannerObservation(
      timeline.target.id,
      timeline.target.fallbackName,
      timeline.target.color,
      bestPoint.targetObservation,
    );
  }

  protected async selectPlannerTarget(result: SearchEntry): Promise<void> {
    const request = ++this.plannerTargetRequest;
    const installed = this.facade.objects().find(({ id }) => id === result.id);
    const target = installed ?? (await this.facade.resolveObject(result.id));

    if (
      request === this.plannerTargetRequest &&
      this.plannerOpen() &&
      target &&
      isEarthSkyTarget(target)
    ) {
      this.plannerTarget.set(target);
    }
  }

  protected async selectSearchResult(result: SearchEntry): Promise<void> {
    await this.earthSkyJourney.retargetById(result.id, Number.parseFloat(this.horizonPosition()));
  }

  protected selectSkyBody(body: ProjectedEarthSkyBody): void {
    this.pendingFocusCue = null;
    this.facade.selectObject(body.id);
    this.showFocusCue({
      objectId: body.id,
      fallbackName: body.fallbackName,
      color: body.color,
      altitudeDegrees: body.observation.altitudeDegrees,
      compassDirection: body.observation.compassDirection,
      xPercent: body.xPercent,
      yPercent: body.yPercent,
    });
  }

  protected zoomSkyBody(
    event: WheelEvent,
    anchorAltitudeDegrees: number,
    anchorAzimuthDegrees: number,
  ): void {
    const forwardedEvent = new CustomEvent<EarthObserverZoomAtDetail>(
      EARTH_OBSERVER_ZOOM_AT_EVENT,
      {
        cancelable: true,
        detail: {
          anchorAltitudeDegrees,
          anchorAzimuthDegrees,
          clientX: event.clientX,
          clientY: event.clientY,
          deltaMode: event.deltaMode,
          deltaY: event.deltaY,
          timeStamp: event.timeStamp,
        },
      },
    );

    window.dispatchEvent(forwardedEvent);
    if (forwardedEvent.defaultPrevented) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private focusPlannerObservation(
    objectId: string,
    fallbackName: string,
    color: string,
    observation: EarthObservationPlannerItem['observation'],
  ): void {
    this.facade.selectObject(objectId);
    const target: EarthObserverLookAtDetail = {
      altitudeDegrees: observation.altitudeDegrees,
      azimuthDegrees: observation.azimuthDegrees,
    };

    this.pendingFocusCue = {
      cue: {
        objectId,
        fallbackName,
        color,
        altitudeDegrees: observation.altitudeDegrees,
        compassDirection: observation.compassDirection,
        xPercent: 50,
        yPercent: 50,
      },
      target,
    };
    const lookAtEvent = new CustomEvent<EarthObserverLookAtDetail>(EARTH_OBSERVER_LOOK_AT_EVENT, {
      cancelable: true,
      detail: target,
    });

    window.dispatchEvent(lookAtEvent);
    if (!lookAtEvent.defaultPrevented) {
      this.pendingFocusCue = null;
    }
    this.resetPlanner();
  }

  private calculateTimelineSample(
    target: SpaceObject,
    time: UniverseTime,
    location: EarthObserverLocation,
  ): EarthObservationTimelineSample | null {
    const solarSystem = calculateSolarSystemSky(time, location);
    const moon = solarSystem.find(({ id }) => id === 'moon');
    const sun = calculateSunSkyObservation(time, location);
    const targetObservation = isSolarSystemSkyBodyId(target.id)
      ? solarSystem.find(({ id }) => id === target.id)?.observation
      : calculateEarthSkyTargetObservation(target, time, location);

    return moon?.lunarIllumination && sun && targetObservation
      ? {
          target: targetObservation,
          sun,
          moon: moon.observation,
          moonIlluminatedFraction: moon.lunarIllumination.illuminatedFraction,
        }
      : null;
  }

  private applyLocation(location: EarthObserverLocation | null): void {
    const currentHorizonPercentage = Number.parseFloat(this.horizonPosition());

    this.appliedObserverLocationKey = observerLocationKey(location);
    this.observerSelection.setLocation(location);
    if (location) {
      void this.recenterSky(currentHorizonPercentage);
    }
  }

  private resetPlanner(): void {
    this.plannerTargetRequest += 1;
    this.plannerTarget.set(null);
    this.plannerOpen.set(false);
  }

  private showFocusCue(cue: EarthSkyFocusCueInput): void {
    window.clearTimeout(this.focusCueTimeout);
    this.focusCues.set([
      {
        sequence: ++this.focusCueSequence,
        objectId: cue.objectId,
        name: this.i18n.objectName(cue.objectId, cue.fallbackName),
        color: cue.color,
        altitudeDegrees: cue.altitudeDegrees,
        compassDirection: cue.compassDirection,
        xPercent: cue.xPercent,
        yPercent: cue.yPercent,
      },
    ]);
    this.focusCueTimeout = window.setTimeout(() => {
      this.focusCues.set([]);
      this.focusCueTimeout = undefined;
    }, FOCUS_CUE_DURATION_MILLISECONDS);
  }

  private readonly handleLookAtSettled = (event: CustomEvent<EarthObserverLookAtDetail>): void => {
    const pending = this.pendingFocusCue;

    this.pendingFocusCue = null;
    if (
      !pending ||
      Math.abs(pending.target.altitudeDegrees - event.detail.altitudeDegrees) > Number.EPSILON ||
      Math.abs(pending.target.azimuthDegrees - event.detail.azimuthDegrees) > Number.EPSILON
    ) {
      return;
    }
    this.showFocusCue(pending.cue);
  };

  private readonly handleObserverView = (event: CustomEvent<EarthObserverViewState>): void => {
    const observerView = event.detail.active ? event.detail : null;

    this.observerView.set(observerView);
    if (observerView && observerViewsMatch(observerView, this.pendingObserverView(), 0.5)) {
      this.pendingObserverView.set(null);
    }
  };
  private readonly handleResize = (): void => {
    this.viewport.set(readViewport());
  };
}

function readViewport(): { readonly width: number; readonly height: number } {
  return {
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
  };
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function observerLocationKey(location: EarthObserverLocation | null): string {
  return location
    ? `${location.id}:${location.latitude}:${location.longitude}:${location.timeZone}`
    : 'none';
}

function observerViewsMatch(
  current: EarthObserverViewState,
  expected: EarthObserverViewState | null,
  toleranceDegrees: number,
): boolean {
  return (
    expected !== null &&
    observerAltitudesMatch(current, expected, toleranceDegrees) &&
    angularDistanceDegrees(current.azimuthOffsetDegrees, expected.azimuthOffsetDegrees) <=
      toleranceDegrees &&
    Math.abs(current.verticalFieldOfViewDegrees - expected.verticalFieldOfViewDegrees) <=
      toleranceDegrees
  );
}

function observerAltitudesMatch(
  current: EarthObserverViewState,
  expected: EarthObserverViewState,
  toleranceDegrees: number,
): boolean {
  return current.centerAltitudeDegrees !== undefined && expected.centerAltitudeDegrees !== undefined
    ? Math.abs(current.centerAltitudeDegrees - expected.centerAltitudeDegrees) <= toleranceDegrees
    : Math.abs(current.pitchOffsetDegrees - expected.pitchOffsetDegrees) <= toleranceDegrees;
}

function angularDistanceDegrees(first: number, second: number): number {
  const distance = Math.abs(normalizeDegrees(first) - normalizeDegrees(second));

  return Math.min(distance, 360 - distance);
}
