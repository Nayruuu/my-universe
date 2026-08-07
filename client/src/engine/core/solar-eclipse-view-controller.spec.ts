import * as THREE from 'three';
import { type Mock } from 'vitest';
import { type SpaceObject } from '../../data/models/universe.models';
import { calculateEarthObserverDirection } from '../simulation/body-orientation';
import { type EarthEclipseEvent } from '../simulation/earth-eclipse';
import { calculateSolarEclipseAppearance } from '../simulation/solar-eclipse-calculator';
import { dateToJulianDay } from '../simulation/time-utils';
import { SolarEclipsePresentationController } from './solar-eclipse-presentation';
import {
  type SolarEclipseViewCameraController,
  SolarEclipseViewController,
  type SolarEclipseViewRegistry,
} from './solar-eclipse-view-controller';

describe('SolarEclipseViewController', () => {
  it('cadre la Terre vers la progression de la trajectoire centrale', () => {
    const harness = createHarness();
    const appearance = calculateSolarEclipseAppearance(SOLAR_ECLIPSE.peak);
    const expectedDirection = calculateEarthObserverDirection(
      SOLAR_ECLIPSE.peak,
      appearance.centralLatitude! * 0.86,
      appearance.centralLongitude! + 10,
    );

    harness.controller.viewSolarEclipse(SOLAR_ECLIPSE);

    expect(harness.setTime).toHaveBeenCalledWith(SOLAR_ECLIPSE.peak);
    expect(harness.clearNavigationLock).toHaveBeenCalledOnce();
    expect(harness.registry.setSolarObserverActive).toHaveBeenCalledWith(false);
    expect(harness.registry.clearSolarEclipsePath).toHaveBeenCalledOnce();
    expect(harness.adoptTarget).toHaveBeenCalledWith('earth');
    expect(harness.selectObject).toHaveBeenCalledWith(null);
    expect(harness.camera.focusOnFromDirection).toHaveBeenCalledWith(
      harness.positions.get('earth'),
      harness.definitions.get('earth'),
      expect.any(THREE.Vector3),
      9.6,
    );
    const framingDirection = harness.camera.focusOnFromDirection.mock.calls.at(-1)?.[2];

    expect(
      framingDirection?.distanceTo(
        new THREE.Vector3(expectedDirection.x, expectedDirection.y, expectedDirection.z),
      ),
    ).toBeLessThan(1e-12);
    expect(harness.emitTargetChanged).toHaveBeenCalledWith('earth');
    expect(harness.presentation.activeEvent).toBe(SOLAR_ECLIPSE);
  });

  it.each([
    ['registre', (harness: Harness) => (harness.registryAvailable = false), SOLAR_ECLIPSE],
    ['contrôleur', (harness: Harness) => (harness.cameraAvailable = false), SOLAR_ECLIPSE],
    ['position terrestre', (harness: Harness) => harness.positions.delete('earth'), SOLAR_ECLIPSE],
    [
      'définition terrestre',
      (harness: Harness) => harness.definitions.delete('earth'),
      SOLAR_ECLIPSE,
    ],
    ['alignement', () => undefined, NON_ECLIPSE],
  ])('refuse une vue orbitale sans %s', (_label, mutate, event) => {
    const harness = createHarness();

    mutate(harness);

    expect(() => harness.controller.viewSolarEclipse(event)).toThrow(
      'Cette éclipse solaire est indisponible',
    );
    expect(harness.setTime).toHaveBeenCalledWith(event.peak);
  });

  it('place la caméra sur le géoïde pour observer le Soleil éclipsé', () => {
    const harness = createHarness();

    harness.controller.observeSolarEclipse(SOLAR_ECLIPSE);

    expect(harness.setTime).toHaveBeenCalledWith(SOLAR_ECLIPSE.peak);
    expect(harness.registry.setSolarObserverActive).toHaveBeenCalledWith(true, expect.any(Number));
    expect(harness.presentation.observerMoonScale).toBeGreaterThanOrEqual(0.72);
    expect(harness.presentation.observerMoonScale).toBeLessThanOrEqual(1.28);
    expect(harness.clearNavigationLock).toHaveBeenCalledOnce();
    expect(harness.resetNavigation).toHaveBeenCalledOnce();
    expect(harness.setNavigationTarget).toHaveBeenCalledWith('sun');
    expect(harness.selectObject).toHaveBeenCalledWith(null);
    expect(harness.clearLabels).toHaveBeenCalledOnce();
    expect(harness.camera.observeFrom).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      harness.positions.get('sun'),
    );
    const observerPosition = harness.camera.observeFrom.mock.calls.at(-1)?.[0];

    expect(observerPosition?.distanceTo(harness.positions.get('earth')!)).toBeGreaterThan(0);
    expect(harness.emitTargetChanged).toHaveBeenCalledWith(null);
  });

  it('utilise le centre calculé lorsque l’événement ne fournit pas de coordonnées', () => {
    const harness = createHarness();

    harness.controller.observeSolarEclipse({
      ...SOLAR_ECLIPSE,
      latitude: null,
      longitude: null,
    });

    expect(harness.camera.observeFrom).toHaveBeenCalledOnce();
  });

  it.each([
    ['registre', (harness: Harness) => (harness.registryAvailable = false), SOLAR_ECLIPSE],
    ['contrôleur', (harness: Harness) => (harness.cameraAvailable = false), SOLAR_ECLIPSE],
    ['Terre', (harness: Harness) => harness.positions.delete('earth'), SOLAR_ECLIPSE],
    ['Lune', (harness: Harness) => harness.positions.delete('moon'), SOLAR_ECLIPSE],
    ['Soleil', (harness: Harness) => harness.positions.delete('sun'), SOLAR_ECLIPSE],
    ['définition lunaire', (harness: Harness) => harness.definitions.delete('moon'), SOLAR_ECLIPSE],
    ['définition solaire', (harness: Harness) => harness.definitions.delete('sun'), SOLAR_ECLIPSE],
    ['coordonnées', () => undefined, { ...NON_ECLIPSE, latitude: null, longitude: null }],
  ])('refuse un observateur sans %s', (_label, mutate, event) => {
    const harness = createHarness();

    mutate(harness);

    expect(() => harness.controller.observeSolarEclipse(event)).toThrow(
      'point d’observation terrestre',
    );
    expect(harness.setTime).toHaveBeenCalledWith(event.peak);
  });

  it('active, masque et efface la trajectoire avec ou sans registre', () => {
    const harness = createHarness();

    harness.controller.setPathVisible(SOLAR_ECLIPSE, true);
    expect(harness.registry.showSolarEclipsePath).toHaveBeenCalledWith(
      SOLAR_ECLIPSE.peak,
      SOLAR_ECLIPSE.kind,
    );

    harness.controller.setPathVisible(SOLAR_ECLIPSE, false);
    expect(harness.registry.clearSolarEclipsePath).toHaveBeenCalledOnce();

    harness.controller.clearPresentation();
    expect(harness.registry.setSolarObserverActive).toHaveBeenCalledWith(false);
    expect(harness.presentation.activeEvent).toBeNull();

    harness.registryAvailable = false;
    harness.controller.setPathVisible(SOLAR_ECLIPSE, true);
    harness.controller.setPathVisible(SOLAR_ECLIPSE, false);
    harness.controller.clearPresentation();
    expect(harness.presentation.activeEvent).toBeNull();
  });
});

