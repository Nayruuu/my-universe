import type { Page } from '@playwright/test';
import type { UniverseEngineObservabilityWindow } from '../../src/app/core/engine/universe-engine-observability';
import type { ObjectVisualDiagnostics } from '../../src/engine/objects/object-visual-diagnostics';

export interface RenderedFrameSignature {
  readonly sampledPixels: number;
  readonly visiblePixelRatio: number;
  readonly luminousPixelRatio: number;
  readonly chromaticPixelRatio: number;
  readonly meanLuminance: number;
  readonly luminanceDeviation: number;
}

export interface ObjectSurfaceContribution {
  readonly comparedPixels: number;
  readonly changedPixelRatio: number;
  readonly meanDifference: number;
  readonly maximumDifference: number;
}

interface RuntimeScene {
  readonly scene: object;
}

interface RuntimeRenderer {
  readonly domElement: HTMLCanvasElement;
  getContext(): WebGLRenderingContext | WebGL2RenderingContext;
  render(scene: object, camera: object): void;
}

interface RuntimeEngine {
  start(): void;
  stop(): void;
}

export async function readObjectVisualDiagnostics(
  page: Page,
  objectId: string,
): Promise<ObjectVisualDiagnostics | null> {
  return page.evaluate((requestedId) => {
    const bridge = (window as UniverseEngineObservabilityWindow).__UNIVERSE_MAP_OBSERVABILITY__;

    return bridge?.getObjectVisualDiagnostics(requestedId) ?? null;
  }, objectId);
}

export async function readRenderedFrameSignature(page: Page): Promise<RenderedFrameSignature> {
  return page.evaluate(browserReadRenderedFrameSignature);
}

export async function readObjectSurfaceContribution(
  page: Page,
  objectId: string,
): Promise<ObjectSurfaceContribution> {
  return page.evaluate(browserReadObjectSurfaceContribution, objectId);
}

function browserReadRenderedFrameSignature(): RenderedFrameSignature {
  const root = document.querySelector('app-root');
  const angularDebug = (
    window as unknown as { ng?: { getComponent(element: Element): object | null } }
  ).ng;
  const component = root && angularDebug?.getComponent(root);
  const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
  const engine = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
  const renderer = engine
    ? (Reflect.get(engine, 'renderer') as RuntimeRenderer | undefined)
    : undefined;
  const renderFrame = engine ? Reflect.get(engine, 'renderFrame') : undefined;

  if (!engine || !renderer || typeof renderFrame !== 'function') {
    throw new Error('Runtime de rendu indisponible pour la signature visuelle.');
  }
  const { width, height } = renderer.domElement;
  const pixels = new Uint8Array(width * height * 4);
  const context = renderer.getContext();

  (engine as RuntimeEngine).stop();
  try {
    Reflect.apply(renderFrame, engine, [0]);
    context.finish();
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
  } finally {
    (engine as RuntimeEngine).start();
  }
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 240));
  let sampledPixels = 0;
  let visiblePixels = 0;
  let luminousPixels = 0;
  let chromaticPixels = 0;
  let luminanceSum = 0;
  let luminanceSquareSum = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const offset = (y * width + x) * 4;
      const red = pixels[offset]!;
      const green = pixels[offset + 1]!;
      const blue = pixels[offset + 2]!;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

      sampledPixels += 1;
      visiblePixels += luminance >= 4 ? 1 : 0;
      luminousPixels += luminance >= 32 ? 1 : 0;
      chromaticPixels += Math.max(red, green, blue) - Math.min(red, green, blue) >= 12 ? 1 : 0;
      luminanceSum += luminance;
      luminanceSquareSum += luminance * luminance;
    }
  }
  const meanLuminance = luminanceSum / sampledPixels;
  const variance = Math.max(0, luminanceSquareSum / sampledPixels - meanLuminance ** 2);

  return {
    sampledPixels,
    visiblePixelRatio: visiblePixels / sampledPixels,
    luminousPixelRatio: luminousPixels / sampledPixels,
    chromaticPixelRatio: chromaticPixels / sampledPixels,
    meanLuminance,
    luminanceDeviation: Math.sqrt(variance),
  };
}

