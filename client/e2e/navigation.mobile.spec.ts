import { expect, test } from '@playwright/test';
import {
  chooseCustomObserverLocation,
  chooseObserverLocation,
  monitorBrowserErrors,
  numericQueryParameter,
  openUniverse,
  queryParameter,
  readCameraInteractionState,
  readRotationGuideState,
  universeUrl,
  waitForCameraSettled,
  waitForLabelCenter,
} from './universe-test-helpers';

const MOBILE_TOUCH_TARGET_SIZE = 44;
const IOS_SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

function vectorDistance(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

async function elementBox(locator: import('@playwright/test').Locator) {
  const bounds = await locator.boundingBox();

  expect(bounds).not.toBeNull();

  return bounds!;
}

async function expectTouchTarget(locator: import('@playwright/test').Locator) {
  const bounds = await elementBox(locator);

  expect(bounds.width).toBeGreaterThanOrEqual(MOBILE_TOUCH_TARGET_SIZE);
  expect(bounds.height).toBeGreaterThanOrEqual(MOBILE_TOUCH_TARGET_SIZE);
}

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
  await expect(page.locator('app-object-details h2')).toContainText(/.+/);
  expect(browserErrors).toEqual([]);
});

test('Locate from Earth amène un ciel de Sirius navigable dans la fiche mobile', async ({
  page,
  context,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: '',
      time: '2026-01-15T22:00:00.000Z',
    }).replace('/fr/', '/en/'),
  );

  await page.getByRole('searchbox', { name: 'Search for an astronomical object' }).fill('Sirius');
  await page.getByRole('option', { name: /^Sirius\b/u }).click();

  const observeFromEarth = page.getByRole('button', {
    name: 'Locate from Earth',
    exact: true,
  });

  await expectTouchTarget(observeFromEarth);
  await observeFromEarth.click();

  const locator = page.getByRole('region', { name: 'Locate Sirius' });
  const nightSky = page.getByRole('region', { name: 'Night sky from Paris' });
  const detailsBody = page.locator('.details__body');

  await expect(nightSky).toBeVisible();
  await expect(nightSky.locator('canvas')).toHaveCount(0);
  await expect(page.locator('canvas.universe-canvas')).toBeVisible();
  await expect(nightSky.locator('.earth-sky-view__horizon')).toBeVisible();
  await expect(nightSky.locator('.earth-sky-view__ground')).toBeVisible();
  await expect(nightSky.locator('[data-body-id="sun"]')).toHaveCount(0);
  await expect(nightSky.locator('.earth-sky-target')).toHaveCount(0);
  await expect(detailsBody).toBeVisible();
  await expect(locator).toBeVisible();
  await expect.poll(() => queryParameter(page, 'mode')).toBe('observable');
  await page.getByRole('button', { name: 'Close object sheet' }).click();
  await expectTouchTarget(nightSky.getByRole('button', { name: 'Return to the 3D map' }));
  await expectTouchTarget(nightSky.getByRole('button', { name: 'Recenter Sirius' }));

  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();
  const initialCamera = await readCameraInteractionState(page);
  const session = await context.newCDPSession(page);

  expect(bounds).not.toBeNull();
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: bounds!.x + bounds!.width * 0.42, y: bounds!.y + bounds!.height * 0.5, id: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: bounds!.x + bounds!.width * 0.65, y: bounds!.y + bounds!.height * 0.5, id: 1 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(async () => {
      const current = await readCameraInteractionState(page);

      return vectorDistance(current.direction, initialCamera.direction);
    })
    .toBeGreaterThan(0.03);
  const movedCamera = await readCameraInteractionState(page);

  expect(vectorDistance(movedCamera.position, initialCamera.position)).toBeLessThan(1e-8);

  await nightSky.getByRole('button', { name: 'Recenter Sirius' }).click();
  await waitForCameraSettled(page);
  expect((await readCameraInteractionState(page)).observerModeActive).toBe(true);
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