interface MockCameraController {
  readonly focusOnFromDirection: Mock<SolarEclipseViewCameraController['focusOnFromDirection']>;
  readonly observeFrom: Mock<SolarEclipseViewCameraController['observeFrom']>;
}

interface MockRegistry {
  readonly getWorldPosition: Mock<SolarEclipseViewRegistry['getWorldPosition']>;
  readonly getDefinition: Mock<SolarEclipseViewRegistry['getDefinition']>;
  readonly setSolarObserverActive: Mock<SolarEclipseViewRegistry['setSolarObserverActive']>;
  readonly clearSolarEclipsePath: Mock<SolarEclipseViewRegistry['clearSolarEclipsePath']>;
  readonly showSolarEclipsePath: Mock<SolarEclipseViewRegistry['showSolarEclipsePath']>;
}

interface Harness {
  readonly controller: SolarEclipseViewController;
  readonly presentation: SolarEclipsePresentationController;
  readonly camera: MockCameraController;
  readonly registry: MockRegistry;
  readonly definitions: Map<string, SpaceObject>;
  readonly positions: Map<string, THREE.Vector3>;
  readonly setTime: ReturnType<typeof vi.fn>;
  readonly clearNavigationLock: ReturnType<typeof vi.fn>;
  readonly adoptTarget: ReturnType<typeof vi.fn>;
  readonly resetNavigation: ReturnType<typeof vi.fn>;
  readonly setNavigationTarget: ReturnType<typeof vi.fn>;
  readonly selectObject: ReturnType<typeof vi.fn>;
  readonly clearLabels: ReturnType<typeof vi.fn>;
  readonly emitTargetChanged: ReturnType<typeof vi.fn>;
  registryAvailable: boolean;
  cameraAvailable: boolean;
}

