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
    minimumLuminousPixelRatio: 0.000_005,
  },
  {
    id: 'cosmic-web',
    parameters: { target: 'cosmic-web', selected: '', zoom: '590000', quality: 'medium' },
    minimumLuminanceDeviation: 2,
  },
] as const;

test('le ciel terrestre masque la lumière solaire et conserve une Lune lisible', async ({
  page,
}, testInfo) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: '',
      time: '2026-08-16T15:08:00.000Z',
      quality: 'high',
    }),
  );
  await page.getByRole('searchbox', { name: 'Rechercher un objet astronomique' }).fill('Spica');
  await page.getByRole('option', { name: /^Spica\b/u }).click();
  await page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }).click();

  const nightSky = page.locator('#earth-sky-view[data-phase="open"]');
  const moon = nightSky.locator('[data-body-id="moon"]');
  const moonDisk = moon.locator('i');

  await expect(nightSky).toBeVisible();
  await expect(nightSky.locator('[data-body-id="sun"]')).toHaveCount(0);
  await expect(moon).toBeVisible();
  await expect(moon).toHaveAttribute('data-lunar-phase', 'crescent');
  await expect(moon).toHaveAttribute('data-lunar-waxing', 'true');
  await expect(moonDisk).toHaveCSS('width', '34px');
  await expect
    .poll(() => moonDisk.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('moon-lroc-1024.jpg');

  const moonBounds = await moon.boundingBox();
  const horizonBounds = await nightSky.locator('.earth-sky-view__horizon').boundingBox();

  expect(moonBounds).not.toBeNull();
  expect(horizonBounds).not.toBeNull();
  expect(moonBounds!.y + moonBounds!.height).toBeLessThan(horizonBounds!.y - 100);
  await testInfo.attach('earth-night-sky-moon.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(actionableBrowserMessages(browserErrors)).toEqual([]);
});

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
    const minimumLuminousPixelRatio =
      'minimumLuminousPixelRatio' in view ? view.minimumLuminousPixelRatio : 0.000_01;
    const signature = await waitForStableRenderedFrameSignature(
      page,
      minimumLuminousPixelRatio,
      view.minimumLuminanceDeviation,
    );

    await testInfo.attach(`${view.id}-signature.json`, {
      body: JSON.stringify(signature, null, 2),
      contentType: 'application/json',
    });

    expect(signature.sampledPixels).toBeGreaterThan(50_000);
    expect(signature.visiblePixelRatio).toBeGreaterThan(0.015);
    expect(signature.luminousPixelRatio).toBeGreaterThan(minimumLuminousPixelRatio);
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

async function waitForStableRenderedFrameSignature(
  page: Parameters<typeof readRenderedFrameSignature>[0],
  minimumLuminousPixelRatio: number,
  minimumLuminanceDeviation: number,
) {
  let signature = await readRenderedFrameSignature(page);

  await expect
    .poll(
      async () => {
        signature = await readRenderedFrameSignature(page);

        return (
          signature.visiblePixelRatio > 0.015 &&
          signature.luminousPixelRatio > minimumLuminousPixelRatio &&
          signature.chromaticPixelRatio > 0.002 &&
          signature.meanLuminance > 1 &&
          signature.luminanceDeviation > minimumLuminanceDeviation
        );
      },
      { timeout: 5_000 },
    )
    .toBe(true);

  return signature;
}

function actionableBrowserMessages(messages: readonly string[]): readonly string[] {
  return messages.filter(
    (message) => !BENIGN_BROWSER_MESSAGES.some((benign) => message.includes(benign)),
  );
}
