import { expect, type Page } from '@playwright/test';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface QuaternionSample {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface CameraInteractionState {
  rotateEnabled: boolean;
  panEnabled: boolean;
  distance: number;
  minDistance: number;
  maxDistance: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  target: {
    x: number;
    y: number;
    z: number;
  };
}

export interface NavigationAlignmentState {
  targetId: string | null;
  targetError: number;
  floatingOriginDistance: number;
}

export interface SpaceTileStreamingState {
  indexedObjectCount: number;
  indexedTileCount: number;
  loadedTileCount: number;
  cachedTileCount: number;
  loadedObjectIds: string[];
}

export interface NearbyGalaxyBatchState {
  batchCount: number;
  catalogObjectIds: string[];
  visibleCatalogObjectIds: string[];
}

interface LabelRegion {
  objectId: string;
  rectangle: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export interface CatalogLabelLayout {
  totalCount: number;
  catalogCount: number;
  overlapCount: number;
  hoveredObjectId: string | null;
  candidate: {
    objectId: string;
    point: ScreenPoint;
  } | null;
}

export interface ConstellationInteractionState {
  definitionCount: number;
  labelCount: number;
  activeObjectId: string | null;
  highlightVisible: boolean;
  highlightVertexCount: number;
  candidate: {
    objectId: string;
    point: ScreenPoint;
  } | null;
}

export interface GalaxyImpostorState {
  objectId: string;
  visible: boolean;
  opacity: number;
  width: number;
  height: number;
  pickable: boolean;
}

export interface MilkyWayDetailState {
  visible: boolean;
  opacity: number;
  radius: number;
  spiralAuraCount: number;
  visualStructure: string | null;
  structureOrigin: string | null;
  spiralArmCount: number | null;
  spiralPitchDegrees: number | null;
  sunDistanceFromGalacticCenter: number;
  stellarOriginDistanceFromSun: number;
  stellarNeighborhoodScale: number;
}

export interface MilkyWayVolumeState {
  visible: boolean;
  atlasStatus: string;
  atlasUrl: string | null;
  structure: string | null;
  depthTechnique: string | null;
  confidence: string | null;
  cinematicQuality: string | null;
  parallaxStrength: number;
  dustAbsorption: number;
  glowStrength: number;
  drawMeshCount: number;
  visibleDiscLayerCount: number;
  layerDepthSpan: number;
  bulgeHeight: number;
}

export interface CosmicBackgroundState {
  upperColor: [number, number, number];
  lowerColor: [number, number, number];
  accentColor: [number, number, number];
  hazeStrength: number;
  nebulaStrength: number;
  dustStrength: number;
  vignetteStrength: number;
  detailStrength: number;
  cameraDistance: number;
  triangleCount: number;
  confidence: string | null;
  transitionDriver: string | null;
}

export interface BodyLabelOcclusionState {
  radius: number;
  overlappingLabelCount: number;
}

export interface BlackHoleVisualState {
  objectId: string;
  nearVisible: boolean;
  farVisible: boolean;
  corePresent: boolean;
  lensPresent: boolean;
  lensStyle: string | null;
  diskPresent: boolean;
  jetsPresent: boolean;
  nuclearClusterPresent: boolean;
  nuclearClusterRendered: boolean;
  nuclearClusterPointCount: number;
  nuclearClusterInForeground: boolean;
  batchedAsLuminousPoint: boolean;
  opaqueCosmicReferenceBodyPresent: boolean;
}

export interface BlackHoleLensingState {
  active: boolean;
  objectId: string | null;
  strength: number;
  coreRadius: number;
  einsteinRadius: number;
  distortionModel: string;
  compositionMode: string;
  backgroundPreservation: string;
  foregroundSeparated: boolean;
  foregroundScale: number;
  displayCoreRadius: number;
  displayInfluenceRadius: number;
  scientificConfidence: string | null;
  renderWidth: number;
  renderHeight: number;
}

const FIXED_TIME = '2026-07-27T12:00:00.000Z';

export function universeUrl(parameters: Record<string, string> = {}): string {
  const query = new URLSearchParams({
    target: 'earth',
    quality: 'low',
    density: 'balanced',
    time: FIXED_TIME,
    labels: '1',
    orbits: '1',
    constellations: '1',
    ...parameters,
  });

  return `/?${query.toString()}`;
}

export async function openUniverse(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('canvas.universe-canvas')).toBeVisible();
  await expect(page.locator('.loading-screen')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('zoom')).not.toBeNull();
  await waitForCameraSettled(page);
}

export async function waitForCameraSettled(page: Page): Promise<void> {
  await expect.poll(() => isCameraSettled(page)).toBe(true);
}

export async function readCameraInteractionState(page: Page): Promise<CameraInteractionState> {
  return page.evaluate(() => {
    interface VectorState {
      x: number;
      y: number;
      z: number;
    }

    interface ControllerState {
      distanceToTarget: number;
      controls: {
        enableRotate: boolean;
        enablePan: boolean;
        minDistance: number;
        maxDistance: number;
        target: VectorState;
      };
      camera: {
        position: VectorState;
      };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const controller = engine
      ? (Reflect.get(engine, 'cameraController') as ControllerState | null)
      : null;

    if (!controller) {
      throw new Error('Contrôleur de caméra indisponible.');
    }
    const { controls, camera } = controller;

    return {
      rotateEnabled: controls.enableRotate,
      panEnabled: controls.enablePan,
      distance: controller.distanceToTarget,
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      },
    };
  });
}

export async function readBlackHoleVisualState(
  page: Page,
  objectId: string,
): Promise<BlackHoleVisualState> {
  return page.evaluate((id) => {
    interface SceneNode {
      name: string;
      visible: boolean;
      userData: Record<string, unknown>;
      material?: { opacity: number };
      geometry?: { getAttribute(name: string): { count: number } | undefined };
      getObjectByName(name: string): SceneNode | undefined;
    }

    interface RegistryEntryState {
      visualRoot: SceneNode;
      lensingForeground: SceneNode | null;
      farBatchIndex: number | null;
      lod: {
        nearRoot: SceneNode | null;
        farSprite: SceneNode | null;
      };
    }

    interface RegistryState {
      entries: Map<string, RegistryEntryState>;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as RegistryState | null)
      : null;
    const entry = registry?.entries.get(id);

    if (!entry) {
      throw new Error(`Trou noir ${id} indisponible dans le registre.`);
    }

    const core = entry.visualRoot.getObjectByName(`${id}-event-horizon`);
    const lens = entry.visualRoot.getObjectByName(`${id}-local-lensing-halo`);
    const nuclearCluster = entry.visualRoot.getObjectByName(`${id}-nuclear-star-cluster`);

    return {
      objectId: id,
      nearVisible: entry.lod.nearRoot?.visible ?? false,
      farVisible: entry.lod.farSprite?.visible ?? false,
      corePresent: core !== undefined,
      lensPresent: lens !== undefined,
      lensStyle:
        typeof lens?.userData['visualStyle'] === 'string' ? lens.userData['visualStyle'] : null,
      diskPresent: entry.visualRoot.getObjectByName(`${id}-accretion-disk`) !== undefined,
      jetsPresent: entry.visualRoot.getObjectByName(`${id}-relativistic-jets`) !== undefined,
      nuclearClusterPresent: nuclearCluster !== undefined,
      nuclearClusterRendered:
        nuclearCluster !== undefined &&
        nuclearCluster.visible &&
        entry.lod.nearRoot?.visible === true &&
        (nuclearCluster.material?.opacity ?? 0) > 0.008,
      nuclearClusterPointCount: nuclearCluster?.geometry?.getAttribute('position')?.count ?? 0,
      nuclearClusterInForeground:
        entry.lensingForeground?.getObjectByName(`${id}-nuclear-star-cluster`) !== undefined,
      batchedAsLuminousPoint: entry.farBatchIndex !== null,
      opaqueCosmicReferenceBodyPresent:
        registry?.entries.get('cosmic-web')?.visualRoot.getObjectByName('cosmic-web-body') !==
        undefined,
    };
  }, objectId);
}

export async function readBlackHoleLensingState(page: Page): Promise<BlackHoleLensingState> {
  return page.evaluate(() => {
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const pass = engine
      ? (Reflect.get(engine, 'blackHoleLensingPass') as
          { debugState: BlackHoleLensingState } | undefined)
      : undefined;

    return (
      pass?.debugState ?? {
        active: false,
        objectId: null,
        strength: 0,
        coreRadius: 0,
        einsteinRadius: 0,
        distortionModel: 'thin-lens-einstein-ring',
        compositionMode: 'background-lens-foreground',
        backgroundPreservation: 'live-framebuffer-thin-lens',
        foregroundSeparated: false,
        foregroundScale: 1,
        displayCoreRadius: 0,
        displayInfluenceRadius: 0,
        scientificConfidence: null,
        renderWidth: 0,
        renderHeight: 0,
      }
    );
  });
}

export async function readNavigationAlignmentState(page: Page): Promise<NavigationAlignmentState> {
  return page.evaluate(() => {
    interface VectorState {
      distanceTo(vector: VectorState): number;
      length(): number;
    }

    interface EngineState {
      targetId: string | null;
      cameraController: {
        controls: {
          target: VectorState;
        };
      } | null;
      floatingOriginManager: {
        accumulatedOrigin: VectorState;
      };
      getWorldPosition(objectId: string): VectorState | null;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as EngineState | undefined) : undefined;
    const targetId = engine?.targetId ?? null;
    const controlsTarget = engine?.cameraController?.controls.target;
    const objectPosition = engine && targetId ? engine.getWorldPosition(targetId) : null;

    if (!engine || !controlsTarget) {
      throw new Error('État de navigation indisponible.');
    }

    return {
      targetId,
      targetError: objectPosition ? controlsTarget.distanceTo(objectPosition) : 0,
      floatingOriginDistance: engine.floatingOriginManager.accumulatedOrigin.length(),
    };
  });
}

export async function readSpaceTileStreamingState(page: Page): Promise<SpaceTileStreamingState> {
  return page.evaluate(() => {
    interface TileManagerState {
      indexedTileCount: number;
      loadedTileCount: number;
      cachedTileCount: number;
      loadedObjects: readonly { id: string }[];
      tileIdByObjectId: Map<string, string>;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const manager = engine
      ? (Reflect.get(engine, 'spaceTileManager') as TileManagerState | null)
      : null;

    if (!manager) {
      throw new Error('Gestionnaire de tuiles spatiales indisponible.');
    }

    return {
      indexedObjectCount: manager.tileIdByObjectId.size,
      indexedTileCount: manager.indexedTileCount,
      loadedTileCount: manager.loadedTileCount,
      cachedTileCount: manager.cachedTileCount,
      loadedObjectIds: manager.loadedObjects
        .map((object) => object.id)
        .sort((left, right) => left.localeCompare(right)),
    };
  });
}

export async function readNearbyGalaxyBatchState(page: Page): Promise<NearbyGalaxyBatchState> {
  return page.evaluate(() => {
    interface BatchPoints {
      name: string;
      userData: Record<string, unknown>;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registries = engine
      ? [
          Reflect.get(engine, 'objectRegistry'),
          Reflect.get(engine, 'spaceTileObjectRegistry'),
        ].filter(
          (registry): registry is object => typeof registry === 'object' && registry !== null,
        )
      : [];
    const pointsByRegistry = registries
      .map((registry) => Reflect.get(registry, 'farObjectBatch') as object | undefined)
      .map((farObjectBatch) =>
        farObjectBatch
          ? (Reflect.get(farObjectBatch, 'points') as BatchPoints | undefined)
          : undefined,
      )
      .filter((points): points is BatchPoints => points !== undefined);

    if (pointsByRegistry.length === 0) {
      throw new Error('Batch des galaxies proches indisponible.');
    }
    let batchCount = 0;
    const catalogObjectIds: string[] = [];
    const visibleCatalogObjectIds: string[] = [];

    for (const points of pointsByRegistry) {
      const objectIds = points.userData['objectIds'];
      const visibleIndices = points.userData['visibleIndices'];

      if (!Array.isArray(objectIds) || !(visibleIndices instanceof Uint8Array)) {
        throw new Error('Métadonnées du batch des galaxies proches invalides.');
      }
      let containsCatalogGalaxy = false;

      for (let index = 0; index < objectIds.length; index += 1) {
        const objectId: unknown = objectIds[index];

        if (typeof objectId !== 'string' || !objectId.startsWith('lv-')) {
          continue;
        }
        containsCatalogGalaxy = true;
        catalogObjectIds.push(objectId);
        if (visibleIndices[index] === 1) {
          visibleCatalogObjectIds.push(objectId);
        }
      }
      if (containsCatalogGalaxy) {
        batchCount += 1;
      }
    }

    return {
      batchCount,
      catalogObjectIds: catalogObjectIds.sort((left, right) => left.localeCompare(right)),
      visibleCatalogObjectIds: visibleCatalogObjectIds.sort((left, right) =>
        left.localeCompare(right),
      ),
    };
  });
}

export async function readObjectScreenPoint(page: Page, objectId: string): Promise<ScreenPoint> {
  return page.evaluate((requestedId) => {
    interface ProjectableVector {
      x: number;
      y: number;
      z: number;
      project(camera: unknown): ProjectableVector;
    }

    interface RegistryState {
      getWorldPosition(id: string): ProjectableVector | null;
    }

    const root = document.querySelector('app-root');
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.universe-canvas');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as RegistryState | undefined)
      : undefined;
    const camera = engine ? (Reflect.get(engine, 'camera') as object | undefined) : undefined;
    const position = registry?.getWorldPosition(requestedId);

    if (!canvas || !camera || !position) {
      throw new Error(`Projection écran indisponible pour ${requestedId}.`);
    }
    position.project(camera);
    const bounds = canvas.getBoundingClientRect();

    return {
      x: bounds.left + (position.x * 0.5 + 0.5) * bounds.width,
      y: bounds.top + (-position.y * 0.5 + 0.5) * bounds.height,
    };
  }, objectId);
}

export async function findEmptyCanvasPoint(page: Page): Promise<ScreenPoint> {
  return page.evaluate(() => {
    interface SelectionManagerState {
      findObjectAt(event: { clientX: number; clientY: number }): string | null;
    }

    const root = document.querySelector('app-root');
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.universe-canvas');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const selectionManager = engine
      ? (Reflect.get(engine, 'selectionManager') as SelectionManagerState | undefined)
      : undefined;

    if (!canvas || !selectionManager) {
      throw new Error('Le gestionnaire de sélection est indisponible.');
    }
    const bounds = canvas.getBoundingClientRect();

    for (let y = bounds.top + 120; y < bounds.bottom - 160; y += 80) {
      for (let x = bounds.left + 100; x < bounds.right - 100; x += 100) {
        if (
          document.elementFromPoint(x, y) === canvas &&
          selectionManager.findObjectAt({ clientX: x, clientY: y }) === null
        ) {
          return { x, y };
        }
      }
    }

    throw new Error('Aucune zone vide et interactive du canvas n’a été trouvée.');
  });
}

export async function readObjectRotation(page: Page, objectId: string): Promise<number> {
  return page.evaluate((requestedId) => {
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
      : undefined;
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const entry = entries?.get(requestedId);
    const body = entry
      ? (Reflect.get(entry, 'rotatingBody') as { rotation: { y: number } } | null)
      : null;

    return body?.rotation.y ?? Number.NaN;
  }, objectId);
}

export async function readBodyTextureState(
  page: Page,
  objectId: string,
): Promise<{ loaded: boolean; width: number; height: number }> {
  return page.evaluate((requestedId) => {
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
      : undefined;
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const entry = entries?.get(requestedId);
    const body = entry ? (Reflect.get(entry, 'rotatingBody') as object | null) : null;
    const material = body ? (Reflect.get(body, 'material') as object | undefined) : undefined;
    const map = material ? (Reflect.get(material, 'map') as object | null) : null;
    const image = map ? (Reflect.get(map, 'image') as HTMLImageElement | undefined) : undefined;

    return {
      loaded: Boolean(image?.complete && image.naturalWidth),
      width: image?.naturalWidth ?? 0,
      height: image?.naturalHeight ?? 0,
    };
  }, objectId);
}

export async function sampleObjectQuaternions(
  page: Page,
  objectId: string,
  sampleCount: number,
): Promise<QuaternionSample[]> {
  return page.evaluate(
    async ({ requestedId, requestedCount }) => {
      const root = document.querySelector('app-root');
      const angularDebug = (
        window as unknown as {
          ng?: {
            getComponent(element: Element): object | null;
          };
        }
      ).ng;
      const component = root && angularDebug?.getComponent(root);
      const facade = component
        ? (Reflect.get(component, 'facade') as object | undefined)
        : undefined;
      const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
      const registry = engine
        ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
        : undefined;
      const entries = registry
        ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
        : undefined;
      const entry = entries?.get(requestedId);
      const body = entry
        ? (Reflect.get(entry, 'rotatingBody') as {
            quaternion: QuaternionSample;
          } | null)
        : null;
      const samples: QuaternionSample[] = [];

      if (!body) {
        return samples;
      }
      for (let index = 0; index < requestedCount; index += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const { x, y, z, w } = body.quaternion;

        samples.push({ x, y, z, w });
      }

      return samples;
    },
    { requestedId: objectId, requestedCount: sampleCount },
  );
}

export async function readSolarEclipseVisualState(
  page: Page,
): Promise<{ phase: string; visible: boolean }> {
  return page.evaluate(() => {
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
      : undefined;
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const earth = entries?.get('earth');
    const solarEclipse = earth
      ? (Reflect.get(earth, 'solarEclipse') as {
          mesh: {
            visible: boolean;
            userData: Record<string, unknown>;
          };
        } | null)
      : null;
    const phase = solarEclipse?.mesh.userData['eclipsePhase'];

    return {
      phase: typeof phase === 'string' ? phase : 'missing',
      visible: solarEclipse?.mesh.visible ?? false,
    };
  });
}

export async function readOrbitVisualState(
  page: Page,
  objectId: string,
): Promise<{
  visible: boolean;
  active: boolean;
  opacity: number;
}> {
  return page.evaluate((requestedId) => {
    interface OrbitLine {
      visible: boolean;
      userData: Record<string, unknown>;
      material: {
        opacity: number;
      };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
      : undefined;
    const orbitVisuals = registry
      ? (Reflect.get(registry, 'orbitVisuals') as Map<string, { line: OrbitLine }> | undefined)
      : undefined;
    const line = orbitVisuals?.get(requestedId)?.line;

    return {
      visible: line?.visible ?? false,
      active: line?.userData['active'] === true,
      opacity: line?.material.opacity ?? 0,
    };
  }, objectId);
}

export async function readRotationGuideState(page: Page): Promise<{
  visible: boolean;
  objectId: string | null;
  direction: string | null;
  style: string | null;
  parentName: string | null;
  directionScale: number;
  vertexCount: number;
  hasVertexColors: boolean;
}> {
  return page.evaluate(() => {
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
      : undefined;
    const guide = registry
      ? (Reflect.get(registry, 'rotationGuide') as
          | {
              visible: boolean;
              userData: Record<string, unknown>;
              parent: { name: string } | null;
              scale: { z: number };
              geometry: {
                getAttribute(name: string): { count: number } | undefined;
              };
            }
          | undefined)
      : undefined;
    const objectId = guide?.userData['objectId'];
    const direction = guide?.userData['direction'];
    const style = guide?.userData['style'];
    const positionAttribute = guide?.geometry.getAttribute('position');
    const colorAttribute = guide?.geometry.getAttribute('color');

    return {
      visible: guide?.visible ?? false,
      objectId: typeof objectId === 'string' ? objectId : null,
      direction: typeof direction === 'string' ? direction : null,
      style: typeof style === 'string' ? style : null,
      parentName: guide?.parent?.name ?? null,
      directionScale: guide?.scale.z ?? 0,
      vertexCount: positionAttribute?.count ?? 0,
      hasVertexColors:
        colorAttribute !== undefined && colorAttribute.count === positionAttribute?.count,
    };
  });
}

export async function readPlanetaryRingVisualState(
  page: Page,
  objectId: string,
): Promise<{
  visible: boolean;
  textured: boolean;
  textureLoaded: boolean;
  opacity: number;
  emissiveIntensity: number;
}> {
  return page.evaluate((requestedId) => {
    interface RingObject {
      visible: boolean;
      parent: RingObject | null;
      material?: {
        opacity?: number;
        emissiveIntensity?: number;
        map?: {
          image?: {
            complete?: boolean;
            naturalWidth?: number;
          };
        };
      };
      getObjectByName(name: string): RingObject | undefined;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
      : undefined;
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const entry = entries?.get(requestedId);
    const node = entry ? (Reflect.get(entry, 'node') as RingObject | undefined) : undefined;
    const rings = node?.getObjectByName(`${requestedId}-rings`);
    const material = rings?.material;
    let visible = Boolean(rings);
    let ancestor = rings ?? null;

    while (ancestor) {
      visible = visible && ancestor.visible;
      ancestor = ancestor.parent;
    }

    return {
      visible,
      textured: Boolean(material?.map),
      textureLoaded: Boolean(material?.map?.image?.complete && material.map.image.naturalWidth),
      opacity: material?.opacity ?? Number.NaN,
      emissiveIntensity: material?.emissiveIntensity ?? Number.NaN,
    };
  }, objectId);
}

export async function readStarCatalogBatchState(page: Page): Promise<{
  catalogCount: number;
  drawCount: number;
  visible: boolean;
  confidence: string | null;
  batchCount: number;
  selectedObjectId: string | null;
}> {
  return page.evaluate(() => {
    interface CatalogPoints {
      name: string;
      visible: boolean;
      userData: Record<string, unknown>;
      geometry: {
        drawRange: {
          count: number;
        };
      };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const scene = universeScene
      ? (Reflect.get(universeScene, 'scene') as
          | {
              traverse(callback: (object: { name: string }) => void): void;
            }
          | undefined)
      : undefined;
    const starCatalogBatch = universeScene
      ? (Reflect.get(universeScene, 'starCatalogBatch') as object | null)
      : null;
    const points = starCatalogBatch
      ? (Reflect.get(starCatalogBatch, 'points') as CatalogPoints | undefined)
      : undefined;
    let batchCount = 0;

    scene?.traverse((object) => {
      if (object.name === 'observed-hyg-star-catalog') {
        batchCount += 1;
      }
    });
    const confidence = points?.userData['scientificConfidence'];
    const catalogCount = points?.userData['catalogCount'];
    const selectionPoint = starCatalogBatch
      ? (Reflect.get(starCatalogBatch, 'selectionPoint') as CatalogPoints | undefined)
      : undefined;
    const selectedObjectId = selectionPoint?.userData['objectId'];

    return {
      catalogCount: typeof catalogCount === 'number' ? catalogCount : 0,
      drawCount: points?.geometry.drawRange.count ?? 0,
      visible: points?.visible ?? false,
      confidence: typeof confidence === 'string' ? confidence : null,
      batchCount,
      selectedObjectId: typeof selectedObjectId === 'string' ? selectedObjectId : null,
    };
  });
}

export async function readCosmicGroupBatchState(page: Page): Promise<{
  catalogCount: number;
  drawCount: number;
  visible: boolean;
  opacity: number;
  confidence: string | null;
  batchCount: number;
  selectedObjectId: string | null;
}> {
  return page.evaluate(() => {
    interface CatalogPoints {
      name: string;
      visible: boolean;
      userData: Record<string, unknown>;
      geometry: {
        drawRange: {
          count: number;
        };
      };
      material: {
        uniforms: Record<string, { value: unknown } | undefined>;
      };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const scene = universeScene
      ? (Reflect.get(universeScene, 'scene') as
          | {
              traverse(callback: (object: { name: string }) => void): void;
            }
          | undefined)
      : undefined;
    const catalogBatch = universeScene
      ? (Reflect.get(universeScene, 'cosmicGroupCatalogBatch') as object | null)
      : null;
    const points = catalogBatch
      ? (Reflect.get(catalogBatch, 'points') as CatalogPoints | undefined)
      : undefined;
    const selectionPoint = catalogBatch
      ? (Reflect.get(catalogBatch, 'selectionPoint') as CatalogPoints | undefined)
      : undefined;
    let batchCount = 0;

    scene?.traverse((object) => {
      if (object.name === 'calculated-cosmicflows4-groups') {
        batchCount += 1;
      }
    });
    const confidence = points?.userData['scientificConfidence'];
    const catalogCount = points?.userData['catalogCount'];
    const selectedObjectId = selectionPoint?.userData['objectId'];
    const opacity = points?.material.uniforms['catalogOpacity']?.value;

    return {
      catalogCount: typeof catalogCount === 'number' ? catalogCount : 0,
      drawCount: points?.geometry.drawRange.count ?? 0,
      visible: points?.visible ?? false,
      opacity: typeof opacity === 'number' ? opacity : 0,
      confidence: typeof confidence === 'string' ? confidence : null,
      batchCount,
      selectedObjectId: typeof selectedObjectId === 'string' ? selectedObjectId : null,
    };
  });
}

export async function readStarClusterBatchState(page: Page): Promise<{
  activeTileCount: number;
  cachedPackCount: number;
  cachedTileCount: number;
  activeClusterCount: number;
  cachedClusterCount: number;
  representationCount: number;
  visibleClusterCount: number;
  pointBatchCount: number;
  visibleLodLevels: number[];
  confidence: string | null;
}> {
  return page.evaluate(() => {
    interface ClusterPoints {
      name: string;
      visible: boolean;
      userData: Record<string, unknown>;
      geometry: {
        drawRange: {
          count: number;
        };
      };
    }

    interface ClusterRepresentation {
      lodLevel: number;
      points: ClusterPoints;
    }

    interface ClusterBatch {
      representations: Map<string, ClusterRepresentation>;
      representationCount: number;
      visibleClusterCount: number;
    }

    interface TileManager {
      activeTileCount: number;
      cachedPackCount: number;
      cachedTileCount: number;
      activeClusterCount: number;
      cachedClusterCount: number;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const manager = engine ? (Reflect.get(engine, 'starTileManager') as TileManager | null) : null;
    const batch = universeScene
      ? (Reflect.get(universeScene, 'starClusterBatch') as ClusterBatch | null)
      : null;
    const representations = batch ? [...batch.representations.values()] : [];
    const pointBatchCount = representations.filter((representation) =>
      representation.points.name.startsWith('calculated-hyg-star-clusters-lod-'),
    ).length;
    const visibleLodLevels = representations
      .filter((representation) => representation.points.visible)
      .map((representation) => representation.lodLevel)
      .sort((left, right) => left - right);
    const confidence = representations[0]?.points.userData['scientificConfidence'];

    return {
      activeTileCount: manager?.activeTileCount ?? 0,
      cachedPackCount: manager?.cachedPackCount ?? 0,
      cachedTileCount: manager?.cachedTileCount ?? 0,
      activeClusterCount: manager?.activeClusterCount ?? 0,
      cachedClusterCount: manager?.cachedClusterCount ?? 0,
      representationCount: batch?.representationCount ?? 0,
      visibleClusterCount: batch?.visibleClusterCount ?? 0,
      pointBatchCount,
      visibleLodLevels,
      confidence: typeof confidence === 'string' ? confidence : null,
    };
  });
}

export async function readConstellationLineState(page: Page): Promise<{
  figureCount: number;
  segmentCount: number;
  visible: boolean;
  opacity: number;
  confidence: string | null;
  batchCount: number;
}> {
  return page.evaluate(() => {
    interface ConstellationLines {
      name: string;
      visible: boolean;
      userData: Record<string, unknown>;
      material: {
        opacity: number;
      };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const constellationBatch = universeScene
      ? (Reflect.get(universeScene, 'constellationBatch') as object | null)
      : null;
    const lines = constellationBatch
      ? (Reflect.get(constellationBatch, 'lines') as ConstellationLines | undefined)
      : undefined;
    const scene = universeScene
      ? (Reflect.get(universeScene, 'scene') as
          | {
              traverse(callback: (object: { name: string }) => void): void;
            }
          | undefined)
      : undefined;
    let batchCount = 0;

    scene?.traverse((object) => {
      if (object.name === 'illustrative-constellation-lines') {
        batchCount += 1;
      }
    });
    const figureCount = lines?.userData['figureCount'];
    const segmentCount = lines?.userData['segmentCount'];
    const confidence = lines?.userData['scientificConfidence'];

    return {
      figureCount: typeof figureCount === 'number' ? figureCount : 0,
      segmentCount: typeof segmentCount === 'number' ? segmentCount : 0,
      visible: lines?.visible ?? false,
      opacity: lines?.material.opacity ?? 0,
      confidence: typeof confidence === 'string' ? confidence : null,
      batchCount,
    };
  });
}

export async function readConstellationInteractionState(
  page: Page,
): Promise<ConstellationInteractionState> {
  return page.evaluate(() => {
    interface HighlightLines {
      visible: boolean;
      userData: Record<string, unknown>;
      geometry: {
        drawRange: {
          count: number;
        };
      };
    }

    const root = document.querySelector('app-root');
    const labelCanvas = document.querySelector<HTMLCanvasElement>('.universe-label-layer');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const constellationBatch = universeScene
      ? (Reflect.get(universeScene, 'constellationBatch') as object | null)
      : null;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as object | undefined)
      : undefined;
    const definitions = constellationBatch
      ? (Reflect.get(constellationBatch, 'definitions') as unknown[] | undefined)
      : undefined;
    const highlight = constellationBatch
      ? (Reflect.get(constellationBatch, 'highlightLines') as HighlightLines | undefined)
      : undefined;
    const regions = labelManager
      ? (Reflect.get(labelManager, 'hitRegions') as LabelRegion[] | undefined)
      : undefined;
    const constellationRegions = (regions ?? []).filter((region) =>
      region.objectId.startsWith('constellation-'),
    );
    const bounds = labelCanvas?.getBoundingClientRect();
    const candidate =
      bounds &&
      constellationRegions.find((region) => {
        const centerX = (region.rectangle.left + region.rectangle.right) / 2;
        const centerY = (region.rectangle.top + region.rectangle.bottom) / 2;

        return (
          centerX >= 360 &&
          centerX <= bounds.width - 120 &&
          centerY >= 120 &&
          centerY <= bounds.height - 180
        );
      });
    const activeObjectId = highlight?.userData['objectId'];

    return {
      definitionCount: definitions?.length ?? 0,
      labelCount: constellationRegions.length,
      activeObjectId: typeof activeObjectId === 'string' ? activeObjectId : null,
      highlightVisible: highlight?.visible ?? false,
      highlightVertexCount: highlight?.geometry.drawRange.count ?? 0,
      candidate:
        bounds && candidate
          ? {
              objectId: candidate.objectId,
              point: {
                x: bounds.left + (candidate.rectangle.left + candidate.rectangle.right) / 2,
                y: bounds.top + (candidate.rectangle.top + candidate.rectangle.bottom) / 2,
              },
            }
          : null,
    };
  });
}

export async function findConstellationSegmentPoint(
  page: Page,
): Promise<{ objectId: string; point: ScreenPoint } | null> {
  return page.evaluate(() => {
    interface ProjectedVector {
      x: number;
      y: number;
      z: number;
      set(x: number, y: number, z: number): ProjectedVector;
      project(camera: CameraState): ProjectedVector;
    }

    interface CameraState {
      position: {
        clone(): ProjectedVector;
      };
    }

    interface PositionAttribute {
      count: number;
      getX(index: number): number;
      getY(index: number): number;
      getZ(index: number): number;
    }

    interface ConstellationLines {
      visible: boolean;
      userData: Record<string, unknown>;
      geometry: {
        getAttribute(name: string): PositionAttribute;
      };
      localToWorld(vector: ProjectedVector): ProjectedVector;
      updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void;
    }

    interface SelectionManagerState {
      findObjectAt(event: { clientX: number; clientY: number }): string | null;
    }

    interface LabelManagerState {
      hitTest(clientX: number, clientY: number): string | null;
    }

    const root = document.querySelector('app-root');
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.universe-canvas');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const constellationBatch = universeScene
      ? (Reflect.get(universeScene, 'constellationBatch') as object | null)
      : null;
    const lines = constellationBatch
      ? (Reflect.get(constellationBatch, 'lines') as ConstellationLines | undefined)
      : undefined;
    const camera = engine ? (Reflect.get(engine, 'camera') as CameraState | undefined) : undefined;
    const selectionManager = engine
      ? (Reflect.get(engine, 'selectionManager') as SelectionManagerState | undefined)
      : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as LabelManagerState | undefined)
      : undefined;
    const objectIds = lines?.userData['objectIds'];

    if (!canvas || !lines?.visible || !camera || !selectionManager || !Array.isArray(objectIds)) {
      return null;
    }
    const bounds = canvas.getBoundingClientRect();
    const positions = lines.geometry.getAttribute('position');

    lines.updateWorldMatrix(true, false);
    for (let index = 0; index < positions.count - 1; index += 2) {
      const objectId: unknown = objectIds[index];

      if (typeof objectId !== 'string') {
        continue;
      }
      const projected = camera.position
        .clone()
        .set(
          (positions.getX(index) + positions.getX(index + 1)) / 2,
          (positions.getY(index) + positions.getY(index + 1)) / 2,
          (positions.getZ(index) + positions.getZ(index + 1)) / 2,
        );

      lines.localToWorld(projected).project(camera);
      if (projected.z < -1 || projected.z > 1) {
        continue;
      }
      const clientX = bounds.left + (projected.x * 0.5 + 0.5) * bounds.width;
      const clientY = bounds.top + (-projected.y * 0.5 + 0.5) * bounds.height;

      if (
        clientX < bounds.left + 360 ||
        clientX > bounds.right - 120 ||
        clientY < bounds.top + 120 ||
        clientY > bounds.bottom - 180 ||
        document.elementFromPoint(clientX, clientY) !== canvas ||
        labelManager?.hitTest(clientX, clientY) !== null
      ) {
        continue;
      }
      if (selectionManager.findObjectAt({ clientX, clientY }) === objectId) {
        return {
          objectId,
          point: {
            x: clientX,
            y: clientY,
          },
        };
      }
    }

    return null;
  });
}

export async function readActiveCatalogStarState(page: Page): Promise<{
  objectId: string | null;
  visible: boolean;
  haloVisible: boolean;
  haloPointSize: number;
  coreVisible: boolean;
  coreOpacity: number;
  catalogPointScale: number;
}> {
  return page.evaluate(() => {
    interface SceneObject {
      visible: boolean;
      userData: Record<string, unknown>;
      material?: {
        opacity?: number;
        uniforms?: Record<string, { value: unknown }>;
      };
      getObjectByName(name: string): SceneObject | undefined;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const scene = universeScene
      ? (Reflect.get(universeScene, 'scene') as SceneObject | undefined)
      : undefined;
    const detail = scene?.getObjectByName('active-hyg-star-detail');
    const halo = scene?.getObjectByName('active-hyg-star-halo');
    const core = scene?.getObjectByName('active-hyg-star-core');
    const catalog = scene?.getObjectByName('observed-hyg-star-catalog');
    const objectId = detail?.userData['objectId'];
    const haloPointSize = halo?.material?.uniforms?.['pointSize']?.value;
    const catalogPointScale = catalog?.material?.uniforms?.['pointScale']?.value;

    return {
      objectId: typeof objectId === 'string' ? objectId : null,
      visible: detail?.visible ?? false,
      haloVisible: halo?.visible ?? false,
      haloPointSize: typeof haloPointSize === 'number' ? haloPointSize : Number.NaN,
      coreVisible: core?.visible ?? false,
      coreOpacity: core?.material?.opacity ?? Number.NaN,
      catalogPointScale: typeof catalogPointScale === 'number' ? catalogPointScale : Number.NaN,
    };
  });
}

export async function readGalaxyImpostorStates(page: Page): Promise<GalaxyImpostorState[]> {
  return page.evaluate(() => {
    interface GalaxySprite {
      visible: boolean;
      layers: { mask: number };
      material: { opacity: number };
      scale: { x: number; y: number };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const registries = engine
      ? [
          Reflect.get(engine, 'objectRegistry'),
          Reflect.get(engine, 'spaceTileObjectRegistry'),
        ].filter(
          (registry): registry is object => typeof registry === 'object' && registry !== null,
        )
      : [];
    const entriesByRegistry = registries
      .map((registry) => Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      .filter((entries): entries is Map<string, object> => entries instanceof Map);
    const states: GalaxyImpostorState[] = [];

    for (const entries of entriesByRegistry) {
      for (const [objectId, entry] of entries) {
        const definition = Reflect.get(entry, 'definition') as { type?: string } | undefined;

        if (definition?.type !== 'galaxy') {
          continue;
        }
        const lod = Reflect.get(entry, 'lod') as { farSprite?: GalaxySprite | null } | undefined;
        const sprite = lod?.farSprite;

        if (!sprite) {
          continue;
        }
        states.push({
          objectId,
          visible: sprite.visible,
          opacity: sprite.material.opacity,
          width: sprite.scale.x,
          height: sprite.scale.y,
          pickable: (sprite.layers.mask & (1 << 1)) !== 0,
        });
      }
    }

    return states.sort((left, right) => left.objectId.localeCompare(right.objectId));
  });
}

export async function readMilkyWayDetailState(page: Page): Promise<MilkyWayDetailState> {
  return page.evaluate(() => {
    interface SceneVector {
      x: number;
      y: number;
      z: number;
      clone(): SceneVector;
      distanceTo(other: SceneVector): number;
    }

    interface SceneNode {
      name: string;
      position: SceneVector;
      scale: { x: number };
      getWorldPosition(target: SceneVector): SceneVector;
    }

    interface MilkyWayPoints extends SceneNode {
      visible: boolean;
      material: { opacity: number };
      userData: Record<string, unknown>;
      geometry: {
        boundingSphere: { radius: number } | null;
        computeBoundingSphere(): void;
      };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const milkyWay = universeScene
      ? (Reflect.get(universeScene, 'milkyWay') as MilkyWayPoints | undefined)
      : undefined;
    const spaceRoot = universeScene
      ? (Reflect.get(universeScene, 'spaceRoot') as
          | {
              traverse(callback: (object: SceneNode) => void): void;
            }
          | undefined)
      : undefined;
    const stellarRoot = universeScene
      ? (Reflect.get(universeScene, 'stellarNeighborhoodRoot') as SceneNode | undefined)
      : undefined;

    if (!milkyWay) {
      throw new Error('La représentation détaillée de la Voie lactée est indisponible.');
    }
    milkyWay.geometry.computeBoundingSphere();
    let spiralAuraCount = 0;
    let sun: SceneNode | null = null;

    spaceRoot?.traverse((object) => {
      if (object.name === 'illustrative-milky-way-aura') {
        spiralAuraCount += 1;
      }
      if (object.name === 'sun') {
        sun = object;
      }
    });
    const visualStructure = milkyWay.userData['visualStructure'];
    const structureOrigin = milkyWay.userData['structureOrigin'];
    const spiralArmCount = milkyWay.userData['spiralArmCount'];
    const spiralPitchDegrees = milkyWay.userData['spiralPitchDegrees'];
    const galacticCenterPosition = milkyWay.getWorldPosition(milkyWay.position.clone());
    const resolvedSun = sun as SceneNode | null;
    const sunPosition = resolvedSun
      ? resolvedSun.getWorldPosition(resolvedSun.position.clone())
      : galacticCenterPosition;
    const stellarOriginPosition =
      stellarRoot?.getWorldPosition(stellarRoot.position.clone()) ?? galacticCenterPosition;

    return {
      visible: milkyWay.visible,
      opacity: milkyWay.material.opacity,
      radius: milkyWay.geometry.boundingSphere?.radius ?? 0,
      spiralAuraCount,
      visualStructure: typeof visualStructure === 'string' ? visualStructure : null,
      structureOrigin: typeof structureOrigin === 'string' ? structureOrigin : null,
      spiralArmCount: typeof spiralArmCount === 'number' ? spiralArmCount : null,
      spiralPitchDegrees: typeof spiralPitchDegrees === 'number' ? spiralPitchDegrees : null,
      sunDistanceFromGalacticCenter: sunPosition.distanceTo(galacticCenterPosition),
      stellarOriginDistanceFromSun: stellarOriginPosition.distanceTo(sunPosition),
      stellarNeighborhoodScale: stellarRoot?.scale.x ?? 1,
    };
  });
}

export async function readMilkyWayVolumeState(page: Page): Promise<MilkyWayVolumeState> {
  return page.evaluate(() => {
    interface VolumeNode {
      name: string;
      visible: boolean;
      position: { y: number };
      scale: { y: number };
      userData: Record<string, unknown>;
      children: VolumeNode[];
    }

    interface VolumeRenderer {
      root: VolumeNode;
      atlasStatus: string;
      drawMeshCount: number;
      visibleDiscLayerCount: number;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const volume = universeScene
      ? (Reflect.get(universeScene, 'milkyWayVolume') as VolumeRenderer | undefined)
      : undefined;

    if (!volume) {
      throw new Error('La représentation volumique de la Voie lactée est indisponible.');
    }
    const discs = volume.root.children.filter((child) =>
      child.name.startsWith('milky-way-volume-disc-'),
    );
    const bulge = volume.root.children.find((child) => child.name === 'milky-way-volume-bulge');
    const depths = discs.map((disc) => disc.position.y);
    const atlasUrl = volume.root.userData['atlasUrl'];
    const structure = volume.root.userData['visualStructure'];
    const depthTechnique = volume.root.userData['depthTechnique'];
    const confidence = volume.root.userData['scientificConfidence'];
    const cinematicQuality = volume.root.userData['cinematicQuality'];
    const cinematicProfile = volume.root.userData['cinematicProfile'] as
      Record<string, unknown> | undefined;

    return {
      visible: volume.root.visible,
      atlasStatus: volume.atlasStatus,
      atlasUrl: typeof atlasUrl === 'string' ? atlasUrl : null,
      structure: typeof structure === 'string' ? structure : null,
      depthTechnique: typeof depthTechnique === 'string' ? depthTechnique : null,
      confidence: typeof confidence === 'string' ? confidence : null,
      cinematicQuality: typeof cinematicQuality === 'string' ? cinematicQuality : null,
      parallaxStrength: Number(cinematicProfile?.['parallaxStrength']),
      dustAbsorption: Number(cinematicProfile?.['dustAbsorption']),
      glowStrength: Number(cinematicProfile?.['glowStrength']),
      drawMeshCount: volume.drawMeshCount,
      visibleDiscLayerCount: volume.visibleDiscLayerCount,
      layerDepthSpan: Math.max(...depths) - Math.min(...depths),
      bulgeHeight: (bulge?.scale.y ?? 0) * 2,
    };
  });
}

export async function readCosmicBackgroundState(page: Page): Promise<CosmicBackgroundState> {
  return page.evaluate(() => {
    interface ColorState {
      r: number;
      g: number;
      b: number;
    }

    interface BackgroundMesh {
      userData: Record<string, unknown>;
      geometry: {
        getAttribute(name: string): { count: number };
      };
      material: {
        uniforms: Record<string, { value: unknown }>;
      };
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const background = universeScene
      ? (Reflect.get(universeScene, 'cosmicBackground') as object | undefined)
      : undefined;
    const mesh = background
      ? (Reflect.get(background, 'mesh') as BackgroundMesh | undefined)
      : undefined;

    if (!mesh) {
      throw new Error('Fond cosmique continu indisponible.');
    }
    const uniforms = mesh.material.uniforms;
    const upper = uniforms['upperColor']?.value as ColorState | undefined;
    const lower = uniforms['lowerColor']?.value as ColorState | undefined;
    const accent = uniforms['accentColor']?.value as ColorState | undefined;

    if (!upper || !lower || !accent) {
      throw new Error('Palette du fond cosmique indisponible.');
    }
    const confidence = mesh.userData['scientificConfidence'];
    const transitionDriver = mesh.userData['transitionDriver'];
    const cameraDistance = mesh.userData['cameraDistance'];

    return {
      upperColor: [upper.r, upper.g, upper.b],
      lowerColor: [lower.r, lower.g, lower.b],
      accentColor: [accent.r, accent.g, accent.b],
      hazeStrength: Number(uniforms['hazeStrength']?.value),
      nebulaStrength: Number(uniforms['nebulaStrength']?.value),
      dustStrength: Number(uniforms['dustStrength']?.value),
      vignetteStrength: Number(uniforms['vignetteStrength']?.value),
      detailStrength: Number(uniforms['detailStrength']?.value),
      cameraDistance: typeof cameraDistance === 'number' ? cameraDistance : 0,
      triangleCount: mesh.geometry.getAttribute('position').count / 3,
      confidence: typeof confidence === 'string' ? confidence : null,
      transitionDriver: typeof transitionDriver === 'string' ? transitionDriver : null,
    };
  });
}

export async function waitForIsolatedCatalogPoint(
  page: Page,
): Promise<{ objectId: string; point: ScreenPoint }> {
  return waitForCatalogPoint(page, false);
}

export async function waitForUnlabelledCatalogPoint(
  page: Page,
): Promise<{ objectId: string; point: ScreenPoint }> {
  return waitForCatalogPoint(page, true);
}

async function waitForCatalogPoint(
  page: Page,
  requireUnlabelled: boolean,
): Promise<{ objectId: string; point: ScreenPoint }> {
  let result: { objectId: string; point: ScreenPoint } | null = null;

  await expect
    .poll(async () => {
      result = await readIsolatedCatalogPoint(page, requireUnlabelled);

      return result;
    })
    .not.toBeNull();
  if (!result) {
    throw new Error('Aucune étoile HYG isolée et visible.');
  }

  return result;
}

async function readIsolatedCatalogPoint(
  page: Page,
  requireUnlabelled: boolean,
): Promise<{ objectId: string; point: ScreenPoint } | null> {
  return page.evaluate((unlabelledOnly) => {
    interface ProjectableVector {
      x: number;
      y: number;
      z: number;
      fromBufferAttribute(attribute: unknown, index: number): ProjectableVector;
      project(camera: unknown): ProjectableVector;
    }

    interface CatalogPoints {
      geometry: {
        drawRange: { count: number };
        getAttribute(name: string): unknown;
      };
      userData: Record<string, unknown>;
      updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void;
      localToWorld(vector: ProjectableVector): ProjectableVector;
    }

    const root = document.querySelector('app-root');
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.universe-canvas');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as
          | {
              hitTest(clientX: number, clientY: number): string | null;
            }
          | undefined)
      : undefined;
    const camera = engine
      ? (Reflect.get(engine, 'camera') as
          | {
              position: {
                clone(): ProjectableVector;
              };
            }
          | undefined)
      : undefined;
    const batch = universeScene
      ? (Reflect.get(universeScene, 'starCatalogBatch') as object | null)
      : null;
    const points = batch ? (Reflect.get(batch, 'points') as CatalogPoints | undefined) : undefined;

    if (!canvas || !camera || !points) {
      return null;
    }
    const objectIds = points.userData['objectIds'];

    if (!Array.isArray(objectIds)) {
      return null;
    }
    const bounds = canvas.getBoundingClientRect();
    const position = points.geometry.getAttribute('position');
    const projected: { objectId: string; x: number; y: number }[] = [];

    points.updateWorldMatrix(true, false);
    for (let index = 0; index < points.geometry.drawRange.count; index += 1) {
      const vector = camera.position.clone().fromBufferAttribute(position, index);

      points.localToWorld(vector).project(camera);
      const x = bounds.left + (vector.x * 0.5 + 0.5) * bounds.width;
      const y = bounds.top + (-vector.y * 0.5 + 0.5) * bounds.height;
      const objectId = objectIds[index];

      if (
        typeof objectId === 'string' &&
        vector.z >= -1 &&
        vector.z <= 1 &&
        x >= bounds.left + 420 &&
        x <= bounds.right - 120 &&
        y >= bounds.top + 130 &&
        y <= bounds.bottom - 190
      ) {
        projected.push({ objectId, x, y });
      }
    }

    for (const candidate of projected) {
      const isolated = projected.every(
        (other) =>
          other === candidate || Math.hypot(other.x - candidate.x, other.y - candidate.y) > 18,
      );

      if (
        isolated &&
        (!unlabelledOnly || labelManager?.hitTest(candidate.x, candidate.y) === null)
      ) {
        return {
          objectId: candidate.objectId,
          point: { x: candidate.x, y: candidate.y },
        };
      }
    }

    return null;
  }, requireUnlabelled);
}

export async function waitForLabelCenter(
  page: Page,
  objectId?: string,
): Promise<{ objectId: string; point: ScreenPoint }> {
  let result: { objectId: string; point: ScreenPoint } | null = null;

  await expect
    .poll(async () => {
      result = await readLabelCenter(page, objectId);

      return result;
    })
    .not.toBeNull();
  if (!result) {
    throw new Error(`Label ${objectId ?? 'stellaire'} introuvable.`);
  }

  return result;
}

export async function readLabelCenter(
  page: Page,
  objectId?: string,
): Promise<{ objectId: string; point: ScreenPoint } | null> {
  return page.evaluate((requestedId) => {
    const root = document.querySelector('app-root');
    const labelCanvas = document.querySelector<HTMLCanvasElement>('.universe-label-layer');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;

    if (!root || !labelCanvas || !angularDebug) {
      return null;
    }

    const component = angularDebug.getComponent(root);

    if (!component) {
      return null;
    }
    const facade = Reflect.get(component, 'facade') as object | undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as object | undefined)
      : undefined;
    const regions = labelManager
      ? (Reflect.get(labelManager, 'hitRegions') as LabelRegion[] | undefined)
      : undefined;

    if (!regions) {
      return null;
    }

    const bounds = labelCanvas.getBoundingClientRect();
    const region = requestedId
      ? regions.find((candidate) => candidate.objectId === requestedId)
      : regions
          .filter((candidate) => {
            const centerX = (candidate.rectangle.left + candidate.rectangle.right) / 2;
            const centerY = (candidate.rectangle.top + candidate.rectangle.bottom) / 2;

            return (
              candidate.objectId !== 'milky-way' &&
              centerX >= 32 &&
              centerX <= bounds.width - 32 &&
              centerY >= 140 &&
              centerY <= bounds.height - 220
            );
          })
          .sort((first, second) => {
            const firstCenterX = (first.rectangle.left + first.rectangle.right) / 2;
            const firstCenterY = (first.rectangle.top + first.rectangle.bottom) / 2;
            const secondCenterX = (second.rectangle.left + second.rectangle.right) / 2;
            const secondCenterY = (second.rectangle.top + second.rectangle.bottom) / 2;
            const firstDistance = Math.hypot(
              firstCenterX - bounds.width / 2,
              firstCenterY - bounds.height / 2,
            );
            const secondDistance = Math.hypot(
              secondCenterX - bounds.width / 2,
              secondCenterY - bounds.height / 2,
            );

            return firstDistance - secondDistance;
          })[0];

    if (!region) {
      return null;
    }

    return {
      objectId: region.objectId,
      point: {
        x: bounds.left + (region.rectangle.left + region.rectangle.right) / 2,
        y: bounds.top + (region.rectangle.top + region.rectangle.bottom) / 2,
      },
    };
  }, objectId);
}

export async function readVisibleLabelIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as object | undefined)
      : undefined;
    const regions = labelManager
      ? (Reflect.get(labelManager, 'hitRegions') as LabelRegion[] | undefined)
      : undefined;

    return (regions ?? []).map(({ objectId }) => objectId).sort();
  });
}

export async function readCatalogLabelLayout(page: Page): Promise<CatalogLabelLayout> {
  return page.evaluate(() => {
    const root = document.querySelector('app-root');
    const labelCanvas = document.querySelector<HTMLCanvasElement>('.universe-label-layer');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as object | undefined)
      : undefined;
    const regions = labelManager
      ? (Reflect.get(labelManager, 'hitRegions') as LabelRegion[] | undefined)
      : undefined;
    const hoveredObjectId = labelManager
      ? (Reflect.get(labelManager, 'hoveredId') as unknown)
      : null;

    if (!labelCanvas || !regions) {
      return {
        totalCount: 0,
        catalogCount: 0,
        overlapCount: 0,
        hoveredObjectId: null,
        candidate: null,
      };
    }
    const bounds = labelCanvas.getBoundingClientRect();
    const catalogRegions = regions.filter((region) => region.objectId.startsWith('hyg-'));
    const rectanglesOverlap = (
      left: LabelRegion['rectangle'],
      right: LabelRegion['rectangle'],
    ): boolean =>
      left.left < right.right &&
      left.right > right.left &&
      left.top < right.bottom &&
      left.bottom > right.top;
    let overlapCount = 0;

    for (let leftIndex = 0; leftIndex < regions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < regions.length; rightIndex += 1) {
        if (rectanglesOverlap(regions[leftIndex]!.rectangle, regions[rightIndex]!.rectangle)) {
          overlapCount += 1;
        }
      }
    }
    const candidate = catalogRegions.find((region) => {
      const centerX = (region.rectangle.left + region.rectangle.right) / 2;
      const centerY = (region.rectangle.top + region.rectangle.bottom) / 2;

      return (
        centerX >= 420 &&
        centerX <= bounds.width - 140 &&
        centerY >= 140 &&
        centerY <= bounds.height - 220
      );
    });

    return {
      totalCount: regions.length,
      catalogCount: catalogRegions.length,
      overlapCount,
      hoveredObjectId: typeof hoveredObjectId === 'string' ? hoveredObjectId : null,
      candidate: candidate
        ? {
            objectId: candidate.objectId,
            point: {
              x: bounds.left + (candidate.rectangle.left + candidate.rectangle.right) / 2,
              y: bounds.top + (candidate.rectangle.top + candidate.rectangle.bottom) / 2,
            },
          }
        : null,
    };
  });
}

export async function readBodyLabelOcclusionState(
  page: Page,
  objectId: string,
): Promise<BodyLabelOcclusionState> {
  return page.evaluate((requestedId) => {
    interface ScreenOccluderState {
      objectId: string;
      centerX: number;
      centerY: number;
      radius: number;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as object | undefined)
      : undefined;
    const occluders = labelManager
      ? (Reflect.get(labelManager, 'screenOccluders') as ScreenOccluderState[] | undefined)
      : undefined;
    const regions = labelManager
      ? (Reflect.get(labelManager, 'hitRegions') as LabelRegion[] | undefined)
      : undefined;
    const occluder = occluders?.find(({ objectId }) => objectId === requestedId);

    if (!occluder || !regions) {
      return {
        radius: 0,
        overlappingLabelCount: 0,
      };
    }
    const overlappingLabelCount = regions.filter((region) => {
      if (region.objectId === requestedId) {
        return false;
      }
      const closestX = Math.max(
        region.rectangle.left,
        Math.min(occluder.centerX, region.rectangle.right),
      );
      const closestY = Math.max(
        region.rectangle.top,
        Math.min(occluder.centerY, region.rectangle.bottom),
      );

      return (
        Math.hypot(occluder.centerX - closestX, occluder.centerY - closestY) <= occluder.radius
      );
    }).length;

    return {
      radius: occluder.radius,
      overlappingLabelCount,
    };
  }, objectId);
}

async function isCameraSettled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: {
          getComponent(element: Element): object | null;
        };
      }
    ).ng;

    if (!root || !angularDebug) {
      return false;
    }

    const component = angularDebug.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const controller = engine
      ? (Reflect.get(engine, 'cameraController') as object | undefined)
      : undefined;

    return controller ? Reflect.get(controller, 'isTransitioning') === false : false;
  });
}

export function queryParameter(page: Page, name: string): string | null {
  return new URL(page.url()).searchParams.get(name);
}

export function numericQueryParameter(page: Page, name: string): number {
  const value = queryParameter(page, name);

  return value === null ? Number.NaN : Number(value);
}

export function monitorBrowserErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  return errors;
}
