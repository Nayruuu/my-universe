import { expect, test, type Locator } from '@playwright/test';
import {
  findConstellationSegmentPoint,
  findEmptyCanvasPoint,
  findTempelFilamentSegmentPoint,
  monitorBrowserErrors,
  numericQueryParameter,
  openUniverse,
  queryParameter,
  readActiveCatalogStarState,
  readBodyLabelOcclusionState,
  readBodyTextureState,
  readBlackHoleLensingState,
  readBlackHoleVisualState,
  readCameraInteractionState,
  readCatalogLabelLayout,
  readConstellationInteractionState,
  readConstellationLineState,
  readCosmicBackgroundState,
  readCosmicGroupBatchState,
  readCosmicStructureBatchState,
  readCosmicWebVolumeState,
  readGalaxyImpostorStates,
  readHeliocentricCatalogPresentationState,
  readLocalGalacticSkyState,
  readLocalVolumeDepthBackdropState,
  readMilkyWayDetailState,
  readMilkyWayVolumeState,
  readNearbyGalaxyBatchState,
  readNavigationAlignmentState,
  readObjectScreenPoint,
  readObjectRotation,
  readOrbitVisualState,
  readPlanetaryRingVisualState,
  readRotationGuideState,
  readSolarEclipseVisualState,
  readSpaceTileStreamingState,
  readStarCatalogBatchState,
  readStarClusterBatchState,
  readSunOcclusionState,
  readSunPixelOcclusionState,
  readSupernovaVisualState,
  readTempelFilamentSpineState,
  readVisibleLabelIds,
  sampleObjectQuaternions,
  universeUrl,
  waitForCameraSettled,
  waitForIsolatedCatalogPoint,
  waitForLabelCenter,
  waitForUnlabelledCatalogPoint,
} from './universe-test-helpers';

test('la langue change sans perdre l’état partageable de la carte', async ({ page }) => {
  await openUniverse(page, universeUrl({ target: 'mars', zoom: '8.4' }));

  await page.locator('.language-selector select').selectOption('en');

  await expect.poll(() => new URL(page.url()).pathname).toBe('/en/');
  await expect.poll(() => queryParameter(page, 'target')).toBe('mars');
  await expect.poll(() => queryParameter(page, 'zoom')).not.toBeNull();
  await expect(
    page.locator('header').getByRole('button', { name: 'Return to Earth' }),
  ).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: 'Search for an astronomical object' }),
  ).toBeVisible();

  await page.locator('.language-selector select').selectOption('zh');

  await expect.poll(() => new URL(page.url()).pathname).toBe('/zh/');
  await expect.poll(() => queryParameter(page, 'target')).toBe('mars');
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('zh-Hans');
  await expect(page.locator('header').getByRole('button', { name: '返回地球' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: '搜索天体' })).toBeVisible();
});

test('l’aide présente le créateur, son portfolio et le soutien facultatif', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir l’aide' }).click();
  const help = page.getByRole('region', { name: 'Aide à la navigation' });
  const portfolio = help.getByRole('link', { name: 'Découvrir mon portfolio' });
  const support = help.getByRole('link', { name: 'Offrir un café' });

  await expect(help).toContainText('Créé par Nayruuu');
  await expect(portfolio).toHaveAttribute('href', 'https://super-dev.app');
  await expect(portfolio).toHaveAttribute('rel', /\bme\b/u);
  await expect(portfolio).toHaveAttribute('target', '_blank');
  await expect(support).toHaveAttribute('href', 'https://buymeacoffee.com/nayruuu');
  await expect(support).toHaveAttribute('target', '_blank');
  expect(await help.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  expect(browserErrors).toEqual([]);
});

test('la vue du Système solaire donne la priorité aux planètes et à leurs trajectoires', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', zoom: '520', quality: 'high' }),
  );
  await waitForCameraSettled(page);
  await expect
    .poll(async () => {
      const visibleLabels = await readVisibleLabelIds(page);

      return ['mercury', 'venus', 'earth', 'mars'].filter((objectId) =>
        visibleLabels.includes(objectId),
      ).length;
    })
    .toBeGreaterThanOrEqual(4);
  const earthOrbit = await readOrbitVisualState(page, 'earth');

  expect(earthOrbit).toMatchObject({
    visible: true,
    active: false,
    overviewEmphasis: true,
    color: '#43b4dd',
    mapAccent: '#43b4dd',
    semanticGroup: 'solar-system',
  });
  expect(earthOrbit.opacity).toBeGreaterThanOrEqual(0.6);
  expect(browserErrors).toEqual([]);
});

test('le repère Soleil reste visible à côté de la fiche d’une planète', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'mars', selected: 'mars', zoom: '2.7', quality: 'high' }),
  );
  await waitForCameraSettled(page);
  const sunLabel = await waitForLabelCenter(page, 'sun');
  const detailsBounds = await page.getByLabel('Informations sur l’objet sélectionné').boundingBox();

  expect(detailsBounds).not.toBeNull();
  expect(sunLabel.point.x).toBeGreaterThan(
    (detailsBounds?.x ?? 0) + (detailsBounds?.width ?? 0) + 8,
  );
  expect(sunLabel.point.x).toBeLessThan(1_368);
  expect(browserErrors).toEqual([]);
});

test('le Soleil occulte les objets, leur sélection et leurs noms', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', zoom: '24', quality: 'high' }));
  await expect
    .poll(() => readSunOcclusionState(page))
    .toEqual({
      bodyDepthTest: true,
      bodyDepthWrite: true,
      logarithmicDepthFragment: true,
      logarithmicDepthVertex: true,
      selectionDepthTest: true,
      selectedLabelsOccluded: true,
    });
  const pixelOcclusion = await readSunPixelOcclusionState(page);

  expect(pixelOcclusion.comparedPixels).toBeGreaterThan(1_000);
  expect(pixelOcclusion.changedPixels).toBeGreaterThan(10);
  expect(pixelOcclusion.meanOccludedLuminance).toBeGreaterThan(160);
  expect(pixelOcclusion.maximumDifference).toBeGreaterThan(30);
  expect(browserErrors).toEqual([]);
});

test('les supernovas historiques sont recherchables et rejouables sans masquer l’approximation', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: '', quality: 'high' }));
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await search.fill('SN 1987A');
  await page.getByRole('option', { name: /SN 1987A Supernova · Grand Nuage de Magellan/ }).click();
  await waitForCameraSettled(page);

  await expect(details.getByRole('heading', { name: 'SN 1987A' })).toBeVisible();
  await expect(details).toContainText('23 février 1987 · découverte');
  await expect(details).toContainText('II-pec');
  await expect(details).toContainText('Courbe de luminosité et expansion');
  await expect
    .poll(() => readSupernovaVisualState(page, 'sn-1987a'))
    .toMatchObject({
      phase: 'remnant',
      shellVisible: true,
      shellLayerCount: 3,
      visibleShellLayerCount: 3,
      flashVisible: false,
      shellStyle: 'procedural-volumetric-supernova-remnant',
      farAppearanceOpacity: 1,
    });

  await details.getByRole('button', { name: /Voir l’événement/ }).click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'time')).toContain('1987-02-23');
  await expect
    .poll(() => readSupernovaVisualState(page, 'sn-1987a'))
    .toMatchObject({
      phase: 'peak',
      shellVisible: false,
      shellLayerCount: 3,
      visibleShellLayerCount: 0,
      flashVisible: true,
      farAppearanceOpacity: 1,
    });

  await search.fill('Cassiopeia A');
  await page
    .getByRole('option', { name: /Cassiopée A Rémanent de supernova · Voie lactée/ })
    .click();
  await waitForCameraSettled(page);
  await expect(details).toContainText('aucune observation historique vérifiée');
  await expect(details.getByRole('button', { name: /Voir l’événement/ })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test('une exoplanète NASA est recherchable, cadrable et reliée à son étoile hôte', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: '', quality: 'medium' }));
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await search.fill('Kepler 452 b');
  await page.getByRole('option', { name: /Kepler-452 b Exoplanète · Kepler-452/ }).click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('kepler-452-b');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('kepler-452-b');
  await expect(details.getByRole('heading', { name: 'Kepler-452 b' })).toBeVisible();
  await expect(details).toContainText('Exoplanète confirmée');
  await expect(details).toContainText('Planète confirmée');
  await expect(details).toContainText('Température d’équilibre');
  await expect(details).toContainText('265 K');
  await expect(details).toContainText('1,046 UA');
  await expect(details).toContainText(/384,84 jours/u);
  await expect(details).toContainText('NASA Exoplanet Archive');

  await details.getByRole('button', { name: 'Orbite · Kepler-452' }).click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('kepler-452');
  await expect
    .poll(() => readOrbitVisualState(page, 'kepler-452-b'))
    .toMatchObject({
      visible: true,
      active: true,
      opacity: 0.92,
      overviewEmphasis: false,
    });

  await search.fill('TRAPPIST-1 e');
  await page.getByRole('option', { name: /TRAPPIST-1 e Exoplanète · TRAPPIST-1/ }).click();
  await waitForCameraSettled(page);

  await expect(details.getByRole('heading', { name: 'TRAPPIST-1 e' })).toBeVisible();
  await expect(details).toContainText(/6,1 jours/u);
  expect(browserErrors).toEqual([]);
});

test('le catalogue NASA complet se filtre et matérialise un système à la demande', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: '', quality: 'medium' }));
  await page
    .getByRole('button', { name: 'Explorer le catalogue des exoplanètes confirmées' })
    .click();
  const explorer = page.getByRole('region', { name: 'Explorer les exoplanètes confirmées' });

  await expect(explorer).toBeVisible();
  await expect(explorer).toContainText(/6[\s\u202f]333 mondes confirmés/u);
  await expect(explorer).toContainText('NASA Exoplanet Archive');
  const discoveries = explorer.locator('.discovery-list').getByRole('option');
  const pointerDownCanceled = await explorer.getByRole('combobox').evaluateAll((filters) =>
    filters.map((filter) => {
      const pointerDown = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
      });

      filter.dispatchEvent(pointerDown);

      return pointerDown.defaultPrevented;
    }),
  );

  await expect(discoveries).toHaveCount(12);
  expect(pointerDownCanceled).toEqual([false, false, false]);

  await explorer.getByLabel('Distance').selectOption('100');
  await explorer.getByLabel('Taille').selectOption('earth-sized');
  await explorer.getByLabel('Détection').selectOption('Transit');
  const filteredOptions = explorer.locator('.discovery-list').getByRole('option');

  await expect(filteredOptions.first()).toBeVisible();
  const selectedName = (await filteredOptions.first().locator('strong').textContent())?.trim();

  expect(selectedName).toBeTruthy();
  await filteredOptions.first().click();
  await waitForCameraSettled(page);

  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: selectedName! })).toBeVisible();
  await expect(details).toContainText('Exoplanète confirmée');
  await expect(details).toContainText('NASA Exoplanet Archive');
  await expect.poll(() => queryParameter(page, 'target')).toMatch(/^nea-planet-/u);
  expect(browserErrors).toEqual([]);
});

test('les contrôles de la barre temporelle partagent le même centre vertical', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: '', quality: 'medium' }));
  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });
  const controls = [
    timeline.getByRole('button', { name: 'Faire avancer le temps' }),
    timeline.locator('.present-button'),
    timeline.getByRole('button', { name: 'Ouvrir les événements astronomiques' }),
    timeline.getByRole('combobox', { name: 'Vitesse temporelle' }),
    timeline.getByRole('combobox', { name: 'Mode temporel' }),
    timeline.getByRole('textbox', { name: 'Date et heure UTC de simulation' }),
  ];
  const captions = timeline.locator('.select-control > span, .date-control > span');
  const timelineBounds = await timeline.boundingBox();
  const bounds = await Promise.all(controls.map((control) => control.boundingBox()));
  const controlCenters = bounds.map((controlBounds) => {
    expect(controlBounds).not.toBeNull();

    return (controlBounds?.y ?? 0) + (controlBounds?.height ?? 0) / 2;
  });

  expect(timelineBounds).not.toBeNull();
  expect(timelineBounds?.height ?? 0).toBeGreaterThanOrEqual(82);
  await expect(captions).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const captionBounds = await captions.nth(index).boundingBox();
    const fieldBounds = bounds[index + 3];

    expect(captionBounds).not.toBeNull();
    expect((captionBounds?.y ?? 0) - (timelineBounds?.y ?? 0)).toBeGreaterThanOrEqual(6);
    expect((captionBounds?.y ?? 0) + (captionBounds?.height ?? 0)).toBeLessThanOrEqual(
      (fieldBounds?.y ?? 0) - 3,
    );
  }
  expect(Math.max(...controlCenters) - Math.min(...controlCenters)).toBeLessThanOrEqual(1);
  expect(browserErrors).toEqual([]);
});

