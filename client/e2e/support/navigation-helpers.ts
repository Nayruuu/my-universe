import { expect, type Page } from '@playwright/test';
import type { UniverseEngineObservabilityWindow } from '../../src/app/core/engine/universe-engine-observability';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CameraInteractionState {
  rotateEnabled: boolean;
  panEnabled: boolean;
  controlsEnabled: boolean;
  transitioning: boolean;
  observerModeActive: boolean;
  observerPresentationActive: boolean;
  distance: number;
  fieldOfView: number;
  minDistance: number;
  maxDistance: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
}

export interface NavigationAlignmentState {
  targetId: string | null;
  targetError: number;
  floatingOriginDistance: number;
}

interface ObjectRuntimeState<Registry> {
  getRegistry(objectId: string): Registry | null;
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
    e2e: '1',
    ...parameters,
  });

  return `/fr/?${query.toString()}`;
}

export async function openUniverse(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('canvas.universe-canvas')).toBeVisible();
  await expect(page.locator('.loading-screen')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as UniverseEngineObservabilityWindow).__UNIVERSE_MAP_OBSERVABILITY__),
      ),
    )
    .toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get('zoom')).not.toBeNull();
  await waitForCameraSettled(page);
}

export async function waitForCameraSettled(page: Page, timeout = 20_000): Promise<void> {
  await expect.poll(() => isCameraSettled(page), { timeout }).toBe(true);
}

export async function readCameraInteractionState(page: Page): Promise<CameraInteractionState> {
  return page.evaluate(() => {
    interface VectorState {
      x: number;
      y: number;
      z: number;
      clone(): VectorState;
    }

    interface ControllerState {
      distanceToTarget: number;
      isTransitioning: boolean;
      observerModeActive: boolean;
      observerPresentationActive: boolean;
      controls: {
        enabled: boolean;
        enableRotate: boolean;
        enablePan: boolean;
        minDistance: number;
        maxDistance: number;
        target: VectorState;
      };
      camera: {
        fov: number;
        position: VectorState;
        getWorldDirection(target: VectorState): VectorState;
      };
    }

    const engine = readEngine();
    const controller = engine
      ? (Reflect.get(engine, 'cameraController') as ControllerState | null)
      : null;

    if (!controller) {
      throw new Error('Contrôleur de caméra indisponible.');
    }
    const { controls, camera } = controller;
    const direction = camera.getWorldDirection(camera.position.clone());

    return {
      rotateEnabled: controls.enableRotate,
      panEnabled: controls.enablePan,
      controlsEnabled: controls.enabled,
      transitioning: controller.isTransitioning,
      observerModeActive: controller.observerModeActive,
      observerPresentationActive: controller.observerPresentationActive,
      distance: controller.distanceToTarget,
      fieldOfView: camera.fov,
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
      direction: {
        x: direction.x,
        y: direction.y,
        z: direction.z,
      },
    };

    function readEngine(): object | undefined {
      const root = document.querySelector('app-root');
      const angularDebug = (
        window as unknown as {
          ng?: { getComponent(element: Element): object | null };
        }
      ).ng;
      const component = root && angularDebug?.getComponent(root);
      const facade = component
        ? (Reflect.get(component, 'facade') as object | undefined)
        : undefined;

      const engineClient = facade
        ? (Reflect.get(facade, 'engine') as object | undefined)
        : undefined;

      return engineClient
        ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
        : undefined;
    }
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
      cameraController: { controls: { target: VectorState } } | null;
      floatingOriginManager: { accumulatedOrigin: VectorState };
      getWorldPosition(objectId: string): VectorState | null;
    }

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
      ? ((Reflect.get(engineClient, 'engine') as EngineState | null | undefined) ??
        (engineClient as EngineState))
      : undefined;
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
        ng?: { getComponent(element: Element): object | null };
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
    const registry = objectRuntime?.getRegistry(requestedId);
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
  return findCanvasPointWithoutObject(page, 'findObjectAt');
}

export async function findEmptyWheelCanvasPoint(page: Page): Promise<ScreenPoint> {
  return findCanvasPointWithoutObject(page, 'findWheelObjectAt');
}

async function findCanvasPointWithoutObject(
  page: Page,
  reader: 'findObjectAt' | 'findWheelObjectAt',
): Promise<ScreenPoint> {
  return page.evaluate((requestedReader) => {
    interface SelectionManagerState {
      findObjectAt(event: { clientX: number; clientY: number }): string | null;
      findWheelObjectAt(event: { clientX: number; clientY: number }): string | null;
    }

    const root = document.querySelector('app-root');
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.universe-canvas');
    const angularDebug = (
      window as unknown as {
        ng?: { getComponent(element: Element): object | null };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
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
          selectionManager[requestedReader]({ clientX: x, clientY: y }) === null
        ) {
          return { x, y };
        }
      }
    }

    throw new Error('Aucune zone vide et interactive du canvas n’a été trouvée.');
  }, reader);
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

async function isCameraSettled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const observability = window.__UNIVERSE_MAP_OBSERVABILITY__;

    if (observability) {
      return !observability.isCameraTransitioning();
    }
    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: { getComponent(element: Element): object | null };
      }
    ).ng;

    if (!root || !angularDebug) {
      return false;
    }

    const component = angularDebug.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const loadedEngine = engine ? (Reflect.get(engine, 'engine') as object | undefined) : undefined;
    const controller = engine
      ? ((Reflect.get(engine, 'cameraController') ??
          (loadedEngine && Reflect.get(loadedEngine, 'cameraController'))) as object | undefined)
      : undefined;

    return controller ? Reflect.get(controller, 'isTransitioning') === false : false;
  });
}
