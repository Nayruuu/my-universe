import { expect, type Page } from '@playwright/test';
import type { ScreenPoint } from './support/navigation-helpers';

export {
  readRotationGuideState,
  readSunOcclusionState,
  type RotationGuideState,
  type SunOcclusionState,
} from './support/object-adornment-helpers';
export {
  findEmptyCanvasPoint,
  monitorBrowserErrors,
  numericQueryParameter,
  openUniverse,
  queryParameter,
  readCameraInteractionState,
  readNavigationAlignmentState,
  readObjectScreenPoint,
  universeUrl,
  waitForCameraSettled,
  type CameraInteractionState,
  type NavigationAlignmentState,
  type ScreenPoint,
} from './support/navigation-helpers';
export {
  chooseCustomObserverLocation,
  chooseObserverLocation,
} from './support/observer-location-helpers';

export interface QuaternionSample {
  x: number;
  y: number;
  z: number;
  w: number;
  julianDay: number;
  timestampMs: number;
}

export interface PositionSample {
  x: number;
  y: number;
  z: number;
  julianDay: number;
  timestampMs: number;
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

interface ObjectRuntimeState<Registry> {
  readonly primaryRegistry: Registry | null;
  readonly streamedRegistry: Registry | null;
  getRegistry(objectId: string): Registry | null;
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
  highlightOpacity: number;
  highlightStyle: string | null;
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
  farVisualStyle: string | null;
  nearVisible: boolean;
  nearDiskVisible: boolean;
  nearDiskStyle: string | null;
  nearStarFieldVisible: boolean;
  nearStarFieldStyle: string | null;
  nearParticleCount: number;
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
  opacity: number;
  scale: number;
  atlasStatus: string;
  atlasUrl: string | null;
  structure: string | null;
  depthTechnique: string | null;
  morphologyModel: string | null;
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

export interface LocalGalacticSkyState {
  environmentVisible: boolean;
  bandVisible: boolean;
  opacity: number;
  drawMeshCount: number;
  maximumDrawMeshCount: number;
  panoramaStatus: string;
  panoramaUrl: string | null;
  panoramaWidth: number;
  panoramaHeight: number;
  angularPresentation: string | null;
  sourceCredit: string | null;
  sourceImageId: string | null;
  sourcePageUrl: string | null;
  sourcePixelDimensions: number[];
  texturePixelDimensions: number[];
  sourceAngularLatitudeSpanDegrees: number;
  angularLatitudeSpanDegrees: number;
  latitudePresentationScale: number;
  sourceProjection: string | null;
  presentationPitchDegrees: number;
  presentationRollDegrees: number;
  presentationComposition: string | null;
  orientationConfidence: string | null;
  confidence: string | null;
  referenceFrame: string | null;
  visualStyle: string | null;
  galacticCenterDirection: number[];
  visualLayers: string[];
  depthTest: boolean;
}

export interface LocalVolumeDepthBackdropState {
  visible: boolean;
  opacity: number;
  catalogCount: number;
  activeCount: number;
  drawCount: number;
  minimumRadius: number;
  maximumRadius: number;
  depthProjection: string | null;
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

export interface SunPixelOcclusionState {
  changedPixels: number;
  comparedPixels: number;
  meanOccludedLuminance: number;
  maximumDifference: number;
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

export interface SupernovaVisualState {
  objectId: string;
  phase: string;
  nearVisible: boolean;
  farVisible: boolean;
  shellVisible: boolean;
  shellLayerCount: number;
  visibleShellLayerCount: number;
  flashVisible: boolean;
  shellStyle: string | null;
  farAppearanceOpacity: number;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<RegistryState> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry(id) ?? null;
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

export async function readSupernovaVisualState(
  page: Page,
  objectId: string,
): Promise<SupernovaVisualState> {
  return page.evaluate((id) => {
    interface SceneNode {
      visible: boolean;
      userData: Record<string, unknown>;
      getObjectByName(name: string): SceneNode | undefined;
    }

    interface RegistryEntryState {
      visualRoot: SceneNode;
      supernova: { phase: string } | null;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<RegistryState> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry(id) ?? null;
    const entry = registry?.entries.get(id);

    if (!entry?.supernova) {
      throw new Error(`Supernova ${id} indisponible dans le registre.`);
    }
    const shell = entry.visualRoot.getObjectByName(`${id}-supernova-shell`);
    const shellLayers = [
      shell,
      entry.visualRoot.getObjectByName(`${id}-supernova-filaments`),
      entry.visualRoot.getObjectByName(`${id}-supernova-emission-knots`),
    ].filter((layer): layer is SceneNode => layer !== undefined);
    const flash = entry.visualRoot.getObjectByName(`${id}-supernova-flash`);
    const shellStyle = shell?.userData['visualStyle'];
    const appearanceOpacity = entry.lod.farSprite?.userData['appearanceOpacity'];

    return {
      objectId: id,
      phase: entry.supernova.phase,
      nearVisible: entry.lod.nearRoot?.visible ?? false,
      farVisible: entry.lod.farSprite?.visible ?? false,
      shellVisible: shell?.visible ?? false,
      shellLayerCount: shellLayers.length,
      visibleShellLayerCount: shellLayers.filter((layer) => layer.visible).length,
      flashVisible: flash?.visible ?? false,
      shellStyle: typeof shellStyle === 'string' ? shellStyle : null,
      farAppearanceOpacity: typeof appearanceOpacity === 'number' ? appearanceOpacity : 0,
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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

export async function readSpaceTileStreamingState(page: Page): Promise<SpaceTileStreamingState> {
  return page.evaluate(() => {
    interface StreamingCoordinatorState {
      searchEntries: readonly { id: string }[];
      loadedSpaceObjects: readonly { id: string }[];
      stats: {
        indexedGalaxyTiles: number;
        loadedTiles: number;
        cachedGalaxyTiles: number;
      };
    }

    interface StreamingRuntimeState {
      coordinator: StreamingCoordinatorState | null;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const streamingRuntime = engine
      ? (Reflect.get(engine, 'streamingRuntime') as StreamingRuntimeState | undefined)
      : undefined;
    const coordinator = streamingRuntime?.coordinator ?? null;

    if (!coordinator) {
      throw new Error('Coordinateur de streaming spatial indisponible.');
    }

    return {
      indexedObjectCount: coordinator.searchEntries.length,
      indexedTileCount: coordinator.stats.indexedGalaxyTiles,
      loadedTileCount: coordinator.stats.loadedTiles,
      cachedTileCount: coordinator.stats.cachedGalaxyTiles,
      loadedObjectIds: coordinator.loadedSpaceObjects
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registries = [objectRuntime?.primaryRegistry, objectRuntime?.streamedRegistry].filter(
      (registry): registry is object => registry !== null && registry !== undefined,
    );
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry(requestedId);
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry(requestedId);
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
      const engineClient = facade
        ? (Reflect.get(facade, 'engine') as object | undefined)
        : undefined;
      const engine = engineClient
        ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
        : undefined;
      const objectRuntime = engine
        ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
        : undefined;
      const registry = objectRuntime?.getRegistry(requestedId);
      const entries = registry
        ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
        : undefined;
      const entry = entries?.get(requestedId);
      const body = entry
        ? (Reflect.get(entry, 'rotatingBody') as {
            quaternion: Omit<QuaternionSample, 'julianDay' | 'timestampMs'>;
          } | null)
        : null;
      const samples: QuaternionSample[] = [];

      if (!body || !engine) {
        return samples;
      }
      for (let index = 0; index < requestedCount; index += 1) {
        const timestampMs = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
        const { x, y, z, w } = body.quaternion;
        const currentTime = Reflect.get(engine, 'currentTime') as { julianDay: number };

        samples.push({
          x,
          y,
          z,
          w,
          julianDay: currentTime.julianDay,
          timestampMs,
        });
      }

      return samples;
    },
    { requestedId: objectId, requestedCount: sampleCount },
  );
}

export async function sampleObjectPositions(
  page: Page,
  objectId: string,
  sampleCount: number,
): Promise<PositionSample[]> {
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
      const engineClient = facade
        ? (Reflect.get(facade, 'engine') as object | undefined)
        : undefined;
      const engine = engineClient
        ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
        : undefined;
      const objectRuntime = engine
        ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
        : undefined;
      const registry = objectRuntime?.getRegistry(requestedId);
      const entries = registry
        ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
        : undefined;
      const entry = entries?.get(requestedId);
      const node = entry
        ? (Reflect.get(entry, 'node') as {
            position: Omit<PositionSample, 'julianDay' | 'timestampMs'>;
          })
        : null;
      const samples: PositionSample[] = [];

      if (!node || !engine) {
        return samples;
      }
      for (let index = 0; index < requestedCount; index += 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
        const { x, y, z } = node.position;
        const currentTime = Reflect.get(engine, 'currentTime') as { julianDay: number };

        samples.push({
          x,
          y,
          z,
          julianDay: currentTime.julianDay,
          timestampMs: performance.now(),
        });
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry('earth');
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

export async function readSolarObserverVisualState(page: Page): Promise<{
  observerModeActive: boolean;
  sunVisible: boolean;
  moonVisible: boolean;
  earthVisible: boolean;
  coronaVisible: boolean;
  sunOnScreen: boolean;
  moonOnScreen: boolean;
  screenSeparation: number;
}> {
  return page.evaluate(() => {
    interface RuntimeVector {
      x: number;
      y: number;
      z: number;
      clone(): RuntimeVector;
      project(camera: object): RuntimeVector;
    }

    interface RuntimeEntry {
      node: {
        getWorldPosition(target: RuntimeVector): RuntimeVector;
      };
      visualRoot: { visible: boolean };
      observerCorona: { visible: boolean } | null;
      lod: {
        visibilityBlend: number;
        nearRoot: { visible: boolean } | null;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry('earth');
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, RuntimeEntry> | undefined)
      : undefined;
    const camera = engine
      ? (Reflect.get(engine, 'camera') as { position: RuntimeVector } | undefined)
      : undefined;
    const controller = engine
      ? (Reflect.get(engine, 'cameraController') as { observerModeActive: boolean } | undefined)
      : undefined;
    const sun = entries?.get('sun');
    const moon = entries?.get('moon');
    const earth = entries?.get('earth');
    const project = (entry: RuntimeEntry | undefined): RuntimeVector | null =>
      entry && camera ? entry.node.getWorldPosition(camera.position.clone()).project(camera) : null;
    const sunPoint = project(sun);
    const moonPoint = project(moon);
    const onScreen = (point: RuntimeVector | null): boolean =>
      point !== null &&
      Math.abs(point.x) <= 1 &&
      Math.abs(point.y) <= 1 &&
      point.z >= -1 &&
      point.z <= 1;
    const visible = (entry: RuntimeEntry | undefined): boolean =>
      entry?.visualRoot.visible === true &&
      entry.lod.nearRoot?.visible === true &&
      entry.lod.visibilityBlend > 0.5;

    return {
      observerModeActive: controller?.observerModeActive ?? false,
      sunVisible: visible(sun),
      moonVisible: visible(moon),
      earthVisible: visible(earth),
      coronaVisible: sun?.observerCorona?.visible ?? false,
      sunOnScreen: onScreen(sunPoint),
      moonOnScreen: onScreen(moonPoint),
      screenSeparation:
        sunPoint && moonPoint
          ? Math.hypot(sunPoint.x - moonPoint.x, sunPoint.y - moonPoint.y)
          : Number.POSITIVE_INFINITY,
    };
  });
}

export async function readSolarEclipseEventMapState(page: Page): Promise<{
  visible: boolean;
  partialEnvelopeVisible: boolean;
  corridorVisible: boolean;
  corridorLimitsVisible: boolean;
  centralLineVisible: boolean;
  bodyFixed: boolean;
  europeCovered: boolean;
  europeFramed: boolean;
  overviewFramed: boolean;
  sufficientSampling: boolean;
  source: string | null;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry('earth');

    interface RuntimeVector {
      x: number;
      y: number;
      z: number;
      clone(): RuntimeVector;
      set(x: number, y: number, z: number): RuntimeVector;
      normalize(): RuntimeVector;
      multiplyScalar(scale: number): RuntimeVector;
      sub(vector: RuntimeVector): RuntimeVector;
      dot(vector: RuntimeVector): number;
      project(camera: object): RuntimeVector;
    }
    const controller = engine
      ? (Reflect.get(engine, 'cameraController') as { distanceToTarget: number } | undefined)
      : undefined;
    const camera = engine
      ? (Reflect.get(engine, 'camera') as { position: RuntimeVector } | undefined)
      : undefined;
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const earth = entries?.get('earth');
    const rotatingBody = earth
      ? (Reflect.get(earth, 'rotatingBody') as {
          worldToLocal(point: RuntimeVector): RuntimeVector;
        } | null)
      : null;
    const solarEclipse = earth
      ? (Reflect.get(earth, 'solarEclipse') as {
          eventMapRoot: {
            visible: boolean;
            parent: { name: string } | null;
            userData: Record<string, unknown>;
          };
          partialEnvelope: {
            visible: boolean;
            material: { map: { image: HTMLCanvasElement } | null };
            localToWorld(point: RuntimeVector): RuntimeVector;
          };
          corridor: { visible: boolean };
          corridorLimits: { visible: boolean };
          path: { visible: boolean };
        } | null)
      : null;
    const footprintCount = solarEclipse?.eventMapRoot.userData['partialFootprintCount'];
    const corridorCount = solarEclipse?.eventMapRoot.userData['corridorSampleCount'];
    const source = solarEclipse?.eventMapRoot.userData['source'];
    const partialCanvas = solarEclipse?.partialEnvelope.material.map?.image;
    const partialContext = partialCanvas?.getContext('2d');
    const europeanCities = [
      [48.8566, 2.3522],
      [51.5074, -0.1278],
      [52.52, 13.405],
      [40.4168, -3.7038],
    ];
    const europeanCityStates = europeanCities.map(([latitude, longitude]) => {
      if (!partialCanvas || !partialContext || !camera || !solarEclipse) {
        return { covered: false, framed: false, screenX: Number.NaN };
      }
      const latitudeRadians = (latitude! * Math.PI) / 180;
      const longitudeRadians = (longitude! * Math.PI) / 180;
      const surfacePoint = camera.position
        .clone()
        .set(
          Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
          Math.sin(latitudeRadians),
          -Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
        )
        .multiplyScalar(1.018);
      const earthCenter = solarEclipse.partialEnvelope.localToWorld(
        camera.position.clone().set(0, 0, 0),
      );
      const worldPoint = solarEclipse.partialEnvelope.localToWorld(surfacePoint);
      const screenPoint = worldPoint.clone().project(camera);
      const frontFacing =
        worldPoint
          .clone()
          .sub(earthCenter)
          .normalize()
          .dot(camera.position.clone().sub(earthCenter).normalize()) > 0.2;
      const pixel = partialContext.getImageData(
        Math.round(((longitude! + 180) / 360) * (partialCanvas.width - 1)),
        Math.round(((90 - latitude!) / 180) * (partialCanvas.height - 1)),
        1,
        1,
      ).data;

      return {
        covered: pixel[3]! > 0,
        framed: frontFacing && Math.abs(screenPoint.x) < 0.36 && Math.abs(screenPoint.y) < 0.36,
        screenX: screenPoint.x,
      };
    });
    const newYorkLatitude = (40.7128 * Math.PI) / 180;
    const newYorkLongitude = (-74.006 * Math.PI) / 180;
    const newYorkScreenX =
      camera && solarEclipse
        ? solarEclipse.partialEnvelope
            .localToWorld(
              camera.position
                .clone()
                .set(
                  Math.cos(newYorkLatitude) * Math.cos(newYorkLongitude),
                  Math.sin(newYorkLatitude),
                  -Math.cos(newYorkLatitude) * Math.sin(newYorkLongitude),
                ),
            )
            .project(camera).x
        : Number.NaN;
    const localCameraDirection =
      camera && rotatingBody
        ? rotatingBody.worldToLocal(camera.position.clone()).normalize()
        : null;
    const cameraLatitude = localCameraDirection
      ? (Math.asin(localCameraDirection.y) * 180) / Math.PI
      : Number.NaN;
    const cameraLongitude = localCameraDirection
      ? (-Math.atan2(localCameraDirection.z, localCameraDirection.x) * 180) / Math.PI
      : Number.NaN;
    const europeCovered = europeanCityStates.every(({ covered }) => covered);
    const europeFramed =
      europeanCityStates.every(({ framed }) => framed) &&
      europeanCityStates.every(({ screenX }) => screenX > newYorkScreenX) &&
      cameraLatitude > 52 &&
      cameraLatitude < 63 &&
      cameraLongitude > -24 &&
      cameraLongitude < -8;
    const definition = earth
      ? (Reflect.get(earth, 'definition') as { visual: { visualRadius: number } })
      : null;
    const overviewDistance =
      controller && definition
        ? controller.distanceToTarget / definition.visual.visualRadius
        : Number.NaN;

    return {
      visible: solarEclipse?.eventMapRoot.visible ?? false,
      partialEnvelopeVisible: solarEclipse?.partialEnvelope.visible ?? false,
      corridorVisible: solarEclipse?.corridor.visible ?? false,
      corridorLimitsVisible: solarEclipse?.corridorLimits.visible ?? false,
      centralLineVisible: solarEclipse?.path.visible ?? false,
      bodyFixed: solarEclipse?.eventMapRoot.parent?.name === 'earth-body',
      europeCovered,
      europeFramed,
      overviewFramed: overviewDistance > 4.7 && overviewDistance < 4.9,
      sufficientSampling:
        typeof footprintCount === 'number' &&
        footprintCount > 12 &&
        typeof corridorCount === 'number' &&
        corridorCount > 20,
      source: typeof source === 'string' ? source : null,
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
  overviewEmphasis: boolean;
  color: string | null;
  mapAccent: string | null;
  semanticGroup: string | null;
}> {
  return page.evaluate((requestedId) => {
    interface OrbitLine {
      visible: boolean;
      userData: Record<string, unknown>;
      material: {
        opacity: number;
        color: {
          getHexString(): string;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry(requestedId);
    const registryRoot = registry
      ? (Reflect.get(registry, 'registryRoot') as
          { getObjectByName(name: string): OrbitLine | undefined } | undefined)
      : undefined;
    const line = registryRoot?.getObjectByName(`${requestedId}-orbit`);
    const mapAccent = line?.userData['mapAccent'];
    const semanticGroup = line?.userData['semanticGroup'];

    return {
      visible: line?.visible ?? false,
      active: line?.userData['active'] === true,
      opacity: line?.material.opacity ?? 0,
      overviewEmphasis: line?.userData['overviewEmphasis'] === true,
      color: line ? `#${line.material.color.getHexString()}` : null,
      mapAccent: typeof mapAccent === 'string' ? mapAccent : null,
      semanticGroup: typeof semanticGroup === 'string' ? semanticGroup : null,
    };
  }, objectId);
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry(requestedId);
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const stellarCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'stellarCatalogLayers') as object | undefined)
      : undefined;
    const starCatalogBatch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'starCatalogBatch') as object | null)
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

export async function readHeliocentricCatalogPresentationState(page: Page): Promise<{
  hyg: {
    visible: boolean;
    observerBoundaryOpacity: number;
  };
  exoplanetHosts: {
    visible: boolean;
    opacity: number;
    pointScale: number;
    hostSignatureStrength: number;
    observerBoundaryOpacity: number;
  };
}> {
  return page.evaluate(() => {
    interface CatalogPoints {
      visible: boolean;
      userData: Record<string, unknown>;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const stellarCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'stellarCatalogLayers') as object | undefined)
      : undefined;
    const starCatalogBatch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'starCatalogBatch') as object | null)
      : null;
    const exoplanetHostBatch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'exoplanetHostBatch') as object | null)
      : null;
    const hygPoints = starCatalogBatch
      ? (Reflect.get(starCatalogBatch, 'points') as CatalogPoints | undefined)
      : undefined;
    const hostPoints = exoplanetHostBatch
      ? (Reflect.get(exoplanetHostBatch, 'points') as CatalogPoints | undefined)
      : undefined;
    const numericUniform = (points: CatalogPoints | undefined, name: string): number => {
      const value = points?.material.uniforms[name]?.value;

      return typeof value === 'number' ? value : 0;
    };
    const numericMetadata = (points: CatalogPoints | undefined, name: string): number => {
      const value = points?.userData[name];

      return typeof value === 'number' ? value : 0;
    };

    return {
      hyg: {
        visible: hygPoints?.visible ?? false,
        observerBoundaryOpacity: numericMetadata(hygPoints, 'observerBoundaryOpacity'),
      },
      exoplanetHosts: {
        visible: hostPoints?.visible ?? false,
        opacity: numericUniform(hostPoints, 'catalogOpacity'),
        pointScale: numericUniform(hostPoints, 'pointScale'),
        hostSignatureStrength: numericUniform(hostPoints, 'hostSignatureStrength'),
        observerBoundaryOpacity: numericMetadata(hostPoints, 'observerBoundaryOpacity'),
      },
    };
  });
}

export async function readCosmicGroupBatchState(page: Page): Promise<{
  catalogCount: number;
  activeCount: number;
  drawCount: number;
  visible: boolean;
  opacity: number;
  confidence: string | null;
  appearanceConfidence: string | null;
  visualStyle: string | null;
  impostorBlend: number;
  batchCount: number;
  selectedObjectId: string | null;
  filamentEdgeCount: number;
  filamentActiveCount: number;
  filamentDrawCount: number;
  filamentVisible: boolean;
  filamentOpacity: number;
  filamentDetail: number;
  filamentConfidence: string | null;
  filamentBatchCount: number;
  detail: number;
  layerState: Record<string, boolean>;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const cosmicCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'cosmicCatalogLayers') as object | undefined)
      : undefined;
    const catalogBatch = cosmicCatalogLayers
      ? (Reflect.get(cosmicCatalogLayers, 'cosmicGroupCatalogBatch') as object | null)
      : null;
    const points = catalogBatch
      ? (Reflect.get(catalogBatch, 'points') as CatalogPoints | undefined)
      : undefined;
    const selectionPoint = catalogBatch
      ? (Reflect.get(catalogBatch, 'selectionPoint') as CatalogPoints | undefined)
      : undefined;
    const filaments = catalogBatch
      ? (Reflect.get(catalogBatch, 'filaments') as CatalogPoints | undefined)
      : undefined;
    let batchCount = 0;
    let filamentBatchCount = 0;

    scene?.traverse((object) => {
      if (object.name === 'calculated-cosmicflows4-groups') {
        batchCount += 1;
      }
      if (object.name === 'illustrative-cosmicflows4-filaments') {
        filamentBatchCount += 1;
      }
    });
    const confidence = points?.userData['scientificConfidence'];
    const appearanceConfidence = points?.userData['appearanceConfidence'];
    const visualStyle = points?.userData['visualStyle'];
    const catalogCount = points?.userData['catalogCount'];
    const activeCount = points?.userData['activeCount'];
    const layerState = points?.userData['layerState'];
    const selectedObjectId = selectionPoint?.userData['objectId'];
    const opacity = points?.material.uniforms['catalogOpacity']?.value;
    const impostorBlend = points?.material.uniforms['impostorBlend']?.value;
    const detail = points?.material.uniforms['detailLevel']?.value;
    const filamentEdgeCount = filaments?.userData['edgeCount'];
    const filamentActiveCount = filaments?.userData['activeEdgeCount'];
    const filamentOpacity = filaments?.material.uniforms['filamentOpacity']?.value;
    const filamentDetail = filaments?.material.uniforms['filamentDetail']?.value;
    const filamentConfidence = filaments?.userData['scientificConfidence'];

    return {
      catalogCount: typeof catalogCount === 'number' ? catalogCount : 0,
      activeCount: typeof activeCount === 'number' ? activeCount : 0,
      drawCount: points?.geometry.drawRange.count ?? 0,
      visible: points?.visible ?? false,
      opacity: typeof opacity === 'number' ? opacity : 0,
      confidence: typeof confidence === 'string' ? confidence : null,
      appearanceConfidence: typeof appearanceConfidence === 'string' ? appearanceConfidence : null,
      visualStyle: typeof visualStyle === 'string' ? visualStyle : null,
      impostorBlend: typeof impostorBlend === 'number' ? impostorBlend : 0,
      batchCount,
      selectedObjectId: typeof selectedObjectId === 'string' ? selectedObjectId : null,
      filamentEdgeCount: typeof filamentEdgeCount === 'number' ? filamentEdgeCount : 0,
      filamentActiveCount: typeof filamentActiveCount === 'number' ? filamentActiveCount : 0,
      filamentDrawCount: filaments?.geometry.drawRange.count ?? 0,
      filamentVisible: filaments?.visible ?? false,
      filamentOpacity: typeof filamentOpacity === 'number' ? filamentOpacity : 0,
      filamentDetail: typeof filamentDetail === 'number' ? filamentDetail : 0,
      filamentConfidence: typeof filamentConfidence === 'string' ? filamentConfidence : null,
      filamentBatchCount,
      detail: typeof detail === 'number' ? detail : 0,
      layerState:
        typeof layerState === 'object' && layerState !== null
          ? (layerState as Record<string, boolean>)
          : {},
    };
  });
}

export async function readLocalVolumeDepthBackdropState(
  page: Page,
): Promise<LocalVolumeDepthBackdropState> {
  return page.evaluate(() => {
    interface DepthPoints {
      visible: boolean;
      userData: Record<string, unknown>;
      geometry: {
        drawRange: { count: number };
        attributes: {
          position?: { array: ArrayLike<number> };
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const cosmicCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'cosmicCatalogLayers') as object | undefined)
      : undefined;
    const backdrop = cosmicCatalogLayers
      ? (Reflect.get(cosmicCatalogLayers, 'localVolumeDepthBackdrop') as {
          points: DepthPoints;
        } | null)
      : null;

    if (!backdrop) {
      throw new Error('Arrière-plan de profondeur du volume local indisponible.');
    }
    const { points } = backdrop;
    const positions = points.geometry.attributes.position?.array;
    const drawCount = points.geometry.drawRange.count;
    let minimumRadius = Number.POSITIVE_INFINITY;
    let maximumRadius = 0;

    if (positions) {
      for (let index = 0; index < drawCount; index += 1) {
        const offset = index * 3;
        const radius = Math.hypot(
          Number(positions[offset]),
          Number(positions[offset + 1]),
          Number(positions[offset + 2]),
        );

        minimumRadius = Math.min(minimumRadius, radius);
        maximumRadius = Math.max(maximumRadius, radius);
      }
    }
    const opacity = points.material.uniforms['opacity']?.value;
    const catalogCount = points.userData['catalogCount'];
    const activeCount = points.userData['activeCount'];
    const depthProjection = points.userData['depthProjection'];

    return {
      visible: points.visible,
      opacity: typeof opacity === 'number' ? opacity : 0,
      catalogCount: typeof catalogCount === 'number' ? catalogCount : 0,
      activeCount: typeof activeCount === 'number' ? activeCount : 0,
      drawCount,
      minimumRadius: Number.isFinite(minimumRadius) ? minimumRadius : 0,
      maximumRadius,
      depthProjection: typeof depthProjection === 'string' ? depthProjection : null,
    };
  });
}

export async function readCosmicWebVolumeState(page: Page): Promise<{
  visible: boolean;
  opacity: number;
  confidence: string | null;
  resolution: number;
  sourceGroupCount: number;
  sourceEdgeCount: number;
  rayMarchSteps: number;
  batchCount: number;
}> {
  return page.evaluate(() => {
    interface VolumeMesh {
      name: string;
      visible: boolean;
      userData: Record<string, unknown>;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const cosmicCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'cosmicCatalogLayers') as object | undefined)
      : undefined;
    const renderer = cosmicCatalogLayers
      ? (Reflect.get(cosmicCatalogLayers, 'cosmicWebVolumeRenderer') as object | null)
      : null;
    const mesh = renderer ? (Reflect.get(renderer, 'mesh') as VolumeMesh | undefined) : undefined;
    const scene = universeScene
      ? (Reflect.get(universeScene, 'scene') as
          | {
              traverse(callback: (object: { name: string }) => void): void;
            }
          | undefined)
      : undefined;
    let batchCount = 0;

    scene?.traverse((object) => {
      if (object.name === 'simulated-cosmic-web-volume') {
        batchCount += 1;
      }
    });
    const opacity = mesh?.material.uniforms['volumeOpacity']?.value;
    const confidence = mesh?.userData['scientificConfidence'];
    const resolution = mesh?.userData['volumeResolution'];
    const sourceGroupCount = mesh?.userData['sourceGroupCount'];
    const sourceEdgeCount = mesh?.userData['sourceEdgeCount'];
    const rayMarchSteps = mesh?.userData['rayMarchSteps'];

    return {
      visible: mesh?.visible ?? false,
      opacity: typeof opacity === 'number' ? opacity : 0,
      confidence: typeof confidence === 'string' ? confidence : null,
      resolution: typeof resolution === 'number' ? resolution : 0,
      sourceGroupCount: typeof sourceGroupCount === 'number' ? sourceGroupCount : 0,
      sourceEdgeCount: typeof sourceEdgeCount === 'number' ? sourceEdgeCount : 0,
      rayMarchSteps: typeof rayMarchSteps === 'number' ? rayMarchSteps : 0,
      batchCount,
    };
  });
}

export async function readCosmicStructureBatchState(page: Page): Promise<{
  catalogCount: number;
  sourceCount: number;
  activeCount: number;
  drawCount: number;
  visible: boolean;
  opacity: number;
  confidence: string | null;
  batchCount: number;
  selectedObjectId: string | null;
  structureCounts: Record<string, number>;
  activeVoidCount: number;
  voidRepresentation: string | null;
  voidBoundaryStyle: string | null;
  landmarkRepresentation: string | null;
  detail: number;
  layerState: Record<string, boolean>;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const cosmicCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'cosmicCatalogLayers') as object | undefined)
      : undefined;
    const catalogBatch = cosmicCatalogLayers
      ? (Reflect.get(cosmicCatalogLayers, 'cosmicStructureCatalogBatch') as object | null)
      : null;
    const points = catalogBatch
      ? (Reflect.get(catalogBatch, 'points') as CatalogPoints | undefined)
      : undefined;
    const renderStructureTypes = catalogBatch
      ? (Reflect.get(catalogBatch, 'renderStructureTypes') as readonly string[] | undefined)
      : undefined;
    const selectionPoint = catalogBatch
      ? (Reflect.get(catalogBatch, 'selectionPoint') as CatalogPoints | undefined)
      : undefined;
    let batchCount = 0;

    scene?.traverse((object) => {
      if (object.name === 'calculated-cosmic-structure-symbols') {
        batchCount += 1;
      }
    });
    const catalogCount = points?.userData['catalogCount'];
    const sourceCount = points?.userData['sourceCount'];
    const activeCount = points?.userData['activeCount'];
    const confidence = points?.userData['scientificConfidence'];
    const selectedObjectId = selectionPoint?.userData['objectId'];
    const structureCounts = points?.userData['structureCounts'];
    const layerState = points?.userData['layerState'];
    const visibleIndices = points?.userData['visibleIndices'];
    const voidRepresentation = points?.userData['voidRepresentation'];
    const voidBoundaryStyle = points?.userData['voidBoundaryStyle'];
    const landmarkRepresentation = points?.userData['landmarkRepresentation'];
    const opacity = points?.material.uniforms['catalogOpacity']?.value;
    const detail = points?.material.uniforms['detailLevel']?.value;
    let activeVoidCount = 0;

    if (renderStructureTypes && visibleIndices instanceof Uint8Array) {
      for (let index = 0; index < renderStructureTypes.length; index += 1) {
        if (visibleIndices[index] === 1 && renderStructureTypes[index] === 'void') {
          activeVoidCount += 1;
        }
      }
    }

    return {
      catalogCount: typeof catalogCount === 'number' ? catalogCount : 0,
      sourceCount: typeof sourceCount === 'number' ? sourceCount : 0,
      activeCount: typeof activeCount === 'number' ? activeCount : 0,
      drawCount: points?.geometry.drawRange.count ?? 0,
      visible: points?.visible ?? false,
      opacity: typeof opacity === 'number' ? opacity : 0,
      confidence: typeof confidence === 'string' ? confidence : null,
      batchCount,
      selectedObjectId: typeof selectedObjectId === 'string' ? selectedObjectId : null,
      structureCounts:
        typeof structureCounts === 'object' && structureCounts !== null
          ? (structureCounts as Record<string, number>)
          : {},
      activeVoidCount,
      voidRepresentation: typeof voidRepresentation === 'string' ? voidRepresentation : null,
      voidBoundaryStyle: typeof voidBoundaryStyle === 'string' ? voidBoundaryStyle : null,
      landmarkRepresentation:
        typeof landmarkRepresentation === 'string' ? landmarkRepresentation : null,
      detail: typeof detail === 'number' ? detail : 0,
      layerState:
        typeof layerState === 'object' && layerState !== null
          ? (layerState as Record<string, boolean>)
          : {},
    };
  });
}

export async function readTempelFilamentSpineState(page: Page): Promise<{
  loaded: boolean;
  tileCount: number;
  visibleTileCount: number;
  visibleHaloTileCount: number;
  filamentCount: number;
  pointCount: number;
  segmentCount: number;
  visibleSegmentCount: number;
  haloSegmentCount: number;
  haloOpacity: number;
  haloWidthPixels: number;
  haloConfidence: string | null;
  haloRepresentation: string | null;
  haloPhysicalWidth: boolean | null;
  confidence: string | null;
  representation: string | null;
  selectedObjectId: string | null;
  selectedHaloObjectId: string | null;
}> {
  return page.evaluate(() => {
    interface FilamentTile {
      visible: boolean;
      userData: Record<string, unknown>;
    }

    interface FilamentHaloTile extends FilamentTile {
      geometry: { instanceCount: number };
      material: {
        opacity: number;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const cosmicCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'cosmicCatalogLayers') as object | undefined)
      : undefined;
    const batch = cosmicCatalogLayers
      ? (Reflect.get(cosmicCatalogLayers, 'tempelFilamentSpineBatch') as object | null)
      : null;

    if (!batch) {
      return {
        loaded: false,
        tileCount: 0,
        visibleTileCount: 0,
        visibleHaloTileCount: 0,
        filamentCount: 0,
        pointCount: 0,
        segmentCount: 0,
        visibleSegmentCount: 0,
        haloSegmentCount: 0,
        haloOpacity: 0,
        haloWidthPixels: 0,
        haloConfidence: null,
        haloRepresentation: null,
        haloPhysicalWidth: null,
        confidence: null,
        representation: null,
        selectedObjectId: null,
        selectedHaloObjectId: null,
      };
    }
    const tiles = Reflect.get(batch, 'tiles') as readonly FilamentTile[];
    const haloTiles = Reflect.get(batch, 'haloTiles') as readonly FilamentHaloTile[];
    const firstTile = tiles[0];
    const firstHaloTile = haloTiles[0];
    const selectionLine = Reflect.get(batch, 'selectionLine') as {
      userData: Record<string, unknown>;
    };
    const selectionHalo = Reflect.get(batch, 'selectionHalo') as {
      userData: Record<string, unknown>;
    };
    const selectedObjectId = selectionLine.userData['objectId'];
    const selectedHaloObjectId = selectionHalo.userData['objectId'];
    const confidence = firstTile?.userData['scientificConfidence'];
    const representation = firstTile?.userData['representation'];
    const haloConfidence = firstHaloTile?.userData['scientificConfidence'];
    const haloRepresentation = firstHaloTile?.userData['representation'];
    const haloPhysicalWidth = firstHaloTile?.userData['physicalWidth'];
    const haloWidthPixels = firstHaloTile?.material.uniforms['linewidth']?.value;

    return {
      loaded: true,
      tileCount: Number(Reflect.get(batch, 'tileCount')),
      visibleTileCount: tiles.filter((tile) => tile.visible).length,
      visibleHaloTileCount: haloTiles.filter((tile) => tile.visible).length,
      filamentCount: Number(Reflect.get(batch, 'catalogFilamentCount')),
      pointCount: Number(Reflect.get(batch, 'catalogPointCount')),
      segmentCount: Number(Reflect.get(batch, 'catalogSegmentCount')),
      visibleSegmentCount: Number(Reflect.get(batch, 'visibleSegmentCount')),
      haloSegmentCount: haloTiles.reduce((total, tile) => total + tile.geometry.instanceCount, 0),
      haloOpacity: firstHaloTile?.material.opacity ?? 0,
      haloWidthPixels: typeof haloWidthPixels === 'number' ? haloWidthPixels : 0,
      haloConfidence: typeof haloConfidence === 'string' ? haloConfidence : null,
      haloRepresentation: typeof haloRepresentation === 'string' ? haloRepresentation : null,
      haloPhysicalWidth: typeof haloPhysicalWidth === 'boolean' ? haloPhysicalWidth : null,
      confidence: typeof confidence === 'string' ? confidence : null,
      representation: typeof representation === 'string' ? representation : null,
      selectedObjectId: typeof selectedObjectId === 'string' ? selectedObjectId : null,
      selectedHaloObjectId: typeof selectedHaloObjectId === 'string' ? selectedHaloObjectId : null,
    };
  });
}

export async function findTempelFilamentSegmentPoint(
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

    interface FilamentTile {
      visible: boolean;
      userData: Record<string, unknown>;
      geometry: {
        drawRange: { count: number };
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

    interface Candidate {
      readonly objectId: string;
      readonly clientX: number;
      readonly clientY: number;
      readonly centerDistance: number;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const cosmicCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'cosmicCatalogLayers') as object | undefined)
      : undefined;
    const batch = cosmicCatalogLayers
      ? (Reflect.get(cosmicCatalogLayers, 'tempelFilamentSpineBatch') as object | null)
      : null;
    const tiles = batch
      ? (Reflect.get(batch, 'tiles') as readonly FilamentTile[] | undefined)
      : undefined;
    const camera = engine ? (Reflect.get(engine, 'camera') as CameraState | undefined) : undefined;
    const selectionManager = engine
      ? (Reflect.get(engine, 'selectionManager') as SelectionManagerState | undefined)
      : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as LabelManagerState | undefined)
      : undefined;

    if (!canvas || !tiles || !camera || !selectionManager) {
      return null;
    }
    const bounds = canvas.getBoundingClientRect();
    const candidates: Candidate[] = [];

    for (const tile of tiles) {
      if (!tile.visible) {
        continue;
      }
      const positions = tile.geometry.getAttribute('position');
      const objectIds = tile.userData['objectIds'];
      const objectIndices = tile.userData['objectIndices'];
      const drawCount = Math.min(tile.geometry.drawRange.count, positions.count);
      const segmentCount = Math.floor(drawCount / 2);
      const segmentStride = Math.max(1, Math.floor(segmentCount / 320));

      if (
        !Array.isArray(objectIds) ||
        (!(objectIndices instanceof Uint16Array) && !(objectIndices instanceof Uint32Array))
      ) {
        continue;
      }
      tile.updateWorldMatrix(true, false);
      for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += segmentStride) {
        const vertexIndex = segmentIndex * 2;
        const objectId: unknown = objectIds[objectIndices[vertexIndex]!];

        if (typeof objectId !== 'string') {
          continue;
        }
        const projected = camera.position
          .clone()
          .set(
            (positions.getX(vertexIndex) + positions.getX(vertexIndex + 1)) / 2,
            (positions.getY(vertexIndex) + positions.getY(vertexIndex + 1)) / 2,
            (positions.getZ(vertexIndex) + positions.getZ(vertexIndex + 1)) / 2,
          );

        tile.localToWorld(projected).project(camera);
        if (projected.z < -1 || projected.z > 1) {
          continue;
        }
        const clientX = bounds.left + (projected.x * 0.5 + 0.5) * bounds.width;
        const clientY = bounds.top + (-projected.y * 0.5 + 0.5) * bounds.height;

        if (
          clientX < bounds.left + 360 ||
          clientX > bounds.right - 160 ||
          clientY < bounds.top + 130 ||
          clientY > bounds.bottom - 180 ||
          document.elementFromPoint(clientX, clientY) !== canvas ||
          labelManager?.hitTest(clientX, clientY) !== null
        ) {
          continue;
        }
        candidates.push({
          objectId,
          clientX,
          clientY,
          centerDistance: Math.hypot(
            clientX - (bounds.left + bounds.width / 2),
            clientY - (bounds.top + bounds.height / 2),
          ),
        });
      }
    }
    candidates.sort((left, right) => left.centerDistance - right.centerDistance);