test('les trous noirs sont recherchables et gardent un rendu adapté à leur activité', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'milky-way', selected: '', quality: 'high', zoom: '9600' }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await search.fill('Sagittarius A');
  await page.getByRole('option', { name: /Sagittarius A\* Trou noir · Voie lactée/ }).click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('sagittarius-a-star');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('sagittarius-a-star');
  await expect(details.getByRole('heading', { name: 'Sagittarius A*' })).toBeVisible();
  await expect(details).toContainText('Trou noir');
  await expect(details).toContainText('Quiescent');
  await expect(details).toContainText(/4.000.000 masses solaires/u);
  await expect(details).toContainText('Rayon de Schwarzschild');
  await expect
    .poll(() => readBlackHoleVisualState(page, 'sagittarius-a-star'))
    .toEqual({
      objectId: 'sagittarius-a-star',
      nearVisible: true,
      farVisible: false,
      corePresent: true,
      lensPresent: true,
      lensStyle: 'local-lensing-cue',
      diskPresent: true,
      jetsPresent: false,
      nuclearClusterPresent: true,
      nuclearClusterRendered: true,
      nuclearClusterPointCount: 6_144,
      nuclearClusterInForeground: false,
      batchedAsLuminousPoint: false,
      opaqueCosmicReferenceBodyPresent: false,
    });
  await expect.poll(async () => (await readBlackHoleLensingState(page)).active).toBe(true);
  await expect
    .poll(async () => (await readBlackHoleLensingState(page)).objectId)
    .toBe('sagittarius-a-star');
  const lensing = await readBlackHoleLensingState(page);

  expect(lensing.strength).toBeGreaterThan(0.7);
  expect(lensing.einsteinRadius).toBeGreaterThan(lensing.coreRadius);
  expect(lensing.distortionModel).toBe('thin-lens-einstein-ring');
  expect(lensing.compositionMode).toBe('background-lens-foreground');
  expect(lensing.backgroundPreservation).toBe('live-framebuffer-thin-lens');
  expect(lensing.foregroundSeparated).toBe(true);
  expect(lensing.foregroundScale).toBeGreaterThan(0);
  expect(lensing.foregroundScale).toBeLessThanOrEqual(1);
  expect(lensing.scientificConfidence).toBe('illustrative');
  expect(lensing.renderWidth).toBeGreaterThan(1);
  expect(lensing.renderHeight).toBeGreaterThan(1);

  await search.fill('Gaia BH1');
  await page.getByRole('option', { name: /Gaia BH1 Trou noir · Voie lactée/ }).click();
  await waitForCameraSettled(page);

  await expect(details.getByRole('heading', { name: 'Gaia BH1' })).toBeVisible();
  await expect(details).toContainText('Dormant');
  await expect
    .poll(() => readBlackHoleVisualState(page, 'gaia-bh1'))
    .toMatchObject({
      nearVisible: true,
      corePresent: true,
      lensPresent: true,
      diskPresent: false,
      jetsPresent: false,
      nuclearClusterPresent: false,
      nuclearClusterRendered: false,
      nuclearClusterPointCount: 0,
      batchedAsLuminousPoint: false,
    });
  await expect.poll(async () => (await readBlackHoleLensingState(page)).objectId).toBe('gaia-bh1');
  await expect
    .poll(() => readBlackHoleVisualState(page, 'sagittarius-a-star'))
    .toMatchObject({ nearVisible: false, nuclearClusterRendered: false });

  await search.fill('Cyg X-1');
  await page.getByRole('option', { name: /Cygnus X-1 Trou noir · Voie lactée/ }).click();
  await waitForCameraSettled(page);

  await expect(details.getByRole('heading', { name: 'Cygnus X-1' })).toBeVisible();
  await expect(details).toContainText('Actif');
  await expect
    .poll(() => readBlackHoleVisualState(page, 'cygnus-x-1'))
    .toMatchObject({
      nearVisible: true,
      corePresent: true,
      lensPresent: true,
      diskPresent: true,
      jetsPresent: true,
      nuclearClusterPresent: false,
      nuclearClusterRendered: false,
      nuclearClusterPointCount: 0,
      batchedAsLuminousPoint: false,
    });
  await expect
    .poll(async () => (await readBlackHoleLensingState(page)).objectId)
    .toBe('cygnus-x-1');

  await page.reload();
  await waitForCameraSettled(page);
  await expect(details.getByRole('heading', { name: 'Cygnus X-1' })).toBeVisible();
  await expect.poll(() => queryParameter(page, 'target')).toBe('cygnus-x-1');
  expect(browserErrors).toEqual([]);
});

test('la lentille d’un trou noir garde sa couverture au zoom maximal en HiDPI', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1_600, height: 1_000 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const browserErrors = monitorBrowserErrors(page);

  try {
    await openUniverse(
      page,
      universeUrl({
        target: 'gaia-bh1',
        selected: 'gaia-bh1',
        quality: 'high',
        density: 'dense',
        zoom: '22',
      }),
    );
    await waitForCameraSettled(page);
    await expect.poll(async () => (await readBlackHoleLensingState(page)).active).toBe(true);
    const initialLensing = await readBlackHoleLensingState(page);
    const blackHolePoint = await readObjectScreenPoint(page, 'gaia-bh1');

    expect(blackHolePoint).not.toBeNull();
    await page.mouse.move(blackHolePoint!.x, blackHolePoint!.y);
    for (let index = 0; index < 8; index += 1) {
      await page.mouse.wheel(0, -480);
    }
    await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(2.6);
    const lensing = await readBlackHoleLensingState(page);

    expect(lensing.displayInfluenceRadius).toBeGreaterThan(initialLensing.displayInfluenceRadius);
    expect(lensing.displayCoreRadius).toBeCloseTo(0.16, 2);
    expect(lensing.displayInfluenceRadius).toBeCloseTo(0.48, 2);
    expect(lensing.displayInfluenceRadius / lensing.displayCoreRadius).toBeGreaterThanOrEqual(3);
    expect(browserErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('un clic sur un nom sélectionne et centre automatiquement l’étoile', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sirius', selected: '', quality: 'low' }));
  await waitForCameraSettled(page);

  const { point } = await waitForLabelCenter(page, 'sirius');

  await page.mouse.move(point.x, point.y);
  await expect(page.locator('canvas.universe-canvas')).toHaveCSS('cursor', 'pointer');
  await page.mouse.click(point.x, point.y);

  await expect.poll(() => queryParameter(page, 'target')).toBe('sirius');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('sirius');
  await expect(page.getByRole('heading', { name: 'Sirius' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('un glisser gauche fait orbiter la caméra autour de la cible active', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  const beforeDrag = await readCameraInteractionState(page);

  expect(beforeDrag.rotateEnabled).toBe(true);
  expect(beforeDrag.panEnabled).toBe(true);

  await page.mouse.move(900, 420);
  await page.mouse.down();
  await page.mouse.move(1_080, 540, { steps: 12 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const current = await readCameraInteractionState(page);

      return vectorDistance(current.position, beforeDrag.position);
    })
    .toBeGreaterThan(0.5);
  const afterDrag = await readCameraInteractionState(page);

  expect(afterDrag.distance).toBeCloseTo(beforeDrag.distance, 3);
  expect(afterDrag.target.x).toBeCloseTo(beforeDrag.target.x, 5);
  expect(afterDrag.target.y).toBeCloseTo(beforeDrag.target.y, 5);
  expect(afterDrag.target.z).toBeCloseTo(beforeDrag.target.z, 5);
  expect(browserErrors).toEqual([]);
});

test('un zoom dans le vide conserve la cible et les gestes orbitaux', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: '', zoom: '2.7' }));

  const zoomButton = page.getByRole('button', { name: 'Zoomer', exact: true });

  const emptyPoint = await findEmptyCanvasPoint(page);

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.wheel(0, -160);
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');

  const focusedState = await readCameraInteractionState(page);

  expect(focusedState.rotateEnabled).toBe(true);
  expect(focusedState.panEnabled).toBe(true);
  expect(focusedState.minDistance).toBeGreaterThanOrEqual(0.75);

  for (let index = 0; index < 3; index += 1) {
    await zoomButton.click();
  }

  await expect
    .poll(() => numericQueryParameter(page, 'zoom'))
    .toBeCloseTo(focusedState.minDistance, 1);
  const beforeDrag = await readCameraInteractionState(page);

  await page.mouse.move(850, 450);
  await page.mouse.down();
  await page.mouse.move(1_050, 570, { steps: 8 });
  await page.mouse.up();

  const afterDrag = await readCameraInteractionState(page);

  expect(vectorDistance(afterDrag.position, beforeDrag.position)).toBeGreaterThan(0.5);
  expect(afterDrag.target.x).toBeCloseTo(beforeDrag.target.x, 5);
  expect(afterDrag.target.y).toBeCloseTo(beforeDrag.target.y, 5);
  expect(afterDrag.target.z).toBeCloseTo(beforeDrag.target.z, 5);

  await openUniverse(page, universeUrl({ target: 'cosmic-web', selected: '', zoom: '599000' }));
  const zoomOutButton = page.getByRole('button', { name: 'Dézoomer', exact: true });

  await zoomOutButton.click();
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(600_000, 0);
  expect((await readCameraInteractionState(page)).maxDistance).toBe(600_000);
  expect(browserErrors).toEqual([]);
});

test('la molette continue de zoomer après la libération de la cible', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  const emptyPoint = await findEmptyCanvasPoint(page);

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();

  const releasedState = await readCameraInteractionState(page);

  expect(releasedState.rotateEnabled).toBe(false);
  expect(releasedState.panEnabled).toBe(false);
  expect(releasedState.minDistance).toBe(0.75);

  for (let index = 0; index < 8; index += 1) {
    const currentEmptyPoint = await findEmptyCanvasPoint(page);

    await page.mouse.move(currentEmptyPoint.x, currentEmptyPoint.y);
    await page.mouse.wheel(0, -120);
  }

  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(releasedState.distance * 0.5);
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  expect(browserErrors).toEqual([]);
});

test('la fiche d’une planète cadre et met en valeur son orbite', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details).toContainText('Période orbitale');
  await expect(details).toContainText('365,26 jours');
  await details.getByRole('button', { name: 'Orbite · Soleil' }).click();

  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(35);
  await expect
    .poll(async () => {
      const state = await readOrbitVisualState(page, 'earth');

      return {
        visible: state.visible,
        active: state.active,
      };
    })
    .toEqual({
      visible: true,
      active: true,
    });
  expect((await readOrbitVisualState(page, 'earth')).opacity).toBeGreaterThan(0.8);

  await openUniverse(page, universeUrl({ target: 'neptune' }));
  await page.getByRole('button', { name: 'Orbite · Soleil' }).click();
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(1_000);
  await expect
    .poll(async () => {
      const state = await readOrbitVisualState(page, 'neptune');

      return {
        visible: state.visible,
        active: state.active,
      };
    })
    .toEqual({
      visible: true,
      active: true,
    });
  expect(browserErrors).toEqual([]);
});