function createHarness(): Harness {
  const definitions = new Map<string, SpaceObject>([
    ['sun', object('sun', 'Soleil', 'star', 5)],
    ['earth', object('earth', 'Terre', 'planet', 2)],
    ['moon', object('moon', 'Lune', 'moon', 1)],
  ]);
  const positions = new Map<string, THREE.Vector3>([
    ['sun', new THREE.Vector3(100, 0, 0)],
    ['earth', new THREE.Vector3(0, 0, 0)],
    ['moon', new THREE.Vector3(10, 0, 0)],
  ]);
  const registry: MockRegistry = {
    getWorldPosition: vi.fn((objectId: string) => positions.get(objectId) ?? null),
    getDefinition: vi.fn((objectId: string) => definitions.get(objectId)),
    setSolarObserverActive: vi.fn(),
    clearSolarEclipsePath: vi.fn(),
    showSolarEclipsePath: vi.fn(async () => undefined),
  };
  const camera: MockCameraController = {
    focusOnFromDirection: vi.fn(),
    observeFrom: vi.fn(),
  };
  const presentation = new SolarEclipsePresentationController();
  const setTime = vi.fn();
  const clearNavigationLock = vi.fn();
  const adoptTarget = vi.fn();
  const resetNavigation = vi.fn();
  const setNavigationTarget = vi.fn();
  const selectObject = vi.fn();
  const clearLabels = vi.fn();
  const emitTargetChanged = vi.fn();
  const harness = {
    controller: null as unknown as SolarEclipseViewController,
    presentation,
    camera,
    registry,
    definitions,
    positions,
    setTime,
    clearNavigationLock,
    adoptTarget,
    resetNavigation,
    setNavigationTarget,
    selectObject,
    clearLabels,
    emitTargetChanged,
    registryAvailable: true,
    cameraAvailable: true,
  };

  harness.controller = new SolarEclipseViewController(presentation, {
    getRegistry: () => (harness.registryAvailable ? registry : null),
    getCameraController: () => (harness.cameraAvailable ? camera : null),
    setTime,
    clearNavigationLock,
    adoptTarget,
    resetNavigation,
    setNavigationTarget,
    selectObject,
    clearLabels,
    emitTargetChanged,
  });

  return harness;
}

function object(
  id: string,
  name: string,
  type: SpaceObject['type'],
  visualRadius: number,
): SpaceObject {
  return {
    id,
    name,
    type,
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

const SOLAR_ECLIPSE: EarthEclipseEvent = {
  id: 'solar-total-2026-08-12',
  family: 'solar',
  kind: 'total',
  scope: 'global',
  peak: {
    julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
  },
  obscuration: 1,
  durationMinutes: 4,
  latitude: 65.2,
  longitude: -25.2,
  observerName: null,
  observerTimeZone: null,
  sunAltitudeDegrees: null,
};

const NON_ECLIPSE: EarthEclipseEvent = {
  ...SOLAR_ECLIPSE,
  id: 'solar-unavailable',
  peak: {
    julianDay: dateToJulianDay(new Date('2026-07-28T12:00:00.000Z')),
  },
};