test('iOS bloque le pincement de page sans désactiver le pincement de la carte', async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent: IOS_SAFARI_USER_AGENT,
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  const browserErrors = monitorBrowserErrors(page);

  try {
    await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '50' }));
    const viewportGuard = await page.evaluate(() => {
      const gesture = new Event('gesturestart', { cancelable: true });
      const dispatched = document.dispatchEvent(gesture);

      return {
        content: document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? '',
        dispatched,
        prevented: gesture.defaultPrevented,
      };
    });

    expect(viewportGuard.content).toContain('maximum-scale=1');
    expect(viewportGuard.content).toContain('user-scalable=no');
    expect(viewportGuard.dispatched).toBe(false);
    expect(viewportGuard.prevented).toBe(true);

    const initialZoom = numericQueryParameter(page, 'zoom');
    const session = await context.newCDPSession(page);

    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 145, y: 400, id: 1 },
        { x: 245, y: 400, id: 2 },
      ],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 95, y: 400, id: 1 },
        { x: 295, y: 400, id: 2 },
      ],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect.poll(() => numericQueryParameter(page, 'zoom')).not.toBeCloseTo(initialZoom, 1);
    expect(browserErrors).toEqual([]);
  } finally {
    await context.close();
  }
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

  await chooseCustomObserverLocation(
    browser,
    'Lieu d’observation de l’éclipse',
    'Coordonnées personnalisées',
  );
  const latitudeInput = browser.getByRole('spinbutton', {
    name: 'Latitude d’observation en degrés',
  });
  const longitudeInput = browser.getByRole('spinbutton', {
    name: 'Longitude d’observation en degrés',
  });

  await expect(latitudeInput).toBeVisible();
  await expect(longitudeInput).toBeVisible();
  expect((await latitudeInput.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect((await longitudeInput.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await chooseObserverLocation(
    browser,
    'Lieu d’observation de l’éclipse',
    'Paris',
    /^Paris France$/u,
  );

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

test('la barre mobile compacte garde tous ses contrôles visibles et tactiles à 360 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  expect(layout.scrollWidth).toBe(layout.viewportWidth);
  expect(layout.scrollHeight).toBe(layout.viewportHeight);

  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });
  const timelineBounds = await elementBox(timeline);

  expect(await timeline.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
    await timeline.evaluate((element) => element.clientWidth),
  );

  for (const control of await timeline
    .locator('button:visible, select:visible, input:visible')
    .all()) {
    const bounds = await elementBox(control);

    expect(bounds.x).toBeGreaterThanOrEqual(timelineBounds.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(timelineBounds.x + timelineBounds.width);
  }

  await expectTouchTarget(page.getByRole('button', { name: 'Ouvrir les paramètres' }));
  await expectTouchTarget(page.getByRole('button', { name: 'Ouvrir l’aide' }));
  await expectTouchTarget(page.getByRole('link', { name: 'Offrir un café' }));
  await expectTouchTarget(timeline.getByRole('button', { name: 'Faire avancer le temps' }));
  await expectTouchTarget(
    timeline.getByRole('button', { name: 'Ouvrir les événements astronomiques' }),
  );
  await expectTouchTarget(timeline.getByLabel('Vitesse temporelle'));
  await expectTouchTarget(timeline.getByLabel('Date et heure UTC de simulation'));
  expect(browserErrors).toEqual([]);
});

test('les panneaux mobiles courts restent entre la navigation et la timeline', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });

  const expectPanelAboveTimeline = async (panel: import('@playwright/test').Locator) => {
    const panelBounds = await elementBox(panel);
    const timelineBounds = await elementBox(timeline);

    expect(panelBounds.y).toBeGreaterThanOrEqual(0);
    expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(timelineBounds.y - 8);
  };

  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click();
  const settings = page.getByRole('region', { name: 'Paramètres visuels' });

  await expectPanelAboveTimeline(settings);
  await settings.getByRole('button', { name: 'Fermer les paramètres' }).click();

  await page.getByRole('button', { name: 'Ouvrir l’aide' }).click();
  const help = page.getByRole('region', { name: 'Aide à la navigation' });

  await expectPanelAboveTimeline(help);
  await help.getByRole('button', { name: 'Fermer l’aide' }).click();

  await page
    .getByRole('button', { name: 'Explorer le catalogue des exoplanètes confirmées' })
    .click();
  await expectPanelAboveTimeline(
    page.getByRole('region', { name: 'Explorer les exoplanètes confirmées' }),
  );
  expect(browserErrors).toEqual([]);
});

test('la fiche mobile conserve une zone de scène et des actions tactiles', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });
  const detailsBounds = await elementBox(details);
  const timelineBounds = await elementBox(page.getByRole('region', { name: 'Contrôle du temps' }));
  const scaleBounds = await elementBox(page.getByRole('button', { name: 'Changer d’échelle' }));

  expect(detailsBounds.y).toBeGreaterThanOrEqual(scaleBounds.y + scaleBounds.height + 8);
  expect(detailsBounds.y + detailsBounds.height).toBeLessThanOrEqual(timelineBounds.y - 8);

  for (const action of await details.locator('.details__actions button').all()) {
    await expectTouchTarget(action);
  }
  expect(browserErrors).toEqual([]);
});