function browserReadObjectSurfaceContribution(objectId: string): ObjectSurfaceContribution {
  interface ProjectableVector {
    readonly x: number;
    readonly y: number;
    clone(): ProjectableVector;
    addScaledVector(vector: ProjectableVector, scale: number): ProjectableVector;
    normalize(): ProjectableVector;
    project(camera: object): ProjectableVector;
  }

  interface RuntimeBody {
    visible: boolean;
    readonly position: ProjectableVector;
    getWorldPosition(target: ProjectableVector): ProjectableVector;
    getWorldScale(target: ProjectableVector): ProjectableVector;
  }

  interface RegistryState {
    readonly entries: Map<string, object>;
  }

  interface ObjectRuntimeState {
    getRegistry(requestedId: string): RegistryState | null;
  }

  const root = document.querySelector('app-root');
  const angularDebug = (
    window as unknown as { ng?: { getComponent(element: Element): object | null } }
  ).ng;
  const component = root && angularDebug?.getComponent(root);
  const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
  const engine = facade
    ? (Reflect.get(facade, 'engine') as (RuntimeEngine & object) | undefined)
    : undefined;
  const renderer = engine
    ? (Reflect.get(engine, 'renderer') as RuntimeRenderer | undefined)
    : undefined;
  const camera = engine ? (Reflect.get(engine, 'camera') as object | undefined) : undefined;
  const universeScene = engine
    ? (Reflect.get(engine, 'universeScene') as RuntimeScene | undefined)
    : undefined;
  const objectRuntime = engine
    ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState | undefined)
    : undefined;
  const entry = objectRuntime?.getRegistry(objectId)?.entries.get(objectId);
  const body = entry ? (Reflect.get(entry, 'rotatingBody') as RuntimeBody | null) : null;

  if (!engine || !renderer || !camera || !universeScene || !body) {
    throw new Error(`Surface de ${objectId} indisponible pour la régression visuelle.`);
  }
  const center = body.getWorldPosition(body.position.clone());
  const worldRadius = body.getWorldScale(body.position.clone()).x;
  const projectedCenter = center.clone().project(camera);
  const cameraUp = Reflect.get(camera, 'up') as ProjectableVector;
  const projectedEdge = center
    .clone()
    .addScaledVector(cameraUp.clone().normalize(), worldRadius)
    .project(camera);
  const canvas = renderer.domElement;
  const centerX = Math.round((projectedCenter.x * 0.5 + 0.5) * canvas.width);
  const centerY = Math.round((projectedCenter.y * 0.5 + 0.5) * canvas.height);
  const projectedRadius = Math.abs(projectedEdge.y - projectedCenter.y) * canvas.height * 0.5;
  const radius = Math.max(2, Math.floor(projectedRadius * 0.72));
  const size = radius * 2 + 1;
  const sample = {
    x: Math.max(0, Math.min(canvas.width - size, centerX - radius)),
    y: Math.max(0, Math.min(canvas.height - size, centerY - radius)),
    size,
  };
  const readPixels = (): Uint8Array => {
    const pixels = new Uint8Array(sample.size * sample.size * 4);
    const context = renderer.getContext();

    context.finish();
    context.readPixels(
      sample.x,
      sample.y,
      sample.size,
      sample.size,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );

    return pixels;
  };
  const initiallyVisible = body.visible;
  let visible: Uint8Array;
  let hidden: Uint8Array;

  engine.stop();
  try {
    body.visible = true;
    renderer.render(universeScene.scene, camera);
    visible = readPixels();
    body.visible = false;
    renderer.render(universeScene.scene, camera);
    hidden = readPixels();
  } finally {
    body.visible = initiallyVisible;
    renderer.render(universeScene.scene, camera);
    engine.start();
  }
  let comparedPixels = 0;
  let changedPixels = 0;
  let differenceSum = 0;
  let maximumDifference = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (Math.hypot(x - radius, y - radius) > radius) {
        continue;
      }
      const offset = (y * size + x) * 4;
      const difference =
        Math.abs(visible[offset]! - hidden[offset]!) +
        Math.abs(visible[offset + 1]! - hidden[offset + 1]!) +
        Math.abs(visible[offset + 2]! - hidden[offset + 2]!);

      comparedPixels += 1;
      differenceSum += difference;
      maximumDifference = Math.max(maximumDifference, difference);
      changedPixels += difference >= 18 ? 1 : 0;
    }
  }

  return {
    comparedPixels,
    changedPixelRatio: changedPixels / Math.max(1, comparedPixels),
    meanDifference: differenceSum / Math.max(1, comparedPixels),
    maximumDifference,
  };
}
