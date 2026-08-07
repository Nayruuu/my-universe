import type { Page } from '@playwright/test';
import type { UniverseEngineObservabilityWindow } from '../../src/app/core/engine/universe-engine-observability';

export interface RotationGuideState {
  visible: boolean;
  objectId: string | null;
  direction: string | null;
  style: string | null;
  parentName: string | null;
  directionScale: number;
  vertexCount: number;
  hasVertexColors: boolean;
}

export interface SunOcclusionState {
  bodyDepthTest: boolean;
  bodyDepthWrite: boolean;
  logarithmicDepthFragment: boolean;
  logarithmicDepthVertex: boolean;
  selectionDepthTest: boolean;
  selectedLabelsOccluded: boolean;
}

interface ObjectRuntimeState<Registry> {
  getRegistry(objectId: string): Registry | null;
}

export async function readRotationGuideState(page: Page): Promise<RotationGuideState> {
  return page.evaluate(() => {
    const guide = (
      window as UniverseEngineObservabilityWindow
    ).__UNIVERSE_MAP_OBSERVABILITY__?.getObjectAdornmentDiagnostics('earth')?.rotationGuide;

    return {
      visible: guide?.visible ?? false,
      objectId: guide?.objectId ?? null,
      direction: guide?.direction ?? null,
      style: guide?.style ?? null,
      parentName: guide?.parentName ?? null,
      directionScale: guide?.directionScale ?? 0,
      vertexCount: guide?.vertexCount ?? 0,
      hasVertexColors: guide?.hasVertexColors ?? false,
    };
  });
}

export async function readSunOcclusionState(page: Page): Promise<SunOcclusionState> {
  return page.evaluate(() => {
    interface MaterialState {
      depthTest: boolean;
      depthWrite: boolean;
      fragmentShader?: string;
      vertexShader?: string;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as {
        ng?: { getComponent(element: Element): object | null };
      }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState<object> | undefined)
      : undefined;
    const registry = objectRuntime?.getRegistry('sun');
    const entries = registry
      ? (Reflect.get(registry, 'entries') as Map<string, object> | undefined)
      : undefined;
    const sun = entries?.get('sun');
    const rotatingBody = sun ? (Reflect.get(sun, 'rotatingBody') as object | undefined) : undefined;
    const material = rotatingBody
      ? (Reflect.get(rotatingBody, 'material') as MaterialState | undefined)
      : undefined;
    const adornmentDiagnostics = (
      window as UniverseEngineObservabilityWindow
    ).__UNIVERSE_MAP_OBSERVABILITY__?.getObjectAdornmentDiagnostics('sun');
    const labelManager = engine
      ? (Reflect.get(engine, 'labelManager') as object | undefined)
      : undefined;
    const occlusionManager = labelManager
      ? (Reflect.get(labelManager, 'occlusionManager') as object | undefined)
      : undefined;
    const occluders = occlusionManager
      ? (Reflect.get(occlusionManager, 'occluders') as
          Array<{ objectId: string; occludesSelectedLabels: boolean }> | undefined)
      : undefined;

    return {
      bodyDepthTest: material?.depthTest ?? false,
      bodyDepthWrite: material?.depthWrite ?? false,
      logarithmicDepthFragment:
        material?.fragmentShader?.includes('#include <logdepthbuf_fragment>') ?? false,
      logarithmicDepthVertex:
        material?.vertexShader?.includes('#include <logdepthbuf_vertex>') ?? false,
      selectionDepthTest: adornmentDiagnostics?.selectionMarker.depthTest ?? false,
      selectedLabelsOccluded:
        occluders?.find(({ objectId }) => objectId === 'sun')?.occludesSelectedLabels ?? false,
    };
  });
}