test('les actions de la fiche reviennent de l’orbite vers la rotation de la planète', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await details.getByRole('button', { name: 'Orbite · Soleil' }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(35);

  await details.getByRole('button', { name: 'Voir la rotation' }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(8);
  await expect
    .poll(() => readRotationGuideState(page))
    .toMatchObject({
      visible: true,
      objectId: 'earth',
    });
  expect(browserErrors).toEqual([]);
});

test('le guide axial suit l’objet et distingue une rotation rétrograde', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details).toContainText('Rotation axiale');
  await expect(details).toContainText('23 h 56 min · Prograde');
  await expect(details.getByRole('button', { name: 'Voir la rotation' })).toBeVisible();
  await expect
    .poll(() => readRotationGuideState(page))
    .toEqual({
      visible: true,
      objectId: 'earth',
      direction: 'prograde',
      style: 'moving-highlight',
      parentName: 'earth-body',
      directionScale: 1,
      vertexCount: 82,
      hasVertexColors: true,
    });

  await openUniverse(page, universeUrl({ target: 'venus' }));
  await expect(details).toContainText('243,02 jours · Rétrograde');
  await expect
    .poll(() => readRotationGuideState(page))
    .toEqual({
      visible: true,
      objectId: 'venus',
      direction: 'retrograde',
      style: 'moving-highlight',
      parentName: 'venus-body',
      directionScale: -1,
      vertexCount: 82,
      hasVertexColors: true,
    });
  expect(browserErrors).toEqual([]);
});

test('le sélecteur traverse les sept échelles et partage le cadrage courant', async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors = monitorBrowserErrors(page);
  const tempelCatalogRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/data/structures/tempel-filament-spines.bin')) {
      tempelCatalogRequests.push(request.url());
    }
  });

  await openUniverse(page, universeUrl({ target: 'earth', debug: 'true' }));
  const scaleSwitcher = page.getByRole('button', { name: 'Changer d’échelle' });

  await expect
    .poll(async () => (await readCosmicBackgroundState(page)).detailStrength)
    .toBeLessThan(0.7);
  const planetaryBackground = await readCosmicBackgroundState(page);

  expect(planetaryBackground).toMatchObject({
    triangleCount: 2,
    confidence: 'illustrative',
    transitionDriver: 'continuous-camera-distance',
  });
  expect(tempelCatalogRequests).toEqual([]);
  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Voisinage stellaire' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(1_350);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(1_450);
  await expect(scaleSwitcher).toContainText('Voisinage stellaire');
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('sun')).toBe(true);
  await expect
    .poll(async () => (await readVisibleLabelIds(page)).includes('milky-way'))
    .toBe(false);

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Voie lactée' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(9_500);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(9_700);
  await expect(scaleSwitcher).toContainText('Voie lactée');
  const galacticBackground = await readCosmicBackgroundState(page);

  expect(rgbDistance(galacticBackground.upperColor, planetaryBackground.upperColor)).toBeLessThan(
    0.002,
  );
  expect(Math.max(...galacticBackground.upperColor)).toBeLessThan(0.003);
  expect(galacticBackground.hazeStrength).toBeGreaterThan(planetaryBackground.hazeStrength);
  expect(galacticBackground.nebulaStrength).toBeGreaterThan(planetaryBackground.nebulaStrength);
  expect(galacticBackground.dustStrength).toBeGreaterThan(planetaryBackground.dustStrength);
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('milky-way')).toBe(true);
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('sun')).toBe(false);
  await expect
    .poll(async () => {
      const milkyWay = (await readGalaxyImpostorStates(page)).find(
        (state) => state.objectId === 'milky-way',
      );

      return milkyWay?.visible;
    })
    .toBe(false);

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Groupe local' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('local-group');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(16_900);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(17_100);
  await expect(scaleSwitcher).toContainText('Groupe local');
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('milky-way')).toBe(true);
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('sun')).toBe(false);

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Univers proche' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('nearby-universe');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(119_900);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(120_100);
  await expect(scaleSwitcher).toContainText('Univers proche');
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('milky-way')).toBe(true);
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('sun')).toBe(false);
  await expect
    .poll(() => readSpaceTileStreamingState(page))
    .toMatchObject({
      indexedObjectCount: 720,
      indexedTileCount: 115,
      loadedTileCount: 2,
      cachedTileCount: 2,
    });
  await expect
    .poll(() => readStarCatalogBatchState(page))
    .toMatchObject({
      catalogCount: 10_000,
      visible: false,
    });
  await expect
    .poll(() => readCosmicGroupBatchState(page))
    .toMatchObject({
      catalogCount: 37_730,
      visible: true,
      appearanceConfidence: 'illustrative',
      visualStyle: 'adaptive-unresolved-group-impostors',
    });
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).opacity)
    .toBeGreaterThan(0.15);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).opacity)
    .toBeLessThan(0.151);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).activeCount)
    .toBeGreaterThan(3_500);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).activeCount)
    .toBeLessThan(10_000);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).impostorBlend)
    .toBeGreaterThan(0.99);
  expect((await readCosmicGroupBatchState(page)).filamentVisible).toBe(false);

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Réseau cosmique' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('cosmic-web');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(419_900);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(420_100);
  await expect(scaleSwitcher).toContainText('Réseau cosmique');
  const cosmicBackground = await readCosmicBackgroundState(page);

  expect(rgbDistance(cosmicBackground.lowerColor, galacticBackground.lowerColor)).toBeLessThan(
    0.002,
  );
  expect(Math.max(...cosmicBackground.lowerColor)).toBeLessThan(0.003);
  expect(cosmicBackground.nebulaStrength).toBeGreaterThan(galacticBackground.nebulaStrength);
  expect(cosmicBackground.cameraDistance).toBeGreaterThan(419_000);
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('milky-way')).toBe(true);
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('sun')).toBe(false);
  await expect
    .poll(() => readCosmicGroupBatchState(page))
    .toMatchObject({
      catalogCount: 37_730,
      visible: true,
      confidence: 'calculated',
      batchCount: 1,
      filamentVisible: true,
      filamentConfidence: 'illustrative',
      filamentBatchCount: 1,
      filamentEdgeCount: 49_939,
      layerState: {
        groups: true,
        links: true,
      },
    });
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).impostorBlend)
    .toBeLessThan(0.01);
  await expect
    .poll(() => readCosmicStructureBatchState(page))
    .toMatchObject({
      catalogCount: 26_500,
      sourceCount: 7,
      visible: true,
      confidence: 'calculated',
      batchCount: 1,
      structureCounts: {
        cluster: 1_094,
        supercluster: 8_757,
        filament: 15_421,
        void: 1_228,
      },
      layerState: {
        clusters: true,
        superclusters: true,
        filaments: true,
        voids: true,
      },
    });
  await expect
    .poll(() => readCosmicWebVolumeState(page))
    .toMatchObject({
      visible: true,
      confidence: 'simulated',
      resolution: 128,
      sourceGroupCount: 37_730,
      sourceEdgeCount: 49_939,
      rayMarchSteps: 16,
      batchCount: 1,
    });
  await expect.poll(() => tempelCatalogRequests.length).toBe(1);
  await expect
    .poll(() => readTempelFilamentSpineState(page))
    .toMatchObject({
      loaded: true,
      tileCount: 4,
      filamentCount: 15_421,
      pointCount: 275_599,
      segmentCount: 260_178,
      visibleHaloTileCount: 4,
      haloWidthPixels: 2.4,
      haloConfidence: 'illustrative',
      haloRepresentation: 'screen-space-filament-halo',
      haloPhysicalWidth: false,
      confidence: 'calculated',
      representation: 'published-filament-spine-points',
      selectedObjectId: null,
    });
  await expect
    .poll(async () => (await readCosmicWebVolumeState(page)).opacity)
    .toBeGreaterThan(0.12);
  await expect.poll(async () => (await readCosmicWebVolumeState(page)).opacity).toBeLessThan(0.14);
  const cosmicGroupBatch = await readCosmicGroupBatchState(page);
  const cosmicStructureBatch = await readCosmicStructureBatchState(page);

  expect(cosmicGroupBatch.activeCount).toBeGreaterThan(500);
  expect(cosmicGroupBatch.activeCount).toBeLessThan(5_000);
  expect(cosmicGroupBatch.drawCount).toBe(cosmicGroupBatch.activeCount);
  expect(cosmicStructureBatch.activeCount).toBeGreaterThan(20);
  expect(cosmicStructureBatch.activeCount).toBeLessThan(1_200);
  expect(cosmicStructureBatch.drawCount).toBeLessThan(cosmicStructureBatch.catalogCount);
  expect(cosmicGroupBatch.filamentActiveCount).toBeGreaterThan(0);
  expect(cosmicGroupBatch.filamentActiveCount).toBeLessThan(cosmicGroupBatch.filamentEdgeCount);
  expect(cosmicGroupBatch.filamentDrawCount).toBe(cosmicGroupBatch.filamentActiveCount * 2);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).filamentOpacity)
    .toBeGreaterThan(0.21);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).filamentOpacity)
    .toBeLessThan(0.23);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).filamentDetail)
    .toBeGreaterThan(0.11);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).filamentDetail)
    .toBeLessThan(0.13);
  await expect(page.getByLabel('Légende du réseau cosmique')).toBeVisible();
  await expect(page.getByLabel('Légende du réseau cosmique')).toContainText(
    '26 500 détections · 7 catalogues',
  );
  await expect(page.getByLabel('Légende du réseau cosmique')).toContainText(
    'Cliquez une épine pour l’identifier · recherche facultative',
  );
  await expect(page.getByLabel('Légende du réseau cosmique')).toContainText(
    'Vides BOSS · actifs · centres et rayons catalogués',
  );
  const volumeLayer = page.getByRole('button', { name: /la matière cosmique simulée/ });
  const voidLayer = page.getByRole('button', { name: /les vides BOSS/ });
  const filamentSpineLayer = page.getByRole('button', {
    name: /les épines 3D des filaments Tempel/,
  });

  await expect(volumeLayer).toHaveAttribute('aria-pressed', 'true');
  await expect(filamentSpineLayer).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await readTempelFilamentSpineState(page)).visibleTileCount)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await readTempelFilamentSpineState(page)).visibleSegmentCount)
    .toBeGreaterThan(10_000);
  const visibleSpineState = await readTempelFilamentSpineState(page);

  expect(visibleSpineState.haloSegmentCount).toBe(visibleSpineState.visibleSegmentCount);
  expect(visibleSpineState.haloOpacity).toBeGreaterThan(0.05);
  expect(visibleSpineState.haloOpacity).toBeLessThan(0.2);
  const visibleFilament = await findTempelFilamentSegmentPoint(page);

  expect(visibleFilament).not.toBeNull();
  if (visibleFilament) {
    await page.mouse.click(visibleFilament.point.x, visibleFilament.point.y);
    await expect.poll(() => queryParameter(page, 'selected')).toBe(visibleFilament.objectId);
  }
  await filamentSpineLayer.click();
  await expect(filamentSpineLayer).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(async () => (await readTempelFilamentSpineState(page)).visibleTileCount)
    .toBe(0);
  expect((await readTempelFilamentSpineState(page)).visibleHaloTileCount).toBe(0);
  await filamentSpineLayer.click();
  await expect(filamentSpineLayer).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await readTempelFilamentSpineState(page)).visibleSegmentCount)
    .toBeGreaterThan(0);
  expect((await readTempelFilamentSpineState(page)).visibleSegmentCount).toBeLessThan(260_178);
  await volumeLayer.click();
  await expect(volumeLayer).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await readCosmicWebVolumeState(page)).visible).toBe(false);
  await volumeLayer.click();
  await expect(volumeLayer).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readCosmicWebVolumeState(page)).visible).toBe(true);
  await expect(voidLayer).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => readCosmicStructureBatchState(page))
    .toMatchObject({
      activeVoidCount: expect.any(Number),
      voidRepresentation: 'adaptive-catalog-underdensity-volume',
      voidBoundaryStyle: 'diffuse-fill-without-ring',
      layerState: { voids: true },
    });
  await expect
    .poll(async () => (await readCosmicStructureBatchState(page)).activeVoidCount)
    .toBeGreaterThan(200);
  await voidLayer.click();
  await expect(voidLayer).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(async () => (await readCosmicStructureBatchState(page)).activeVoidCount)
    .toBe(0);
  await voidLayer.click();
  await expect(voidLayer).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await readCosmicStructureBatchState(page)).activeVoidCount)
    .toBeGreaterThan(200);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).opacity)
    .toBeGreaterThan(0.57);
  await expect.poll(async () => (await readCosmicGroupBatchState(page)).opacity).toBeLessThan(0.59);
  await expect
    .poll(
      async () =>
        (await readVisibleLabelIds(page)).filter(
          (objectId) => objectId.startsWith('cf4-pgc-') || objectId.startsWith('lss-'),
        ).length,
    )
    .toBeGreaterThanOrEqual(8);
  await expect(page.getByLabel('Statistiques de débogage')).toContainText('Groupes Cosmicflows-4');

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Planétaire' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(5);
  await expect(scaleSwitcher).toContainText('Planétaire');
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('sun')).toBe(true);
  await expect
    .poll(async () => (await readVisibleLabelIds(page)).includes('milky-way'))
    .toBe(false);
  await expect
    .poll(async () => {
      const detail = await readMilkyWayDetailState(page);

      return detail.visible || detail.opacity > 0.004;
    })
    .toBe(false);
  await expect
    .poll(async () => {
      const impostor = (await readGalaxyImpostorStates(page)).find(
        (state) => state.objectId === 'milky-way',
      );

      return impostor?.visible;
    })
    .toBe(false);
  await expect
    .poll(() => readStarCatalogBatchState(page))
    .toMatchObject({
      catalogCount: 10_000,
      drawCount: 10_000,
      visible: true,
      confidence: 'observed',
      batchCount: 1,
    });
  await expect.poll(async () => (await readSpaceTileStreamingState(page)).loadedTileCount).toBe(0);
  await expect.poll(async () => (await readCosmicGroupBatchState(page)).visible).toBe(false);
  await expect.poll(async () => (await readCosmicStructureBatchState(page)).visible).toBe(false);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).opacity)
    .toBeLessThan(0.004);
  await expect
    .poll(async () =>
      rgbDistance(
        (await readCosmicBackgroundState(page)).upperColor,
        planetaryBackground.upperColor,
      ),
    )
    .toBeLessThan(0.002);
  expect(browserErrors).toEqual([]);
});