    for (const candidate of candidates.slice(0, 24)) {
      if (
        selectionManager.findObjectAt({
          clientX: candidate.clientX,
          clientY: candidate.clientY,
        }) === candidate.objectId
      ) {
        return {
          objectId: candidate.objectId,
          point: { x: candidate.clientX, y: candidate.clientY },
        };
      }
    }

    return null;
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

    interface StreamingCoordinator {
      stats: {
        activeStarTiles: number;
        cachedStarPacks: number;
        cachedStarTiles: number;
        activeStarClusters: number;
        cachedStarClusters: number;
      };
    }

    interface StreamingRuntime {
      coordinator: StreamingCoordinator | null;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const streamingRuntime = engine
      ? (Reflect.get(engine, 'streamingRuntime') as StreamingRuntime | undefined)
      : undefined;
    const coordinator = streamingRuntime?.coordinator ?? null;
    const stellarCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'stellarCatalogLayers') as object | undefined)
      : undefined;
    const batch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'starClusterBatch') as ClusterBatch | null)
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
      activeTileCount: coordinator?.stats.activeStarTiles ?? 0,
      cachedPackCount: coordinator?.stats.cachedStarPacks ?? 0,
      cachedTileCount: coordinator?.stats.cachedStarTiles ?? 0,
      activeClusterCount: coordinator?.stats.activeStarClusters ?? 0,
      cachedClusterCount: coordinator?.stats.cachedStarClusters ?? 0,
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const stellarCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'stellarCatalogLayers') as object | undefined)
      : undefined;
    const constellationBatch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'constellationBatch') as object | null)
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
      material: {
        opacity: number;
      };
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const stellarCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'stellarCatalogLayers') as object | undefined)
      : undefined;
    const constellationBatch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'constellationBatch') as object | null)
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
    const highlightStyle = highlight?.userData['visualStyle'];

    return {
      definitionCount: definitions?.length ?? 0,
      labelCount: constellationRegions.length,
      activeObjectId: typeof activeObjectId === 'string' ? activeObjectId : null,
      highlightVisible: highlight?.visible ?? false,
      highlightVertexCount: highlight?.geometry.drawRange.count ?? 0,
      highlightOpacity: highlight?.material.opacity ?? 0,
      highlightStyle: typeof highlightStyle === 'string' ? highlightStyle : null,
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const stellarCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'stellarCatalogLayers') as object | undefined)
      : undefined;
    const constellationBatch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'constellationBatch') as object | null)
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
  haloVisualStyle: string | null;
  visualFamily: string | null;
  catalogVisualStyle: string | null;
  catalogSurfaceDetail: number;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const haloVisualStyle = halo?.userData['visualStyle'];
    const visualFamily = core?.userData['visualFamily'];
    const catalogVisualStyle = catalog?.userData['visualStyle'];
    const catalogSurfaceDetail = catalog?.material?.uniforms?.['surfaceDetail']?.value;

    return {
      objectId: typeof objectId === 'string' ? objectId : null,
      visible: detail?.visible ?? false,
      haloVisible: halo?.visible ?? false,
      haloPointSize: typeof haloPointSize === 'number' ? haloPointSize : Number.NaN,
      haloVisualStyle: typeof haloVisualStyle === 'string' ? haloVisualStyle : null,
      visualFamily: typeof visualFamily === 'string' ? visualFamily : null,
      catalogVisualStyle: typeof catalogVisualStyle === 'string' ? catalogVisualStyle : null,
      catalogSurfaceDetail:
        typeof catalogSurfaceDetail === 'number' ? catalogSurfaceDetail : Number.NaN,
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
      material: { opacity: number; userData?: Record<string, unknown> };
      scale: { x: number; y: number };
    }

    interface GalaxyNearNode {
      visible: boolean;
      name: string;
      userData: Record<string, unknown>;
      children: GalaxyNearNode[];
      geometry?: {
        getAttribute(name: string): { count: number } | undefined;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registries = [objectRuntime?.primaryRegistry, objectRuntime?.streamedRegistry].filter(
      (registry): registry is object => registry !== null && registry !== undefined,
    );
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
        const lod = Reflect.get(entry, 'lod') as
          | {
              farSprite?: GalaxySprite | null;
              nearRoot?: GalaxyNearNode | null;
            }
          | undefined;
        const sprite = lod?.farSprite;

        if (!sprite) {
          continue;
        }
        const disk = lod?.nearRoot?.children.find((child) =>
          child.name.endsWith('-galaxy-structured-disk'),
        );
        const starField = lod?.nearRoot?.children.find((child) =>
          child.name.endsWith('-galaxy-stellar-volume'),
        );
        const farVisualStyle = sprite.material.userData?.['visualStyle'];
        const nearDiskStyle = disk?.userData['visualStyle'];
        const nearStarFieldStyle = starField?.userData['visualStyle'];

        states.push({
          objectId,
          visible: sprite.visible,
          opacity: sprite.material.opacity,
          width: sprite.scale.x,
          height: sprite.scale.y,
          pickable: (sprite.layers.mask & (1 << 1)) !== 0,
          farVisualStyle: typeof farVisualStyle === 'string' ? farVisualStyle : null,
          nearVisible: lod?.nearRoot?.visible ?? false,
          nearDiskVisible: disk?.visible ?? false,
          nearDiskStyle: typeof nearDiskStyle === 'string' ? nearDiskStyle : null,
          nearStarFieldVisible: starField?.visible ?? false,
          nearStarFieldStyle: typeof nearStarFieldStyle === 'string' ? nearStarFieldStyle : null,
          nearParticleCount: starField?.geometry?.getAttribute('position')?.count ?? 0,
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const spaceRoot = universeScene
      ? (Reflect.get(universeScene, 'spaceRoot') as
          | {
              getObjectByName(name: string): SceneNode | undefined;
              traverse(callback: (object: SceneNode) => void): void;
            }
          | undefined)
      : undefined;
    const milkyWay = spaceRoot?.getObjectByName('illustrative-milky-way') as
      MilkyWayPoints | undefined;
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
      scale: { x: number; y: number };
      userData: Record<string, unknown>;
      material?: {
        uniforms: Record<string, { value: unknown } | undefined>;
      };
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const sceneEnvironment = universeScene
      ? (Reflect.get(universeScene, 'environment') as object | undefined)
      : undefined;
    const volume = sceneEnvironment
      ? (Reflect.get(sceneEnvironment, 'milkyWayVolume') as VolumeRenderer | undefined)
      : undefined;

    if (!volume) {
      throw new Error('La représentation volumique de la Voie lactée est indisponible.');
    }
    const discs = volume.root.children.filter((child) =>
      child.name.startsWith('milky-way-volume-disc-'),
    );
    const bulge = volume.root.children.find((child) => child.name === 'milky-way-volume-bulge');
    const depths = discs.map((disc) => disc.position.y);
    const opacity = discs[0]?.material?.uniforms['opacity']?.value;
    const atlasUrl = volume.root.userData['atlasUrl'];
    const structure = volume.root.userData['visualStructure'];
    const depthTechnique = volume.root.userData['depthTechnique'];
    const morphologyModel = volume.root.userData['morphologyModel'];
    const confidence = volume.root.userData['scientificConfidence'];
    const cinematicQuality = volume.root.userData['cinematicQuality'];
    const cinematicProfile = volume.root.userData['cinematicProfile'] as
      Record<string, unknown> | undefined;

    return {
      visible: volume.root.visible,
      opacity: typeof opacity === 'number' ? opacity : 0,
      scale: volume.root.scale.x,
      atlasStatus: volume.atlasStatus,
      atlasUrl: typeof atlasUrl === 'string' ? atlasUrl : null,
      structure: typeof structure === 'string' ? structure : null,
      depthTechnique: typeof depthTechnique === 'string' ? depthTechnique : null,
      morphologyModel: typeof morphologyModel === 'string' ? morphologyModel : null,
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

export async function readLocalGalacticSkyState(page: Page): Promise<LocalGalacticSkyState> {
  return page.evaluate(() => {
    interface EnvironmentNode {
      name: string;
      visible: boolean;
      userData: Record<string, unknown>;
      material?: {
        depthTest: boolean;
        uniforms: Record<string, { value: unknown } | undefined>;
      };
      children: EnvironmentNode[];
    }

    interface EnvironmentRenderer {
      root: EnvironmentNode;
      drawMeshCount: number;
      maximumDrawMeshCount: number;
      panoramaStatus: string;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const sceneEnvironment = universeScene
      ? (Reflect.get(universeScene, 'environment') as object | undefined)
      : undefined;
    const environment = sceneEnvironment
      ? (Reflect.get(sceneEnvironment, 'localSpaceEnvironment') as EnvironmentRenderer | undefined)
      : undefined;

    if (!environment) {
      throw new Error('Le ciel galactique local est indisponible.');
    }
    const band = environment.root.children.find(
      (child) => child.name === 'illustrative-local-milky-way-sky',
    );

    if (!band) {
      throw new Error('La bande intérieure de la Voie lactée est indisponible.');
    }
    const opacity = band.material?.uniforms['opacity']?.value;
    const centerDirection = band.userData['galacticCenterDirection'];
    const visualLayers = band.userData['visualLayers'];
    const confidence = band.userData['scientificConfidence'];
    const referenceFrame = band.userData['referenceFrame'];
    const visualStyle = band.userData['visualStyle'];
    const panoramaUrl = band.userData['panoramaUrl'];
    const angularPresentation = band.userData['angularPresentation'];
    const sourceCredit = band.userData['sourceCredit'];
    const sourceImageId = band.userData['sourceImageId'];
    const sourcePageUrl = band.userData['sourcePageUrl'];
    const sourcePixelDimensions = band.userData['sourcePixelDimensions'];
    const texturePixelDimensions = band.userData['texturePixelDimensions'];
    const sourceAngularLatitudeSpanDegrees = band.userData['sourceAngularLatitudeSpanDegrees'];
    const angularLatitudeSpanDegrees = band.userData['angularLatitudeSpanDegrees'];
    const latitudePresentationScale = band.userData['latitudePresentationScale'];
    const sourceProjection = band.userData['sourceProjection'];
    const presentationPitchDegrees = band.userData['presentationPitchDegrees'];
    const presentationRollDegrees = band.userData['presentationRollDegrees'];
    const presentationComposition = band.userData['presentationComposition'];
    const orientationConfidence = band.userData['orientationConfidence'];
    const panoramaTexture = band.material?.uniforms['panorama']?.value as
      | {
          image?: {
            naturalWidth?: number;
            naturalHeight?: number;
            width?: number;
            height?: number;
          };
        }
      | undefined;
    const panoramaImage = panoramaTexture?.image;

    return {
      environmentVisible: environment.root.visible,
      bandVisible: band.visible,
      opacity: typeof opacity === 'number' ? opacity : 0,
      drawMeshCount: environment.drawMeshCount,
      maximumDrawMeshCount: environment.maximumDrawMeshCount,
      panoramaStatus: environment.panoramaStatus,
      panoramaUrl: typeof panoramaUrl === 'string' ? panoramaUrl : null,
      panoramaWidth: panoramaImage?.naturalWidth ?? panoramaImage?.width ?? 0,
      panoramaHeight: panoramaImage?.naturalHeight ?? panoramaImage?.height ?? 0,
      angularPresentation: typeof angularPresentation === 'string' ? angularPresentation : null,
      sourceCredit: typeof sourceCredit === 'string' ? sourceCredit : null,
      sourceImageId: typeof sourceImageId === 'string' ? sourceImageId : null,
      sourcePageUrl: typeof sourcePageUrl === 'string' ? sourcePageUrl : null,
      sourcePixelDimensions: Array.isArray(sourcePixelDimensions)
        ? sourcePixelDimensions.filter((value): value is number => typeof value === 'number')
        : [],
      texturePixelDimensions: Array.isArray(texturePixelDimensions)
        ? texturePixelDimensions.filter((value): value is number => typeof value === 'number')
        : [],
      sourceAngularLatitudeSpanDegrees:
        typeof sourceAngularLatitudeSpanDegrees === 'number' ? sourceAngularLatitudeSpanDegrees : 0,
      angularLatitudeSpanDegrees:
        typeof angularLatitudeSpanDegrees === 'number' ? angularLatitudeSpanDegrees : 0,
      latitudePresentationScale:
        typeof latitudePresentationScale === 'number' ? latitudePresentationScale : 0,
      sourceProjection: typeof sourceProjection === 'string' ? sourceProjection : null,
      presentationPitchDegrees:
        typeof presentationPitchDegrees === 'number' ? presentationPitchDegrees : 0,
      presentationRollDegrees:
        typeof presentationRollDegrees === 'number' ? presentationRollDegrees : 0,
      presentationComposition:
        typeof presentationComposition === 'string' ? presentationComposition : null,
      orientationConfidence:
        typeof orientationConfidence === 'string' ? orientationConfidence : null,
      confidence: typeof confidence === 'string' ? confidence : null,
      referenceFrame: typeof referenceFrame === 'string' ? referenceFrame : null,
      visualStyle: typeof visualStyle === 'string' ? visualStyle : null,
      galacticCenterDirection: Array.isArray(centerDirection)
        ? centerDirection.filter((value): value is number => typeof value === 'number')
        : [],
      visualLayers: Array.isArray(visualLayers)
        ? visualLayers.filter((value): value is string => typeof value === 'string')
        : [],
      depthTest: band.material?.depthTest ?? true,
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as object | undefined)
      : undefined;
    const sceneEnvironment = universeScene
      ? (Reflect.get(universeScene, 'environment') as object | undefined)
      : undefined;
    const background = sceneEnvironment
      ? (Reflect.get(sceneEnvironment, 'cosmicBackground') as object | undefined)
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const stellarCatalogLayers = universeScene
      ? (Reflect.get(universeScene, 'stellarCatalogLayers') as object | undefined)
      : undefined;
    const batch = stellarCatalogLayers
      ? (Reflect.get(stellarCatalogLayers, 'starCatalogBatch') as object | null)
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
      const labelHit = labelManager?.hitTest(candidate.x, candidate.y) ?? null;
      const labelAllowsPoint = unlabelledOnly
        ? labelHit === null
        : labelHit === null || labelHit === candidate.objectId;

      if (isolated && labelAllowsPoint) {
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as object | undefined)
      : undefined;
    const occlusionManager = labelManager
      ? (Reflect.get(labelManager, 'occlusionManager') as object | undefined)
      : undefined;
    const occluders = occlusionManager
      ? (Reflect.get(occlusionManager, 'occluders') as ScreenOccluderState[] | undefined)
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

export async function readSunPixelOcclusionState(page: Page): Promise<SunPixelOcclusionState> {
  return page.evaluate(() => {
    interface VectorState {
      x: number;
      y: number;
      clone(): VectorState;
      addScaledVector(vector: VectorState, scale: number): VectorState;
      normalize(): VectorState;
      project(camera: object): VectorState;
    }

    interface CameraState {
      up: VectorState;
    }

    interface MaterialState {
      depthWrite: boolean;
    }

    interface BodyState {
      material: MaterialState;
      position: VectorState;
      getWorldPosition(target: VectorState): VectorState;
      getWorldScale(target: VectorState): VectorState;
    }

    interface RendererState {
      domElement: HTMLCanvasElement;
      getContext(): WebGL2RenderingContext;
      render(scene: object, camera: object): void;
    }

    interface EngineState {
      start(): void;
      stop(): void;
    }

    const empty = {
      changedPixels: 0,
      comparedPixels: 0,
      meanOccludedLuminance: 0,
      maximumDifference: 0,
    };
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: { getComponent(element: Element): object | null };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as (EngineState & object) | null | undefined) ??
        (engineClient as EngineState & object))
      : undefined;
    const renderer = engine
      ? (Reflect.get(engine, 'renderer') as RendererState | undefined)
      : undefined;
    const camera = engine ? (Reflect.get(engine, 'camera') as CameraState | undefined) : undefined;
    const universeScene = engine
      ? (Reflect.get(engine, 'universeScene') as { scene: object } | undefined)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry('sun');
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const sun = entries?.get('sun');
    const body = sun ? (Reflect.get(sun, 'rotatingBody') as BodyState | undefined) : undefined;

    if (!engine || !renderer || !camera || !universeScene || !body) {
      return empty;
    }

    const center = body.getWorldPosition(body.position.clone());
    const worldScale = body.getWorldScale(body.position.clone()).x;
    const projectedCenter = center.clone().project(camera);
    const projectedEdge = center
      .clone()
      .addScaledVector(camera.up.clone().normalize(), worldScale)
      .project(camera);
    const canvas = renderer.domElement;
    const centerX = Math.round((projectedCenter.x * 0.5 + 0.5) * canvas.width);
    const centerY = Math.round((projectedCenter.y * 0.5 + 0.5) * canvas.height);
    const radius = Math.abs(projectedEdge.y - projectedCenter.y) * canvas.height * 0.5;
    const sampleRadius = Math.max(2, Math.floor(radius * 0.72));
    const sampleSize = sampleRadius * 2 + 1;
    const sampleX = Math.max(0, Math.min(canvas.width - sampleSize, centerX - sampleRadius));
    const sampleY = Math.max(0, Math.min(canvas.height - sampleSize, centerY - sampleRadius));
    const context = renderer.getContext();

    if (sampleSize > canvas.width || sampleSize > canvas.height) {
      return empty;
    }

    const capture = (): Uint8Array => {
      const pixels = new Uint8Array(sampleSize * sampleSize * 4);

      renderer.render(universeScene.scene, camera);
      context.finish();
      context.readPixels(
        sampleX,
        sampleY,
        sampleSize,
        sampleSize,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixels,
      );

      return pixels;
    };
    const originalDepthWrite = body.material.depthWrite;

    engine.stop();
    try {
      body.material.depthWrite = true;
      const occluded = capture();

      body.material.depthWrite = false;
      const unoccluded = capture();
      let changedPixels = 0;
      let comparedPixels = 0;
      let occludedLuminance = 0;
      let maximumDifference = 0;

      for (let y = 0; y < sampleSize; y += 1) {
        for (let x = 0; x < sampleSize; x += 1) {
          const localX = x - sampleRadius;
          const localY = y - sampleRadius;

          if (Math.hypot(localX, localY) > sampleRadius) {
            continue;
          }
          const offset = (y * sampleSize + x) * 4;
          const difference =
            Math.abs(occluded[offset]! - unoccluded[offset]!) +
            Math.abs(occluded[offset + 1]! - unoccluded[offset + 1]!) +
            Math.abs(occluded[offset + 2]! - unoccluded[offset + 2]!);

          comparedPixels += 1;
          occludedLuminance +=
            occluded[offset]! * 0.2126 +
            occluded[offset + 1]! * 0.7152 +
            occluded[offset + 2]! * 0.0722;
          maximumDifference = Math.max(maximumDifference, difference);
          if (difference >= 12) {
            changedPixels += 1;
          }
        }
      }

      return {
        changedPixels,
        comparedPixels,
        meanOccludedLuminance: occludedLuminance / Math.max(1, comparedPixels),
        maximumDifference,
      };
    } finally {
      body.material.depthWrite = originalDepthWrite;
      renderer.render(universeScene.scene, camera);
      engine.start();
    }
  });
}
