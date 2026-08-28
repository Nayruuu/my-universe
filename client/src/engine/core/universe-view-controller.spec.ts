import * as THREE from 'three';
import { type Mock } from 'vitest';
import { type SpaceObject } from '../../data/models/universe.models';
import { NAVIGATION_SCALES } from '../camera/navigation-scales';
import {
  type UniverseViewCameraController,
  type UniverseViewRegistry,
  UniverseViewController,
} from './universe-view-controller';

describe('UniverseViewController', () => {
  it('cadre une cible et applique les distances dédiées aux catalogues', async () => {
    const harness = createHarness();

    await harness.controller.setTarget('earth', 12);

    expect(harness.ensureSpaceTileObject).toHaveBeenCalledWith('earth');
    expect(harness.ensureActiveExoplanetSystem).toHaveBeenCalledWith('earth');
    expect(harness.clearPresentation).toHaveBeenCalledOnce();
    expect(harness.clearNavigationLock).toHaveBeenCalledOnce();
    expect(harness.adoptTarget).toHaveBeenCalledWith('earth');
    expect(harness.selectObject).toHaveBeenCalledWith('earth');
    expect(harness.cameraController.focusOn).toHaveBeenCalledWith(
      harness.positions.get('earth'),
      harness.definitions.get('earth'),
      12,
    );
    expect(harness.emitTargetChanged).toHaveBeenCalledWith('earth');

    await harness.controller.setTarget('host');
    expect(harness.cameraController.focusOn).toHaveBeenLastCalledWith(
      harness.positions.get('host'),
      harness.definitions.get('host'),
      72,
    );

    await harness.controller.setTarget('catalog-star');
    const catalogPosition = harness.positions.get('catalog-star')!;
    const earthFacingDirection = harness.positions
      .get('earth')!
      .clone()
      .sub(catalogPosition)
      .normalize();
    const catalogFocus = harness.cameraController.focusOnFromDirection.mock.calls.at(-1);

    expect(catalogFocus?.[0]).toBe(catalogPosition);
    expect(catalogFocus?.[1]).toBe(harness.definitions.get('catalog-star'));
    expect(catalogFocus?.[2].distanceTo(earthFacingDirection)).toBeLessThan(1e-12);
    expect(catalogFocus?.[3]).toBe(800);

    await harness.controller.setTarget('sun');
    expect(harness.cameraController.focusOn).toHaveBeenLastCalledWith(
      harness.positions.get('sun'),
      harness.definitions.get('sun'),
      undefined,
    );
  });

  it('charge les filaments et cadre une constellation depuis son volume', async () => {
    const harness = createHarness();

    await harness.controller.setTarget('filament');
    expect(harness.ensureTempelFilamentSpines).toHaveBeenCalledOnce();

    harness.getConstellationFocusRadius.mockImplementation((objectId: string) =>
      objectId === 'constellation-orion' ? 60 : undefined,
    );
    await harness.controller.setTarget('constellation-orion');

    const constellationPosition = harness.positions.get('constellation-orion')!;
    const direction = harness.cameraController.focusOnFromDirection.mock.calls.at(-1)?.[2];

    expect(direction?.distanceTo(constellationPosition.clone().negate())).toBeLessThan(1e-12);
    expect(harness.cameraController.focusOnFromDirection).toHaveBeenLastCalledWith(
      constellationPosition,
      harness.definitions.get('constellation-orion'),
      expect.any(THREE.Vector3),
      expect.any(Number),
    );
  });

  it('retombe sur le cadrage standard sans champ de vision utilisable', async () => {
    const harness = createHarness();

    harness.getConstellationFocusRadius.mockReturnValue(60);
    harness.verticalFieldOfView = null;
    await harness.controller.setTarget('constellation-orion');

    expect(harness.cameraController.focusOn).toHaveBeenCalledWith(
      harness.positions.get('constellation-orion'),
      harness.definitions.get('constellation-orion'),
      undefined,
    );
    expect(harness.cameraController.focusOnFromDirection).not.toHaveBeenCalled();
  });

  it('retombe sur le cadrage standard si la direction Terre-étoile est indisponible', async () => {
    const harness = createHarness();

    harness.getWorldPosition.mockImplementation((objectId: string) =>
      objectId === 'earth' ? null : (harness.positions.get(objectId) ?? null),
    );
    await harness.controller.setTarget('catalog-star');

    expect(harness.cameraController.focusOn).toHaveBeenCalledWith(
      harness.positions.get('catalog-star'),
      harness.definitions.get('catalog-star'),
      800,
    );
  });

  it('retombe sur le cadrage standard si la Terre et l’étoile partagent la même position', async () => {
    const harness = createHarness();

    harness.positions.get('catalog-star')!.copy(harness.positions.get('earth')!);
    await harness.controller.setTarget('catalog-star');

    expect(harness.cameraController.focusOn).toHaveBeenCalledWith(
      harness.positions.get('catalog-star'),
      harness.definitions.get('catalog-star'),
      800,
    );
  });

  it('recule vers la Terre en gardant l’étoile devant et le globe derrière la caméra', async () => {
    const harness = createHarness();
    const earthPosition = harness.positions.get('earth')!;
    const targetPosition = harness.positions.get('catalog-star')!;
    const zenithDirection = new THREE.Vector3(0.2, 0.9, -0.3).normalize();

    const pitchLimits = {
      minimumPitchOffsetDegrees: -8,
      maximumPitchOffsetDegrees: 80,
    };

    const observerFraming = {
      initialPitchOffsetDegrees: 24,
      pitchLimits,
      zenithDirection,
    };

    await harness.controller.prepareEarthObservation('catalog-star', observerFraming);

    const [observerPosition, observedPosition, framing] =
      harness.cameraController.observeFrom.mock.calls.at(-1)!;
    const observerOffset = observerPosition.clone().sub(earthPosition);

    expect(observedPosition.distanceTo(targetPosition)).toBeLessThan(1e-12);
    expect(observerOffset.length()).toBeCloseTo(1.12, 4);
    expect(observerOffset.normalize().distanceTo(zenithDirection)).toBeLessThan(1e-12);
    expect(framing).toBe(observerFraming);
    expect(harness.cameraController.focusOn).not.toHaveBeenCalled();
    expect(harness.adoptTarget).toHaveBeenCalledWith('catalog-star');
    expect(harness.selectObject).toHaveBeenCalledWith('catalog-star');
    expect(harness.emitTargetChanged).toHaveBeenCalledWith('catalog-star');
  });

  it('recentre une observation terrestre sans imposer une nouvelle sélection', async () => {
    const harness = createHarness();

    await harness.controller.prepareEarthObservation('catalog-star', undefined, null);

    expect(harness.adoptTarget).toHaveBeenCalledWith('catalog-star');
    expect(harness.selectObject).toHaveBeenCalledWith(null);
    expect(harness.emitTargetChanged).toHaveBeenCalledWith('catalog-star');
  });

  it('préfère la direction topocentrique fournie au décalage visuel de la cible', async () => {
    const harness = createHarness();
    const targetDirection = new THREE.Vector3(-0.4, 0.2, 0.8).normalize();

    await harness.controller.prepareEarthObservation('catalog-star', {
      initialPitchOffsetDegrees: 0,
      pitchLimits: {
        minimumPitchOffsetDegrees: -88,
        maximumPitchOffsetDegrees: 88,
      },
      targetDirection,
    });
    const [observerPosition, observedPosition] =
      harness.cameraController.observeFrom.mock.calls.at(-1)!;
    const actualDirection = observedPosition.clone().sub(observerPosition).normalize();

    expect(actualDirection.distanceTo(targetDirection)).toBeLessThan(1e-12);
    expect(observedPosition.distanceTo(harness.positions.get('catalog-star')!)).toBeGreaterThan(1);
  });

  it('refuse une observation terrestre sans services ou objets disponibles', async () => {
    const harness = createHarness();

    harness.primaryRegistryAvailable = false;

    await expect(harness.controller.prepareEarthObservation('catalog-star')).rejects.toThrow(
      'Observation terrestre indisponible',
    );
  });

  it('refuse une observation terrestre sans positions résolues', async () => {
    const harness = createHarness();

    harness.getWorldPosition.mockImplementation((objectId: string) =>
      objectId === 'catalog-star' ? null : (harness.positions.get(objectId) ?? null),
    );

    await expect(harness.controller.prepareEarthObservation('catalog-star')).rejects.toThrow(
      'Observation terrestre indisponible',
    );
  });

  it('refuse une observation terrestre dont la cible coïncide avec la Terre', async () => {
    const harness = createHarness();
    const earthPosition = harness.positions.get('earth')!;

    harness.getWorldPosition.mockImplementation((objectId: string) =>
      objectId === 'catalog-star'
        ? earthPosition.clone()
        : (harness.positions.get(objectId) ?? null),
    );

    await expect(harness.controller.prepareEarthObservation('catalog-star')).rejects.toThrow(
      'Observation terrestre indisponible',
    );
  });

  it('refuse une cible sans services, objet, définition ou position', async () => {
    const missingRegistry = createHarness();

    missingRegistry.primaryRegistryAvailable = false;
    await expect(missingRegistry.controller.setTarget('earth')).rejects.toThrow('introuvable');

    const missingController = createHarness();

    missingController.cameraControllerAvailable = false;
    await expect(missingController.controller.setTarget('earth')).rejects.toThrow('introuvable');

    const unknown = createHarness();

    unknown.hasObject.mockReturnValue(false);
    await expect(unknown.controller.setTarget('unknown')).rejects.toThrow('introuvable');

    const missingPosition = createHarness();

    missingPosition.getWorldPosition.mockReturnValue(null);
    await expect(missingPosition.controller.setTarget('earth')).rejects.toThrow(
      'Position indisponible',
    );

    const missingDefinition = createHarness();

    missingDefinition.getDefinition.mockReturnValue(undefined);
    await expect(missingDefinition.controller.setTarget('earth')).rejects.toThrow(
      'Position indisponible',
    );

    const registryLostDuringLoading = createHarness();

    registryLostDuringLoading.ensureSpaceTileObject.mockImplementation(async () => {
      registryLostDuringLoading.primaryRegistryAvailable = false;
    });
    await expect(registryLostDuringLoading.controller.setTarget('earth')).rejects.toThrow(
      'Position indisponible',
    );
  });

  it('termine une transition avec un contrôleur disponible', () => {
    const harness = createHarness();

    harness.controller.completeTargetTransition();
    expect(harness.cameraController.completeFocusTransition).toHaveBeenCalledOnce();

    harness.cameraControllerAvailable = false;
    harness.controller.completeTargetTransition();
    expect(harness.cameraController.completeFocusTransition).toHaveBeenCalledOnce();
  });

  it('cadre un corps suffisamment près pour inspecter sa rotation', async () => {
    const harness = createHarness();
    const earth = harness.definitions.get('earth')!;

    earth.rotation = rotationDefinition('earth');
    await harness.controller.viewRotation('earth');

    expect(harness.cameraController.focusOn).toHaveBeenCalledWith(
      harness.positions.get('earth'),
      earth,
      4.4,
    );
  });

  it('refuse la rotation d’un objet sans modèle axial', async () => {
    const harness = createHarness();

    await expect(harness.controller.viewRotation('earth')).rejects.toThrow(
      'Rotation indisponible pour Terre',
    );
    await expect(harness.controller.viewRotation('unknown')).rejects.toThrow(
      'Rotation indisponible pour unknown',
    );
  });

  it('cadre une orbite complète autour du parent', () => {
    const harness = createHarness();

    harness.controller.viewOrbit('earth');

    expect(harness.ensureActiveExoplanetSystem).toHaveBeenCalledWith('earth');
    expect(harness.clearPresentation).toHaveBeenCalledOnce();
    expect(harness.clearNavigationLock).toHaveBeenCalledOnce();
    expect(harness.adoptTarget).toHaveBeenCalledWith('sun');
    expect(harness.selectObject).toHaveBeenCalledWith('earth');
    expect(harness.cameraController.focusOnFromDirection).toHaveBeenCalledWith(
      harness.positions.get('sun'),
      harness.definitions.get('sun'),
      new THREE.Vector3(1, 0.82, 1),
      expect.any(Number),
    );
    expect(harness.emitTargetChanged).toHaveBeenCalledWith('sun');
  });

  it.each([
    ['registre', (harness: Harness) => (harness.registryAvailable = false)],
    ['contrôleur', (harness: Harness) => (harness.cameraControllerAvailable = false)],
    ['caméra', (harness: Harness) => (harness.verticalFieldOfView = null)],
    ['objet', (harness: Harness) => harness.registry.getDefinition.mockReturnValue(undefined)],
    [
      'parent déclaré',
      (harness: Harness) =>
        harness.registry.getDefinition.mockImplementation((objectId: string) =>
          objectId === 'earth'
            ? object('earth', 'Terre', 'planet')
            : harness.definitions.get(objectId),
        ),
    ],
    [
      'parent résolu',
      (harness: Harness) =>
        harness.registry.getDefinition.mockImplementation((objectId: string) =>
          objectId === 'sun' ? undefined : harness.definitions.get(objectId),
        ),
    ],
    [
      'position du parent',
      (harness: Harness) =>
        harness.registry.getWorldPosition.mockImplementation((objectId: string) =>
          objectId === 'sun' ? null : (harness.positions.get(objectId) ?? null),
        ),
    ],
    [
      'rayon numérique',
      (harness: Harness) => harness.registry.getOrbitRadius.mockReturnValue(null),
    ],
    ['rayon positif', (harness: Harness) => harness.registry.getOrbitRadius.mockReturnValue(0)],
  ])('refuse une orbite sans %s', (_label, mutate) => {
    const harness = createHarness();

    mutate(harness);

    expect(() => harness.controller.viewOrbit('earth')).toThrow('Orbite indisponible');
  });

  it('cadre une échelle de navigation et efface la sélection', () => {
    const harness = createHarness();
    const scale = NAVIGATION_SCALES[1]!;

    harness.controller.viewScale(scale);

    expect(harness.clearPresentation).toHaveBeenCalledOnce();
    expect(harness.clearNavigationLock).toHaveBeenCalledOnce();
    expect(harness.adoptTarget).toHaveBeenCalledWith('sun');
    expect(harness.selectObject).toHaveBeenCalledWith(null);
    expect(harness.cameraController.focusOnFromDirection).toHaveBeenCalledWith(
      harness.positions.get('sun'),
      harness.definitions.get('sun'),
      new THREE.Vector3(...scale.direction),
      scale.distance,
    );
    expect(harness.emitTargetChanged).toHaveBeenCalledWith('sun');
  });

  it.each([
    ['registre', (harness: Harness) => (harness.primaryRegistryAvailable = false)],
    ['contrôleur', (harness: Harness) => (harness.cameraControllerAvailable = false)],
    ['cible', (harness: Harness) => harness.registry.getDefinition.mockReturnValue(undefined)],
    ['position', (harness: Harness) => harness.registry.getWorldPosition.mockReturnValue(null)],
  ])('refuse une échelle sans %s', (_label, mutate) => {
    const harness = createHarness();

    mutate(harness);

    expect(() => harness.controller.viewScale(NAVIGATION_SCALES[1]!)).toThrow(
      'Cadrage indisponible',
    );
  });
});

