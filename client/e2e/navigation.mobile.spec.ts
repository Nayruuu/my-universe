import { expect, test } from '@playwright/test';
import {
  monitorBrowserErrors,
  numericQueryParameter,
  openUniverse,
  queryParameter,
  readRotationGuideState,
  universeUrl,
  waitForLabelCenter,
} from './universe-test-helpers';

test('la vue mobile stellaire reste contenue et un appui sur un nom centre l’étoile', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', quality: 'low', zoom: '1400' }),
  );

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  expect(dimensions.scrollWidth).toBe(dimensions.viewportWidth);
  expect(dimensions.scrollHeight).toBe(dimensions.viewportHeight);

  const label = await waitForLabelCenter(page);

  await page.touchscreen.tap(label.point.x, label.point.y);
  await expect.poll(() => queryParameter(page, 'target')).toBe(label.objectId);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(label.objectId);
  await expect(page.getByRole('heading')).toContainText(/.+/);
  expect(browserErrors).toEqual([]);
});

test('le geste de pincement modifie réellement la distance caméra', async ({ page, context }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '50' }));
  const initialZoom = numericQueryParameter(page, 'zoom');
  const session = await context.newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 160, y: 390, id: 1 },
      { x: 250, y: 390, id: 2 },
    ],
  });
  for (let step = 1; step <= 4; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 160 - step * 15, y: 390, id: 1 },
        { x: 250 + step * 15, y: 390, id: 2 },
      ],
    });
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect.poll(() => numericQueryParameter(page, 'zoom')).not.toBeCloseTo(initialZoom, 1);
  expect(browserErrors).toEqual([]);
});

test('un pincement arrière change automatiquement le contexte de la Terre au Soleil', async ({
  page,
  context,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '50' }));
  const session = await context.newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 80, y: 390, id: 1 },
      { x: 330, y: 390, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 198, y: 390, id: 1 },
      { x: 212, y: 390, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(500);
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  expect(browserErrors).toEqual([]);
});

test('le guide de rotation et ses actions restent lisibles sur mobile', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });
  const bounds = await details.boundingBox();
  const viewport = page.viewportSize();

  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  await expect(details.getByRole('button', { name: 'Voir la rotation' })).toBeVisible();
  await expect(details.getByRole('button', { name: 'Orbite · Soleil' })).toBeVisible();
  await expect
    .poll(() => readRotationGuideState(page))
    .toMatchObject({
      visible: true,
      objectId: 'earth',
    });
  expect(browserErrors).toEqual([]);
});

test('le sélecteur d’échelle reste contenu et navigable sur mobile', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  const scaleSwitcher = page.getByRole('button', { name: 'Changer d’échelle' });

  await scaleSwitcher.click();
  const scaleMenu = page.getByRole('navigation', { name: 'Échelles de navigation' });
  const bounds = await scaleMenu.boundingBox();
  const viewport = page.viewportSize();

  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect(bounds?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);

  await page.getByRole('button', { name: 'Afficher l’échelle Système solaire' }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(500);
  await expect(scaleSwitcher).toContainText('Système solaire');

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Réseau cosmique' }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('cosmic-web');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(419_900);
  await expect(scaleSwitcher).toContainText('Réseau cosmique');
  expect(browserErrors).toEqual([]);
});

test('les contrôles d’éclipse solaire restent contenus sur mobile', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir les événements astronomiques' }).click();
  const browser = page.getByRole('region', { name: 'Éclipses terrestres' });
  const browserBounds = await browser.boundingBox();
  const viewport = page.viewportSize();

  expect(browserBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(browserBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((browserBounds?.x ?? 0) + (browserBounds?.width ?? 0)).toBeLessThanOrEqual(
    viewport?.width ?? 0,
  );
  expect(browserBounds?.y ?? -1).toBeGreaterThanOrEqual(0);

  await browser
    .getByRole('button', {
      name: /Voir Éclipse solaire totale, 12 août 2026/,
    })
    .click();

  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });
  const bounds = await timeline.boundingBox();

  expect(bounds).not.toBeNull();
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);

  await timeline.getByRole('button', { name: /Vue au sol/ }).click();
  await expect(timeline).toContainText('Observation locale');
  expect(browserErrors).toEqual([]);
});
