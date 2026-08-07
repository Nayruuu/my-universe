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
import type { SearchEntry, SpaceObjectType } from '../../../data/models/universe.models';
import {
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_VIEW_EVENT,
  EARTH_OBSERVER_ZOOM_AT_EVENT,
  type EarthObserverViewState,
  type EarthObserverZoomAtDetail,
} from '../../../engine/camera/earth-observer-camera-control';
import {
  EARTH_OBSERVER_LOCATIONS,
  type EarthObserverLocation,
} from '../../../engine/simulation/earth-observer-location';
import { calculateSolarSystemSky } from '../../../engine/simulation/solar-system-sky';
import { calculateStellarObservation } from '../../../engine/simulation/stellar-observation';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import { UniverseSearchComponent } from '../search/universe-search.component';
import { EarthHorizonComponent } from './earth-horizon.component';
import { EarthObserverLocationPickerComponent } from './earth-observer-location-picker.component';
import { EarthObserverSelection } from './earth-observer-selection';
import { earthSkyEntryFraming } from './earth-sky-entry-framing';
import { projectEarthSkyBodies } from './earth-sky-body-projection';
import { equatorialCoordinates } from './earth-sky-catalog';
import {
  earthTerrainObstructionDegrees,
  isEarthTerrainObstructed,
} from './earth-terrain-horizon-catalog';
import { EarthTerrainHorizonCatalogService } from './earth-terrain-horizon-catalog.service';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';
import { lunarPhasePresentation } from './lunar-phase-presentation';
import { EarthSkyViewState } from './earth-sky-view-state';
import { EarthSkyJourney } from './earth-sky-journey';

@Component({
  selector: 'app-earth-sky-view',
  styleUrl: './earth-sky-view.component.scss',
  templateUrl: './earth-sky-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EarthHorizonComponent, EarthObserverLocationPickerComponent, UniverseSearchComponent],
})
export class EarthSkyViewComponent implements OnDestroy {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly earthName = computed(() => this.i18n.objectName('earth', 'Terre'));
  protected readonly observerSelection = inject(EarthObserverSelection);
  protected readonly viewState = inject(EarthSkyViewState);
  protected readonly terrainHorizon = signal<EarthTerrainHorizonProfile | null>(null);
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
    const coordinates = target ? equatorialCoordinates(target) : null;

    return coordinates && location
      ? calculateStellarObservation(this.facade.currentTime(), coordinates, location)
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
  protected readonly skyBodies = computed(() => {
    const observation = this.observation();
    const location = this.observerSelection.location();

    if (!observation || !location) {
      return [];
    }

    const terrainHorizon = this.terrainHorizon();

    return projectEarthSkyBodies(
      calculateSolarSystemSky(this.facade.currentTime(), location),
      observation,
      this.effectiveObserverView(),
      this.viewport(),
    )
      .filter(
        (body) =>
          !terrainHorizon ||
          !isEarthTerrainObstructed(
            terrainHorizon,
            body.observation.geometricAltitudeDegrees,
            body.observation.azimuthDegrees,
          ),
      )
      .map((body) => ({
        ...body,
        name: this.i18n.objectName(body.id, body.fallbackName),
        lunarPhase: lunarPhasePresentation(body.lunarIllumination),
      }));
  });
  private readonly observerView = signal<EarthObserverViewState | null>(null);
  private readonly pendingObserverView = signal<EarthObserverViewState | null>(null);
  private readonly effectiveObserverView = computed(
    () => this.pendingObserverView() ?? this.observerView(),
  );
  private readonly viewport = signal(readViewport());
  private readonly earthSkyJourney = inject(EarthSkyJourney);
  private readonly terrainHorizonCatalog = inject(EarthTerrainHorizonCatalogService);
  private readonly target = computed(() => {
    const targetId = this.viewState.activeTargetId();
    const selected = this.facade.selectedObject();

    return selected?.id === targetId
      ? selected
      : (this.viewState.activeTarget() ?? this.facade.objects().find(({ id }) => id === targetId));
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
    window.addEventListener(EARTH_OBSERVER_VIEW_EVENT, this.handleObserverView as EventListener);
    window.addEventListener('resize', this.handleResize);
  }

  public ngOnDestroy(): void {
    window.removeEventListener(EARTH_OBSERVER_VIEW_EVENT, this.handleObserverView as EventListener);
    window.removeEventListener('resize', this.handleResize);
    this.facade.setEarthObserverCelestialPresentations([]);
    this.viewState.close();
  }

  protected close(): void {
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

  protected async selectSearchResult(result: SearchEntry): Promise<void> {
    await this.earthSkyJourney.retargetById(result.id, Number.parseFloat(this.horizonPosition()));
  }

  protected selectSkyBody(objectId: string): void {
    this.facade.selectObject(objectId);
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

  private applyLocation(location: EarthObserverLocation | null): void {
    const currentHorizonPercentage = Number.parseFloat(this.horizonPosition());

    this.appliedObserverLocationKey = observerLocationKey(location);
    this.observerSelection.setLocation(location);
    if (location) {
      void this.recenterSky(currentHorizonPercentage);
    }
  }

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