interface Harness {
  controller: UniverseViewController;
  readonly cameraController: MockViewCameraController;
  readonly registry: MockViewRegistry;
  readonly definitions: Map<string, SpaceObject>;
  readonly positions: Map<string, THREE.Vector3>;
  readonly hasObject: ReturnType<typeof vi.fn>;
  readonly getDefinition: ReturnType<typeof vi.fn>;
  readonly getWorldPosition: ReturnType<typeof vi.fn>;
  readonly getConstellationFocusRadius: ReturnType<typeof vi.fn>;
  readonly ensureSpaceTileObject: ReturnType<typeof vi.fn>;
  readonly ensureActiveExoplanetSystem: ReturnType<typeof vi.fn>;
  readonly ensureTempelFilamentSpines: ReturnType<typeof vi.fn>;
  readonly clearPresentation: ReturnType<typeof vi.fn>;
  readonly clearNavigationLock: ReturnType<typeof vi.fn>;
  readonly adoptTarget: ReturnType<typeof vi.fn>;
  readonly selectObject: ReturnType<typeof vi.fn>;
  readonly emitTargetChanged: ReturnType<typeof vi.fn>;
  primaryRegistryAvailable: boolean;
  registryAvailable: boolean;
  cameraControllerAvailable: boolean;
  verticalFieldOfView: number | null;
}

