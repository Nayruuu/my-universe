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

export interface GaiaFramebufferSignature {
  readonly sampledSourceBatchCount: number;
  readonly luminousPixelCount: number;
  readonly horizontalLuminousPixelBins: readonly number[];
  readonly chromaticPixelCount: number;
  readonly horizontalChromaticPixelBins: readonly number[];
  readonly vividChromaticPixelCount: number;
  readonly vividChromaticPixelGrid: readonly number[];
}

export interface ChromaticGalacticFramebufferSignature {
  readonly transitionBatchCount: number;
  readonly chromaticPixelCount: number;
  readonly horizontalChromaticPixelBins: readonly number[];
  readonly vividChromaticPixelCount: number;
  readonly vividChromaticPixelGrid: readonly number[];
  readonly prominentChromaticStarCount: number;
  readonly prominentChromaticStarGrid: readonly number[];
}

export interface ChromaticGalacticCompositeSignature {
  readonly transitionBatchCount: number;
  readonly changedPixelCount: number;
  readonly horizontalChangedPixelBins: readonly number[];
  readonly chromaticContributionPixelCount: number;
  readonly chromaticContributionPixelGrid: readonly number[];
}

interface IsolatedPointFramebufferSignature {
  readonly pointBatchCount: number;
  readonly luminousPixelCount: number;
  readonly chromaticPixelCount: number;
  readonly horizontalLuminousPixelBins: readonly number[];
  readonly horizontalChromaticPixelBins: readonly number[];
  readonly vividChromaticPixelCount: number;
  readonly vividChromaticPixelGrid: readonly number[];
  readonly prominentChromaticStarCount: number;
  readonly prominentChromaticStarGrid: readonly number[];
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

export async function isObservedShapeAttached(page: Page, objectId: string): Promise<boolean> {
  return page.evaluate((requestedId) => {
    interface RuntimeObject {
      getObjectByName(name: string): object | undefined;
    }

    interface RegistryState {
      readonly entries: Map<string, object>;
    }

    interface ObjectRuntimeState {
      getRegistry(id: string): RegistryState | null;
    }

    const root = document.querySelector('app-root');
    const angularDebug = (
      window as unknown as { ng?: { getComponent(element: Element): object | null } }
    ).ng;
    const component = root && angularDebug?.getComponent(root);
    const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
    const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
    const engine = engineClient
      ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
      : undefined;
    const objectRuntime = engine
      ? (Reflect.get(engine, 'objectRuntime') as ObjectRuntimeState | undefined)
      : undefined;
    const entry = objectRuntime?.getRegistry(requestedId)?.entries.get(requestedId);
    const rotatingBody = entry
      ? (Reflect.get(entry, 'rotatingBody') as RuntimeObject | null)
      : null;

    return rotatingBody?.getObjectByName(`${requestedId}-observed-shape`) !== undefined;
  }, objectId);
}

export async function readRenderedFrameSignature(page: Page): Promise<RenderedFrameSignature> {
  return page.evaluate(browserReadRenderedFrameSignature);
}

export async function readGaiaFramebufferSignature(page: Page): Promise<GaiaFramebufferSignature> {
  const signature = await page.evaluate(browserReadIsolatedPointFramebufferSignature, 'gaia');

  return {
    sampledSourceBatchCount: signature.pointBatchCount,
    luminousPixelCount: signature.luminousPixelCount,
    horizontalLuminousPixelBins: signature.horizontalLuminousPixelBins,
    chromaticPixelCount: signature.chromaticPixelCount,
    horizontalChromaticPixelBins: signature.horizontalChromaticPixelBins,
    vividChromaticPixelCount: signature.vividChromaticPixelCount,
    vividChromaticPixelGrid: signature.vividChromaticPixelGrid,
  };
}

export async function readChromaticGalacticFramebufferSignature(
  page: Page,
): Promise<ChromaticGalacticFramebufferSignature> {
  const signature = await page.evaluate(
    browserReadIsolatedPointFramebufferSignature,
    'galactic-transition',
  );

  return {
    transitionBatchCount: signature.pointBatchCount,
    chromaticPixelCount: signature.chromaticPixelCount,
    horizontalChromaticPixelBins: signature.horizontalChromaticPixelBins,
    vividChromaticPixelCount: signature.vividChromaticPixelCount,
    vividChromaticPixelGrid: signature.vividChromaticPixelGrid,
    prominentChromaticStarCount: signature.prominentChromaticStarCount,
    prominentChromaticStarGrid: signature.prominentChromaticStarGrid,
  };
}

export async function readChromaticGalacticCompositeSignature(
  page: Page,
): Promise<ChromaticGalacticCompositeSignature> {
  return page.evaluate(browserReadChromaticGalacticCompositeSignature);
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
  const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
  const engine = engineClient
    ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
    : undefined;
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

function browserReadIsolatedPointFramebufferSignature(
  layer: string,
): IsolatedPointFramebufferSignature {
  interface RuntimeObject {
    readonly name: string;
    visible: boolean;
    readonly parent: RuntimeObject | null;
    readonly userData: Record<string, unknown>;
  }

  interface RuntimeThreeScene extends RuntimeObject {
    background: unknown | null;
    traverse(visitor: (object: RuntimeObject) => void): void;
  }

  interface UniverseSceneState {
    readonly scene: RuntimeThreeScene;
  }

  const root = document.querySelector('app-root');
  const angularDebug = (
    window as unknown as { ng?: { getComponent(element: Element): object | null } }
  ).ng;
  const component = root && angularDebug?.getComponent(root);
  const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
  const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
  const engine = engineClient
    ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
    : undefined;
  const renderer = engine
    ? (Reflect.get(engine, 'renderer') as RuntimeRenderer | undefined)
    : undefined;
  const camera = engine ? (Reflect.get(engine, 'camera') as object | undefined) : undefined;
  const universeScene = engine
    ? (Reflect.get(engine, 'universeScene') as UniverseSceneState | undefined)
    : undefined;

  if (!engine || !renderer || !camera || !universeScene) {
    throw new Error('Runtime de rendu indisponible pour la signature de points isolée.');
  }
  const scene = universeScene.scene;
  const originalBackground = scene.background;
  const originalVisibility: Array<readonly [RuntimeObject, boolean]> = [];
  const selectedPointBatches: RuntimeObject[] = [];

  scene.traverse((object) => {
    originalVisibility.push([object, object.visible]);
    const selected =
      layer === 'gaia'
        ? object.userData['pointRepresentation'] === 'sampled-source'
        : object.name === 'chromatic-stellar-accents';

    if (object.visible && selected) {
      selectedPointBatches.push(object);
    }
  });
  const keepVisible = new Set<RuntimeObject>([scene]);

  for (const pointBatch of selectedPointBatches) {
    let current: RuntimeObject | null = pointBatch;

    while (current) {
      keepVisible.add(current);
      current = current.parent;
    }
  }

  const { width, height } = renderer.domElement;
  const pixels = new Uint8Array(width * height * 4);
  const context = renderer.getContext();

  (engine as RuntimeEngine).stop();
  try {
    scene.traverse((object) => {
      object.visible = keepVisible.has(object);
    });
    scene.background = null;
    renderer.render(scene, camera);
    context.finish();
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
  } finally {
    for (const [object, visible] of originalVisibility) {
      object.visible = visible;
    }
    scene.background = originalBackground;
    renderer.render(scene, camera);
    (engine as RuntimeEngine).start();
  }

  const horizontalLuminousPixelBins = Array.from({ length: 8 }, () => 0);
  const horizontalChromaticPixelBins = Array.from({ length: 8 }, () => 0);
  const vividChromaticPixelGrid = Array.from({ length: 12 }, () => 0);
  const prominentChromaticStarGrid = Array.from({ length: 12 }, () => 0);
  let luminousPixelCount = 0;
  let chromaticPixelCount = 0;
  let vividChromaticPixelCount = 0;
  let prominentChromaticStarCount = 0;

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    const maximumChannel = Math.max(red, green, blue);

    if (maximumChannel < 32) {
      continue;
    }
    const x = pixelIndex % width;
    const horizontalBin = Math.min(
      horizontalLuminousPixelBins.length - 1,
      Math.floor((x / width) * horizontalLuminousPixelBins.length),
    );

    luminousPixelCount += 1;
    horizontalLuminousPixelBins[horizontalBin]! += 1;
    if (maximumChannel - Math.min(red, green, blue) >= 12) {
      chromaticPixelCount += 1;
      horizontalChromaticPixelBins[horizontalBin]! += 1;
      if (maximumChannel >= 72 && maximumChannel - Math.min(red, green, blue) >= 24) {
        const y = Math.floor(pixelIndex / width);
        const xGridBin = Math.min(3, Math.floor((x / width) * 4));
        const yGridBin = Math.min(2, Math.floor((y / height) * 3));

        vividChromaticPixelCount += 1;
        vividChromaticPixelGrid[yGridBin * 4 + xGridBin]! += 1;
      }
    }
  }

  // A few isolated hot pixels made the former 360-degree regression pass even though a person
  // could only perceive the broad coloured stars while facing the Galactic disc. Audit connected
  // luminous footprints as well: a prominent star needs both a vivid core and a visible halo at
  // least eight framebuffer pixels wide and high. This deliberately measures the visual object
  // described by the test rather than the mere presence of shader fragments.
  if (layer === 'galactic-transition') {
    const visited = new Uint8Array(width * height);
    const pendingPixels: number[] = [];

    for (let seedPixelIndex = 0; seedPixelIndex < width * height; seedPixelIndex += 1) {
      if (visited[seedPixelIndex] === 1) {
        continue;
      }
      const seedOffset = seedPixelIndex * 4;
      const seedMaximumChannel = Math.max(
        pixels[seedOffset]!,
        pixels[seedOffset + 1]!,
        pixels[seedOffset + 2]!,
      );

      visited[seedPixelIndex] = 1;
      if (seedMaximumChannel < 10) {
        continue;
      }

      pendingPixels.push(seedPixelIndex);
      let minimumX = seedPixelIndex % width;
      let maximumX = minimumX;
      let minimumY = Math.floor(seedPixelIndex / width);
      let maximumY = minimumY;
      let peakBrightness = 0;
      let peakChroma = 0;
      let peakPixelIndex = seedPixelIndex;
      let vividCorePixelCount = 0;
      let componentPixelCount = 0;

      while (pendingPixels.length > 0) {
        const pixelIndex = pendingPixels.pop()!;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const offset = pixelIndex * 4;
        const red = pixels[offset]!;
        const green = pixels[offset + 1]!;
        const blue = pixels[offset + 2]!;
        const maximumChannel = Math.max(red, green, blue);
        const chroma = maximumChannel - Math.min(red, green, blue);

        componentPixelCount += 1;
        minimumX = Math.min(minimumX, x);
        maximumX = Math.max(maximumX, x);
        minimumY = Math.min(minimumY, y);
        maximumY = Math.max(maximumY, y);
        if (maximumChannel > peakBrightness) {
          peakBrightness = maximumChannel;
          peakPixelIndex = pixelIndex;
        }
        peakChroma = Math.max(peakChroma, chroma);
        vividCorePixelCount += maximumChannel >= 64 && chroma >= 18 ? 1 : 0;

        for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
          const neighborY = y + yOffset;

          if (neighborY < 0 || neighborY >= height) {
            continue;
          }
          for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
            if (xOffset === 0 && yOffset === 0) {
              continue;
            }
            const neighborX = x + xOffset;

            if (neighborX < 0 || neighborX >= width) {
              continue;
            }
            const neighborPixelIndex = neighborY * width + neighborX;

            if (visited[neighborPixelIndex] === 1) {
              continue;
            }
            visited[neighborPixelIndex] = 1;
            const neighborOffset = neighborPixelIndex * 4;
            const neighborMaximumChannel = Math.max(
              pixels[neighborOffset]!,
              pixels[neighborOffset + 1]!,
              pixels[neighborOffset + 2]!,
            );

            if (neighborMaximumChannel >= 10) {
              pendingPixels.push(neighborPixelIndex);
            }
          }
        }
      }

      const footprintWidth = maximumX - minimumX + 1;
      const footprintHeight = maximumY - minimumY + 1;

      if (
        footprintWidth < 8 ||
        footprintHeight < 8 ||
        componentPixelCount < 28 ||
        peakBrightness < 80 ||
        peakChroma < 20 ||
        vividCorePixelCount < 2
      ) {
        continue;
      }
      const peakX = peakPixelIndex % width;
      const peakY = Math.floor(peakPixelIndex / width);
      const xGridBin = Math.min(3, Math.floor((peakX / width) * 4));
      const yGridBin = Math.min(2, Math.floor((peakY / height) * 3));

      prominentChromaticStarCount += 1;
      prominentChromaticStarGrid[yGridBin * 4 + xGridBin]! += 1;
    }
  }

  return {
    pointBatchCount: selectedPointBatches.length,
    luminousPixelCount,
    chromaticPixelCount,
    horizontalLuminousPixelBins,
    horizontalChromaticPixelBins,
    vividChromaticPixelCount,
    vividChromaticPixelGrid,
    prominentChromaticStarCount,
    prominentChromaticStarGrid,
  };
}

