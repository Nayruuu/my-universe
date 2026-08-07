import { expect, test } from '@playwright/test';
import {
  monitorBrowserErrors,
  openUniverse,
  universeUrl,
  waitForCameraSettled,
} from './universe-test-helpers';
import {
  readObjectSurfaceContribution,
  readObjectVisualDiagnostics,
  readRenderedFrameSignature,
} from './support/visual-regression-helpers';

const BENIGN_BROWSER_MESSAGES = [
  'Viewport argument key "interactive-widget" not recognized and ignored.',
] as const;

const VISUAL_VIEWS = [
  {
    id: 'sun',
    parameters: { target: 'sun', selected: 'sun', zoom: '24', quality: 'medium' },
    minimumLuminanceDeviation: 3,
  },
  {
    id: 'solar-system',
    parameters: { target: 'sun', selected: '', zoom: '520', quality: 'medium' },
    minimumLuminanceDeviation: 3,
  },
  {
    id: 'solar-eclipse',
    parameters: {
      target: 'earth',
      selected: 'earth',
      time: '2026-08-12T17:45:53.800Z',
      zoom: '4.96',
      quality: 'high',
    },
    minimumLuminanceDeviation: 3,
  },
  {
    id: 'milky-way',
    parameters: { target: 'milky-way', selected: '', zoom: '9600', quality: 'medium' },
    minimumLuminanceDeviation: 2,
  },
  {
    id: 'black-hole',
    parameters: {
      target: 'sagittarius-a-star',
      selected: 'sagittarius-a-star',
      zoom: '24',
      quality: 'medium',
    },
    minimumLuminanceDeviation: 3,
  },
  {
    id: 'cosmic-web',
    parameters: { target: 'cosmic-web', selected: '', zoom: '590000', quality: 'medium' },
    minimumLuminanceDeviation: 3,
  },
] as const;

test('la Terre stabilisée possède une surface texturée, opaque et contributive', async ({
  page,
}, testInfo) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: 'earth',
      time: '2026-08-11T13:14:46.107Z',
      zoom: '4.96',
      quality: 'high',
    }),
  );
  await waitForCameraSettled(page);
  await expect
    .poll(() => readObjectVisualDiagnostics(page, 'earth'))
    .toMatchObject({
      objectId: 'earth',
      bodyPresent: true,
      bodyVisible: true,
      visualVisible: true,
      nearVisible: true,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      surfaceTexture: {
        requested: true,
        loaded: true,
        source: expect.stringContaining('textures/earth-blue-marble-2048.jpg'),
        width: 2048,
        height: 1024,
      },
    });
  await expect
    .poll(async () => {
      const state = await readObjectVisualDiagnostics(page, 'earth');

      return state ? Math.min(state.nearBlend, state.visibilityBlend, state.opacity) : 0;
    })
    .toBeGreaterThan(0.995);
  const diagnostics = await readObjectVisualDiagnostics(page, 'earth');
  const contribution = await readObjectSurfaceContribution(page, 'earth');

  expect(diagnostics?.nearBlend).toBeGreaterThan(0.995);
  expect(diagnostics?.visibilityBlend).toBeGreaterThan(0.995);
  expect(diagnostics?.opacity).toBeGreaterThan(0.995);
  expect(contribution.comparedPixels).toBeGreaterThan(5_000);
  expect(contribution.changedPixelRatio).toBeGreaterThan(0.18);
  expect(contribution.meanDifference).toBeGreaterThan(12);
  expect(contribution.maximumDifference).toBeGreaterThan(80);
  await testInfo.attach('earth-solid-surface.png', {
    body: await page.locator('canvas.universe-canvas').screenshot(),
    contentType: 'image/png',
  });
  expect(actionableBrowserMessages(browserErrors)).toEqual([]);
});

for (const view of VISUAL_VIEWS) {
  test(`la signature visuelle ${view.id} reste non vide et contrastée`, async ({
    page,
  }, testInfo) => {
    const browserErrors = monitorBrowserErrors(page);

    await openUniverse(page, universeUrl(view.parameters));
    await waitForCameraSettled(page);
    const signature = await readRenderedFrameSignature(page);

    await testInfo.attach(`${view.id}-signature.json`, {
      body: JSON.stringify(signature, null, 2),
      contentType: 'application/json',
    });

    expect(signature.sampledPixels).toBeGreaterThan(50_000);
    expect(signature.visiblePixelRatio).toBeGreaterThan(0.015);
    expect(signature.luminousPixelRatio).toBeGreaterThan(0.000_01);
    expect(signature.chromaticPixelRatio).toBeGreaterThan(0.002);
    expect(signature.meanLuminance).toBeGreaterThan(1);
    expect(signature.luminanceDeviation).toBeGreaterThan(view.minimumLuminanceDeviation);
    await testInfo.attach(`${view.id}.png`, {
      body: await page.locator('canvas.universe-canvas').screenshot(),
      contentType: 'image/png',
    });
    expect(actionableBrowserMessages(browserErrors)).toEqual([]);
  });
}

function actionableBrowserMessages(messages: readonly string[]): readonly string[] {
  return messages.filter(
    (message) => !BENIGN_BROWSER_MESSAGES.some((benign) => message.includes(benign)),
  );
}