interface MockViewCameraController {
  readonly focusOn: Mock<UniverseViewCameraController['focusOn']>;
  readonly focusOnFromDirection: Mock<UniverseViewCameraController['focusOnFromDirection']>;
  readonly observeFrom: Mock<UniverseViewCameraController['observeFrom']>;
  readonly completeFocusTransition: Mock<UniverseViewCameraController['completeFocusTransition']>;
}

interface MockViewRegistry {
  readonly getDefinition: Mock<UniverseViewRegistry['getDefinition']>;
  readonly getWorldPosition: Mock<UniverseViewRegistry['getWorldPosition']>;
  readonly getOrbitRadius: Mock<UniverseViewRegistry['getOrbitRadius']>;
}

function createHarness(): Harness {
  const definitions = new Map<string, SpaceObject>([
    ['sun', object('sun', 'Soleil', 'star', 'milky-way')],
    ['earth', object('earth', 'Terre', 'planet', 'sun')],
    ['host', object('host', 'Étoile hôte', 'star', 'milky-way')],
    ['catalog-star', object('catalog-star', 'Sirius', 'star', 'milky-way')],
    ['filament', object('filament', 'Filament', 'cosmic-filament', 'cosmic-web')],
    ['constellation-orion', object('constellation-orion', 'Orion', 'region', 'milky-way')],
  ]);
  const positions = new Map(
    [...definitions.keys()].map((objectId, index) => [
      objectId,
      new THREE.Vector3(index + 1, index * 0.25, -index * 0.5),
    ]),
  );
  const registry: MockViewRegistry = {
    getDefinition: vi.fn((objectId: string) => definitions.get(objectId)),
    getWorldPosition: vi.fn((objectId: string) => positions.get(objectId) ?? null),
    getOrbitRadius: vi.fn((objectId: string) => (objectId === 'earth' ? 10 : null)),
  };
  const cameraController: MockViewCameraController = {
    focusOn: vi.fn(),
    focusOnFromDirection: vi.fn(),
    observeFrom: vi.fn(),
    completeFocusTransition: vi.fn(),
  };
  const hasObject = vi.fn((objectId: string) => definitions.has(objectId));
  const getDefinition = vi.fn((objectId: string) => definitions.get(objectId));
  const getWorldPosition = vi.fn((objectId: string) => positions.get(objectId) ?? null);
  const getConstellationFocusRadius = vi.fn((): number | null | undefined => null);
  const ensureSpaceTileObject = vi.fn(async () => undefined);
  const ensureActiveExoplanetSystem = vi.fn();
  const ensureTempelFilamentSpines = vi.fn(async () => undefined);
  const clearPresentation = vi.fn();
  const clearNavigationLock = vi.fn();
  const adoptTarget = vi.fn();
  const selectObject = vi.fn();
  const emitTargetChanged = vi.fn();
  const harness: Harness = {
    controller: null as unknown as UniverseViewController,
    cameraController,
    registry,
    definitions,
    positions,
    hasObject,
    getDefinition,
    getWorldPosition,
    getConstellationFocusRadius,
    ensureSpaceTileObject,
    ensureActiveExoplanetSystem,
    ensureTempelFilamentSpines,
    clearPresentation,
    clearNavigationLock,
    adoptTarget,
    selectObject,
    emitTargetChanged,
    primaryRegistryAvailable: true,
    registryAvailable: true,
    cameraControllerAvailable: true,
    verticalFieldOfView: 48,
  };

  harness.controller = new UniverseViewController({
    hasPrimaryRegistry: () => harness.primaryRegistryAvailable,
    getPrimaryRegistry: () => (harness.primaryRegistryAvailable ? registry : null),
    getRegistry: () => (harness.registryAvailable ? registry : null),
    getCameraController: () => (harness.cameraControllerAvailable ? cameraController : null),
    getVerticalFieldOfView: () => harness.verticalFieldOfView,
    hasObject,
    getDefinition,
    getWorldPosition,
    getConstellationFocusRadius,
    isExoplanetHost: (objectId: string) => objectId === 'host',
    isCatalogStar: (objectId: string) => objectId === 'catalog-star',
    ensureSpaceTileObject,
    ensureActiveExoplanetSystem,
    ensureTempelFilamentSpines,
    clearPresentation,
    clearNavigationLock,
    adoptTarget,
    selectObject,
    emitTargetChanged,
  });

  return harness;
}

function object(
  id: string,
  name: string,
  type: SpaceObject['type'],
  parentId?: string,
): SpaceObject {
  return {
    id,
    name,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function rotationDefinition(objectId: string): NonNullable<SpaceObject['rotation']> {
  return {
    siderealPeriodHours: 23.934,
    direction: 'prograde',
    bodyFixedFrame: objectId === 'earth' ? 'EARTH_GEOGRAPHIC' : `IAU_${objectId.toUpperCase()}`,
    orientationModel: objectId === 'earth' ? 'earth-geographic' : 'iau-wgccre-2015',
    scientificConfidence: 'calculated',
    source: 'Test',
  };
}
