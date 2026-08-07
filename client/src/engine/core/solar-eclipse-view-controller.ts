import * as THREE from 'three';
import { type SpaceObject } from '../../data/models/universe.models';
import { calculateEarthObserverDirection } from '../simulation/body-orientation';
import { type EarthEclipseEvent } from '../simulation/earth-eclipse';
import {
  calculateSolarEclipseAppearance,
  calculateSolarObserverDiscRatio,
} from '../simulation/solar-eclipse-calculator';
import {
  type SolarEclipsePresentationRegistry,
  SolarEclipsePresentationController,
} from './solar-eclipse-presentation';

const EARTH_RADIUS_TO_MEAN_LUNAR_DISTANCE = 6_378.137 / 384_400;

export interface SolarEclipseViewCameraController {
  focusOnFromDirection(
    position: THREE.Vector3,
    object: SpaceObject,
    direction: THREE.Vector3,
    distance: number,
  ): void;
  observeFrom(position: THREE.Vector3, target: THREE.Vector3): void;
}

export interface SolarEclipseViewRegistry extends SolarEclipsePresentationRegistry {
  getWorldPosition(objectId: string): THREE.Vector3 | null;
  getDefinition(objectId: string): SpaceObject | undefined;
}

export interface SolarEclipseViewBindings {
  getRegistry(): SolarEclipseViewRegistry | null;
  getCameraController(): SolarEclipseViewCameraController | null;
  setTime(time: EarthEclipseEvent['peak']): void;
  clearNavigationLock(): void;
  adoptTarget(objectId: string): void;
  resetNavigation(): void;
  setNavigationTarget(objectId: string | null): void;
  selectObject(objectId: string | null): void;
  clearLabels(): void;
  emitTargetChanged(objectId: string | null): void;
}

interface SolarEclipseObserverFrame {
  readonly registry: SolarEclipseViewRegistry;
  readonly cameraController: SolarEclipseViewCameraController;
  readonly observerPosition: THREE.Vector3;
  readonly sunPosition: THREE.Vector3;
  readonly moonVisualScale: number;
}

export class SolarEclipseViewController {
  constructor(
    private readonly presentation: SolarEclipsePresentationController,
    private readonly bindings: SolarEclipseViewBindings,
  ) {}

  public viewSolarEclipse(event: EarthEclipseEvent): void {
    this.bindings.setTime(event.peak);
    const registry = this.bindings.getRegistry();
    const cameraController = this.bindings.getCameraController();
    const earthPosition = registry?.getWorldPosition('earth');
    const earth = registry?.getDefinition('earth');
    const appearance = calculateSolarEclipseAppearance(event.peak);
    const framingDirection =
      appearance.centralLatitude === null
        ? appearance.shadowDirection
        : calculateEarthObserverDirection(
            event.peak,
            appearance.centralLatitude * 0.86,
            appearance.centralLongitude! + 10,
          );

    if (!registry || !cameraController || !earthPosition || !earth || appearance.phase === 'none') {
      throw new Error('Cette éclipse solaire est indisponible.');
    }

    this.bindings.clearNavigationLock();
    this.presentation.showOrbitalView(event, registry);
    this.bindings.adoptTarget('earth');
    this.bindings.selectObject(null);
    cameraController.focusOnFromDirection(
      earthPosition,
      earth,
      new THREE.Vector3(framingDirection.x, framingDirection.y, framingDirection.z),
      earth.visual.visualRadius * 4.8,
    );
    this.bindings.emitTargetChanged('earth');
  }

  public observeSolarEclipse(event: EarthEclipseEvent): void {
    this.bindings.setTime(event.peak);
    const frame = this.createObserverFrame(event);

    this.bindings.clearNavigationLock();
    this.presentation.showObserverView(event, frame.moonVisualScale, frame.registry);
    this.bindings.resetNavigation();
    this.bindings.setNavigationTarget('sun');
    this.bindings.selectObject(null);
    this.bindings.clearLabels();
    frame.cameraController.observeFrom(frame.observerPosition, frame.sunPosition);
    this.bindings.emitTargetChanged(null);
  }

  public setPathVisible(event: EarthEclipseEvent, visible: boolean): void {
    this.presentation.setPathVisible(event, visible, this.bindings.getRegistry());
  }

  public clearPresentation(): void {
    this.presentation.clear(this.bindings.getRegistry());
  }

  private createObserverFrame(event: EarthEclipseEvent): SolarEclipseObserverFrame {
    const registry = this.bindings.getRegistry();
    const cameraController = this.bindings.getCameraController();
    const earthPosition = registry?.getWorldPosition('earth');
    const moonPosition = registry?.getWorldPosition('moon');
    const sunPosition = registry?.getWorldPosition('sun');
    const moon = registry?.getDefinition('moon');
    const sun = registry?.getDefinition('sun');
    const appearance = calculateSolarEclipseAppearance(event.peak);
    const latitude = event.latitude ?? appearance.centralLatitude;
    const longitude = event.longitude ?? appearance.centralLongitude;

    if (
      !registry ||
      !cameraController ||
      !earthPosition ||
      !moonPosition ||
      !sunPosition ||
      !moon ||
      !sun ||
      latitude === null ||
      longitude === null
    ) {
      throw new Error('Le point d’observation terrestre de cette éclipse est indisponible.');
    }

    const observerPosition = createEarthObserverPosition(
      event,
      earthPosition,
      moonPosition,
      latitude,
      longitude,
    );

    return {
      registry,
      cameraController,
      observerPosition,
      sunPosition,
      moonVisualScale: calculateObserverMoonScale(
        event,
        observerPosition,
        moonPosition,
        sunPosition,
        moon,
        sun,
        latitude,
        longitude,
      ),
    };
  }
}

function createEarthObserverPosition(
  event: EarthEclipseEvent,
  earthPosition: THREE.Vector3,
  moonPosition: THREE.Vector3,
  latitude: number,
  longitude: number,
): THREE.Vector3 {
  const observerDirection = calculateEarthObserverDirection(event.peak, latitude, longitude);
  const observerOffset =
    earthPosition.distanceTo(moonPosition) * EARTH_RADIUS_TO_MEAN_LUNAR_DISTANCE;

  return earthPosition
    .clone()
    .add(
      new THREE.Vector3(
        observerDirection.x,
        observerDirection.y,
        observerDirection.z,
      ).multiplyScalar(observerOffset),
    );
}

function calculateObserverMoonScale(
  event: EarthEclipseEvent,
  observerPosition: THREE.Vector3,
  moonPosition: THREE.Vector3,
  sunPosition: THREE.Vector3,
  moon: SpaceObject,
  sun: SpaceObject,
  latitude: number,
  longitude: number,
): number {
  const discRatio = calculateSolarObserverDiscRatio(event.peak, latitude, longitude);
  const sunDistance = observerPosition.distanceTo(sunPosition);
  const moonDistance = observerPosition.distanceTo(moonPosition);
  const adaptedSunAngularRadius = Math.asin(Math.min(0.999, sun.visual.visualRadius / sunDistance));
  const adaptedMoonRadius = Math.sin(adaptedSunAngularRadius * discRatio) * moonDistance;

  return THREE.MathUtils.clamp(adaptedMoonRadius / moon.visual.visualRadius, 0.72, 1.28);
}