test('la recherche Planck centre une détection d’amas et conserve sa provenance', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'cosmic-web',
      selected: '',
      quality: 'low',
      zoom: '420000',
      debug: 'true',
    }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('PSZ2 G000.04+45.13');
  await page
    .getByRole('option', {
      name: /Amas Planck PSZ2 G000\.04\+45\.13 Groupe de galaxies · Réseau cosmique/,
    })
    .click();
  await waitForCameraSettled(page, 40_000);

  const objectId = 'lss-planck-psz2-clusters-psz2-g000-04-45-13';

  await expect.poll(() => queryParameter(page, 'target')).toBe(objectId);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(objectId);
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(
    details.getByRole('heading', { name: 'Amas Planck PSZ2 G000.04+45.13' }),
  ).toBeVisible();
  await expect(details).toContainText('Calculé');
  await expect(details).toContainText('498,935 Mpc');
  await expect(details).toContainText('PSZ2 G000.04+45.13');
  await expect(details).toContainText('93,9 %');
  await expect(details).toContainText('Sunyaev-Zeldovich');
  await expect(details).toContainText('Planck Collaboration (2016)');
  await expect(details).not.toContainText('Rayon effectif');
  await expect(details).not.toContainText('Galaxies associées');
  await expect
    .poll(() => readCosmicStructureBatchState(page))
    .toMatchObject({
      catalogCount: 26_500,
      visible: true,
      confidence: 'calculated',
      batchCount: 1,
      selectedObjectId: objectId,
    });
  await expect(page.getByLabel('Statistiques de débogage')).toContainText('Structures documentées');
  expect(browserErrors).toEqual([]);
});

test('la recherche Tempel centre un filament et surligne toute son épine publiée', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'cosmic-web',
      selected: '',
      quality: 'low',
      zoom: '420000',
      debug: 'true',
    }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Filament SDSS F1');
  await page
    .getByRole('option', {
      name: /Filament SDSS F1 Filament cosmique · Réseau cosmique/,
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  const objectId = 'lss-sdss-dr8-tempel-filaments-f1';

  await expect.poll(() => queryParameter(page, 'target')).toBe(objectId);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(objectId);
  await expect
    .poll(() => readTempelFilamentSpineState(page))
    .toMatchObject({
      loaded: true,
      filamentCount: 15_421,
      pointCount: 275_599,
      segmentCount: 260_178,
      confidence: 'calculated',
      representation: 'published-filament-spine-points',
      selectedObjectId: objectId,
      selectedHaloObjectId: objectId,
    });
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Filament SDSS F1' })).toBeVisible();
  await expect(details).toContainText('Calculé');
  await expect(details).toContainText('Tempel et al. (2014)');
  await expect(details).toContainText('épine publiée peut être affichée point par point');
  expect(browserErrors).toEqual([]);
});

test('la recherche PGC centre un groupe Cosmicflows-4 et expose sa provenance scientifique', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'cosmic-web',
      selected: '',
      quality: 'low',
      zoom: '420000',
      debug: 'true',
    }),
  );
  const debugPanel = page.getByLabel('Statistiques de débogage');

  await expect(debugPanel).toContainText('Groupes Cosmicflows-4');
  await expect(debugPanel).toContainText('Groupes Cosmicflows-4');
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('PGC 12');
  await page
    .getByRole('option', {
      name: /Groupe PGC 12 Groupe de galaxies · Réseau cosmique/,
    })
    .click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('cf4-pgc-12');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('cf4-pgc-12');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(219_900);
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Groupe PGC 12' })).toBeVisible();
  await expect(details).toContainText('Calculé');
  await expect(details).toContainText('99,8 Mpc');
  await expect(details).toContainText('PGC 12');
  await expect(details).toContainText('± 0,41 mag');
  await expect(details).toContainText(/6.179 km\/s/);
  await expect(details).toContainText('Cosmicflows-4 · Tully et al. (2023)');
  await expect
    .poll(() => readCosmicGroupBatchState(page))
    .toMatchObject({
      catalogCount: 37_730,
      visible: true,
      confidence: 'calculated',
      batchCount: 1,
      selectedObjectId: 'cf4-pgc-12',
    });
  await expect(debugPanel).toContainText('Groupes Cosmicflows-4');
  expect(browserErrors).toEqual([]);
});

test('la recherche centre les lunes majeures et les petits corps documentés', async ({ page }) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'jupiter', selected: '', quality: 'low' }));
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Europa');
  await page
    .getByRole('option', {
      name: 'Europe Lune · Jupiter',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('europa');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('europa');
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Europe' })).toBeVisible();
  await expect(details).toContainText('Calculé');
  await expect(details).toContainText(/671.100 km/u);
  await expect(details).toContainText('3,53 jours');
  await expect(details).toContainText('NASA/JPL JUP365');

  await details.getByRole('button', { name: 'Orbite · Jupiter' }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('jupiter');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('europa');
  await expect
    .poll(async () => {
      const state = await readOrbitVisualState(page, 'europa');

      return { visible: state.visible, active: state.active };
    })
    .toEqual({ visible: true, active: true });

  await search.fill('1P/Halley');
  await page
    .getByRole('option', {
      name: 'Comète de Halley Comète · Soleil',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('halley');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('halley');
  await expect(details.getByRole('heading', { name: 'Comète de Halley' })).toBeVisible();
  await expect(details).toContainText('Extrapolé');
  await expect(details).toContainText('17,9 UA');
  await expect(details.locator('.approximation-note')).toBeVisible();
  await expect(details).toContainText('NASA/JPL Small-Body Database');

  await page.reload();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('halley');
  await expect(details.getByRole('heading', { name: 'Comète de Halley' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('le streaming galactique augmente son budget avec la qualité graphique', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'nearby-universe',
      selected: '',
      quality: 'high',
      zoom: '120000',
    }),
  );
  await expect
    .poll(() => readSpaceTileStreamingState(page))
    .toMatchObject({
      indexedObjectCount: 720,
      indexedTileCount: 115,
      loadedTileCount: 5,
    });
  await expect
    .poll(async () => {
      const state = await readSpaceTileStreamingState(page);

      return state.cachedTileCount >= state.loadedTileCount;
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const state = await readNearbyGalaxyBatchState(page);

      return {
        batchCount: state.batchCount,
        catalogCount: state.catalogObjectIds.length,
        visibleCatalogCount: state.visibleCatalogObjectIds.length,
      };
    })
    .toEqual({
      batchCount: 1,
      catalogCount: expect.any(Number),
      visibleCatalogCount: expect.any(Number),
    });
  await expect.poll(() => readCosmicGroupBatchState(page)).toMatchObject({ visible: true });
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).opacity)
    .toBeGreaterThan(0.15);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).opacity)
    .toBeLessThan(0.151);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).activeCount)
    .toBeGreaterThan(7_000);
  await expect
    .poll(async () => (await readCosmicGroupBatchState(page)).activeCount)
    .toBeLessThan(10_000);
  const batch = await readNearbyGalaxyBatchState(page);

  expect(batch.catalogObjectIds.length).toBeGreaterThan(0);
  expect(batch.visibleCatalogObjectIds.length).toBeGreaterThan(0);
  expect(browserErrors).toEqual([]);
});

test('la molette effectue Terre → Réseau cosmique → Terre sans perdre son ancre', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);

  for (const [expectedDistance, expectedTarget] of [
    [520, 'sun'],
    [1_400, 'sun'],
    [9_600, 'milky-way'],
    [17_000, 'local-group'],
    [120_000, 'nearby-universe'],
    [420_000, 'cosmic-web'],
  ] as const) {
    await page.mouse.wheel(0, 480);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 0);
    await expect.poll(() => queryParameter(page, 'target')).toBe(expectedTarget);
  }

  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText(
    'Réseau cosmique',
  );
  await expect.poll(() => queryParameter(page, 'target')).toBe('cosmic-web');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(420_000, 0);

  for (const [expectedDistance, expectedTarget] of [
    [120_000, 'nearby-universe'],
    [17_000, 'local-group'],
    [9_600, 'milky-way'],
    [1_400, 'sun'],
    [520, 'sun'],
    [4.8, 'earth'],
  ] as const) {
    const emptyPoint = await findEmptyCanvasPoint(page);

    await page.mouse.move(emptyPoint.x, emptyPoint.y);
    await page.mouse.wheel(0, -480);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 1);
    await expect.poll(() => queryParameter(page, 'target')).toBe(expectedTarget);
  }

  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText('Planétaire');
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(4.8, 1);
  expect((await readNavigationAlignmentState(page)).targetError).toBeLessThan(0.001);
  expect(browserErrors).toEqual([]);
});

test('un aller-retour hors axe depuis une étoile traverse ses référentiels sans la perdre', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'hyg-98417',
      selected: 'hyg-98417',
      quality: 'low',
      zoom: '1.15',
      debug: 'true',
    }),
  );
  const emptyPoint = await findEmptyCanvasPoint(page);
  const canvasBounds = await page.locator('canvas.universe-canvas').boundingBox();

  expect(canvasBounds).not.toBeNull();
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  for (const [expectedDistance, expectedTarget] of [
    [4.8, 'hyg-98417'],
    [520, 'hyg-98417'],
    [1_400, 'hyg-98417'],
    [9_600, 'milky-way'],
    [17_000, 'local-group'],
    [120_000, 'nearby-universe'],
    [420_000, 'cosmic-web'],
  ] as const) {
    await page.mouse.wheel(0, 480);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 0);
    await expect.poll(() => queryParameter(page, 'target')).toBe(expectedTarget);
  }

  await expect.poll(() => queryParameter(page, 'target')).toBe('cosmic-web');
  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText(
    'Réseau cosmique',
  );
  expect((await readNavigationAlignmentState(page)).targetError).toBeLessThan(0.001);
  const milkyWayPoint = await readObjectScreenPoint(page, 'milky-way');

  expect(milkyWayPoint.x).toBeGreaterThan(canvasBounds!.x);
  expect(milkyWayPoint.x).toBeLessThan(canvasBounds!.x + canvasBounds!.width);
  expect(milkyWayPoint.y).toBeGreaterThan(canvasBounds!.y);
  expect(milkyWayPoint.y).toBeLessThan(canvasBounds!.y + canvasBounds!.height);

  for (const [expectedDistance, expectedTarget] of [
    [120_000, 'nearby-universe'],
    [17_000, 'local-group'],
    [9_600, 'milky-way'],
    [1_400, 'hyg-98417'],
    [520, 'hyg-98417'],
    [4.8, 'hyg-98417'],
    [1.15, 'hyg-98417'],
  ] as const) {
    await page.mouse.wheel(0, -480);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 1);
    await expect.poll(() => queryParameter(page, 'target')).toBe(expectedTarget);
  }

  expect(browserErrors).toEqual([]);
});