function browserReadChromaticGalacticCompositeSignature(): ChromaticGalacticCompositeSignature {
  interface RuntimeObject {
    readonly name: string;
    visible: boolean;
  }

  interface RuntimeThreeScene {
    traverse(callback: (object: RuntimeObject) => void): void;
  }

  interface UniverseSceneState {
    readonly scene: RuntimeThreeScene;
  }

  const root = document.querySelector('app-root');
  const angularDebug = (
    window as unknown as { ng?: { getComponent(element: Element): object | null } }
  ).ng;
  const component = root && angularDebug?.getComponent(root);
  const facade = component ? (Reflect.get(component, 'facade') as object | undefined) : undefined;
  const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
  const engine = engineClient
    ? ((Reflect.get(engineClient, 'engine') as object | null | undefined) ?? engineClient)
    : undefined;
  const renderer = engine
    ? (Reflect.get(engine, 'renderer') as RuntimeRenderer | undefined)
    : undefined;
  const camera = engine ? (Reflect.get(engine, 'camera') as object | undefined) : undefined;
  const universeScene = engine
    ? (Reflect.get(engine, 'universeScene') as UniverseSceneState | undefined)
    : undefined;

  if (!engine || !renderer || !camera || !universeScene) {
    throw new Error('Runtime de rendu indisponible pour la contribution chromatique composée.');
  }
  const accents: RuntimeObject[] = [];

  universeScene.scene.traverse((object) => {
    if (object.visible && object.name === 'chromatic-stellar-accents') {
      accents.push(object);
    }
  });
  const { width, height } = renderer.domElement;
  const context = renderer.getContext();
  const readPixels = (): Uint8Array => {
    const pixels = new Uint8Array(width * height * 4);

    context.finish();
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);

    return pixels;
  };
  let visiblePixels: Uint8Array;
  let hiddenPixels: Uint8Array;

  (engine as RuntimeEngine).stop();
  try {
    renderer.render(universeScene.scene, camera);
    visiblePixels = readPixels();
    for (const accent of accents) {
      accent.visible = false;
    }
    renderer.render(universeScene.scene, camera);
    hiddenPixels = readPixels();
  } finally {
    for (const accent of accents) {
      accent.visible = true;
    }
    renderer.render(universeScene.scene, camera);
    (engine as RuntimeEngine).start();
  }
  const horizontalChangedPixelBins = Array.from({ length: 8 }, () => 0);
  const chromaticContributionPixelGrid = Array.from({ length: 12 }, () => 0);
  let changedPixelCount = 0;
  let chromaticContributionPixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const redDifference = Math.abs(visiblePixels[offset]! - hiddenPixels[offset]!);
      const greenDifference = Math.abs(visiblePixels[offset + 1]! - hiddenPixels[offset + 1]!);
      const blueDifference = Math.abs(visiblePixels[offset + 2]! - hiddenPixels[offset + 2]!);
      const maximumDifference = Math.max(redDifference, greenDifference, blueDifference);
      const minimumDifference = Math.min(redDifference, greenDifference, blueDifference);
      const totalDifference = redDifference + greenDifference + blueDifference;

      if (maximumDifference >= 4 && totalDifference >= 9) {
        changedPixelCount += 1;
        const horizontalBin = Math.min(7, Math.floor((x / width) * 8));

        horizontalChangedPixelBins[horizontalBin] = horizontalChangedPixelBins[horizontalBin]! + 1;
      }
      if (totalDifference >= 14 && maximumDifference - minimumDifference >= 4) {
        chromaticContributionPixelCount += 1;
        const column = Math.min(3, Math.floor((x / width) * 4));
        const row = Math.min(2, Math.floor((y / height) * 3));
        const cell = row * 4 + column;

        chromaticContributionPixelGrid[cell] = chromaticContributionPixelGrid[cell]! + 1;
      }
    }
  }

  return {
    transitionBatchCount: accents.length,
    changedPixelCount,
    horizontalChangedPixelBins,
    chromaticContributionPixelCount,
    chromaticContributionPixelGrid,
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
  const engineClient = facade ? (Reflect.get(facade, 'engine') as object | undefined) : undefined;
  const engine = engineClient
    ? ((Reflect.get(engineClient, 'engine') as (RuntimeEngine & object) | null | undefined) ??
      (engineClient as RuntimeEngine & object))
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
