import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { EarthHorizonCityscapeKind } from './earth-horizon-cityscapes';
import type { EarthHorizonPerspective } from './earth-horizon-profile';
import { createEarthCatalogCityscape } from './earth-catalog-cityscape';
import type { EarthLandmarkDefinition } from './earth-landmark-catalog';
import { EarthLandmarkCatalogService } from './earth-landmark-catalog.service';
import { projectEarthLandmarkLayouts } from './earth-landmark-layout';
import {
  PARIS_FAR_SILHOUETTE_PATH,
  PARIS_LIGHT_POOLS,
  PARIS_NEAR_SILHOUETTE_PATH,
  PARIS_WINDOW_LIGHTS,
} from './earth-paris-cityscape';
import {
  PARIS_PANORAMA_HEIGHT,
  PARIS_PANORAMA_WIDTH,
  projectParisLandmarkLayouts,
} from './earth-paris-landmarks';
import { earthRegionalCityscape } from './earth-regional-cityscapes';
import { projectEarthRegionalLandmarkLayouts } from './earth-regional-landmarks';

const DESKTOP_RENDERED_HEIGHT = 184;
const MOBILE_RENDERED_HEIGHT = 130;

interface EarthCityscapePanoramaProjection {
  readonly viewBox: string;
  readonly unitsPerRenderedPixel: number;
}

@Component({
  selector: 'app-earth-cityscape',
  styleUrl: './earth-cityscape.component.scss',
  templateUrl: './earth-cityscape.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EarthCityscapeComponent {
  public readonly kind = input.required<EarthHorizonCityscapeKind>();
  public readonly location = input<EarthObserverLocation | null>(null);
  public readonly perspective = input.required<EarthHorizonPerspective>();
  public readonly showIllustrativeTerrain = input(true);
  protected readonly parisFarSilhouettePath = PARIS_FAR_SILHOUETTE_PATH;
  protected readonly parisLightPools = PARIS_LIGHT_POOLS;
  protected readonly parisNearSilhouettePath = PARIS_NEAR_SILHOUETTE_PATH;
  protected readonly parisWindowLights = PARIS_WINDOW_LIGHTS;
  protected readonly panoramaProjection = computed(() =>
    earthCityscapePanoramaProjection(this.perspective()),
  );
  protected readonly parisLandmarkLayouts = computed(() =>
    projectParisLandmarkLayouts(this.panoramaProjection().unitsPerRenderedPixel),
  );
  protected readonly regionalCityscape = computed(() => earthRegionalCityscape(this.kind()));
  protected readonly regionalLandmarkLayouts = computed(() =>
    projectEarthRegionalLandmarkLayouts(
      this.kind(),
      this.panoramaProjection().unitsPerRenderedPixel,
    ),
  );
  protected readonly catalogLandmarkLayouts = computed(() => {
    const location = this.location();

    return location
      ? projectEarthLandmarkLayouts(
          location,
          this.catalogLandmarks(),
          this.panoramaProjection().unitsPerRenderedPixel,
          {
            verticalFieldOfViewDegrees: this.perspective().verticalFieldOfViewDegrees,
            viewportHeight: this.perspective().viewport.height,
          },
        )
      : [];
  });
  protected readonly catalogCityscape = computed(() => {
    const location = this.location();

    return this.kind() === 'procedural' && location ? createEarthCatalogCityscape(location) : null;
  });
  private readonly catalogService = inject(EarthLandmarkCatalogService);
  private readonly catalogLandmarks = signal<readonly EarthLandmarkDefinition[]>([]);
  private readonly loadCatalogLandmarks = effect((onCleanup) => {
    const location = this.location();
    let active = true;

    onCleanup(() => {
      active = false;
    });

    this.catalogLandmarks.set([]);
    if (this.kind() !== 'procedural' || !location) {
      return;
    }
    void this.catalogService
      .load(location.id)
      .then((landmarks) => {
        if (active) {
          this.catalogLandmarks.set(landmarks);
        }
      })
      .catch(() => {
        if (active) {
          this.catalogLandmarks.set([]);
        }
      });
  });
}

export function earthCityscapePanoramaViewBox(perspective: EarthHorizonPerspective): string {
  return earthCityscapePanoramaProjection(perspective).viewBox;
}

function earthCityscapePanoramaProjection(
  perspective: EarthHorizonPerspective,
): EarthCityscapePanoramaProjection {
  const verticalFieldOfViewRadians = degreesToRadians(perspective.verticalFieldOfViewDegrees);
  const aspectRatio = perspective.viewport.width / perspective.viewport.height;
  const horizontalFieldOfViewRadians =
    2 * Math.atan(Math.tan(verticalFieldOfViewRadians / 2) * aspectRatio);
  const visibleWidth = (horizontalFieldOfViewRadians / (Math.PI * 2)) * PARIS_PANORAMA_WIDTH;
  const renderedHeight =
    perspective.viewport.width <= 720 ? MOBILE_RENDERED_HEIGHT : DESKTOP_RENDERED_HEIGHT;
  const visibleHeight = (visibleWidth * renderedHeight) / perspective.viewport.width;
  const normalizedAzimuth = normalizeDegrees(perspective.centerAzimuthDegrees);
  const center = PARIS_PANORAMA_WIDTH + (normalizedAzimuth / 360) * PARIS_PANORAMA_WIDTH;

  return {
    viewBox: `${format(center - visibleWidth / 2)} ${format(PARIS_PANORAMA_HEIGHT - visibleHeight)} ${format(visibleWidth)} ${format(visibleHeight)}`,
    unitsPerRenderedPixel: visibleHeight / renderedHeight,
  };
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function format(value: number): string {
  return value.toFixed(3);
}