test('une recherche charge à la demande une galaxie externe puis restaure son URL', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', quality: 'high' }));
  await expect
    .poll(() => readSpaceTileStreamingState(page))
    .toMatchObject({
      indexedObjectCount: 720,
      loadedTileCount: 0,
      loadedObjectIds: [],
    });

  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('M81');
  await page
    .getByRole('option', {
      name: 'Galaxie de Bode Galaxie · Univers proche',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('bodes-galaxy');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('bodes-galaxy');
  await expect
    .poll(() => readSpaceTileStreamingState(page))
    .toMatchObject({
      loadedTileCount: 1,
      loadedObjectIds: ['bodes-galaxy', 'cigar-galaxy', 'ngc-2403', 'ngc-3077'],
    });

  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Galaxie de Bode' })).toBeVisible();
  await expect(details).toContainText('3,63 Mpc');
  await expect(details).toContainText('Observé');

  await page.reload();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('bodes-galaxy');
  await expect(details.getByRole('heading', { name: 'Galaxie de Bode' })).toBeVisible();
  await expect.poll(async () => (await readSpaceTileStreamingState(page)).loadedTileCount).toBe(1);

  await search.fill('IC 342');
  await page
    .getByRole('option', {
      name: 'IC 342 Galaxie · Univers proche',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('lv-ic0342');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('lv-ic0342');
  await expect(details.getByRole('heading', { name: 'IC 342' })).toBeVisible();
  await expect(details).toContainText('3,28 Mpc');
  await expect
    .poll(async () => (await readSpaceTileStreamingState(page)).loadedObjectIds)
    .toContain('lv-ic0342');
  await expect
    .poll(async () => (await readNearbyGalaxyBatchState(page)).catalogObjectIds)
    .toContain('lv-ic0342');
  await expect
    .poll(async () => (await readNearbyGalaxyBatchState(page)).visibleCatalogObjectIds)
    .not.toContain('lv-ic0342');
  await expect.poll(async () => (await readLocalGalacticSkyState(page)).bandVisible).toBe(false);
  await expect
    .poll(async () => {
      const impostor = (await readGalaxyImpostorStates(page)).find(
        (state) => state.objectId === 'lv-ic0342',
      );

      return Boolean(impostor?.visible || impostor?.nearVisible);
    })
    .toBe(true);
  expect(browserErrors).toEqual([]);
});

test('la molette entre dans la Voie lactée sans traverser son disque ni dupliquer son rendu', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'local-group',
      selected: 'milky-way',
      quality: 'high',
      zoom: '17000',
    }),
  );
  const scaleSwitcher = page.getByRole('button', { name: 'Changer d’échelle' });

  await expect(scaleSwitcher).toContainText('Groupe local');
  await expect.poll(async () => (await readMilkyWayDetailState(page)).visible).toBe(false);
  await expect
    .poll(async () => {
      const impostor = (await readGalaxyImpostorStates(page)).find(
        (state) => state.objectId === 'milky-way',
      );

      return impostor?.visible;
    })
    .toBe(true);

  const milkyWayLabel = await waitForLabelCenter(page, 'milky-way');

  await page.mouse.move(milkyWayLabel.point.x, milkyWayLabel.point.y);
  await page.mouse.wheel(0, -480);
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  await expect(scaleSwitcher).toContainText('Voie lactée');
  await expect
    .poll(async () => {
      const volume = await readMilkyWayVolumeState(page);

      return volume.atlasStatus === 'ready' && volume.visible && volume.opacity > 0.1;
    })
    .toBe(true);
  await expect.poll(async () => (await readMilkyWayDetailState(page)).visible).toBe(false);
  await expect
    .poll(async () => {
      const impostor = (await readGalaxyImpostorStates(page)).find(
        (state) => state.objectId === 'milky-way',
      );

      return impostor?.visible;
    })
    .toBe(false);

  const galacticCamera = await readCameraInteractionState(page);
  const galacticDetail = await readMilkyWayDetailState(page);

  expect(galacticDetail.spiralAuraCount).toBe(0);
  expect(galacticDetail.visualStructure).toBe('illustrative-galactocentric-four-arm-disk');
  expect(galacticDetail.structureOrigin).toBe('galactic-center');
  expect(galacticDetail.spiralArmCount).toBe(4);
  expect(galacticDetail.spiralPitchDegrees).toBeCloseTo(13, 6);
  expect(galacticDetail.sunDistanceFromGalacticCenter).toBeGreaterThan(2_000);
  expect(galacticDetail.stellarOriginDistanceFromSun).toBeLessThan(0.01);
  expect(galacticDetail.stellarNeighborhoodScale).toBeLessThan(0.3);
  expect(galacticCamera.distance).toBeGreaterThan(galacticDetail.radius);
  expect(galacticCamera.distance).toBeLessThan(17_000);

  await page.mouse.wheel(0, -480);
  await page.mouse.wheel(0, -480);
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect(scaleSwitcher).toContainText('Voisinage stellaire');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(2_400);
  await expect.poll(() => queryParameter(page, 'selected')).toBe('milky-way');
  await expect.poll(async () => (await readMilkyWayDetailState(page)).visible).toBe(false);
  await expect
    .poll(async () => (await readMilkyWayDetailState(page)).stellarNeighborhoodScale)
    .toBeGreaterThan(0.8);
  await expect
    .poll(async () => {
      const impostor = (await readGalaxyImpostorStates(page)).find(
        (state) => state.objectId === 'milky-way',
      );

      return impostor?.visible;
    })
    .toBe(false);

  await page.mouse.wheel(0, 480);
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  await expect(scaleSwitcher).toContainText('Voie lactée');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(9_600, 0);
  expect((await readCameraInteractionState(page)).distance).toBeGreaterThan(
    (await readMilkyWayDetailState(page)).radius,
  );

  await page.mouse.wheel(0, 480);
  await expect.poll(() => queryParameter(page, 'target')).toBe('local-group');
  await expect(scaleSwitcher).toContainText('Groupe local');
  await expect.poll(async () => (await readMilkyWayDetailState(page)).visible).toBe(false);
  await expect
    .poll(async () => {
      const impostor = (await readGalaxyImpostorStates(page)).find(
        (state) => state.objectId === 'milky-way',
      );

      return impostor?.visible;
    })
    .toBe(true);
  expect(browserErrors).toEqual([]);
});

test('la transition Voie lactée–Groupe local conserve une profondeur visible à son point critique', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'local-group', selected: '', quality: 'high', zoom: '14500' }),
  );
  await expect
    .poll(async () => (await readMilkyWayVolumeState(page)).opacity)
    .toBeGreaterThan(0.15);
  await expect
    .poll(async () => (await readLocalVolumeDepthBackdropState(page)).opacity)
    .toBeGreaterThan(0.3);
  const volume = await readMilkyWayVolumeState(page);
  const backdrop = await readLocalVolumeDepthBackdropState(page);

  expect(volume.visible).toBe(true);
  expect(volume.opacity).toBeGreaterThan(0.15);
  expect(volume.scale).toBeGreaterThan(0.28);
  expect(backdrop.visible).toBe(true);
  expect(backdrop.opacity).toBeGreaterThan(0.3);
  expect(backdrop.activeCount).toBe(backdrop.drawCount);
  expect(backdrop.drawCount).toBeGreaterThan(16_500);
  expect(backdrop.minimumRadius).toBeGreaterThanOrEqual(23_999);
  expect(backdrop.maximumRadius).toBeLessThanOrEqual(56_001);
  expect(backdrop.depthProjection).toBe('catalog-direction-preserving-radial-compression');
  expect(browserErrors).toEqual([]);
});

test('le zoom vers une galaxie décentrée conserve son point sous le curseur', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'local-group',
      selected: '',
      quality: 'high',
      zoom: '17000',
      debug: 'true',
    }),
  );
  const canvas = page.locator('canvas.universe-canvas');
  const debugPanel = page.getByLabel('Statistiques de débogage');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.wheel(0, 480);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(120_000, 0);
  await page.mouse.wheel(0, 480);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(420_000, 0);
  await page.mouse.wheel(0, 480);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(600_000, 0);
  await expect(debugPanel).toContainText('limite maximale');

  await openUniverse(
    page,
    universeUrl({
      target: 'local-group',
      selected: '',
      quality: 'high',
      zoom: '17000',
      debug: 'true',
    }),
  );
  const label = await waitForLabelCenter(page, 'andromeda');
  const beforePoint = await readObjectScreenPoint(page, 'andromeda');
  const beforeCamera = await readCameraInteractionState(page);

  expect(Math.hypot(beforePoint.x - 720, beforePoint.y - 450)).toBeGreaterThan(40);

  await page.mouse.move(label.point.x, label.point.y);
  await page.mouse.wheel(0, -480);
  await expect.poll(() => queryParameter(page, 'target')).toBe('andromeda');

  const afterPoint = await readObjectScreenPoint(page, 'andromeda');
  const afterCamera = await readCameraInteractionState(page);

  expect(Math.hypot(afterPoint.x - beforePoint.x, afterPoint.y - beforePoint.y)).toBeLessThan(2);
  expect(afterCamera.distance).toBeLessThan(beforeCamera.distance);

  await expect(debugPanel).toContainText('andromeda');
  await expect(debugPanel).toContainText('appliqué');
  expect(browserErrors).toEqual([]);
});

test('le Groupe local affiche des galaxies nommées, sélectionnables et partageables', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'local-group', selected: '', quality: 'high', zoom: '17000' }),
  );
  const scaleSwitcher = page.getByRole('button', { name: 'Changer d’échelle' });

  await expect(scaleSwitcher).toContainText('Groupe local');
  await expect
    .poll(
      async () => (await readGalaxyImpostorStates(page)).filter((state) => state.visible).length,
    )
    .toBeGreaterThanOrEqual(30);
  await expect
    .poll(
      async () => (await readVisibleLabelIds(page)).filter((id) => !id.startsWith('hyg-')).length,
    )
    .toBeGreaterThanOrEqual(14);
  const andromedaState = (await readGalaxyImpostorStates(page)).find(
    (state) => state.objectId === 'andromeda',
  );

  expect(andromedaState).toBeDefined();
  expect(andromedaState?.pickable).toBe(true);
  expect(andromedaState?.width ?? 0).toBeGreaterThan(andromedaState?.height ?? 0);

  const label = await waitForLabelCenter(page, 'andromeda');

  await page.mouse.click(label.point.x, label.point.y);
  await expect.poll(() => queryParameter(page, 'target')).toBe('andromeda');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('andromeda');
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Andromède' })).toBeVisible();
  await expect(details).toContainText('Galaxie spirale SA(s)b');
  await expect(details).toContainText('2 553 801 a.l.');
  await expect
    .poll(async () => {
      const state = (await readGalaxyImpostorStates(page)).find(
        ({ objectId }) => objectId === 'andromeda',
      );

      return state
        ? {
            farVisible: state.visible,
            farVisualStyle: state.farVisualStyle,
            nearVisible: state.nearVisible,
            nearDiskVisible: state.nearDiskVisible,
            nearDiskStyle: state.nearDiskStyle,
            nearStarFieldVisible: state.nearStarFieldVisible,
            nearStarFieldStyle: state.nearStarFieldStyle,
            nearParticleCount: state.nearParticleCount,
          }
        : null;
    })
    .toEqual({
      farVisible: false,
      farVisualStyle: 'structured-galaxy-impostor',
      nearVisible: true,
      nearDiskVisible: true,
      nearDiskStyle: 'procedural-structured-galaxy-disk',
      nearStarFieldVisible: true,
      nearStarFieldStyle: 'volumetric-galaxy-star-field',
      nearParticleCount: 2_200,
    });
  expect(browserErrors).toEqual([]);
});

