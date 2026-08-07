import { expect, test } from '@playwright/test';
import {
  monitorBrowserErrors,
  openUniverse,
  queryParameter,
  universeUrl,
  waitForCameraSettled,
} from './universe-test-helpers';

test('la fiche d’une étoile partage une position consentie avec la vue observable', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sirius',
      selected: 'sirius',
      time: '2026-01-15T22:00:00.000Z',
      observer: 'paris',
    }),
  );
  await page.context().grantPermissions(['geolocation'], { origin: new URL(page.url()).origin });
  await page.context().setGeolocation({ latitude: 43.296_482, longitude: 5.369_78 });

  const observationPanel = page.locator('#stellar-observation-panel');
  const picker = observationPanel.locator('app-earth-observer-location-picker');

  await expect(observationPanel).toBeVisible();
  await picker.locator('summary').click();
  await picker.getByRole('button', { name: 'Utiliser ma position' }).click();

  await expect(picker.locator('summary strong')).toHaveText('Ma position');
  await expect(picker.getByRole('status')).toHaveText(
    'Position utilisée · coordonnées arrondies à environ 100 m',
  );
  await expect.poll(() => queryParameter(page, 'observer')).toBe('coordinates-43.296000-5.370000');

  await page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }).click();

  const nightSky = page.locator('#earth-sky-view[data-phase="open"]');

  await expect(nightSky).toBeVisible({ timeout: 8_000 });
  await expect(nightSky).toHaveAttribute('aria-label', 'Ciel nocturne depuis Ma position');
  await expect(nightSky.locator('.earth-sky-view__landscape')).toHaveAttribute(
    'data-landscape',
    'plain',
  );
  await expect(nightSky.locator('[data-cityscape-svg]')).toHaveCount(0);
  await expect(nightSky.locator('app-earth-observer-location-picker summary strong')).toHaveText(
    'Ma position',
  );
  await waitForCameraSettled(page);
  expect(browserErrors).toEqual([]);
});

test('un lieu du catalogue charge son masque de relief ETOPO à la demande', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sirius',
      selected: 'sirius',
      time: '2026-01-15T22:00:00.000Z',
      observer: 'paris',
    }),
  );
  await page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }).click();

  const nightSky = page.locator('#earth-sky-view[data-phase="open"]');
  const landscape = nightSky.locator('.earth-sky-view__landscape');

  await expect(nightSky).toBeVisible({ timeout: 8_000 });
  await expect(landscape).toHaveAttribute(
    'data-terrain-model',
    'noaa-ncei-etopo-2022-v1-60s-surface',
  );
  await expect(landscape).toHaveAttribute(
    'data-terrain-classification',
    'calculated-from-measured-global-relief-model',
  );
  await expect(landscape).toHaveAttribute(
    'data-terrain-source-doi',
    'https://doi.org/10.25921/fd45-gt74',
  );
  await expect(landscape).toHaveAttribute(
    'data-terrain-rendering',
    'measured-distance-envelopes-with-stylized-lighting',
  );
  const measuredTerrain = landscape.locator('[data-measured-terrain]');

  await expect(measuredTerrain).toHaveCount(1);
  await expect(landscape.locator('[data-terrain-distance-band]')).toHaveCount(3);
  await expect(landscape.locator('[data-terrain-contour]')).toHaveCount(2);
  const [landscapeBox, terrainBox] = await Promise.all([
    landscape.boundingBox(),
    measuredTerrain.boundingBox(),
  ]);

  expect(landscapeBox).not.toBeNull();
  expect(terrainBox).not.toBeNull();
  expect(terrainBox!.x).toBeLessThanOrEqual(landscapeBox!.x);
  expect(terrainBox!.x + terrainBox!.width).toBeGreaterThanOrEqual(
    landscapeBox!.x + landscapeBox!.width,
  );
  await expect(nightSky.locator('.earth-sky-view__science small')).toContainText(
    'Relief calculé · NOAA ETOPO 2022 (60″)',
  );
  await waitForCameraSettled(page);
  expect(browserErrors).toEqual([]);
});
