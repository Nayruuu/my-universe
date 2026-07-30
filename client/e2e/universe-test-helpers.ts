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

export interface GalaxyImpostorState {
  objectId: string;
  visible: boolean;
  opacity: number;
  width: number;
  height: number;
  pickable: boolean;
}

const FIXED_TIME = '2026-07-27T12:00:00.000Z';

export function universeUrl(parameters: Record<string, string> = {}): string {
  const query = new URLSearchParams({
    target: 'earth',
    quality: 'low',
    time: FIXED_TIME,
    labels: '1',
    orbits: '1',
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
    const registry = engine
      ? (Reflect.get(engine, 'objectRegistry') as object | undefined)
      : undefined;
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const states: GalaxyImpostorState[] = [];

    for (const [objectId, entry] of entries ?? []) {
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

    return states.sort((left, right) => left.objectId.localeCompare(right.objectId));
  });
}

export async function waitForIsolatedCatalogPoint(
  page: Page,
): Promise<{ objectId: string; point: ScreenPoint }> {
  let result: { objectId: string; point: ScreenPoint } | null = null;

  await expect
    .poll(async () => {
      result = await readIsolatedCatalogPoint(page);

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
): Promise<{ objectId: string; point: ScreenPoint } | null> {
  return page.evaluate(() => {
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

      if (isolated) {
        return {
          objectId: candidate.objectId,
          point: { x: candidate.x, y: candidate.y },
        };
      }
    }

    return null;
  });
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