test('un satellite galactique conserve son sous-groupe, sa fiche et son URL', async ({ page }) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'andromeda', selected: '', quality: 'high', zoom: '2800' }),
  );
  await expect
    .poll(async () => {
      const states = await readGalaxyImpostorStates(page);
      const visibleIds = new Set(
        states.filter(({ visible }) => visible).map(({ objectId }) => objectId),
      );

      return {
        host: visibleIds.has('andromeda'),
        satellite: visibleIds.has('andromeda-i'),
        sibling: visibleIds.has('m32'),
        unrelated: visibleIds.has('large-magellanic-cloud'),
      };
    })
    .toEqual({
      host: true,
      satellite: true,
      sibling: true,
      unrelated: false,
    });

  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Andromeda I');
  await page
    .getByRole('option', {
      name: 'Andromède I Galaxie · Andromède',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(page.getByRole('heading', { name: 'Andromède I' })).toBeVisible();
  await expect(details).toContainText('Sous-groupe d’Andromède');
  await expect(details).toContainText('Magnitude absolue');
  await expect(details).toContainText('Rayon de demi-lumière');
  await expect.poll(() => queryParameter(page, 'target')).toBe('andromeda-i');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('andromeda-i');

  await page.reload();
  await waitForCameraSettled(page);
  await expect(page.getByRole('heading', { name: 'Andromède I' })).toBeVisible();
  await expect.poll(() => queryParameter(page, 'target')).toBe('andromeda-i');
  expect(browserErrors).toEqual([]);
});

test('le catalogue HYG complet reste un batch GPU unique à toutes les qualités', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', quality: 'high', zoom: '1400' }),
  );
  await expect
    .poll(() => readStarCatalogBatchState(page))
    .toEqual({
      catalogCount: 10_000,
      drawCount: 10_000,
      visible: true,
      confidence: 'observed',
      batchCount: 1,
      selectedObjectId: null,
    });

  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click();
  await page.getByRole('button', { name: 'Faible', exact: true }).click();
  await expect
    .poll(() => readStarCatalogBatchState(page))
    .toEqual({
      catalogCount: 10_000,
      drawCount: 10_000,
      visible: true,
      confidence: 'observed',
      batchCount: 1,
      selectedObjectId: null,
    });

  await openUniverse(
    page,
    universeUrl({ target: 'earth', selected: '', quality: 'low', zoom: '4.8' }),
  );
  await expect
    .poll(() => readStarCatalogBatchState(page))
    .toEqual({
      catalogCount: 10_000,
      drawCount: 10_000,
      visible: true,
      confidence: 'observed',
      batchCount: 1,
      selectedObjectId: null,
    });
  await expect.poll(async () => (await readLocalGalacticSkyState(page)).bandVisible).toBe(true);
  await expect
    .poll(async () => (await readLocalGalacticSkyState(page)).panoramaStatus)
    .toBe('ready');
  expect(await readLocalGalacticSkyState(page)).toMatchObject({
    environmentVisible: true,
    bandVisible: true,
    drawMeshCount: 1,
    maximumDrawMeshCount: 3,
    panoramaStatus: 'ready',
    panoramaUrl: '/textures/milky-way-eso-band-8k-v3.webp',
    panoramaWidth: 8_192,
    panoramaHeight: 1_024,
    angularPresentation: 'distant-thin-sky-band',
    sourceCredit: 'ESO/S. Brunier',
    sourceImageId: 'ESO-ESO0932A',
    sourcePageUrl: 'https://www.eso.org/public/images/eso0932a/',
    sourcePixelDimensions: [6_000, 3_000],
    texturePixelDimensions: [8_192, 1_024],
    sourceAngularLatitudeSpanDegrees: 60,
    angularLatitudeSpanDegrees: 32,
    latitudePresentationScale: 32 / 60,
    sourceProjection: 'full-sky-panorama-galactic-plane-horizontal',
    presentationPitchDegrees: -32,
    presentationRollDegrees: -6.5,
    presentationComposition: 'diagonal-cinematic-sky',
    orientationConfidence: 'illustrative',
    confidence: 'illustrative',
    referenceFrame: 'galactic-heliocentric',
    visualStyle: 'inside-milky-way-panoramic-band',
    galacticCenterDirection: [-1, 0, 0],
    visualLayers: ['integrated-starlight', 'central-bulge', 'dust-rifts', 'star-forming-clouds'],
    depthTest: false,
  });
  expect((await readLocalGalacticSkyState(page)).opacity).toBeGreaterThan(0.12);
  expect(browserErrors).toEqual([]);
});

test('les catalogues héliocentriques restent un fond discret près des objets éloignés', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'earth', selected: '', quality: 'high', zoom: '4.8' }),
  );
  await expect
    .poll(
      async () =>
        (await readHeliocentricCatalogPresentationState(page)).exoplanetHosts.hostSignatureStrength,
    )
    .toBeLessThan(0.004);
  await expect
    .poll(
      async () => (await readHeliocentricCatalogPresentationState(page)).exoplanetHosts.pointScale,
    )
    .toBeCloseTo(0.62, 2);

  await openUniverse(
    page,
    universeUrl({
      target: 'kepler-22',
      selected: 'kepler-22',
      quality: 'high',
      zoom: '22',
    }),
  );
  await waitForCameraSettled(page);
  await expect(page.getByRole('heading', { name: 'Kepler-22' })).toBeVisible();
  await expect
    .poll(async () => (await readHeliocentricCatalogPresentationState(page)).hyg.visible)
    .toBe(false);
  const remote = await readHeliocentricCatalogPresentationState(page);

  expect(remote.hyg.observerBoundaryOpacity).toBe(0);
  expect(remote.exoplanetHosts.hostSignatureStrength).toBeLessThan(0.004);
  expect(remote.exoplanetHosts.observerBoundaryOpacity).toBeLessThan(0.7);
  expect(remote.exoplanetHosts.opacity).toBeLessThan(0.3);
  expect(browserErrors).toEqual([]);
});

test('la Voie lactée volumique remplace l’amas artificiel du catalogue local', async ({ page }) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'milky-way',
      selected: '',
      quality: 'high',
      zoom: '9600',
    }),
  );
  await expect
    .poll(async () => (await readStarClusterBatchState(page)).activeTileCount)
    .toBeGreaterThan(0);
  const detailed = await readStarClusterBatchState(page);

  await expect.poll(async () => (await readMilkyWayVolumeState(page)).atlasStatus).toBe('ready');
  await expect.poll(async () => (await readMilkyWayDetailState(page)).visible).toBe(false);
  const volume = await readMilkyWayVolumeState(page);
  const legacyDetail = await readMilkyWayDetailState(page);
  const localSky = await readLocalGalacticSkyState(page);

  expect(detailed.cachedPackCount).toBeGreaterThan(0);
  expect(detailed.cachedTileCount).toBeGreaterThanOrEqual(detailed.activeTileCount);
  expect(detailed.activeClusterCount).toBeGreaterThan(0);
  expect(detailed.cachedClusterCount).toBeGreaterThanOrEqual(detailed.activeClusterCount);
  expect(detailed.visibleClusterCount).toBe(0);
  expect(detailed.pointBatchCount).toBeLessThanOrEqual(2);
  expect(detailed.visibleLodLevels).toEqual([]);
  expect(volume).toMatchObject({
    visible: true,
    atlasUrl: '/textures/milky-way-emissive-1254-v2.jpg',
    structure: 'asymmetric-continuous-four-arm-galactic-disc',
    depthTechnique: 'domain-warped-atlas-parallax-with-dust-rifts',
    morphologyModel: 'barred-spiral-with-two-major-and-two-minor-arms',
    confidence: 'illustrative',
    cinematicQuality: 'high',
    drawMeshCount: 4,
    visibleDiscLayerCount: 3,
  });
  expect(volume.layerDepthSpan).toBeGreaterThanOrEqual(164);
  expect(volume.bulgeHeight).toBeGreaterThan(600);
  expect(volume.parallaxStrength).toBeGreaterThan(0);
  expect(volume.dustAbsorption).toBeGreaterThan(volume.glowStrength);
  expect(legacyDetail.visible).toBe(false);
  expect(legacyDetail.opacity).toBeLessThan(0.004);
  expect(localSky.bandVisible).toBe(false);
  expect(localSky.opacity).toBeLessThan(0.004);

  const scaleSwitcher = page.getByRole('button', { name: 'Changer d’échelle' });

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Groupe local' }).click();
  await waitForCameraSettled(page);
  await expect
    .poll(async () => (await readStarClusterBatchState(page)).visibleLodLevels)
    .toEqual([]);
  const overview = await readStarClusterBatchState(page);

  expect(overview.activeTileCount).toBeGreaterThan(0);
  expect(overview.cachedPackCount).toBeGreaterThanOrEqual(detailed.cachedPackCount);
  expect(overview.visibleClusterCount).toBe(0);
  expect(overview.pointBatchCount).toBe(1);
  expect(overview.confidence).toBe('calculated');
  await expect.poll(async () => (await readStarCatalogBatchState(page)).visible).toBe(false);

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Voisinage stellaire' }).click();
  await waitForCameraSettled(page);
  await expect.poll(async () => (await readStarClusterBatchState(page)).activeTileCount).toBe(0);
  await expect
    .poll(async () => (await readStarClusterBatchState(page)).visibleClusterCount)
    .toBe(0);
  const exact = await readStarClusterBatchState(page);

  expect(exact.cachedPackCount).toBeGreaterThan(0);
  expect(exact.representationCount).toBe(0);
  expect(exact.visibleLodLevels).toEqual([]);
  await expect.poll(async () => (await readStarCatalogBatchState(page)).visible).toBe(true);
  await expect.poll(async () => (await readLocalGalacticSkyState(page)).bandVisible).toBe(true);
  expect((await readLocalGalacticSkyState(page)).opacity).toBeGreaterThan(0.3);
  expect(browserErrors).toEqual([]);
});

test('la molette ne verrouille pas une étoile HYG non libellée par accident', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', quality: 'high', zoom: '1400' }),
  );
  const candidate = await waitForUnlabelledCatalogPoint(page);
  const beforeDistance = (await readCameraInteractionState(page)).distance;

  await page.mouse.move(candidate.point.x, candidate.point.y);
  await page.mouse.wheel(0, -480);

  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(beforeDistance);
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  expect(browserErrors).toEqual([]);
});

test('les constellations relient le catalogue HYG dans un unique batch désactivable', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sun',
      selected: '',
      quality: 'high',
      constellations: '1',
      zoom: '1400',
    }),
  );
  await expect.poll(async () => (await readConstellationLineState(page)).visible).toBe(true);

  expect(await readConstellationLineState(page)).toMatchObject({
    figureCount: 88,
    segmentCount: 644,
    visible: true,
    confidence: 'illustrative',
    batchCount: 1,
  });

  const toggle = page.getByRole('button', {
    name: 'Afficher ou masquer les constellations',
  });

  await toggle.click();
  await expect.poll(() => queryParameter(page, 'constellations')).toBe('0');
  await expect.poll(async () => (await readConstellationLineState(page)).visible).toBe(false);

  await toggle.click();
  await expect.poll(() => queryParameter(page, 'constellations')).toBe('1');
  await expect.poll(async () => (await readConstellationLineState(page)).visible).toBe(true);

  await openUniverse(
    page,
    universeUrl({
      target: 'local-group',
      selected: '',
      quality: 'high',
      constellations: '1',
      zoom: '17000',
    }),
  );
  await expect.poll(async () => (await readConstellationLineState(page)).visible).toBe(false);
  expect((await readConstellationLineState(page)).batchCount).toBe(1);
  expect(browserErrors).toEqual([]);
});

