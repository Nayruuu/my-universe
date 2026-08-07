import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_VIEW_EVENT,
  type EarthObserverViewState,
} from '../../../engine/camera/earth-observer-camera-control';
import { EARTH_OBSERVER_LOCATIONS } from '../../../engine/simulation/earth-observer-location';
import { calculateSolarSystemSky } from '../../../engine/simulation/solar-system-sky';
import { calculateStellarObservation } from '../../../engine/simulation/stellar-observation';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import { EarthHorizonComponent } from './earth-horizon.component';
import { EarthObserverLocationPickerComponent } from './earth-observer-location-picker.component';
import { EarthObserverSelection } from './earth-observer-selection';
import { earthSkyEntryFraming, earthSkyFramingForHorizon } from './earth-sky-entry-framing';
import { projectEarthSkyBodies } from './earth-sky-body-projection';
import { equatorialCoordinates } from './earth-sky-catalog';
import { lunarPhasePresentation } from './lunar-phase-presentation';
import { EarthSkyViewState } from './earth-sky-view-state';

@Component({
  selector: 'app-earth-sky-view',
  styleUrl: './earth-sky-view.component.scss',
  templateUrl: './earth-sky-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EarthHorizonComponent, EarthObserverLocationPickerComponent],
})
export class EarthSkyViewComponent implements OnDestroy {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly earthName = computed(() => this.i18n.objectName('earth', 'Terre'));
  protected readonly observerSelection = inject(EarthObserverSelection);
  protected readonly viewState = inject(EarthSkyViewState);
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
      observerView?.verticalFieldOfViewDegrees ?? EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES;

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
      EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
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
  protected readonly skyBodies = computed(() => {
    const observation = this.observation();
    const location = this.observerSelection.location();

    if (!observation || !location) {
      return [];
    }

    return projectEarthSkyBodies(
      calculateSolarSystemSky(this.facade.currentTime(), location),
      observation,
      this.effectiveObserverView(),
      this.viewport(),
    ).map((body) => ({
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
  private readonly target = computed(() => {
    const targetId = this.viewState.activeTargetId();
    const selected = this.facade.selectedObject();

    return selected?.id === targetId
      ? selected
      : (this.viewState.activeTarget() ?? this.facade.objects().find(({ id }) => id === targetId));
  });

  constructor() {
    window.addEventListener(EARTH_OBSERVER_VIEW_EVENT, this.handleObserverView as EventListener);
    window.addEventListener('resize', this.handleResize);
  }

  public ngOnDestroy(): void {
    window.removeEventListener(EARTH_OBSERVER_VIEW_EVENT, this.handleObserverView as EventListener);
    window.removeEventListener('resize', this.handleResize);
    this.viewState.close();
  }

  protected close(): void {
    this.viewState.close();
    this.facade.setTemporalMode('state');
  }

  protected changeLocation(locationId: string): void {
    const location = this.availableLocations().find(({ id }) => id === locationId) ?? null;
    const currentHorizonPercentage = Number.parseFloat(this.horizonPosition());

    this.observerSelection.setLocation(location);
    if (location) {
      void this.recenterSky(currentHorizonPercentage);
    }
  }

  protected async recenterSky(preservedHorizonPercentage?: number): Promise<void> {
    const targetId = this.viewState.activeTargetId();

    if (targetId) {
      const target = this.target();
      const location = this.observerSelection.location();
      const entryFraming =
        target && location
          ? earthSkyEntryFraming(target, this.facade.currentTime(), location)
          : null;
      const observation = this.observation();
      const framing =
        entryFraming && observation && preservedHorizonPercentage !== undefined
          ? earthSkyFramingForHorizon(
              entryFraming,
              observation.geometricAltitudeDegrees,
              preservedHorizonPercentage,
            )
          : entryFraming;

      if (framing) {
        this.pendingObserverView.set({
          active: true,
          azimuthOffsetDegrees: 0,
          pitchOffsetDegrees: framing.initialPitchOffsetDegrees,
          verticalFieldOfViewDegrees: EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
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

  protected selectSkyBody(objectId: string): void {
    this.facade.selectObject(objectId);
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

function observerViewsMatch(
  current: EarthObserverViewState,
  expected: EarthObserverViewState | null,
  toleranceDegrees: number,
): boolean {
  return (
    expected !== null &&
    Math.abs(current.pitchOffsetDegrees - expected.pitchOffsetDegrees) <= toleranceDegrees &&
    angularDistanceDegrees(current.azimuthOffsetDegrees, expected.azimuthOffsetDegrees) <=
      toleranceDegrees &&
    Math.abs(current.verticalFieldOfViewDegrees - expected.verticalFieldOfViewDegrees) <=
      toleranceDegrees
  );
}

function angularDistanceDegrees(first: number, second: number): number {
  const distance = Math.abs(normalizeDegrees(first) - normalizeDegrees(second));

  return Math.min(distance, 360 - distance);
}