test('la navigation essentielle reste accessible sur un écran de 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  const viewport = page.viewportSize();
  const topbarBounds = await elementBox(page.locator('.topbar'));
  const searchBounds = await elementBox(page.locator('.search-shell'));
  const scaleBounds = await elementBox(page.getByRole('button', { name: 'Changer d’échelle' }));
  const controlsBounds = await elementBox(page.locator('app-floating-controls .controls'));
  const timelineBounds = await elementBox(page.getByRole('region', { name: 'Contrôle du temps' }));

  expect(topbarBounds.x).toBeGreaterThanOrEqual(0);
  expect(topbarBounds.x + topbarBounds.width).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect(searchBounds.x + searchBounds.width).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect(scaleBounds.y).toBeGreaterThanOrEqual(searchBounds.y + searchBounds.height + 8);
  expect(controlsBounds.y + controlsBounds.height).toBeLessThanOrEqual(timelineBounds.y - 8);
  expect(await timelineBounds.width).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect(
    await page.locator('.timeline').evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(await page.locator('.timeline').evaluate((element) => element.clientWidth));

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);

  expect(documentWidth).toBe(viewport?.width);
  expect(browserErrors).toEqual([]);
});

test('un téléphone en paysage conserve les panneaux séparés et des actions tactiles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });
  const detailsBounds = await elementBox(details);
  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });
  const timelineBounds = await elementBox(timeline);
  const detailsActionsBounds = await elementBox(details.locator('.details__actions'));

  expect(detailsBounds.y + detailsBounds.height).toBeLessThanOrEqual(timelineBounds.y - 8);
  expect(detailsActionsBounds.y + detailsActionsBounds.height).toBeLessThanOrEqual(
    detailsBounds.y + detailsBounds.height,
  );
  expect(await timeline.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
    await timeline.evaluate((element) => element.clientWidth),
  );
  for (const control of await timeline
    .locator('button:visible, select:visible, input:visible')
    .all()) {
    const bounds = await elementBox(control);

    expect(bounds.x).toBeGreaterThanOrEqual(timelineBounds.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(timelineBounds.x + timelineBounds.width);
  }
  await expect(page.locator('app-map-scale')).toBeHidden();
  await expect(page.locator('app-floating-controls .controls')).toBeHidden();

  await details.getByRole('button', { name: 'Fermer', exact: true }).click();
  const controls = page.locator('app-floating-controls .controls');
  const mapScale = page.locator('app-map-scale .map-scale');

  await expect(controls).toBeVisible();
  await expect(mapScale).toBeVisible();
  const controlsBounds = await elementBox(controls);
  const mapScaleBounds = await elementBox(mapScale);

  expect(controlsBounds.height).toBeLessThanOrEqual(46);
  expect(controlsBounds.y + controlsBounds.height).toBeLessThanOrEqual(timelineBounds.y - 8);
  expect(mapScaleBounds.y + mapScaleBounds.height).toBeLessThanOrEqual(timelineBounds.y - 8);

  await expectTouchTarget(page.getByRole('button', { name: 'Ouvrir les paramètres' }));
  await expectTouchTarget(page.getByRole('button', { name: 'Ouvrir l’aide' }));
  await expectTouchTarget(timeline.getByRole('button', { name: 'Faire avancer le temps' }));
  await expectTouchTarget(timeline.getByLabel('Vitesse temporelle'));
  expect(browserErrors).toEqual([]);
});

test('les huit traductions conservent une composition mobile sans débordement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  const languageSelector = page.locator('.language-selector select');

  for (const language of ['fr', 'en', 'es', 'de', 'it', 'ko', 'ja', 'zh']) {
    await languageSelector.selectOption(language);
    await expect(languageSelector).toHaveValue(language);

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      timelineWidth: document.querySelector('.timeline')?.clientWidth ?? 0,
      timelineScrollWidth: document.querySelector('.timeline')?.scrollWidth ?? 0,
    }));

    expect(layout.documentWidth).toBe(layout.viewportWidth);
    expect(layout.timelineScrollWidth).toBeLessThanOrEqual(layout.timelineWidth);
  }
  expect(browserErrors).toEqual([]);
});