test('les noms de constellation survolent, cadrent et documentent leur figure', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sun',
      selected: '',
      quality: 'high',
      orbits: '0',
      constellations: '1',
      zoom: '1400',
    }),
  );
  await expect
    .poll(async () => (await readConstellationInteractionState(page)).labelCount)
    .toBeGreaterThan(4);

  const interaction = await readConstellationInteractionState(page);

  expect(interaction.definitionCount).toBe(88);
  expect(interaction.candidate).not.toBeNull();
  if (!interaction.candidate) {
    throw new Error('Aucun nom de constellation dégagé ne peut être testé.');
  }

  await page.mouse.move(interaction.candidate.point.x, interaction.candidate.point.y);
  await expect
    .poll(async () => (await readConstellationInteractionState(page)).activeObjectId)
    .toBe(interaction.candidate.objectId);
  await expect
    .poll(async () => (await readConstellationInteractionState(page)).highlightVisible)
    .toBe(true);
  expect((await readConstellationInteractionState(page)).highlightVertexCount).toBeGreaterThan(0);

  await page.mouse.click(interaction.candidate.point.x, interaction.candidate.point.y);
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe(interaction.candidate.objectId);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(interaction.candidate.objectId);
  await expect
    .poll(async () => (await readConstellationInteractionState(page)).highlightOpacity)
    .toBeGreaterThan(0.9);
  expect((await readConstellationInteractionState(page)).highlightStyle).toBe(
    'additive-target-highlight',
  );

  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details).toContainText('Constellation');
  await expect(details).toContainText('Illustratif');
  await expect(details).toContainText('Étoiles reliées');
  await expect(details).toContainText('Segments');
  expect(browserErrors).toEqual([]);
});

test('un segment de constellation se survole et se sélectionne directement', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sun',
      selected: '',
      quality: 'high',
      orbits: '0',
      constellations: '1',
      labels: '0',
      zoom: '1400',
    }),
  );
  const segment = await findConstellationSegmentPoint(page);

  expect(segment).not.toBeNull();
  if (!segment) {
    throw new Error('Aucun segment de constellation directement interactif ne peut être testé.');
  }

  await page.mouse.move(segment.point.x, segment.point.y);
  await expect
    .poll(async () => (await readConstellationInteractionState(page)).activeObjectId)
    .toBe(segment.objectId);
  await expect
    .poll(async () => (await readConstellationInteractionState(page)).highlightVisible)
    .toBe(true);

  await page.mouse.click(segment.point.x, segment.point.y);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(segment.objectId);
  await expect(
    page.getByRole('complementary', { name: 'Informations sur l’objet sélectionné' }),
  ).toContainText('Constellation');
  expect(browserErrors).toEqual([]);
});

test('les noms HYG restent espacés puis quittent proprement la vue galactique', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sun',
      selected: '',
      quality: 'high',
      orbits: '0',
      zoom: '1400',
    }),
  );
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).catalogCount)
    .toBeGreaterThan(70);

  const layout = await readCatalogLabelLayout(page);

  expect(layout.totalCount).toBeLessThanOrEqual(96);
  expect(layout.overlapCount).toBe(0);
  expect(layout.candidate).not.toBeNull();
  if (!layout.candidate) {
    throw new Error('Aucun nom HYG dégagé ne peut être testé.');
  }

  await page.mouse.move(layout.candidate.point.x, layout.candidate.point.y);
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).hoveredObjectId)
    .toBe(layout.candidate.objectId);
  await expect(page.locator('canvas.universe-canvas')).toHaveCSS('cursor', 'pointer');
  await page.mouse.click(layout.candidate.point.x, layout.candidate.point.y);
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe(layout.candidate?.objectId ?? null);
  await expect
    .poll(() => queryParameter(page, 'selected'))
    .toBe(layout.candidate?.objectId ?? null);
  await expect(
    page.getByRole('complementary', {
      name: 'Informations sur l’objet sélectionné',
    }),
  ).toContainText('HYG Database v4.1');

  await openUniverse(
    page,
    universeUrl({
      target: 'milky-way',
      selected: '',
      quality: 'high',
      orbits: '0',
      zoom: '9600',
    }),
  );
  await expect.poll(async () => (await readMilkyWayVolumeState(page)).atlasStatus).toBe('ready');

  const galacticLayout = await readCatalogLabelLayout(page);

  expect(galacticLayout.catalogCount).toBe(0);
  expect(galacticLayout.totalCount).toBeLessThanOrEqual(72);
  expect(galacticLayout.overlapCount).toBe(0);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: '',
      quality: 'high',
      orbits: '0',
      zoom: '4.8',
    }),
  );
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).catalogCount)
    .toBeGreaterThan(40);

  const planetaryLayout = await readCatalogLabelLayout(page);

  expect(planetaryLayout.totalCount).toBeLessThanOrEqual(64);
  expect(planetaryLayout.overlapCount).toBe(0);

  await openUniverse(
    page,
    universeUrl({
      target: 'venus',
      selected: 'venus',
      quality: 'high',
      orbits: '0',
      zoom: '4.8',
    }),
  );
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).catalogCount)
    .toBeGreaterThan(20);
  await expect
    .poll(async () => (await readBodyLabelOcclusionState(page, 'venus')).radius)
    .toBeGreaterThan(100);
  await expect
    .poll(async () => (await readBodyLabelOcclusionState(page, 'venus')).overlappingLabelCount)
    .toBe(0);
  expect(browserErrors).toEqual([]);
});

test('la densité des noms enrichit la carte et persiste dans l’URL', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sun',
      selected: '',
      quality: 'high',
      density: 'minimal',
      orbits: '0',
      zoom: '1400',
    }),
  );
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).catalogCount)
    .toBeGreaterThan(30);
  const minimalLayout = await readCatalogLabelLayout(page);

  expect(minimalLayout.totalCount).toBeLessThanOrEqual(48);
  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click();
  const density = page.getByRole('combobox', { name: 'Densité des noms' });

  await expect(density).toHaveValue('minimal');
  await density.selectOption('dense');
  await expect.poll(() => queryParameter(page, 'density')).toBe('dense');
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).catalogCount)
    .toBeGreaterThan(minimalLayout.catalogCount);
  const denseLayout = await readCatalogLabelLayout(page);

  expect(denseLayout.totalCount).toBeLessThanOrEqual(144);
  expect(denseLayout.overlapCount).toBe(0);

  await page.reload();
  await expect(page.locator('canvas.universe-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click();
  await expect(page.getByRole('combobox', { name: 'Densité des noms' })).toHaveValue('dense');
  expect(browserErrors).toEqual([]);
});

test('une étoile HYG peut être cliquée puis centrée depuis son label', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', quality: 'low', zoom: '1400' }),
  );
  const candidate = await waitForIsolatedCatalogPoint(page);

  await page.mouse.move(candidate.point.x, candidate.point.y);
  await expect(page.locator('canvas.universe-canvas')).toHaveCSS('cursor', 'pointer');
  await page.mouse.click(candidate.point.x, candidate.point.y);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(candidate.objectId);
  await expect(
    page.getByRole('complementary', {
      name: 'Informations sur l’objet sélectionné',
    }),
  ).toContainText('HYG Database v4.1');

  const label = await waitForLabelCenter(page, candidate.objectId);

  await page.mouse.click(label.point.x, label.point.y);
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe(candidate.objectId);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(790);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(810);
  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText(
    'Voisinage stellaire',
  );
  await expect
    .poll(() => readActiveCatalogStarState(page))
    .toMatchObject({
      objectId: candidate.objectId,
      visible: true,
      haloVisible: true,
      haloVisualStyle: 'procedural-spectral-photosphere-impostor',
      catalogVisualStyle: 'procedural-spectral-photospheres-v3',
      coreVisible: false,
    });
  const stellarState = await readActiveCatalogStarState(page);

  expect(stellarState.haloPointSize).toBeGreaterThan(48);
  expect(stellarState.catalogSurfaceDetail).toBeGreaterThan(0);

  const focusedLabel = await waitForLabelCenter(page, candidate.objectId);
  let previousDistance = (await readCameraInteractionState(page)).distance;

  await page.mouse.move(focusedLabel.point.x, focusedLabel.point.y);
  for (let index = 0; index < 4; index += 1) {
    await page.mouse.wheel(0, -480);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeLessThan(previousDistance);
    previousDistance = (await readCameraInteractionState(page)).distance;
  }
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(80);
  await expect
    .poll(async () => {
      const state = await readActiveCatalogStarState(page);

      return {
        coreVisible: state.coreVisible,
        haloLarge: state.haloPointSize > 100,
        fieldEnlarged: state.catalogPointScale > 1.7,
      };
    })
    .toEqual({
      coreVisible: true,
      haloLarge: true,
      fieldEnlarged: true,
    });

  for (let index = 0; index < 8; index += 1) {
    await page.mouse.wheel(0, -480);
  }
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(0.7);
  const closestCamera = await readCameraInteractionState(page);

  expect(closestCamera.minDistance).toBeCloseTo(0.55, 2);
  expect(closestCamera.distance).toBeCloseTo(closestCamera.minDistance, 2);
  expect(browserErrors).toEqual([]);
});

test('la recherche HYG ouvre une fiche scientifique partageable', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('HIP 30438');
  await page.getByRole('option', { name: /Canopus/ }).click();
  await waitForCameraSettled(page);

  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(page.getByRole('heading', { name: 'Canopus' })).toBeVisible();
  await expect(details).toContainText('HYG 30365');
  await expect(details).toContainText('Magnitude apparente');
  await expect(details).toContainText('Indice B−V');
  await expect(details).toContainText('Observé');
  await expect.poll(() => queryParameter(page, 'target')).toBe('hyg-30365');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('hyg-30365');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Canopus' })).toBeVisible();
  await expect.poll(() => queryParameter(page, 'target')).toBe('hyg-30365');
  expect(browserErrors).toEqual([]);
});

test('une étoile proche trop faible pour le seuil de magnitude garde son point HYG canonique', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', quality: 'low' }));
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Wolf 359');
  await page.getByRole('option', { name: /Wolf 359/ }).click();
  await waitForCameraSettled(page);

  await expect(page.getByRole('heading', { name: 'Wolf 359' })).toBeVisible();
  await expect.poll(() => queryParameter(page, 'target')).toBe('wolf-359');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('wolf-359');
  await expect
    .poll(() => readActiveCatalogStarState(page))
    .toMatchObject({
      objectId: 'wolf-359',
      visible: true,
      visualFamily: 'red-dwarf',
      catalogVisualStyle: 'procedural-spectral-photospheres-v3',
    });
  expect(browserErrors).toEqual([]);
});

test('la recherche, la date, la qualité et l’URL survivent à un rechargement', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));

  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Gaïa');
  await page.getByRole('option', { name: /Terre/ }).click();
  await expect(page.getByRole('heading', { name: 'Terre' })).toBeVisible();

  const date = page.getByRole('textbox', { name: 'Date et heure UTC de simulation' });

  await date.fill('2026-08-28T04:14');
  await date.press('Tab');
  await page.getByRole('button', { name: 'Ouvrir les paramètres' }).click();
  await page.getByRole('button', { name: 'Élevé', exact: true }).click();

  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => queryParameter(page, 'quality')).toBe('high');
  await expect.poll(() => queryParameter(page, 'time')?.startsWith('2026-08-28T04:14')).toBe(true);

  await page.reload();
  await expect(page.locator('canvas.universe-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Terre' })).toBeVisible();
  await expect(date).toHaveValue('2026-08-28T04:14');
  expect(browserErrors).toEqual([]);
});

