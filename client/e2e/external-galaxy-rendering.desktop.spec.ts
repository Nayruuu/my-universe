import { expect, test, type Page } from '@playwright/test';
import type * as THREE from 'three';
import {
  monitorBrowserErrors,
  openUniverse,
  readCameraInteractionState,
  readGalaxyImpostorStates,
  universeUrl,
} from './universe-test-helpers';

for (const [target, zoom, morphology] of [
  ['andromeda', '1000', 'spiral'],
  ['virgo-a', '900', 'elliptical'],
  ['large-magellanic-cloud', '120', 'irregular'],
] as const) {
  test(`${target} reste un nuage visible depuis les deux faces et par la tranche`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = monitorBrowserErrors(page);
    let initialPositions: number[] | undefined;

    for (const orientation of ['1,0,0', '-1,0,0', '0,1,0', '0,0,-1']) {
      await openUniverse(
        page,
        universeUrl({ target, zoom, selected: '', orientation, quality: 'high', mode: 'state' }),
      );
      await expect
        .poll(
          async () =>
            (await readGalaxyImpostorStates(page)).find(({ objectId }) => objectId === target)
              ?.nearVisible,
        )
        .toBe(true);
      const before = await readCameraInteractionState(page);
      const volume = await readVolumeFramebuffer(page, target);
      const after = await readCameraInteractionState(page);

      expect(volume.style).toBe('continuous-galaxy-grain-volume');
      expect(volume.morphology).toBe(morphology);
      expect(volume.visiblePixels).toBeGreaterThan(100);
      expect(volume.chromaticPixels).toBeGreaterThan(20);
      expect(volume.capacity).toBeLessThanOrEqual(131_072);
      expect(volume.capacity).toBeGreaterThanOrEqual(1_024);
      expect(after.distance).toBeCloseTo(before.distance, 6);
      expect(after.direction.x).toBeCloseTo(before.direction.x, 6);
      expect(after.direction.y).toBeCloseTo(before.direction.y, 6);
      expect(after.direction.z).toBeCloseTo(before.direction.z, 6);
      if (initialPositions) {
        expect(volume.prefix).toEqual(initialPositions);
      }
      initialPositions = volume.prefix;
    }
    expect(errors).toEqual([]);
  });
}

test('le zoom conserve le même nuage et les points déjà présents', async ({ page }) => {
  const errors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'andromeda',
      zoom: '9000',
      selected: '',
      quality: 'high',
      mode: 'state',
    }),
  );
  const before = await readVolumeFramebuffer(page, 'andromeda');
  const beforeCamera = await readCameraInteractionState(page);

  await page.mouse.move(720, 450);
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.wheel(0, -180);
    await page.waitForTimeout(60);
  }
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(beforeCamera.distance * 0.9);
  const after = await readVolumeFramebuffer(page, 'andromeda');
  const lod = (await readGalaxyImpostorStates(page)).find(
    ({ objectId }) => objectId === 'andromeda',
  )!;

  expect(after.uuid).toBe(before.uuid);
  expect(after.prefix).toEqual(before.prefix);
  expect(after.capacity).toBeGreaterThanOrEqual(before.capacity);
  expect(after.visiblePixels).toBeGreaterThan(before.visiblePixels);
  expect(lod.nearDiskVisible).toBe(false);
  expect(lod.nearStarFieldVisible).toBe(true);
  expect(lod.visible).toBe(false);
  expect(lod.pickable).toBe(true);
  expect(errors).toEqual([]);
});

test('la sélection d’une galaxie ne superpose pas un anneau planétaire au nuage', async ({
  page,
}) => {
  const errors = monitorBrowserErrors(page);

  for (const [target, zoom] of [
    ['andromeda', '400'],
    ['virgo-a', '600'],
    ['large-magellanic-cloud', '120'],
  ] as const) {
    await openUniverse(page, universeUrl({ target, selected: target, zoom, quality: 'high' }));
    const volume = await readVolumeFramebuffer(page, target);

    expect(new URL(page.url()).searchParams.get('selected')).toBe(target);
    await expect(page.locator('app-object-details')).toBeVisible();
    expect(volume.visiblePixels).toBeGreaterThan(100);
    expect(volume.selectionMarkerVisible).toBe(false);
  }
  expect(errors).toEqual([]);
});

async function readVolumeFramebuffer(page: Page, target: string) {
  return page.evaluate((objectId) => {
    const debug = (window as unknown as { ng: { getComponent(element: Element): object } }).ng;
    const component = debug.getComponent(document.querySelector('app-root')!);
    const facade = Reflect.get(component, 'facade') as object;
    const client = Reflect.get(facade, 'engine') as object;
    const engine = ((Reflect.get(client, 'engine') as object | undefined) ?? client) as {
      renderer: THREE.WebGLRenderer;
      camera: THREE.PerspectiveCamera;
      universeScene: { scene: THREE.Scene };
      stop(): void;
      start(): void;
    };
    const scene = engine.universeScene.scene;
    const grains = scene.getObjectByName(`${objectId}-galaxy-stellar-volume`) as THREE.Points<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >;
    const ancestors = new Set<THREE.Object3D>();
    const visibility = new Map<THREE.Object3D, boolean>();

    for (let parent: THREE.Object3D | null = grains; parent; parent = parent.parent) {
      ancestors.add(parent);
    }
    const { width, height } = engine.renderer.domElement;
    const pixels = new Uint8Array(width * height * 4);
    const background = scene.background;

    engine.stop();
    try {
      scene.traverse((node) => {
        visibility.set(node, node.visible);
        node.visible = ancestors.has(node);
      });
      scene.background = null;
      engine.renderer.render(scene, engine.camera);
      const gl = engine.renderer.getContext();

      gl.finish();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    } finally {
      for (const [node, visible] of visibility) {
        node.visible = visible;
      }
      scene.background = background;
      engine.renderer.render(scene, engine.camera);
      engine.start();
    }
    let visiblePixels = 0;
    let chromaticPixels = 0;
    let selectionMarkerVisible = false;

    scene.traverse((node) => {
      if (node.name !== 'selection-marker') {
        return;
      }
      let visible = node.visible;

      for (let parent = node.parent; parent; parent = parent.parent) {
        visible &&= parent.visible;
      }
      selectionMarkerVisible ||= visible;
    });

    for (let offset = 0; offset < pixels.length; offset += 4) {
      const brightest = Math.max(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!);
      const dimmest = Math.min(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!);

      visiblePixels += Number(brightest > 12);
      chromaticPixels += Number(brightest - dimmest > 6);
    }

    return {
      uuid: grains.uuid,
      prefix: Array.from(grains.geometry.getAttribute('position').array).slice(0, 96),
      capacity: grains.geometry.getAttribute('position').count,
      style: grains.userData['visualStyle'] as string,
      morphology: grains.userData['morphology'] as string,
      selectionMarkerVisible,
      visiblePixels,
      chromaticPixels,
    };
  }, target);
}
