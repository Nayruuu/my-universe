import type { Page } from '@playwright/test';

export interface CometActivityVisualState {
  readonly present: boolean;
  readonly active: boolean;
  readonly rendered: boolean;
  readonly antiSolarAlignment: number;
  readonly comaOpacity: number;
  readonly dustTailOpacity: number;
  readonly ionTailOpacity: number;
}

interface ObjectRuntimeState<Registry> {
  getRegistry(objectId: string): Registry | null;
}

export async function readCometActivityVisualState(
  page: Page,
  objectId: string,
): Promise<CometActivityVisualState> {
  return page.evaluate((requestedId) => {
    interface SceneNode {
      readonly visible: boolean;
      readonly position: { x: number; y: number; z: number };
      readonly quaternion: { x: number; y: number; z: number; w: number };
      readonly material?: { opacity: number };
      getObjectByName(name: string): SceneNode | undefined;
    }

    interface RegistryEntryState {
      readonly node: SceneNode;
      readonly cometActivity: { readonly root: SceneNode } | null;
      readonly lod: { readonly nearRoot: SceneNode | null };
    }

    interface RegistryState {
      readonly entries: Map<string, RegistryEntryState>;
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
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<RegistryState> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry(requestedId);
    const entry = registry?.entries.get(requestedId);
    const activity = entry?.cometActivity;

    if (!entry || !activity) {
      return {
        present: false,
        active: false,
        rendered: false,
        antiSolarAlignment: 0,
        comaOpacity: 0,
        dustTailOpacity: 0,
        ionTailOpacity: 0,
      };
    }
    const { x, y, z, w } = activity.root.quaternion;
    const tailDirection = {
      x: 2 * (x * y - z * w),
      y: 1 - 2 * (x * x + z * z),
      z: 2 * (y * z + x * w),
    };
    const radialLength = Math.hypot(
      entry.node.position.x,
      entry.node.position.y,
      entry.node.position.z,
    );
    const antiSolarAlignment =
      radialLength === 0
        ? 0
        : (tailDirection.x * entry.node.position.x +
            tailDirection.y * entry.node.position.y +
            tailDirection.z * entry.node.position.z) /
          radialLength;
    const coma = activity.root.getObjectByName(`${requestedId}-coma`);
    const dustTail = activity.root.getObjectByName(`${requestedId}-dust-tail`);
    const ionTail = activity.root.getObjectByName(`${requestedId}-ion-tail`);

    return {
      present: true,
      active: activity.root.visible,
      rendered: activity.root.visible && entry.lod.nearRoot?.visible === true,
      antiSolarAlignment,
      comaOpacity: coma?.material?.opacity ?? 0,
      dustTailOpacity: dustTail?.material?.opacity ?? 0,
      ionTailOpacity: ionTail?.material?.opacity ?? 0,
    };
  }, objectId);
}