test('le navigateur d’éclipses déplace le temps et cible la Lune', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir les événements astronomiques' }).click();

  const browser = page.getByRole('region', { name: 'Éclipses terrestres' });

  await expect(browser).toBeVisible();
  await expect(
    browser.getByRole('button', {
      name: /Voir Éclipse solaire totale, 12 août 2026/,
    }),
  ).toBeVisible();

  await browser
    .getByRole('button', {
      name: 'Voir Éclipse lunaire partielle, 28 août 2026, 04:12 UTC',
    })
    .click();

  await expect.poll(() => queryParameter(page, 'target')).toBe('moon');
  await expect.poll(() => queryParameter(page, 'time')?.startsWith('2026-08-28T04:12')).toBe(true);
  await expect(page.getByRole('heading', { name: 'Lune' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('le navigateur d’événements défile et remonte vers les éclipses antérieures', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir les événements astronomiques' }).click();
  const browser = page.getByRole('region', { name: 'Éclipses terrestres' });
  const list = browser.locator('.event-list');

  await expect(browser.getByRole('button', { name: 'Événements antérieurs' })).toBeVisible();
  await expect
    .poll(() =>
      list.evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        scrollable: element.scrollHeight > element.clientHeight,
      })),
    )
    .toEqual({ overflowY: 'auto', scrollable: true });
  await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await browser.getByRole('button', { name: 'Événements antérieurs' }).click();
  await expect(browser).toContainText('03 mars 2026');
  await expect(
    browser.getByRole('button', { name: 'Revenir autour de la date choisie' }),
  ).toBeEnabled();
  await browser.getByRole('button', { name: 'Revenir autour de la date choisie' }).click();
  await expect(browser).toContainText('12 août 2026');
  expect(browserErrors).toEqual([]);
});

test('la carte expose une échelle dynamique et un fil d’Ariane navigable', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const breadcrumb = page.getByRole('navigation', { name: 'Hiérarchie astronomique' });
  const mapScale = page.getByRole('status', { name: 'Échelle cartographique' });

  await expect(breadcrumb).toContainText('Voie lactée');
  await expect(breadcrumb).toContainText('Soleil');
  await expect(breadcrumb).toContainText('Terre');
  await expect(mapScale).toContainText('Échelle visuelle adaptée');
  await expect(mapScale).toContainText('km');

  await breadcrumb.getByRole('button', { name: 'Naviguer vers Voie lactée' }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  expect(browserErrors).toEqual([]);
});

test('une date d’éclipse révèle automatiquement l’ombre dans la vue orbitale', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  const date = page.getByRole('textbox', { name: 'Date et heure UTC de simulation' });

  await date.fill('2026-08-12T17:45');
  await date.press('Tab');
  await waitForCameraSettled(page);

  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });

  await expect(timeline).toContainText('Phénomène en cours');
  await expect(timeline).toContainText('Éclipse solaire totale');
  await expect(timeline).toContainText('Pénombre');
  await expect(timeline).toContainText('Totalité');
  await expect(timeline).toContainText('Couche colorée adaptée');
  await expect(timeline).toContainText('Heure locale');
  await expect(timeline.getByRole('button', { name: 'Centrer l’ombre' })).toBeVisible();
  await expect
    .poll(() => readSolarEclipseVisualState(page))
    .toEqual({
      phase: 'total',
      visible: true,
    });
  await expect.poll(() => queryParameter(page, 'time')?.startsWith('2026-08-12T17:45')).toBe(true);
  expect(browserErrors).toEqual([]);
});

test('la pause fige la rotation axiale de la Terre', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  await expect
    .poll(() => readBodyTextureState(page, 'earth'))
    .toEqual({
      loaded: true,
      width: 1024,
      height: 512,
    });
  const rotationBefore = await readObjectRotation(page, 'earth');

  await page.waitForTimeout(500);

  expect(await readObjectRotation(page, 'earth')).toBeCloseTo(rotationBefore, 12);
  expect(browserErrors).toEqual([]);
});

test('les textures planétaires restent différées hors de leur LOD proche', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);
  const planetaryTextureRequests: string[] = [];

  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;

    if (path.startsWith('/textures/') && /(earth|jupiter|mars|moon|saturn|venus)-/.test(path)) {
      planetaryTextureRequests.push(path);
    }
  });

  await openUniverse(
    page,
    universeUrl({ target: 'local-group', selected: '', quality: 'high', zoom: '17000' }),
  );
  expect(planetaryTextureRequests).toEqual([]);

  await openUniverse(
    page,
    universeUrl({ target: 'earth', selected: '', quality: 'high', zoom: '4.8' }),
  );
  await expect
    .poll(() =>
      planetaryTextureRequests.filter((path) => path.startsWith('/textures/earth-')).sort(),
    )
    .toEqual([
      '/textures/earth-blue-marble-2048.jpg',
      '/textures/earth-clouds-2048.jpg',
      '/textures/earth-night-lights-2048.jpg',
    ]);
  expect(browserErrors).toEqual([]);
});

test('la rotation terrestre reste fluide pendant la lecture temporelle', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  await page.getByRole('combobox', { name: 'Vitesse temporelle' }).selectOption({
    label: '1 jour / seconde',
  });
  await page.getByRole('button', { name: 'Faire avancer le temps' }).click();
  await expect(page.getByRole('region', { name: 'Contrôle du temps' })).toContainText(
    'Vitesse · Terre stabilisée',
  );

  const samples = await sampleObjectQuaternions(page, 'earth', 14);
  const angularSteps = samples
    .slice(1)
    .map((sample, index) => quaternionDistance(sample, samples[index]!));
  const movingSteps = angularSteps.filter((distance) => distance > 0.001).length;
  const simulatedSecondsAtOneDayPerSecond = samples.at(-1)!.julianDay - samples[0]!.julianDay;
  const angularDistance = angularSteps.reduce((total, distance) => total + distance, 0);
  const averageSimulatedAngularSpeed = angularDistance / simulatedSecondsAtOneDayPerSecond;

  expect(movingSteps).toBeGreaterThanOrEqual(10);
  expect(Math.max(...angularSteps)).toBeLessThan(0.08);
  expect(simulatedSecondsAtOneDayPerSecond).toBeGreaterThan(0);
  expect(averageSimulatedAngularSpeed).toBeGreaterThan(0.2);
  expect(averageSimulatedAngularSpeed).toBeLessThan(0.32);

  await page.getByRole('button', { name: 'Mettre le temps en pause' }).click();
  await page.waitForTimeout(1_200);
  const settledSamples = await sampleObjectQuaternions(page, 'earth', 4);
  const finalMovement = quaternionDistance(settledSamples[2]!, settledSamples[3]!);

  expect(finalMovement).toBeLessThan(0.001);
  expect(browserErrors).toEqual([]);
});

test('une éclipse solaire expose la trajectoire et la vue depuis le sol', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir les événements astronomiques' }).click();
  await page
    .getByRole('region', { name: 'Éclipses terrestres' })
    .getByRole('button', {
      name: /Voir Éclipse solaire totale, 12 août 2026/,
    })
    .click();

  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });

  await expect(timeline).toContainText('Maximum mondial');
  await expect(timeline).toContainText('Couche colorée adaptée');
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => queryParameter(page, 'time')?.startsWith('2026-08-12T17:45')).toBe(true);

  const pathButton = timeline.getByRole('button', { name: 'Trajectoire' });

  await pathButton.click();
  await expect(pathButton).toHaveAttribute('aria-pressed', 'true');

  await timeline.getByRole('button', { name: /Vue au sol/ }).click();
  await expect(timeline).toContainText('Observation locale');
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();

  await timeline.getByRole('button', { name: /Retour en orbite/ }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  expect(browserErrors).toEqual([]);
});

test('un maximum local distingue la ville, l’UTC et l’heure française', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir les événements astronomiques' }).click();
  const browser = page.getByRole('region', { name: 'Éclipses terrestres' });

  await browser
    .getByRole('combobox', { name: 'Ville d’observation de l’éclipse' })
    .selectOption('lyon');
  await browser
    .getByRole('button', {
      name: /Voir le maximum local de Éclipse solaire totale, 12 août 2026.+depuis Lyon/,
    })
    .click();

  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });

  await expect(timeline).toContainText('Maximum local · Lyon');
  await expect(timeline).toContainText('Éclipse solaire partielle à Lyon');
  await expect(timeline).toContainText('93,8 % occulté');
  await expect(timeline).toContainText('20:21');
  await expect(timeline).toContainText('Heure locale');
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => queryParameter(page, 'time')?.startsWith('2026-08-12T18:21')).toBe(true);
  expect(browserErrors).toEqual([]);
});

test('les anneaux de Saturne restent lisibles en qualité faible', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'saturn', selected: '', quality: 'low', zoom: '4.8' }),
  );

  await expect
    .poll(async () => {
      const state = await readPlanetaryRingVisualState(page, 'saturn');

      return {
        visible: state.visible,
        textured: state.textured,
        textureLoaded: state.textureLoaded,
      };
    })
    .toEqual({ visible: true, textured: true, textureLoaded: true });
  await expect
    .poll(async () => (await readPlanetaryRingVisualState(page, 'saturn')).opacity)
    .toBeGreaterThan(0.85);
  const state = await readPlanetaryRingVisualState(page, 'saturn');

  expect(state.emissiveIntensity).toBeGreaterThanOrEqual(0.4);
  expect(browserErrors).toEqual([]);
});

test('les budgets renderer restent bornés dans la vue galactique', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'milky-way', selected: '', debug: 'true' }));
  const panel = page.getByRole('complementary', {
    name: 'Statistiques de débogage',
  });

  await expect(panel).toBeVisible();

  expect(await readDebugNumber(panel, 'draw-calls')).toBeLessThanOrEqual(12);
  expect(await readDebugNumber(panel, 'geometries')).toBeLessThanOrEqual(25);
  expect(await readDebugNumber(panel, 'textures')).toBeLessThanOrEqual(6);
  expect(await readDebugNumber(panel, 'visible-objects')).toBeGreaterThan(0);
  expect(await readDebugNumber(panel, 'hyg-stars')).toBe(0);
  expect(await readDebugNumber(panel, 'render-resolution')).toBeGreaterThanOrEqual(1);
  const canvas = page.locator('canvas.universe-canvas');

  await expect(canvas).toHaveCount(1);
  const contextAttributes = await canvas.evaluate((element) =>
    (element as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes(),
  );

  expect(contextAttributes?.antialias).toBe(false);
  expect(browserErrors).toEqual([]);
});

test.describe('budget volumétrique Retina', () => {
  test.use({ deviceScaleFactor: 2 });

  test('le réseau cosmique borne son coût combiné pixels × ray marching', async ({ page }) => {
    const browserErrors = monitorBrowserErrors(page);

    await openUniverse(
      page,
      universeUrl({ target: 'cosmic-web', selected: '', quality: 'high', debug: 'true' }),
    );
    const panel = page.getByRole('complementary', {
      name: 'Statistiques de débogage',
    });

    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await readCosmicWebVolumeState(page)).visible).toBe(true);
    const pixelRatio = await readDebugNumber(panel, 'render-resolution');
    const volume = await readCosmicWebVolumeState(page);
    const framesPerSecond = Number(
      (await panel.locator('header strong').textContent())?.replace(' FPS', ''),
    );

    expect(pixelRatio).toBeGreaterThanOrEqual(1);
    expect(pixelRatio).toBeLessThanOrEqual(1.5);
    expect(volume.rayMarchSteps).toBe(40);
    expect(volume.rayMarchSteps * pixelRatio ** 2).toBeLessThanOrEqual(90);
    expect(framesPerSecond).toBeGreaterThan(0);
    expect(browserErrors).toEqual([]);
  });
});

async function readDebugNumber(panel: Locator, stat: string): Promise<number> {
  const text = await panel.locator(`[data-debug-stat="${stat}"]`).textContent();

  return Number(text?.trim().replace('×', ''));
}

function quaternionDistance(
  first: { x: number; y: number; z: number; w: number },
  second: { x: number; y: number; z: number; w: number },
): number {
  const dot = Math.min(
    1,
    Math.abs(first.x * second.x + first.y * second.y + first.z * second.z + first.w * second.w),
  );

  return 2 * Math.acos(dot);
}

function vectorDistance(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
): number {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function rgbDistance(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}
