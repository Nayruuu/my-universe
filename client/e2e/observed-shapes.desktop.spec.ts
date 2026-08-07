import { expect, test, type Page } from '@playwright/test';
import {
  monitorBrowserErrors,
  openUniverse,
  readObjectRotation,
  universeUrl,
  waitForCameraSettled,
} from './universe-test-helpers';

test('Cérès et Vesta chargent leur modèle Dawn uniquement lors du focus rapproché', async ({
  page,
}) => {
  test.slow();
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', quality: 'high', zoom: '520' }),
  );
  await expect.poll(() => wasResourceLoaded(page, '/models/ceres-nasa-vtad.glb')).toBe(false);
  await expect.poll(() => wasResourceLoaded(page, '/models/vesta-nasa-vtad.glb')).toBe(false);

  await focusSearchResult(page, 'Ceres', 'Cérès');
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details).toContainText('Forme 3D et mosaïque Dawn observées');
  await expect(details).toContainText('IAU_CERES');
  await expect.poll(() => wasResourceLoaded(page, '/models/ceres-nasa-vtad.glb')).toBe(true);
  await expect
    .poll(async () => Number.isFinite(await readObjectRotation(page, 'ceres')))
    .toBe(true);
  await expect.poll(() => wasResourceLoaded(page, '/models/vesta-nasa-vtad.glb')).toBe(false);

  await focusSearchResult(page, 'Vesta', 'Vesta');
  await expect(details).toContainText('Forme 3D et mosaïque Dawn observées');
  await expect(details).toContainText('IAU_VESTA');
  await expect.poll(() => wasResourceLoaded(page, '/models/vesta-nasa-vtad.glb')).toBe(true);
  await expect
    .poll(async () => Number.isFinite(await readObjectRotation(page, 'vesta')))
    .toBe(true);
  expect(browserErrors).toEqual([]);
});

test('Pallas et Hygie chargent leur reconstruction DAMIT uniquement au focus', async ({ page }) => {
  test.slow();
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', quality: 'high', zoom: '520' }),
  );
  await expect.poll(() => wasResourceLoaded(page, '/models/pallas-damit-4395.obj')).toBe(false);
  await expect.poll(() => wasResourceLoaded(page, '/models/hygiea-damit-4392.obj')).toBe(false);

  await focusSearchResult(page, 'Pallas', 'Pallas');
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details).toContainText('Forme 3D reconstruite');
  await expect(details).toContainText('DAMIT_PALLAS_4395');
  await expect.poll(() => wasResourceLoaded(page, '/models/pallas-damit-4395.obj')).toBe(true);
  await expect
    .poll(async () => Number.isFinite(await readObjectRotation(page, 'pallas')))
    .toBe(true);
  await expect.poll(() => wasResourceLoaded(page, '/models/hygiea-damit-4392.obj')).toBe(false);

  await focusSearchResult(page, 'Hygiea', 'Hygie');
  await expect(details).toContainText('Forme 3D reconstruite');
  await expect(details).toContainText('DAMIT_HYGIEA_4392');
  await expect.poll(() => wasResourceLoaded(page, '/models/hygiea-damit-4392.obj')).toBe(true);
  await expect
    .poll(async () => Number.isFinite(await readObjectRotation(page, 'hygiea')))
    .toBe(true);
  expect(browserErrors).toEqual([]);
});

async function focusSearchResult(page: Page, query: string, result: string): Promise<void> {
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill(query);
  await page.getByRole('option').filter({ hasText: result }).click();
  await waitForCameraSettled(page);
  await expect(
    page.getByRole('complementary', {
      name: 'Informations sur l’objet sélectionné',
    }),
  ).toContainText(result);
}

async function wasResourceLoaded(page: Page, suffix: string): Promise<boolean> {
  return page.evaluate(
    (resourceSuffix) =>
      performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(resourceSuffix)),
    suffix,
  );
}
