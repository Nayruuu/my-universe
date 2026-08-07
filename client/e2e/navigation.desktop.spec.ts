import { expect, test, type Locator, type Page } from '@playwright/test';
import { readObjectVisualDiagnostics } from './support/visual-regression-helpers';
import {
  chooseCustomObserverLocation,
  chooseObserverLocation,
  findConstellationSegmentPoint,
  findEmptyCanvasPoint,
  findEmptyWheelCanvasPoint,
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
  readLabelAnchorPoint,
  readLocalGalacticSkyState,
  readLabelCenter,
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
  readSolarEclipseEventMapState,
  readSolarEclipseVisualState,
  readSolarObserverVisualState,
  readSpaceTileStreamingState,
  readStarCatalogBatchState,
  readStarClusterBatchState,
  readSunOcclusionState,
  readSunPixelOcclusionState,
  readSupernovaVisualState,
  readTempelFilamentSpineState,
  readVisibleLabelIds,
  sampleObjectQuaternions,
  sampleObjectPositions,
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

test('le sélecteur reflète la langue d’une URL partagée', async ({ page }) => {
  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }).replace('/fr/', '/ja/'));

  const languageSelector = page.locator('.language-selector select');

  await expect(languageSelector).toHaveValue('ja');
  await expect(languageSelector.locator('option:checked')).toHaveText('JA');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});

test('la barre supérieure expose le soutien et l’aide conserve le portfolio du créateur', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir l’aide' }).click();
  const help = page.getByRole('region', { name: 'Aide à la navigation' });
  const portfolio = help.getByRole('link', { name: 'Découvrir mon portfolio' });
  const support = page.locator('.topbar').getByRole('link', { name: 'Offrir un café' });

  await expect(help).toContainText('Créé par Nayruuu');
  await expect(portfolio).toHaveAttribute('href', 'https://super-dev.app');
  await expect(portfolio).toHaveAttribute('rel', /\bme\b/u);
  await expect(portfolio).toHaveAttribute('target', '_blank');
  await expect(support).toHaveAttribute('href', 'https://buymeacoffee.com/nayruuu');
  await expect(support).toHaveAttribute('target', '_blank');
  await expect(help.getByRole('link', { name: 'Offrir un café' })).toHaveCount(0);
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

test('Phobos et Déimos chargent leur forme NASA uniquement au LOD proche', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'phobos',
      selected: 'phobos',
      quality: 'high',
      zoom: '1.2',
    }),
  );
  await waitForCameraSettled(page);
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Phobos' })).toBeVisible();
  await expect(details).toContainText('Forme 3D et mosaïque Viking observées');
  await expect(details).toContainText('IAU_PHOBOS');
  await expect.poll(() => wasResourceLoaded(page, '/models/phobos-nasa-jpl.glb')).toBe(true);
  await expect
    .poll(async () => Number.isFinite(await readObjectRotation(page, 'phobos')))
    .toBe(true);

  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Deimos');
  await page.getByRole('option').filter({ hasText: 'Déimos' }).click();
  await waitForCameraSettled(page);
  await expect(details.getByRole('heading', { name: 'Déimos' })).toBeVisible();
  await expect(details).toContainText('Forme 3D et mosaïque Viking observées');
  await expect(details).toContainText('IAU_DEIMOS');
  await expect.poll(() => wasResourceLoaded(page, '/models/deimos-nasa-jpl.glb')).toBe(true);
  await expect
    .poll(async () => Number.isFinite(await readObjectRotation(page, 'deimos')))
    .toBe(true);
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

test('une nouvelle session utilise un jour par seconde sans vitesses peu utiles', async ({
  page,
}) => {
  await openUniverse(page, universeUrl({ target: 'sun', selected: '' }));
  const speed = page.getByRole('combobox', { name: 'Vitesse temporelle' });

  await expect(speed).toHaveValue('1');
  await expect(speed.locator('option:checked')).toHaveText('1 jour / seconde');
  await expect(speed).not.toContainText('Temps réel');
  await expect(speed).not.toContainText('1 minute / seconde');
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
      const cameraState = await readCameraInteractionState(page);

      if (cameraState.distance <= cameraState.minDistance * 1.001) {
        break;
      }
      await wheelSemanticStep(page, -1);
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

test('un clic sur un nom centre l’étoile sans ouvrir automatiquement la vue terrestre', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sirius', selected: '', quality: 'low', mode: 'observable' }),
  );
  await waitForCameraSettled(page);

  const { point } = await waitForStableLabelCenter(page, 'sirius');

  await page.mouse.move(point.x, point.y);
  await expect(page.locator('canvas.universe-canvas')).toHaveCSS('cursor', 'pointer');
  await page.mouse.click(point.x, point.y);

  await expect.poll(() => queryParameter(page, 'target')).toBe('sirius');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('sirius');
  await expect(page.getByRole('heading', { name: 'Sirius' })).toBeVisible();
  await expect(page.locator('#earth-sky-view')).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test('la recherche localise Sirius dans le ciel terrestre à la date de la carte', async ({
  page,
}) => {
  test.slow();
  const browserErrors = monitorBrowserErrors(page);
  const earthLandmarkResponses: Array<{ readonly status: number; readonly url: string }> = [];

  page.on('response', (response) => {
    if (response.url().includes('/data/earth-landmarks/')) {
      earthLandmarkResponses.push({ status: response.status(), url: response.url() });
    }
  });

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: '',
      time: '2026-01-15T22:00:00.000Z',
    }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Sirius');
  await page.getByRole('option', { name: /^Sirius\b/u }).click();
  await waitForCameraSettled(page);
  const observeFromEarth = page.getByRole('button', {
    name: 'Localiser depuis la Terre',
    exact: true,
  });
  const focusedStarCamera = await readCameraInteractionState(page);

  await observeFromEarth.click();

  const journey = page.locator('#earth-sky-view[data-phase="travelling"]');
  const locator = page.getByRole('region', { name: 'Localiser Sirius' });
  const nightSky = page.locator('#earth-sky-view');
  const detailsBody = page.locator('.details__body');

  await expect(journey).toBeVisible();
  await expect(journey).toContainText('Sirius');
  await expect(nightSky.locator('.earth-sky-view__atmosphere')).toHaveCount(1);
  const journeyFrames = [focusedStarCamera];
  const surfaceOffsets: number[] = [];

  await expect
    .poll(
      async () => {
        journeyFrames.push(await readCameraInteractionState(page));
        surfaceOffsets.push(
          await nightSky.locator('.earth-sky-view__landscape').evaluate((element) => {
            const transform = getComputedStyle(element).transform;

            return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
          }),
        );

        return journeyFrames.at(-1)?.observerModeActive;
      },
      { timeout: 6_000, intervals: [80] },
    )
    .toBe(true);
  expect(journeyFrames.length).toBeGreaterThan(4);
  for (let index = 1; index < journeyFrames.length; index += 1) {
    expect(journeyFrames[index]!.distance).toBeGreaterThanOrEqual(
      journeyFrames[index - 1]!.distance - 1e-6,
    );
  }
  expect(journeyFrames.at(-1)!.distance).toBeGreaterThan(focusedStarCamera.distance * 1.15);
  expect(
    journeyFrames.slice(1).every(({ observerPresentationActive }) => observerPresentationActive),
  ).toBe(true);
  expect(surfaceOffsets.some((offset) => offset > 0)).toBe(true);
  for (let index = 1; index < surfaceOffsets.length; index += 1) {
    expect(surfaceOffsets[index]!).toBeLessThanOrEqual(surfaceOffsets[index - 1]! + 1e-3);
  }
  await expect(nightSky).toBeVisible();
  await expect(nightSky).toHaveAttribute('data-phase', 'open');
  await expect(nightSky).toHaveAttribute('aria-label', 'Ciel nocturne depuis Paris');
  await expect.poll(() => queryParameter(page, 'view')).toBe('planetarium');
  await expect.poll(() => queryParameter(page, 'observer')).toBe('paris');
  await expect(nightSky.locator('canvas')).toHaveCount(0);
  await expect(page.locator('canvas.universe-canvas')).toBeVisible();
  await expect(nightSky.locator('.earth-sky-view__horizon')).toBeVisible();
  await expect(nightSky.locator('.earth-sky-view__ground')).toBeVisible();
  const horizonProfile = nightSky.locator('.earth-sky-view__landscape');

  await expect(horizonProfile).toHaveAttribute('data-horizon-profile', 'paris');
  await expect(horizonProfile.locator('[data-landmark="eiffel-tower"]')).toHaveCount(0);
  await expect(horizonProfile.locator('[data-cityscape-svg="paris"]')).toBeVisible();
  await expect(horizonProfile.locator('[data-cityscape-svg="paris"] > use')).toHaveCount(3);
  await expect(
    horizonProfile.locator('[data-cityscape-svg="paris"] .earth-cityscape__near'),
  ).toHaveAttribute('fill', 'url(#paris-near-buildings)');
  await expect(horizonProfile.locator('.earth-sky-view__ridge')).toHaveCount(0);
  const parisHorizonShape = await horizonProfile.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--far-ridge-shape'),
  );

  await expect(nightSky.getByRole('button', { name: 'Jupiter', exact: true })).toBeVisible();
  await expect(nightSky.locator('[data-body-id="sun"]')).toHaveCount(0);
  await expect.poll(async () => (await readVisibleLabelIds(page)).includes('sun')).toBe(false);
  await expect(nightSky.locator('.earth-sky-target')).toHaveCount(0);
  await expect(detailsBody).toBeVisible();
  await expect(locator).toBeVisible();
  await expect.poll(() => queryParameter(page, 'mode')).toBe('observable');
  const siriusLabel = await waitForLabelCenter(page, 'sirius');
  const initialObserver = await readCameraInteractionState(page);

  expect(Math.abs(siriusLabel.point.x - page.viewportSize()!.width / 2)).toBeLessThan(150);
  expect(initialObserver.observerModeActive).toBe(true);
  expect(initialObserver.controlsEnabled).toBe(false);
  expect(initialObserver.rotateEnabled).toBe(false);
  expect(initialObserver.panEnabled).toBe(false);
  expect(initialObserver.fieldOfView).toBeCloseTo(82, 5);

  const betelgeuseLabel = await waitForLabelCenter(page, 'betelgeuse');

  await page.mouse.click(betelgeuseLabel.point.x, betelgeuseLabel.point.y);
  await expect(nightSky).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('heading', { name: 'Bételgeuse' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => queryParameter(page, 'selected')).toBe('betelgeuse');
  await expect.poll(() => queryParameter(page, 'target')).toBe('sirius');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).observerModeActive)
    .toBe(true);
  const observerAfterStarSelection = await readCameraInteractionState(page);

  expect(observerAfterStarSelection.transitioning).toBe(false);
  expect(observerAfterStarSelection.controlsEnabled).toBe(false);
  expect(observerAfterStarSelection.rotateEnabled).toBe(false);
  expect(observerAfterStarSelection.panEnabled).toBe(false);
  expect(
    vectorDistance(observerAfterStarSelection.position, initialObserver.position),
  ).toBeLessThan(1e-8);
  expect(
    vectorDistance(observerAfterStarSelection.direction, initialObserver.direction),
  ).toBeLessThan(1e-8);
  expect(observerAfterStarSelection.fieldOfView).toBeCloseTo(initialObserver.fieldOfView, 8);

  await page.getByRole('button', { name: 'Centrer la vue', exact: true }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('betelgeuse');
  await expect.poll(async () => (await readCameraInteractionState(page)).transitioning).toBe(true);
  const observerDuringRetarget = await readCameraInteractionState(page);

  expect(observerDuringRetarget.observerPresentationActive).toBe(true);
  expect(observerDuringRetarget.controlsEnabled).toBe(false);
  expect(observerDuringRetarget.rotateEnabled).toBe(false);
  expect(observerDuringRetarget.panEnabled).toBe(false);
  await waitForCameraSettled(page);
  const observerAfterRetarget = await readCameraInteractionState(page);

  expect(observerAfterRetarget.observerModeActive).toBe(true);
  expect(observerAfterRetarget.controlsEnabled).toBe(false);
  expect(observerAfterRetarget.rotateEnabled).toBe(false);
  expect(observerAfterRetarget.panEnabled).toBe(false);
  await expect(nightSky).toHaveAttribute('data-phase', 'open');
  await expect(nightSky.getByText('Localiser Bételgeuse', { exact: true })).toBeVisible();

  const restoredSiriusLabel = await waitForLabelCenter(page, 'sirius');

  await page.mouse.click(restoredSiriusLabel.point.x, restoredSiriusLabel.point.y);
  await expect(page.getByRole('heading', { name: 'Sirius' })).toBeVisible();
  await page.getByRole('button', { name: 'Centrer la vue', exact: true }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('sirius');
  await waitForCameraSettled(page);
  const observerAfterSiriusRestore = await readCameraInteractionState(page);

  expect(observerAfterSiriusRestore.observerModeActive).toBe(true);
  expect(observerAfterSiriusRestore.controlsEnabled).toBe(false);
  expect(observerAfterSiriusRestore.rotateEnabled).toBe(false);
  expect(observerAfterSiriusRestore.panEnabled).toBe(false);

  await chooseObserverLocation(
    detailsBody,
    'Lieu depuis lequel localiser l’étoile',
    'Tokyo',
    /^Tokyo Japon$/u,
  );
  await expect(nightSky).toHaveAttribute('aria-label', 'Ciel nocturne depuis Tokyo');
  await expect.poll(() => queryParameter(page, 'observer')).toBe('geonames-1850147');
  await expect(detailsBody.locator('app-earth-observer-location-picker summary strong')).toHaveText(
    'Tokyo',
  );
  const sunVisibilityDuringLocationChange: boolean[] = [];

  await expect.poll(async () => (await readCameraInteractionState(page)).transitioning).toBe(true);
  await expect
    .poll(
      async () => {
        const [cameraState, sunVisual] = await Promise.all([
          readCameraInteractionState(page),
          readObjectVisualDiagnostics(page, 'sun'),
        ]);

        sunVisibilityDuringLocationChange.push(sunVisual?.visualVisible ?? false);

        return cameraState.transitioning;
      },
      { timeout: 6_000, intervals: [80] },
    )
    .toBe(false);
  expect(sunVisibilityDuringLocationChange).not.toContain(true);
  await expect
    .poll(async () =>
      vectorDistance(
        (await readCameraInteractionState(page)).direction,
        observerAfterSiriusRestore.direction,
      ),
    )
    .toBeGreaterThan(0.1);
  const observerAfterCardLocationChange = await readCameraInteractionState(page);

  expect(observerAfterCardLocationChange.observerModeActive).toBe(true);
  expect(observerAfterCardLocationChange.controlsEnabled).toBe(false);
  expect(observerAfterCardLocationChange.rotateEnabled).toBe(false);
  expect(observerAfterCardLocationChange.panEnabled).toBe(false);

  await chooseObserverLocation(
    detailsBody,
    'Lieu depuis lequel localiser l’étoile',
    'Paris',
    /^Paris France$/u,
  );
  await expect(nightSky).toHaveAttribute('aria-label', 'Ciel nocturne depuis Paris');
  await expect.poll(() => queryParameter(page, 'observer')).toBe('paris');
  await expect
    .poll(async () =>
      vectorDistance(
        (await readCameraInteractionState(page)).direction,
        observerAfterCardLocationChange.direction,
      ),
    )
    .toBeGreaterThan(0.1);
  await waitForCameraSettled(page);

  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  const skyHorizon = nightSky.locator('.earth-sky-view__horizon');
  const horizonBeforeCityChange = await skyHorizon.boundingBox();

  expect(horizonBeforeCityChange).not.toBeNull();

  await chooseObserverLocation(
    nightSky,
    'Lieu depuis lequel localiser l’étoile',
    'Tokyo',
    /^Tokyo Japon$/u,
  );
  await expect(nightSky).toHaveAttribute('aria-label', 'Ciel nocturne depuis Tokyo');
  await expect.poll(() => queryParameter(page, 'observer')).toBe('geonames-1850147');
  await expect(nightSky.locator('app-earth-observer-location-picker summary strong')).toHaveText(
    'Tokyo',
  );
  await expect(page.locator('.details')).toHaveCount(0);
  await expect(horizonProfile).toHaveAttribute('data-horizon-profile', 'geonames-1850147');
  await expect(horizonProfile.locator('[data-landmark="mount-fuji"]')).toBeVisible();
  await expect(horizonProfile.locator('[data-cityscape-svg="tokyo"]')).toBeVisible();
  await expect(horizonProfile.locator('[data-cityscape-svg="tokyo"] > use')).toHaveCount(3);
  await expect(
    horizonProfile.locator('[data-cityscape-svg="tokyo"] [data-regional-landmark]'),
  ).toHaveCount(4);
  await expect(
    horizonProfile.locator('[data-cityscape-svg="tokyo"] .earth-cityscape__near'),
  ).toHaveAttribute('fill', 'url(#regional-near-buildings)');
  await expect(
    horizonProfile
      .locator('[data-cityscape-svg="tokyo"] .earth-cityscape__landmark-silhouette')
      .first(),
  ).toHaveAttribute('fill-rule', 'nonzero');
  await expect(horizonProfile.locator('.earth-sky-view__ridge')).toHaveCount(0);
  const tokyoHorizonShape = await horizonProfile.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--far-ridge-shape'),
  );

  expect(tokyoHorizonShape).not.toBe(parisHorizonShape);

  await chooseObserverLocation(
    nightSky,
    'Lieu depuis lequel localiser l’étoile',
    'Lyon',
    /^Lyon France$/u,
  );
  await expect(horizonProfile).toHaveAttribute('data-horizon-profile', 'lyon');
  await expect
    .poll(() =>
      earthLandmarkResponses.some(({ url }) => new URL(url).pathname.endsWith('/manifest.json')),
    )
    .toBe(true);
  await expect
    .poll(() =>
      earthLandmarkResponses.some(({ url }) => new URL(url).pathname.endsWith('/europe.json')),
    )
    .toBe(true);
  expect(earthLandmarkResponses.every(({ status }) => status === 200)).toBe(true);
  const catalogPanorama = horizonProfile.locator(
    '[data-cityscape-svg="catalog"][data-location-id="lyon"]',
  );

  await expect(catalogPanorama).toBeVisible();
  await expect(catalogPanorama).toHaveCSS('z-index', '2');
  await expect(catalogPanorama.locator(':scope > use')).toHaveCount(3);
  const paintedCatalogBounds = await catalogPanorama
    .locator(':scope > use')
    .first()
    .evaluate((element) => {
      const bounds = (element as SVGGraphicsElement).getBBox();

      return { height: bounds.height, width: bounds.width };
    });

  expect(paintedCatalogBounds.height).toBeGreaterThan(20);
  expect(paintedCatalogBounds.width).toBeGreaterThan(20);
  expect(await rasterizedSvgOpaquePixelCount(catalogPanorama)).toBeGreaterThan(100);
  await expect(catalogPanorama.locator('[data-catalog-landmark]')).toHaveCount(4);
  await expect(
    catalogPanorama.locator(
      '[data-catalog-landmark][data-source-url^="https://"][data-visual-confidence="illustrative"]',
    ),
  ).toHaveCount(4);
  await expect(horizonProfile.locator('[data-measured-terrain]')).toHaveCount(1);
  await expect(horizonProfile.locator('.earth-sky-view__ridge')).toHaveCount(0);

  await chooseObserverLocation(
    nightSky,
    'Lieu depuis lequel localiser l’étoile',
    'Tokyo',
    /^Tokyo Japon$/u,
  );
  await expect(horizonProfile).toHaveAttribute('data-horizon-profile', 'geonames-1850147');
  await expect
    .poll(async () => Math.abs((await skyHorizon.boundingBox())!.y - horizonBeforeCityChange!.y))
    .toBeLessThan(1);
  await waitForCameraSettled(page);
  expect((await readCameraInteractionState(page)).observerModeActive).toBe(true);
  expect(Math.abs((await skyHorizon.boundingBox())!.y - horizonBeforeCityChange!.y)).toBeLessThan(
    1,
  );

  const universeCanvas = page.locator('canvas.universe-canvas');
  const skyBounds = await universeCanvas.boundingBox();
  const beforeLookAround = await readCameraInteractionState(page);
  const horizonBeforeLookAround = await skyHorizon.boundingBox();

  expect(skyBounds).not.toBeNull();
  expect(horizonBeforeLookAround).not.toBeNull();
  await page.mouse.move(
    skyBounds!.x + skyBounds!.width * 0.5,
    skyBounds!.y + skyBounds!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    skyBounds!.x + skyBounds!.width * 0.68,
    skyBounds!.y + skyBounds!.height * 0.5,
    {
      steps: 6,
    },
  );
  await page.mouse.up();
  await expect
    .poll(async () => {
      const current = await readCameraInteractionState(page);

      return vectorDistance(current.direction, beforeLookAround.direction);
    })
    .toBeGreaterThan(0.05);
  const afterLookAround = await readCameraInteractionState(page);
  const horizonAfterHorizontalLook = await skyHorizon.boundingBox();

  expect(vectorDistance(afterLookAround.position, beforeLookAround.position)).toBeLessThan(1e-8);
  expect(horizonAfterHorizontalLook).not.toBeNull();
  expect(horizonAfterHorizontalLook!.y).toBeCloseTo(horizonBeforeLookAround!.y, 1);

  await page.mouse.move(
    skyBounds!.x + skyBounds!.width * 0.68,
    skyBounds!.y + skyBounds!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    skyBounds!.x + skyBounds!.width * 0.68,
    skyBounds!.y + skyBounds!.height * 0.68,
    {
      steps: 6,
    },
  );
  await page.mouse.up();
  await expect
    .poll(async () => Math.abs((await skyHorizon.boundingBox())!.y - horizonAfterHorizontalLook!.y))
    .toBeGreaterThan(20);
  const afterVerticalLook = await readCameraInteractionState(page);

  expect(vectorDistance(afterVerticalLook.position, beforeLookAround.position)).toBeLessThan(1e-8);
  expect(vectorDistance(afterVerticalLook.direction, afterLookAround.direction)).toBeGreaterThan(
    0.05,
  );

  await universeCanvas.hover();
  await page.mouse.wheel(0, -420);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).fieldOfView)
    .toBeLessThan(beforeLookAround.fieldOfView);

  await nightSky.getByRole('button', { name: 'Recentrer Sirius' }).click();
  await waitForCameraSettled(page);
  const recenteredObserver = await readCameraInteractionState(page);

  expect(recenteredObserver.observerModeActive).toBe(true);
  expect(recenteredObserver.fieldOfView).toBeCloseTo(82, 5);
  await expect(nightSky.locator('.earth-sky-view__landscape--below')).toBeVisible();
  await expect.poll(async () => (await readVisibleLabelIds(page)).length).toBeGreaterThan(0);

  const constellationToggle = nightSky.getByRole('button', {
    name: 'Afficher ou masquer les constellations',
  });

  await expect(constellationToggle).toHaveAttribute('aria-pressed', 'true');
  await constellationToggle.click();
  await expect(constellationToggle).toHaveAttribute('aria-pressed', 'false');

  await nightSky.getByRole('button', { name: 'Revenir à la carte 3D' }).click();
  await expect(nightSky).toBeHidden();
  await expect.poll(() => queryParameter(page, 'mode')).toBe('state');
  await expect.poll(() => queryParameter(page, 'view')).toBe('map');
  const returnedMap = await readCameraInteractionState(page);

  expect(returnedMap.observerModeActive).toBe(false);
  expect(returnedMap.controlsEnabled).toBe(true);
  expect(returnedMap.rotateEnabled).toBe(true);
  expect(returnedMap.panEnabled).toBe(true);

  const returnedCatalogStar = await waitForIsolatedCatalogPoint(page);

  await page.mouse.click(returnedCatalogStar.point.x, returnedCatalogStar.point.y);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(returnedCatalogStar.objectId);
  await expect(
    page.getByRole('complementary', {
      name: 'Informations sur l’objet sélectionné',
    }),
  ).toContainText('HYG Database v4.1');
  await expect(
    page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('une URL partagée restaure le planétarium et conserve son référentiel observateur après un changement de mode', async ({
  page,
}) => {
  test.slow();
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sirius',
      selected: '',
      time: '2026-01-15T22:00:00.000Z',
      mode: 'observable',
      view: 'planetarium',
      observer: 'geonames-1850147',
    }),
  );

  const nightSky = page.locator('#earth-sky-view');

  await expect(nightSky).toBeVisible({ timeout: 8_000 });
  await expect(nightSky).toHaveAttribute('data-phase', 'open');
  await expect(nightSky).toHaveAttribute('aria-label', 'Ciel nocturne depuis Tokyo');
  await expect.poll(() => queryParameter(page, 'view')).toBe('planetarium');
  await expect.poll(() => queryParameter(page, 'observer')).toBe('geonames-1850147');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).observerModeActive)
    .toBe(true);
  const observerBeforeModeChange = await readCameraInteractionState(page);

  expect(observerBeforeModeChange.controlsEnabled).toBe(false);
  expect(observerBeforeModeChange.rotateEnabled).toBe(false);
  expect(observerBeforeModeChange.panEnabled).toBe(false);

  await page.getByRole('combobox', { name: 'Mode temporel' }).selectOption('state');
  await expect(nightSky).toBeVisible();
  await expect.poll(() => queryParameter(page, 'mode')).toBe('state');
  await expect.poll(() => queryParameter(page, 'view')).toBe('planetarium');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).observerModeActive)
    .toBe(true);
  const observerAfterModeChange = await readCameraInteractionState(page);

  expect(observerAfterModeChange.observerPresentationActive).toBe(true);
  expect(observerAfterModeChange.controlsEnabled).toBe(false);
  expect(observerAfterModeChange.rotateEnabled).toBe(false);
  expect(observerAfterModeChange.panEnabled).toBe(false);

  const universeCanvas = page.locator('canvas.universe-canvas');
  const canvasBounds = await universeCanvas.boundingBox();

  expect(canvasBounds).not.toBeNull();
  await page.mouse.move(
    canvasBounds!.x + canvasBounds!.width * 0.5,
    canvasBounds!.y + canvasBounds!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBounds!.x + canvasBounds!.width * 0.65,
    canvasBounds!.y + canvasBounds!.height * 0.5,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => {
      const current = await readCameraInteractionState(page);

      return vectorDistance(current.direction, observerAfterModeChange.direction);
    })
    .toBeGreaterThan(0.05);
  const observerAfterLookAround = await readCameraInteractionState(page);

  expect(
    vectorDistance(observerAfterLookAround.position, observerAfterModeChange.position),
  ).toBeLessThan(1e-8);
  await universeCanvas.hover();
  await page.mouse.wheel(0, -420);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).fieldOfView)
    .toBeLessThan(observerAfterLookAround.fieldOfView);
  const observerAfterZoom = await readCameraInteractionState(page);

  expect(observerAfterZoom.observerModeActive).toBe(true);
  expect(observerAfterZoom.controlsEnabled).toBe(false);
  expect(vectorDistance(observerAfterZoom.position, observerAfterLookAround.position)).toBeLessThan(
    1e-8,
  );

  await page.getByRole('combobox', { name: 'Mode temporel' }).selectOption('observable');
  await expect(nightSky).toBeVisible();
  await expect.poll(() => queryParameter(page, 'mode')).toBe('observable');
  await expect.poll(() => queryParameter(page, 'view')).toBe('planetarium');

  await nightSky.getByRole('button', { name: 'Revenir à la carte 3D' }).click();
  await expect(nightSky).toBeHidden();
  await expect.poll(() => queryParameter(page, 'mode')).toBe('state');
  await expect.poll(() => queryParameter(page, 'view')).toBe('map');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).observerModeActive)
    .toBe(false);
  expect(browserErrors).toEqual([]);
});

test('le zoom observateur révèle une planète 3D et F revient entièrement à la carte', async ({
  page,
}) => {
  test.slow();
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'betelgeuse',
      selected: '',
      quality: 'high',
      time: '2026-01-15T22:00:00.000Z',
      mode: 'observable',
      view: 'planetarium',
      observer: 'paris',
    }),
  );

  const nightSky = page.locator('#earth-sky-view[data-phase="open"]');
  const jupiter = nightSky.locator('[data-body-id="jupiter"]');
  const jupiterDisk = jupiter.locator('i');

  await expect(nightSky).toBeVisible({ timeout: 8_000 });
  await expect(jupiter).toBeVisible();
  await expect(jupiter).toHaveAttribute('data-renderer', 'webgl-existing-object');
  const initialCenter = await locatorCenter(jupiter);
  const initialDisk = await jupiterDisk.boundingBox();
  const initialApparentDiameter = Number(
    await jupiter.getAttribute('data-apparent-diameter-pixels'),
  );
  const initialFieldOfView = (await readCameraInteractionState(page)).fieldOfView;

  expect(initialDisk).not.toBeNull();
  expect(initialFieldOfView).toBeGreaterThan(70);
  await page.mouse.move(initialCenter.x, initialCenter.y);
  for (let impulse = 0; impulse < 18; impulse += 1) {
    await page.mouse.wheel(0, -1_200);
    await page.waitForTimeout(190);
    const visiblePlanetCount = await jupiter.count();

    expect(visiblePlanetCount, `Jupiter après l’impulsion ${impulse + 1}`).toBe(1);
    const anchoredCenter = await locatorCenter(jupiter);

    expect(
      Math.hypot(anchoredCenter.x - initialCenter.x, anchoredCenter.y - initialCenter.y),
      `Dérive de Jupiter après l’impulsion ${impulse + 1}`,
    ).toBeLessThan(4);
  }

  await expect
    .poll(async () => (await readCameraInteractionState(page)).fieldOfView)
    .toBeLessThan(25);
  await expect(jupiter).toBeVisible();
  await expect(jupiter).toHaveAttribute('data-resolved', 'true');
  const resolvedCenter = await locatorCenter(jupiter);
  const resolvedDisk = await jupiterDisk.boundingBox();
  const resolvedApparentDiameter = Number(
    await jupiter.getAttribute('data-apparent-diameter-pixels'),
  );
  const resolvedBackground = await jupiterDisk.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );

  await expect
    .poll(async () => (await readObjectVisualDiagnostics(page, 'jupiter'))?.nearVisible)
    .toBe(true);

  const jupiterVisual = await readObjectVisualDiagnostics(page, 'jupiter');

  expect(resolvedDisk).not.toBeNull();
  expect(
    Math.hypot(resolvedCenter.x - initialCenter.x, resolvedCenter.y - initialCenter.y),
  ).toBeLessThan(2);
  expect(resolvedDisk!.width).toBeGreaterThan(initialDisk!.width + 8);
  expect(resolvedApparentDiameter).toBeGreaterThan(initialApparentDiameter * 2);
  expect(resolvedBackground).toBe('none');
  expect(jupiterVisual).toMatchObject({
    bodyPresent: true,
    bodyVisible: true,
    visualVisible: true,
    nearVisible: true,
    surfaceTexture: {
      requested: true,
      source: expect.stringContaining('jupiter-hubble-'),
    },
  });
  expect(jupiterVisual?.opacity).toBeGreaterThan(0);

  await jupiter.click();
  await expect.poll(() => queryParameter(page, 'selected')).toBe('jupiter');
  await page.keyboard.press('f');
  await expect(nightSky).toBeHidden();
  await expect.poll(() => queryParameter(page, 'view')).toBe('map');
  await expect.poll(() => queryParameter(page, 'mode')).toBe('state');
  await expect.poll(() => queryParameter(page, 'target')).toBe('jupiter');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).observerModeActive)
    .toBe(false);
  expect(browserErrors).toEqual([]);
});

test('les planètes restent ancrées au fond stellaire dans le ciel terrestre', async ({ page }) => {
  test.slow();
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: '',
      quality: 'high',
      time: '2026-08-16T15:08:00.000Z',
    }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Spica');
  await page.getByRole('option', { name: /^Spica\b/u }).click();
  await waitForCameraSettled(page);
  await page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }).click();

  const nightSky = page.locator('#earth-sky-view[data-phase="open"]');
  const moon = nightSky.locator('[data-body-id="moon"]');

  await expect(nightSky).toBeVisible({ timeout: 7_000 });
  await expect(moon).toBeVisible();
  const initialMoon = await locatorCenter(moon);
  const initialCatalogStar = await readLabelAnchorPoint(page, 'hyg-65269');

  await page.waitForTimeout(750);
  const stationaryMoon = await locatorCenter(moon);

  expect(stationaryMoon.x).toBeCloseTo(initialMoon.x, 1);
  expect(stationaryMoon.y).toBeCloseTo(initialMoon.y, 1);

  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.62, bounds!.y + bounds!.height * 0.35, {
    steps: 8,
  });
  await page.mouse.up();

  const movedMoon = await locatorCenter(moon);
  const movedCatalogStar = await readLabelAnchorPoint(page, 'hyg-65269');
  const moonDeltaX = wrappedHorizontalDelta(movedMoon.x, stationaryMoon.x, bounds!.width);
  const starDeltaX = wrappedHorizontalDelta(
    movedCatalogStar.x,
    initialCatalogStar.x,
    bounds!.width,
  );

  expect(Math.abs(moonDeltaX)).toBeGreaterThan(100);
  expect(Math.sign(moonDeltaX)).toBe(Math.sign(starDeltaX));
  expect(Math.abs(moonDeltaX - starDeltaX)).toBeLessThan(bounds!.width * 0.05);

  const directionBeforeTime = (await readCameraInteractionState(page)).direction;
  const horizon = nightSky.locator('.earth-sky-view__horizon');
  const horizonBeforeTime = await horizon.boundingBox();

  await page.getByRole('combobox', { name: 'Vitesse temporelle' }).selectOption({
    label: '1 heure / seconde',
  });
  await page.getByRole('button', { name: 'Faire avancer le temps' }).click();
  await expect
    .poll(async () => {
      const currentDirection = (await readCameraInteractionState(page)).direction;

      return vectorDistance(currentDirection, directionBeforeTime);
    })
    .toBeGreaterThan(0.05);
  await expect
    .poll(async () => {
      const currentMoon = await locatorCenter(moon);

      return Math.abs(wrappedHorizontalDelta(currentMoon.x, movedMoon.x, bounds!.width));
    })
    .toBeGreaterThan(20);
  const timedMoon = await locatorCenter(moon);
  const timedCatalogStar = await readLabelAnchorPoint(page, 'hyg-65269');
  const horizonAfterTime = await horizon.boundingBox();
  const moonTimeDeltaX = wrappedHorizontalDelta(timedMoon.x, movedMoon.x, bounds!.width);
  const starTimeDeltaX = wrappedHorizontalDelta(
    timedCatalogStar.x,
    movedCatalogStar.x,
    bounds!.width,
  );

  expect(horizonBeforeTime).not.toBeNull();
  expect(horizonAfterTime).not.toBeNull();
  expect(horizonAfterTime!.y).toBeCloseTo(horizonBeforeTime!.y, 1);
  expect(Math.abs(moonTimeDeltaX)).toBeGreaterThan(20);
  expect(Math.abs(starTimeDeltaX)).toBeGreaterThan(10);
  expect(Math.sign(moonTimeDeltaX)).toBe(Math.sign(starTimeDeltaX));
  expect(Math.abs(moonTimeDeltaX - starTimeDeltaX)).toBeLessThan(bounds!.width * 0.05);
  await page.getByRole('button', { name: 'Mettre le temps en pause' }).click();
  expect(browserErrors).toEqual([]);
});

test('fermer la fiche d’une étoile dynamique conserve le sol du ciel terrestre', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'earth',
      selected: '',
      time: '2026-01-15T22:00:00.000Z',
    }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Canopus');
  await page.getByRole('option', { name: /^Canopus\b/u }).click();
  await waitForCameraSettled(page);
  await page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }).click();

  const nightSky = page.locator('#earth-sky-view[data-phase="open"]');

  await expect(nightSky).toBeVisible({ timeout: 7_000 });
  await expect(nightSky.locator('.earth-sky-view__ground')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();

  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  await expect(nightSky.locator('.earth-sky-view__ground')).toBeVisible();
  await expect(nightSky.locator('.earth-sky-view__horizon')).toBeVisible();
  await expect(nightSky).toContainText('Localiser Canopus');

  const canvas = page.locator('canvas.universe-canvas');
  const canvasBounds = await canvas.boundingBox();
  const horizon = nightSky.locator('.earth-sky-view__horizon');

  expect(canvasBounds).not.toBeNull();
  await page.mouse.move(
    canvasBounds!.x + canvasBounds!.width * 0.62,
    canvasBounds!.y + canvasBounds!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBounds!.x + canvasBounds!.width * 0.62,
    canvasBounds!.y + canvasBounds!.height * 0.86,
    { steps: 12 },
  );
  const directionAtLowerLimit = (await readCameraInteractionState(page)).direction;
  const horizonAtLowerLimit = await horizon.boundingBox();

  await page.mouse.move(
    canvasBounds!.x + canvasBounds!.width * 0.62,
    canvasBounds!.y + canvasBounds!.height * 0.98,
    { steps: 6 },
  );
  const directionAfterContinuedDrag = (await readCameraInteractionState(page)).direction;
  const horizonAfterContinuedDrag = await horizon.boundingBox();

  await page.mouse.up();
  expect(horizonAtLowerLimit).not.toBeNull();
  expect(horizonAfterContinuedDrag).not.toBeNull();
  expect(horizonAtLowerLimit!.y).toBeGreaterThan(canvasBounds!.y + canvasBounds!.height * 0.54);
  expect(horizonAfterContinuedDrag!.y).toBeCloseTo(horizonAtLowerLimit!.y, 1);
  expect(vectorDistance(directionAfterContinuedDrag, directionAtLowerLimit)).toBeLessThan(1e-8);
  expect(browserErrors).toEqual([]);
});

test('le voyage vers une étoile très basse conserve un horizon stable', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'hyg-71125',
      selected: 'hyg-71125',
      time: '2026-01-15T21:59:59.998Z',
      zoom: '1838.22',
      mode: 'observable',
    }),
  );
  await page.getByRole('button', { name: 'Localiser depuis la Terre', exact: true }).click();

  const nightSky = page.locator('#earth-sky-view');
  const landscape = nightSky.locator('.earth-sky-view__landscape');

  await landscape.waitFor({ state: 'attached' });
  const entryHorizon = await landscape.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).getPropertyValue('--horizon-y')),
  );

  expect(entryHorizon).toBeGreaterThan(50);
  expect(entryHorizon).toBeLessThan(100);
  await expect(nightSky).toHaveAttribute('data-phase', 'open', { timeout: 7_000 });

  const settledHorizon = await landscape.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).getPropertyValue('--horizon-y')),
  );

  expect(settledHorizon).toBeGreaterThan(50);
  expect(Math.abs(settledHorizon - entryHorizon)).toBeLessThan(5);
  await expect(nightSky.locator('.earth-sky-view__landscape--below')).toBeVisible();
  await expect
    .poll(async () => (await readVisibleLabelIds(page)).includes('hyg-71125'))
    .toBe(false);

  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();
  const horizon = nightSky.locator('.earth-sky-view__horizon');
  const beforeHorizontalLook = await horizon.boundingBox();

  expect(bounds).not.toBeNull();
  expect(beforeHorizontalLook).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.68, bounds!.y + bounds!.height * 0.45, {
    steps: 8,
  });
  await page.mouse.up();
  const afterHorizontalLook = await horizon.boundingBox();

  expect(afterHorizontalLook).not.toBeNull();
  expect(afterHorizontalLook!.y).toBeCloseTo(beforeHorizontalLook!.y, 1);

  await page.mouse.move(bounds!.x + bounds!.width * 0.68, bounds!.y + bounds!.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.68, bounds!.y + bounds!.height * 0.62, {
    steps: 8,
  });
  await page.mouse.up();
  const afterVerticalLook = await horizon.boundingBox();

  expect(afterVerticalLook).not.toBeNull();
  expect(Math.abs(afterVerticalLook!.y - afterHorizontalLook!.y)).toBeGreaterThan(20);

  await nightSky.locator('.earth-sky-view__recenter').click();
  await waitForCameraSettled(page);
  const directionBeforeTurns = (await readCameraInteractionState(page)).direction;
  const horizonBeforeTurns = await horizon.boundingBox();

  for (let turn = 0; turn < 5; turn += 1) {
    await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width * 0.75, bounds!.y + bounds!.height * 0.45, {
      steps: 8,
    });
    await page.mouse.up();
  }
  const directionAfterTurns = (await readCameraInteractionState(page)).direction;
  const horizonAfterTurns = await horizon.boundingBox();

  expect(horizonBeforeTurns).not.toBeNull();
  expect(horizonAfterTurns).not.toBeNull();
  expect(vectorDistance(directionAfterTurns, directionBeforeTurns)).toBeGreaterThan(0.4);
  expect(horizonAfterTurns!.y).toBeCloseTo(horizonBeforeTurns!.y, 1);
  await expect(nightSky.locator('[data-body-id="moon"]')).toHaveCount(0);
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
  expect(queryParameter(page, 'target')).toBe('earth');
  expect(browserErrors).toEqual([]);
});

test('un panoramique qui sort l’objet du viewport efface sa cible et sa sélection', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: 'earth', zoom: '4.8' }));
  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  await page.keyboard.down('Shift');
  for (let gesture = 0; gesture < 6; gesture += 1) {
    await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width * 0.92, bounds!.y + bounds!.height * 0.5, {
      steps: 12,
    });
    await page.mouse.up();
  }
  await page.keyboard.up('Shift');

  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  const earthPoint = await readObjectScreenPoint(page, 'earth');

  expect(
    earthPoint.x < bounds!.x ||
      earthPoint.x > bounds!.x + bounds!.width ||
      earthPoint.y < bounds!.y ||
      earthPoint.y > bounds!.y + bounds!.height,
  ).toBe(true);
  expect(browserErrors).toEqual([]);
});

test('un clic gauche dans le fond désélectionne et libère la cible active', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: 'earth', zoom: '4.8' }));
  const emptyPoint = await findEmptyCanvasPoint(page);
  const beforeClick = await readCameraInteractionState(page);

  await page.mouse.click(emptyPoint.x, emptyPoint.y);

  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  const afterClick = await readCameraInteractionState(page);

  expect(afterClick.distance).toBeCloseTo(beforeClick.distance, 6);
  expect(vectorDistance(afterClick.position, beforeClick.position)).toBeLessThan(0.001);
  expect(vectorDistance(afterClick.target, beforeClick.target)).toBeLessThan(0.001);
  expect(browserErrors).toEqual([]);
});

test('un zoom avant au seuil libère la cible puis déplace le pivot à distance constante', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: 'sun', zoom: '2.7' }));

  const emptyPoint = await findEmptyCanvasPoint(page);
  const focusedState = await readCameraInteractionState(page);

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.wheel(0, -160);
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  await expect.poll(() => queryParameter(page, 'selected')).toBe('sun');

  const releasedState = await readCameraInteractionState(page);

  expect(releasedState.distance).toBeCloseTo(focusedState.distance, 9);
  // This is a usability assertion, not merely a non-zero movement check: the first real browser
  // impulse must already cross Saturn's scale without creating an unbounded initial jump.
  expect(vectorDistance(releasedState.position, focusedState.position)).toBeGreaterThan(180);
  expect(vectorDistance(releasedState.position, focusedState.position)).toBeLessThan(220);
  expect(vectorDistance(releasedState.target, focusedState.target)).toBeGreaterThan(180);
  expect(vectorDistance(releasedState.target, focusedState.target)).toBeLessThan(220);
  expect(releasedState.rotateEnabled).toBe(true);
  expect(releasedState.panEnabled).toBe(true);
  expect(releasedState.minDistance).toBeCloseTo(focusedState.distance, 9);
  const releasedEarthPoint = await readObjectScreenPoint(page, 'earth');

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.down();
  await page.mouse.move(emptyPoint.x + 120, emptyPoint.y + 70, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(1_200);
  await expect
    .poll(async () =>
      vectorDistance((await readCameraInteractionState(page)).direction, releasedState.direction),
    )
    .toBeGreaterThan(0.1);
  const rotatedState = await readCameraInteractionState(page);
  const rotatedEarthPoint = await readObjectScreenPoint(page, 'earth');

  expect(vectorDistance(rotatedState.position, releasedState.position)).toBeGreaterThan(0.05);
  expect(rotatedState.distance).toBeCloseTo(releasedState.distance, 3);
  expect(vectorDistance(rotatedState.target, releasedState.target)).toBeLessThan(0.001);
  expect(
    Math.hypot(
      rotatedEarthPoint.x - releasedEarthPoint.x,
      rotatedEarthPoint.y - releasedEarthPoint.y,
    ),
  ).toBeGreaterThan(20);

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(emptyPoint.x - 110, emptyPoint.y + 55, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await expect
    .poll(async () =>
      vectorDistance((await readCameraInteractionState(page)).target, rotatedState.target),
    )
    .toBeGreaterThan(0.05);
  const pannedState = await readCameraInteractionState(page);

  expect(vectorDistance(pannedState.position, rotatedState.position)).toBeGreaterThan(0.05);
  expect(pannedState.distance).toBeCloseTo(rotatedState.distance, 3);
  expect(vectorDistance(pannedState.direction, rotatedState.direction)).toBeLessThan(0.001);
  const zoomPoint = await findEmptyCanvasPoint(page);

  await page.mouse.move(zoomPoint.x, zoomPoint.y);
  let minimumState: Awaited<ReturnType<typeof readCameraInteractionState>> | null = null;

  for (let index = 0; index < 24; index += 1) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(70);
    const state = await readCameraInteractionState(page);

    if (Math.abs(state.distance - state.minDistance) <= 1e-9) {
      minimumState = state;
      break;
    }
  }

  expect(minimumState).not.toBeNull();
  expect(minimumState!.distance).toBeCloseTo(0.75, 2);

  await page.mouse.wheel(0, -120);
  await expect
    .poll(async () =>
      vectorDistance((await readCameraInteractionState(page)).position, minimumState!.position),
    )
    .toBeGreaterThan(0.05);
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  await expect.poll(() => queryParameter(page, 'selected')).toBe('sun');

  await openUniverse(page, universeUrl({ target: 'cosmic-web', selected: '', zoom: '599000' }));
  const zoomOutButton = page.getByRole('button', { name: 'Dézoomer', exact: true });

  await zoomOutButton.click();
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(600_000, 0);
  expect((await readCameraInteractionState(page)).maxDistance).toBe(600_000);
  expect(browserErrors).toEqual([]);
});

test('depuis le Soleil, une inversion partielle rembobine le trajet libre avant de dézoomer', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', zoom: '2.7', debug: 'true' }),
  );
  const point = await findEmptyWheelCanvasPoint(page);

  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.matches('canvas.universe-canvas'),
      point,
    ),
  ).toBe(true);

  await expect
    .poll(async () => {
      const state = await readCameraInteractionState(page);

      return state.distance / state.minDistance;
    })
    .toBeCloseTo(1, 6);

  await page.mouse.move(point.x, point.y);
  for (let index = 0; index < 14; index += 1) {
    await page.mouse.wheel(0, -760);
    await page.waitForTimeout(17);
  }
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  await expect
    .poll(async () => {
      const trace =
        (await page.evaluate(
          () => window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace() ?? [],
        )) ?? [];

      return trace
        .filter((entry) => entry.deltaY < 0 && entry.after.targetId === null)
        .reduce(
          (total, entry) =>
            total + vectorDistance(entry.after.cameraPosition, entry.before.cameraPosition),
          0,
        );
    })
    .toBeGreaterThan(300);
  const traversedState = await readCameraInteractionState(page);
  const traceBeforeReverse = await page.evaluate(
    () => window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace() ?? [],
  );
  const releaseEntry = traceBeforeReverse.find((entry) => entry.decision === 'release-target');
  const forwardEntries = traceBeforeReverse.filter(
    (entry) => entry.deltaY < 0 && entry.after.targetId === null,
  );
  const accumulatedTravel = forwardEntries.reduce(
    (total, entry) =>
      total + vectorDistance(entry.after.cameraPosition, entry.before.cameraPosition),
    0,
  );
  const lastForwardEntry = forwardEntries.at(-1);

  expect(releaseEntry).toBeDefined();
  expect(lastForwardEntry).toBeDefined();
  expect(traversedState.distance).toBeCloseTo(traversedState.minDistance, 9);
  expect(accumulatedTravel).toBeGreaterThan(300);
  const firstForwardEntry = forwardEntries[0]!;
  const firstTravelPerInput =
    vectorDistance(
      firstForwardEntry.after.cameraPosition,
      firstForwardEntry.before.cameraPosition,
    ) / Math.abs(firstForwardEntry.deltaY);
  const lastTravelPerInput =
    vectorDistance(
      lastForwardEntry!.after.cameraPosition,
      lastForwardEntry!.before.cameraPosition,
    ) / Math.abs(lastForwardEntry!.deltaY);

  expect(lastTravelPerInput).toBeGreaterThan(firstTravelPerInput * 2.5);

  await page.waitForTimeout(70);
  await page.mouse.wheel(0, 42);
  await expect
    .poll(async () => {
      const entry = await page.evaluate(() =>
        window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().at(-1),
      );

      return entry?.deltaY ?? 0;
    })
    .toBeGreaterThan(0);
  const reversedState = await readCameraInteractionState(page);
  const reverseEntry = await page.evaluate(() =>
    window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().at(-1),
  );

  expect(reverseEntry?.deltaY).toBeGreaterThan(0);
  expect(reverseEntry?.before.distance).toBeCloseTo(reverseEntry!.after.distance, 9);
  expect(reverseEntry?.after.semanticZoomActive).toBe(false);
  expect(reversedState.distance).toBeCloseTo(reversedState.minDistance, 9);
  const forwardTranslation = vectorDifference(
    lastForwardEntry!.after.cameraPosition,
    lastForwardEntry!.before.cameraPosition,
  );
  const reverseTranslation = vectorDifference(
    reverseEntry!.after.cameraPosition,
    reverseEntry!.before.cameraPosition,
  );

  expect(vectorLength(reverseTranslation)).toBeGreaterThan(20);
  expect(vectorDot(forwardTranslation, reverseTranslation)).toBeLessThan(0);
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

  expect(releasedState.rotateEnabled).toBe(true);
  expect(releasedState.panEnabled).toBe(true);
  expect(releasedState.minDistance).toBe(0.75);

  const firstEmptyPoint = await findEmptyCanvasPoint(page);

  await page.mouse.move(firstEmptyPoint.x, firstEmptyPoint.y);
  await page.mouse.wheel(0, -120);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(releasedState.distance * 0.95);
  const firstZoomedState = await readCameraInteractionState(page);

  expect(vectorDistance(firstZoomedState.position, releasedState.position)).toBeGreaterThan(0.1);

  for (let index = 1; index < 9; index += 1) {
    const currentEmptyPoint = await findEmptyCanvasPoint(page);

    await page.mouse.move(currentEmptyPoint.x, currentEmptyPoint.y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(70);
  }

  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(releasedState.distance * 0.5);

  let minimumState: Awaited<ReturnType<typeof readCameraInteractionState>> | null = null;

  for (let index = 0; index < 24; index += 1) {
    const currentEmptyPoint = await findEmptyCanvasPoint(page);

    await page.mouse.move(currentEmptyPoint.x, currentEmptyPoint.y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(70);
    const state = await readCameraInteractionState(page);

    if (Math.abs(state.distance - state.minDistance) <= 1e-9) {
      minimumState = state;
      break;
    }
  }

  expect(minimumState).not.toBeNull();
  const finalEmptyPoint = await findEmptyCanvasPoint(page);

  await page.mouse.move(finalEmptyPoint.x, finalEmptyPoint.y);
  await page.mouse.wheel(0, -120);
  await expect
    .poll(async () =>
      vectorDistance((await readCameraInteractionState(page)).position, minimumState!.position),
    )
    .toBeGreaterThan(0.05);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(0.75, 2);
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  expect(browserErrors).toEqual([]);
});

test('un aller-retour de molette libre conserve le point visé et la position caméra', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  const emptyPoint = await findEmptyCanvasPoint(page);

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.click(emptyPoint.x, emptyPoint.y, { button: 'right' });
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  const initial = await readCameraInteractionState(page);
  const initialEarthPoint = await readObjectScreenPoint(page, 'earth');

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await wheelSemanticStep(page, 1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeGreaterThan(initial.distance * 10);
  await wheelSemanticStep(page, -1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(initial.distance, 3);
  const restored = await readCameraInteractionState(page);
  const restoredEarthPoint = await readObjectScreenPoint(page, 'earth');

  expect(vectorDistance(restored.direction, initial.direction)).toBeLessThan(0.001);
  expect(
    Math.hypot(
      restoredEarthPoint.x - initialEarthPoint.x,
      restoredEarthPoint.y - initialEarthPoint.y,
    ),
  ).toBeLessThan(1);
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  expect(browserErrors).toEqual([]);
});

test('le zoom continue lorsqu’une légende apparaît sous le curseur', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'nearby-universe', selected: '', zoom: '120000' }),
  );
  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  const point = {
    x: bounds!.x + bounds!.width - 180,
    y: bounds!.y + bounds!.height - 200,
  };

  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.matches('canvas.universe-canvas'),
      point,
    ),
  ).toBe(true);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  const initial = await readCameraInteractionState(page);

  await page.mouse.move(point.x, point.y);
  await wheelSemanticStep(page, 1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(420_000, 0);
  await expect(page.locator('.cosmic-map-key')).toBeVisible();
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('.cosmic-map-key') !== null,
      point,
    ),
  ).toBe(true);

  await wheelSemanticStep(page, 1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(600_000, 0);
  await wheelSemanticStep(page, -1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(420_000, 0);
  await wheelSemanticStep(page, -1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(initial.distance, 0);
  const restored = await readCameraInteractionState(page);

  expect(vectorDistance(restored.direction, initial.direction)).toBeLessThan(0.001);
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
  const tempelWorkerUrls: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/data/structures/tempel-filament-spines.bin')) {
      tempelCatalogRequests.push(request.url());
    }
  });
  page.on('worker', (worker) => {
    tempelWorkerUrls.push(worker.url());
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
  await expect.poll(() => tempelCatalogRequests.length).toBe(1);
  await expect.poll(() => tempelWorkerUrls.length).toBe(1);
  expect(tempelWorkerUrls[0]).toMatch(/worker-.+\.js/);
  await expect.poll(async () => (await readTempelFilamentSpineState(page)).loaded).toBe(false);

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
      catalogCount: 26_520,
      sourceCount: 13,
      visible: true,
      confidence: 'calculated',
      batchCount: 1,
      structureCounts: {
        cluster: 1_094,
        supercluster: 8_757,
        filament: 15_421,
        void: 1_228,
        wall: 2,
        basin: 15,
        attractor: 1,
        repeller: 2,
      },
      layerState: {
        clusters: true,
        superclusters: true,
        filaments: true,
        voids: true,
      },
      landmarkRepresentation: 'distinct-wall-basin-attractor-repeller-map-symbols',
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
  expect(tempelCatalogRequests).toHaveLength(1);
  expect(tempelWorkerUrls).toHaveLength(1);
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
  const debugPanel = page.getByRole('complementary', {
    name: 'Statistiques de débogage',
  });

  await expect(debugPanel.locator('[data-debug-stat="tempel-worker-round-trip"]')).toContainText(
    'worker',
  );
  await expect(debugPanel.locator('[data-debug-stat="tempel-preload"]')).toContainText('hit');
  await expect
    .poll(async () => {
      const values = await readDebugTimings(debugPanel, 'tempel-fetch-decode');

      return values.length === 2 && values.every((value) => value >= 0);
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const values = await readDebugTimings(debugPanel, 'tempel-geometry-install');

      return (
        values.length === 2 &&
        values.every((value) => value >= 0) &&
        values[0]! < 20 &&
        values[1]! < 4
      );
    })
    .toBe(true);
  await expect
    .poll(async () => {
      const values = await readDebugTimings(debugPanel, 'tempel-first-frame-total');

      return (
        values.length === 3 &&
        values.every((value) => value >= 0) &&
        values[1]! >= values[0]! &&
        values[2]! >= values[1]!
      );
    })
    .toBe(true);
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
    '26 520 détections · 13 catalogues',
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
      catalogCount: 26_520,
      visible: true,
      confidence: 'calculated',
      batchCount: 1,
      selectedObjectId: objectId,
    });
  await expect(page.getByLabel('Statistiques de débogage')).toContainText('Structures documentées');
  expect(browserErrors).toEqual([]);
});

test('la recherche centre un bassin probabiliste sans le confondre avec un filament', async ({
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

  await search.fill('Bassin de Shapley');
  await page
    .getByRole('option', {
      name: /Bassin de Shapley Bassin cosmique · Réseau cosmique/,
    })
    .click();
  await waitForCameraSettled(page, 40_000);

  const objectId = 'lss-valade-2024-pboa-shapley-basin';

  await expect.poll(() => queryParameter(page, 'target')).toBe(objectId);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(objectId);
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Bassin de Shapley' })).toBeVisible();
  await expect(details).toContainText('Calculé');
  await expect(details).toContainText('90 %');
  await expect(details).toContainText('Intrinsic probability');
  await expect(details).toContainText('Equivalent spherical radius');
  await expect(details).toContainText('Valade et al. (2024)');
  await expect(details).toContainText('ne représente pas sa frontière réelle');
  await expect(details).not.toContainText('Empreinte du relevé');
  await expect
    .poll(() => readCosmicStructureBatchState(page))
    .toMatchObject({
      catalogCount: 26_520,
      selectedObjectId: objectId,
      landmarkRepresentation: 'distinct-wall-basin-attractor-repeller-map-symbols',
    });
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
  test.setTimeout(120_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'jupiter', selected: '', quality: 'low', debug: 'true' }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Europa');
  const europaOption = page.getByRole('option', {
    name: 'Europe Lune · Jupiter',
    exact: true,
  });

  await expect(europaOption).toBeVisible({ timeout: 30_000 });
  await europaOption.click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('europa');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('europa');
  const details = page.getByRole('complementary', {
    name: 'Informations sur l’objet sélectionné',
  });

  await expect(details.getByRole('heading', { name: 'Europe' })).toBeVisible();
  await expect(details).toContainText('Calculé');
  await expect(details).toContainText(/671.100 km/u);
  await expect(details).toContainText('3,55 jours');
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

  await search.fill('Enceladus');
  await page
    .getByRole('option', {
      name: 'Encelade Lune · Saturne',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('enceladus');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('enceladus');
  await expect(details.getByRole('heading', { name: 'Encelade' })).toBeVisible();
  await expect(details).toContainText('Extrapolé');
  await expect(details).toContainText(/238.400 km/u);
  await expect(details).toContainText('NASA/JPL Planetary Satellite Mean Orbital Parameters');
  await expect(details).toContainText('Mosaïque globale Voyager observée');

  await search.fill('Eris');
  await page
    .getByRole('option', {
      name: 'Éris Planète naine · Soleil',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('eris');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('eris');
  await expect(details.getByRole('heading', { name: 'Éris' })).toBeVisible();
  await expect(details).toContainText('67,9 UA');
  await expect(details).toContainText('NASA/JPL Small-Body Database');

  await search.fill('Bennu');
  await page.getByRole('option').filter({ hasText: 'Bénou' }).click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('bennu');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('bennu');
  await expect(details.getByRole('heading', { name: 'Bénou' })).toBeVisible();
  await expect(details).toContainText('Forme et texture observées par OSIRIS-REx');
  await expect.poll(() => wasResourceLoaded(page, '/models/bennu-nasa-vtad.glb')).toBe(true);

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
  await expect(details).toContainText('15 × 8 × 8 km');
  await expect(details).toContainText('NASA/JPL · Giotto imaging of comet 1P/Halley');
  await expect(details.locator('.approximation-note')).toBeVisible();
  await expect(details).toContainText('NASA/JPL Small-Body Database');

  await search.fill('67P');
  await page
    .getByRole('option', {
      name: '67P/Tchourioumov-Guérassimenko Comète · Soleil',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  await expect.poll(() => queryParameter(page, 'target')).toBe('67p-churyumov-gerasimenko');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('67p-churyumov-gerasimenko');
  await expect(
    details.getByRole('heading', { name: '67P/Tchourioumov-Guérassimenko' }),
  ).toBeVisible();
  await expect(details).toContainText('3,46 UA');
  await expect(details.locator('.approximation-note')).toBeVisible();
  await expect(details).toContainText('Forme observée par Rosetta/OSIRIS');
  await expect.poll(() => wasResourceLoaded(page, '/models/67p-osiris-esa.obj')).toBe(true);
  await page.waitForTimeout(1_500);
  const debugPanel = page.getByRole('complementary', { name: 'Statistiques de débogage' });
  const warmedResources = {
    geometries: await readDebugNumber(debugPanel, 'geometries'),
    textures: await readDebugNumber(debugPanel, 'textures'),
  };

  await search.fill('Bennu');
  await page.getByRole('option').filter({ hasText: 'Bénou' }).click();
  await waitForCameraSettled(page);
  await search.fill('67P');
  await page
    .getByRole('option', {
      name: '67P/Tchourioumov-Guérassimenko Comète · Soleil',
      exact: true,
    })
    .click();
  await waitForCameraSettled(page);

  await expect
    .poll(async () => ({
      geometries: await readDebugNumber(debugPanel, 'geometries'),
      textures: await readDebugNumber(debugPanel, 'textures'),
    }))
    .toEqual(warmedResources);
  expect(await resourceLoadCount(page, '/models/bennu-nasa-vtad.glb')).toBe(1);
  expect(await resourceLoadCount(page, '/models/67p-osiris-esa.obj')).toBe(1);

  await page.reload();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('67p-churyumov-gerasimenko');
  await expect(
    details.getByRole('heading', { name: '67P/Tchourioumov-Guérassimenko' }),
  ).toBeVisible();
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

test('la molette effectue Terre → Réseau cosmique → Terre en suivant le pointeur', async ({
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
    await wheelSemanticStep(page, 1);
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
    await wheelSemanticStep(page, -1);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 1);
    await expect.poll(() => queryParameter(page, 'target')).toBe(expectedTarget);
  }

  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText('Planétaire');
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(4.8, 1);
  await waitForCameraSettled(page);
  const returnAlignment = await readNavigationAlignmentState(page);

  expect(returnAlignment.targetId).toBe('earth');
  expect(Number.isFinite(returnAlignment.targetError)).toBe(true);
  expect(Number.isFinite(returnAlignment.floatingOriginDistance)).toBe(true);
  expect(returnAlignment.targetError).toBeGreaterThan(1);
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
    await wheelSemanticStep(page, 1);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 0);
    await expect.poll(() => queryParameter(page, 'target')).toBe(expectedTarget);
  }

  await expect.poll(() => queryParameter(page, 'target')).toBe('cosmic-web');
  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText(
    'Réseau cosmique',
  );
  const cosmicAlignment = await readNavigationAlignmentState(page);

  expect(cosmicAlignment.targetId).toBe('cosmic-web');
  expect(cosmicAlignment.targetError).toBeGreaterThan(1);
  expect(cosmicAlignment.targetError).toBeLessThan(420_000);
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
    const currentEmptyPoint = await findEmptyCanvasPoint(page);

    await page.mouse.move(currentEmptyPoint.x, currentEmptyPoint.y);
    await wheelSemanticStep(page, -1);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 1);
    await expect.poll(() => queryParameter(page, 'target')).toBe(expectedTarget);
  }

  expect(browserErrors).toEqual([]);
});

test('depuis Neptune, la molette adopte le Soleil et s’arrête devant lui sans le traverser', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'earth', selected: '', quality: 'low', debug: 'true' }),
  );
  const search = page.getByRole('searchbox', {
    name: 'Rechercher un objet astronomique',
  });

  await search.fill('Neptune');
  await page
    .getByRole('option', { name: /^Neptune\b/u })
    .first()
    .click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('neptune');
  await page.evaluate(() => window.__UNIVERSE_MAP_OBSERVABILITY__?.clearNavigationDebugTrace());

  const sunLabel = await waitForLabelCenter(page, 'sun');

  await page.mouse.move(sunLabel.point.x, sunLabel.point.y);
  for (let index = 0; index < 8; index += 1) {
    await wheelSemanticStep(page, -1);
  }
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect
    .poll(async () => {
      const state = await readCameraInteractionState(page);

      return Math.abs(state.distance - state.minDistance);
    })
    .toBeLessThan(0.001);
  const trace = await page.evaluate(
    () => window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace() ?? [],
  );

  expect(trace.length).toBeGreaterThan(0);
  expect(trace[0]).toMatchObject({
    interceptedObjectId: 'sun',
    decision: 'adopt-wheel-target',
    anchor: { anchorType: 'object', anchorObjectId: 'sun' },
    before: { targetId: 'neptune' },
    after: { targetId: 'sun' },
  });
  expect(trace.every((entry) => entry.interceptedObjectId === 'sun')).toBe(true);
  expect(trace.every((entry) => entry.after.targetId === 'sun')).toBe(true);
  expect(trace.every((entry) => entry.decision !== 'release-target')).toBe(true);
  expect(trace.at(-1)).toMatchObject({
    decision: 'zoom-current-target',
    zoom: { status: 'minimum' },
    after: { targetId: 'sun', atMinimumDistance: true },
  });
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
  await wheelSemanticStep(page, -1);
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  await expect(scaleSwitcher).toContainText('Voie lactée');
  await expect
    .poll(async () => {
      const volume = await readMilkyWayVolumeState(page);

      return volume.atlasStatus === 'ready' && volume.visible && volume.opacity > 0.1;
    })
    .toBe(true);
  await expect.poll(async () => (await readMilkyWayDetailState(page)).visible).toBe(true);
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

  await wheelSemanticStep(page, -1);
  const intermediateGalacticDistance = (await readCameraInteractionState(page)).distance;

  await wheelSemanticStep(page, -1);
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

  await wheelSemanticStep(page, 1);
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  await expect(scaleSwitcher).toContainText('Voie lactée');
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(intermediateGalacticDistance, 5);

  await wheelSemanticStep(page, 1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(galacticCamera.distance, 5);
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  expect((await readCameraInteractionState(page)).distance).toBeGreaterThan(
    (await readMilkyWayDetailState(page)).radius,
  );

  await wheelSemanticStep(page, 1);
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

test('le zoom logarithmique atteint la limite solaire sans changer de cible', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: 'sun', zoom: '2.7' }));
  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await wheelSemanticStep(page, 1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(4.8, 1);

  for (let index = 0; index < 9; index += 1) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(220);
  }

  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  const closest = await readCameraInteractionState(page);

  expect(closest.distance).toBeCloseTo(closest.minDistance, 3);
  expect(closest.minDistance).toBeCloseTo(2.7025, 4);
  expect(closest.rotateEnabled).toBe(true);
  expect(closest.panEnabled).toBe(true);
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

test('le zoom sur une galaxie décentrée l’adopte sans la faire dériver à l’écran', async ({
  page,
}) => {
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
  await wheelSemanticStep(page, 1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(120_000, 0);
  await wheelSemanticStep(page, 1);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(420_000, 0);
  await wheelSemanticStep(page, 1);
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
  await wheelSemanticStep(page, -1);
  await expect.poll(() => queryParameter(page, 'target')).toBe('andromeda');
  await expect.poll(() => queryParameter(page, 'selected')).not.toBe('andromeda');

  const afterPoint = await readObjectScreenPoint(page, 'andromeda');
  const afterCamera = await readCameraInteractionState(page);

  expect(Math.hypot(afterPoint.x - beforePoint.x, afterPoint.y - beforePoint.y)).toBeLessThan(
    bounds!.width * 0.04,
  );
  expect(afterCamera.distance).toBeLessThan(beforeCamera.distance);

  const lastWheelEntry = await page.evaluate(() =>
    window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().at(-1),
  );

  expect(lastWheelEntry).toMatchObject({
    interceptedObjectId: 'andromeda',
    decision: 'zoom-current-target',
    anchor: { anchorType: 'object', anchorObjectId: 'andromeda' },
  });
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
  await expect
    .poll(async () => (await readLocalGalacticSkyState(page)).opacity)
    .toBeGreaterThan(0.12);
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
    .toBe(true);
  await expect
    .poll(async () => {
      const remote = await readHeliocentricCatalogPresentationState(page);

      return {
        hygBoundaryAttenuated:
          remote.hyg.observerBoundaryOpacity > 0 && remote.hyg.observerBoundaryOpacity < 0.2,
        hostSignatureDiscreet: remote.exoplanetHosts.hostSignatureStrength < 0.004,
        hostBoundaryDiscreet: remote.exoplanetHosts.observerBoundaryOpacity < 0.7,
        hostCatalogDiscreet: remote.exoplanetHosts.opacity < 0.3,
      };
    })
    .toEqual({
      hygBoundaryAttenuated: true,
      hostSignatureDiscreet: true,
      hostBoundaryDiscreet: true,
      hostCatalogDiscreet: true,
    });
  expect(browserErrors).toEqual([]);
});

test('la position finale près de la naine du Sagittaire conserve les 10 000 points HYG', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sagittarius-dwarf-spheroidal',
      selected: 'earth',
      quality: 'high',
      zoom: '0.06',
    }),
  );
  await expect
    .poll(() => readStarCatalogBatchState(page))
    .toMatchObject({
      catalogCount: 10_000,
      drawCount: 10_000,
      visible: true,
      confidence: 'observed',
      batchCount: 1,
    });
  await expect
    .poll(async () => (await readHeliocentricCatalogPresentationState(page)).hyg)
    .toEqual({
      visible: true,
      observerBoundaryOpacity: 0.12,
    });
  expect(browserErrors).toEqual([]);
});

test('la Voie lactée volumique ajoute un détail stellaire sans charger ses agrégats', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);
  const aggregateRequests: string[] = [];

  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/data/stars/tiles/')) {
      aggregateRequests.push(request.url());
    }
  });

  await openUniverse(
    page,
    universeUrl({
      target: 'milky-way',
      selected: '',
      quality: 'high',
      zoom: '9600',
    }),
  );
  const detailed = await readStarClusterBatchState(page);

  await expect.poll(async () => (await readMilkyWayVolumeState(page)).atlasStatus).toBe('ready');
  await expect.poll(async () => (await readMilkyWayDetailState(page)).visible).toBe(true);
  const volume = await readMilkyWayVolumeState(page);
  const stellarDetail = await readMilkyWayDetailState(page);
  const localSky = await readLocalGalacticSkyState(page);

  expect(detailed).toMatchObject({
    activeTileCount: 0,
    cachedPackCount: 0,
    cachedTileCount: 0,
    activeClusterCount: 0,
    cachedClusterCount: 0,
    representationCount: 0,
    visibleClusterCount: 0,
    pointBatchCount: 0,
    visibleLodLevels: [],
    confidence: null,
  });
  expect(aggregateRequests).toEqual([]);
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
  expect(stellarDetail.visible).toBe(true);
  expect(stellarDetail.opacity).toBeGreaterThan(0.12);
  expect(localSky.bandVisible).toBe(false);
  expect(localSky.opacity).toBeLessThan(0.004);

  const scaleSwitcher = page.getByRole('button', { name: 'Changer d’échelle' });

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Groupe local' }).click();
  await waitForCameraSettled(page);
  const overview = await readStarClusterBatchState(page);

  expect(overview).toEqual(detailed);
  expect(aggregateRequests).toEqual([]);
  await expect.poll(async () => (await readStarCatalogBatchState(page)).visible).toBe(false);

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Voisinage stellaire' }).click();
  await waitForCameraSettled(page);
  await expect.poll(async () => (await readStarClusterBatchState(page)).activeTileCount).toBe(0);
  await expect
    .poll(async () => (await readStarClusterBatchState(page)).visibleClusterCount)
    .toBe(0);
  const exact = await readStarClusterBatchState(page);

  expect(exact.cachedPackCount).toBe(0);
  expect(exact.representationCount).toBe(0);
  expect(exact.visibleLodLevels).toEqual([]);
  expect(aggregateRequests).toEqual([]);
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
  await wheelSemanticStep(page, -1);

  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(beforeDistance);
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  expect(browserErrors).toEqual([]);
});

test('le zoom au pointeur autour d’une cible HYG reste accéléré malgré une interception ignorée', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'hyg-79134',
      selected: '',
      quality: 'high',
      zoom: '31.260826289872806',
      debug: 'true',
    }),
  );
  await expect.poll(() => queryParameter(page, 'target')).toBe('hyg-79134');
  const point = await findEmptyWheelCanvasPoint(page);
  const initialState = await readCameraInteractionState(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, -160);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance / initialState.distance)
    .toBeLessThan(0.8);
  const inwardState = await readCameraInteractionState(page);
  const inwardEntry = await page.evaluate(() =>
    window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().at(-1),
  );

  expect(inwardState.distance / initialState.distance).toBeGreaterThan(0.75);
  expect(inwardEntry).toMatchObject({
    interceptedObjectId: null,
    decision: 'zoom-pointer',
    anchor: { anchorType: 'pointer', anchorObjectId: null },
    before: { targetId: 'hyg-79134' },
    after: { targetId: 'hyg-79134' },
  });
  expect(inwardEntry?.deltaY).toBeLessThan(0);

  const interceptedPoint = await waitForLabelCenter(page, 'hyg-79134');

  await page.mouse.move(interceptedPoint.point.x, interceptedPoint.point.y);
  await page.mouse.wheel(0, 160);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeCloseTo(initialState.distance, 8);
  const restoredState = await readCameraInteractionState(page);
  const outwardEntry = await page.evaluate(() =>
    window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().at(-1),
  );

  expect(vectorDistance(restoredState.position, initialState.position)).toBeLessThan(1e-8);
  expect(vectorDistance(restoredState.target, initialState.target)).toBeLessThan(1e-8);
  expect(outwardEntry).toMatchObject({
    decision: 'zoom-pointer',
    anchor: { anchorType: 'pointer', anchorObjectId: null },
    before: { targetId: 'hyg-79134' },
    after: { targetId: 'hyg-79134' },
  });
  expect(outwardEntry?.interceptedObjectId).not.toBeNull();
  expect(outwardEntry?.deltaY).toBeGreaterThan(0);
  await expect.poll(() => queryParameter(page, 'target')).toBe('hyg-79134');
  expect(browserErrors).toEqual([]);
});

test('la molette adopte une étoile HYG libellée et conserve sa sélection', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', quality: 'low', zoom: '1400', debug: 'true' }),
  );
  const candidate = await waitForIsolatedCatalogPoint(page);

  await page.mouse.click(candidate.point.x, candidate.point.y);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(candidate.objectId);
  const label = await waitForLabelCenter(page, candidate.objectId);
  const beforeZoom = await readCameraInteractionState(page);

  await page.mouse.move(label.point.x, label.point.y);
  await wheelSemanticStep(page, -1);
  await expect.poll(() => queryParameter(page, 'target')).toBe(candidate.objectId);
  await expect.poll(() => queryParameter(page, 'selected')).toBe(candidate.objectId);
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(beforeZoom.distance);
  const trace = await page.evaluate(
    () => window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace() ?? [],
  );

  expect(trace.length).toBeGreaterThan(0);
  expect(trace.every((entry) => entry.interceptedObjectId === candidate.objectId)).toBe(true);
  expect(trace.every((entry) => entry.anchor?.anchorType === 'object')).toBe(true);
  expect(trace.every((entry) => entry.anchor?.anchorObjectId === candidate.objectId)).toBe(true);
  expect(trace.every((entry) => entry.after.targetId === candidate.objectId)).toBe(true);
  expect(browserErrors).toEqual([]);
});

test('une étoile HYG ciblée à la molette grandit sans ouvrir sa fiche', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({
      target: 'sun',
      selected: '',
      quality: 'low',
      density: 'dense',
      zoom: '1400',
    }),
  );
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).candidate?.objectId ?? null)
    .not.toBeNull();
  const candidate = (await readCatalogLabelLayout(page)).candidate;

  if (!candidate) {
    throw new Error('Aucun nom HYG dégagé ne peut être ciblé.');
  }

  await page.mouse.move(candidate.point.x, candidate.point.y);
  await wheelSemanticStep(page, -1);
  await expect.poll(() => queryParameter(page, 'target')).toBe(candidate.objectId);
  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  await expect
    .poll(() => readActiveCatalogStarState(page))
    .toMatchObject({
      objectId: candidate.objectId,
      visible: true,
      haloVisible: true,
      coreVisible: false,
    });
  const firstFocusedState = await readActiveCatalogStarState(page);

  for (let index = 0; index < 8; index += 1) {
    await wheelSemanticStep(page, -1);
  }
  await expect
    .poll(async () => {
      const state = await readActiveCatalogStarState(page);

      return {
        sameObject: state.objectId === candidate.objectId,
        haloGrew: state.haloPointSize > firstFocusedState.haloPointSize,
        coreVisible: state.coreVisible,
      };
    })
    .toEqual({ sameObject: true, haloGrew: true, coreVisible: true });
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

  await clickStableLabel(page, candidate.objectId);
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
    await wheelSemanticStep(page, -1);
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
    await wheelSemanticStep(page, -1);
  }
  await expect
    .poll(async () => (await readCameraInteractionState(page)).distance)
    .toBeLessThan(0.7);
  const closestCamera = await readCameraInteractionState(page);

  expect(closestCamera.minDistance).toBeCloseTo(0.55, 2);
  expect(closestCamera.distance).toBeCloseTo(closestCamera.minDistance, 2);

  const releasePoint = await findEmptyWheelCanvasPoint(page);

  await page.mouse.click(releasePoint.x, releasePoint.y, { button: 'right' });
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  const releasedBeforeZoom = await readCameraInteractionState(page);

  expect(releasedBeforeZoom.distance).toBeCloseTo(closestCamera.distance, 2);
  expect(releasedBeforeZoom.minDistance).toBeCloseTo(closestCamera.distance, 2);
  await page.mouse.move(releasePoint.x, releasePoint.y);
  await page.mouse.wheel(0, -120);
  const releasedCamera = await readCameraInteractionState(page);

  expect(releasedCamera.distance).toBeLessThanOrEqual(closestCamera.distance + 0.001);
  expect(releasedCamera.minDistance).toBeCloseTo(closestCamera.distance, 2);
  expect(vectorDistance(releasedCamera.position, closestCamera.position)).toBeGreaterThan(0.01);
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
  await expect(details).toContainText('Extrapolé');
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

    if (
      path.startsWith('/textures/') &&
      (/(earth|jupiter|mars|moon|saturn|venus)-/.test(path) ||
        /-(jpl|dawn|new-horizons)-/.test(path))
    ) {
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

test('une mosaïque de sonde observée est décodée dans le matériau détaillé', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'mercury', selected: 'mercury', quality: 'high', zoom: '4.8' }),
  );

  await expect
    .poll(() => readBodyTextureState(page, 'mercury'))
    .toEqual({ loaded: true, width: 1_024, height: 513 });
  await expect(
    page.getByRole('complementary', { name: 'Informations sur l’objet sélectionné' }),
  ).toContainText('Mosaïque globale MESSENGER MDIS observée');
  expect(browserErrors).toEqual([]);
});

test('les rotations planétaires restent fluides pendant la lecture temporelle', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  await page.getByRole('combobox', { name: 'Vitesse temporelle' }).selectOption({
    label: '1 jour / seconde',
  });
  await page.getByRole('button', { name: 'Faire avancer le temps' }).click();

  const samples = await sampleObjectQuaternions(page, 'earth', 14);
  const angularSteps = samples
    .slice(1)
    .map((sample, index) => quaternionDistance(sample, samples[index]!));
  const simulatedStepDays = samples
    .slice(1)
    .map((sample, index) => sample.julianDay - samples[index]!.julianDay);
  const movingSteps = angularSteps.filter((distance) => distance > 0.001).length;
  const simulatedDaysAtOneDayPerSecond = samples.at(-1)!.julianDay - samples[0]!.julianDay;
  const angularDistance = angularSteps.reduce((total, distance) => total + distance, 0);
  const averageSimulatedAngularSpeed = angularDistance / simulatedDaysAtOneDayPerSecond;
  const maximumEarthStepDrift = maximumAngularStepDrift(
    angularSteps,
    simulatedStepDays,
    averageSimulatedAngularSpeed,
  );

  expect(movingSteps).toBeGreaterThanOrEqual(10);
  expect(simulatedDaysAtOneDayPerSecond).toBeGreaterThan(0);
  expect(averageSimulatedAngularSpeed).toBeGreaterThan(5.5);
  expect(averageSimulatedAngularSpeed).toBeLessThan(7);
  expect(maximumEarthStepDrift).toBeLessThan(0.04);

  const marsSamples = await sampleObjectQuaternions(page, 'mars', 14);
  const marsAngularSteps = marsSamples
    .slice(1)
    .map((sample, index) => quaternionDistance(sample, marsSamples[index]!));
  const marsStepSeconds = marsSamples
    .slice(1)
    .map((sample, index) => (sample.timestampMs - marsSamples[index]!.timestampMs) / 1_000);
  const marsElapsedSeconds =
    (marsSamples.at(-1)!.timestampMs - marsSamples[0]!.timestampMs) / 1_000;
  const marsVisualAngularSpeed =
    marsAngularSteps.reduce((total, distance) => total + distance, 0) / marsElapsedSeconds;
  const maximumMarsStepDrift = maximumAngularStepDrift(
    marsAngularSteps,
    marsStepSeconds,
    marsVisualAngularSpeed,
  );

  expect(marsVisualAngularSpeed).toBeGreaterThan(5.3);
  expect(marsVisualAngularSpeed).toBeLessThan(7);
  expect(maximumMarsStepDrift).toBeLessThan(0.04);

  const [earthBeforePause] = await sampleObjectQuaternions(page, 'earth', 1);

  await page.getByRole('button', { name: 'Mettre le temps en pause' }).click();
  const settledSamples = await sampleObjectQuaternions(page, 'earth', 4);
  const pauseJump = quaternionDistance(earthBeforePause!, settledSamples[0]!);
  const simulatedDaysUntilPause = settledSamples[0]!.julianDay - earthBeforePause!.julianDay;
  const expectedPauseJump = averageSimulatedAngularSpeed * simulatedDaysUntilPause;
  const finalMovement = quaternionDistance(settledSamples[2]!, settledSamples[3]!);

  expect(simulatedDaysUntilPause).toBeGreaterThanOrEqual(0);
  expect(simulatedDaysUntilPause).toBeLessThan(0.15);
  expect(Math.abs(pauseJump - expectedPauseJump)).toBeLessThan(0.04);
  expect(finalMovement).toBeLessThan(0.001);
  expect(browserErrors).toEqual([]);
});

test('les lunes martiennes gardent leur orbite scientifique pendant la lecture temporelle', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'phobos', selected: 'phobos', zoom: '4.8' }));
  await expect(
    page.getByRole('complementary', { name: 'Informations sur l’objet sélectionné' }),
  ).toContainText('Phobos');
  await page.getByRole('combobox', { name: 'Vitesse temporelle' }).selectOption({
    label: '1 heure / seconde',
  });
  await page.getByRole('button', { name: 'Faire avancer le temps' }).click();

  const samples = await sampleObjectPositions(page, 'phobos', 16);
  const angularSteps = samples
    .slice(1)
    .map((sample, index) => vectorAngularDistance(sample, samples[index]!));
  const movingSteps = angularSteps.filter((distance) => distance > 0.002).length;
  const scientificElapsedDays = samples.at(-1)!.julianDay - samples[0]!.julianDay;
  const angularDistance = angularSteps.reduce((total, distance) => total + distance, 0);
  const scientificAngularSpeed = angularDistance / scientificElapsedDays;

  expect(movingSteps).toBeGreaterThanOrEqual(10);
  expect(Math.max(...angularSteps)).toBeLessThan(0.2);
  expect(scientificElapsedDays).toBeGreaterThan(0.02);
  expect(scientificAngularSpeed).toBeGreaterThan(18);
  expect(scientificAngularSpeed).toBeLessThan(22);

  const [phobosBeforePause] = await sampleObjectPositions(page, 'phobos', 1);

  await page.getByRole('button', { name: 'Mettre le temps en pause' }).click();
  const paused = await sampleObjectPositions(page, 'phobos', 3);
  const pauseJump = vectorAngularDistance(phobosBeforePause!, paused[0]!);

  expect(pauseJump).toBeLessThan(0.2);
  expect(vectorDistance(paused[2]!, paused[1]!)).toBeLessThan(1e-9);
  expect(browserErrors).toEqual([]);
});

test('Vénus conserve sa lente rotation scientifique à un jour par seconde', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'venus', selected: '', zoom: '4.8' }));
  await page.getByRole('combobox', { name: 'Vitesse temporelle' }).selectOption({
    label: '1 jour / seconde',
  });
  await page.getByRole('button', { name: 'Faire avancer le temps' }).click();

  const samples = await sampleObjectQuaternions(page, 'venus', 30);
  const angularDistance = samples
    .slice(1)
    .map((sample, index) => quaternionDistance(sample, samples[index]!))
    .reduce((total, distance) => total + distance, 0);

  expect(angularDistance).toBeGreaterThan(0.004);
  expect(angularDistance).toBeLessThan(0.05);
  expect(browserErrors).toEqual([]);
});

test('un million d’années par seconde conserve une boucle fluide et un état fini', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  await page.getByRole('combobox', { name: 'Vitesse temporelle' }).selectOption({
    label: '1 million d’années / seconde',
  });
  await page.getByRole('button', { name: 'Faire avancer le temps' }).click();

  const samples = await sampleObjectQuaternions(page, 'earth', 8);
  const elapsedRealMilliseconds = samples.at(-1)!.timestampMs - samples[0]!.timestampMs;
  const elapsedSimulatedDays = samples.at(-1)!.julianDay - samples[0]!.julianDay;

  expect(elapsedRealMilliseconds).toBeLessThan(2_000);
  expect(elapsedSimulatedDays).toBeGreaterThan(1_000_000);
  expect(samples.every(({ x, y, z, w }) => [x, y, z, w].every(Number.isFinite))).toBe(true);
  await page.getByRole('button', { name: 'Mettre le temps en pause' }).click();
  await expect(page.getByRole('button', { name: 'Faire avancer le temps' })).toBeVisible();
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
  await expect
    .poll(() => readSolarEclipseEventMapState(page))
    .toEqual({
      visible: true,
      partialEnvelopeVisible: true,
      corridorVisible: true,
      corridorLimitsVisible: true,
      centralLineVisible: true,
      bodyFixed: true,
      europeCovered: true,
      europeFramed: true,
      overviewFramed: true,
      sufficientSampling: true,
      source: 'Astronomy Engine geocentric ephemerides · validated against NASA GSFC path tables',
    });

  await timeline.getByRole('button', { name: /Vue au sol/ }).click();
  await expect(timeline).toContainText('Observation locale');
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();
  await waitForCameraSettled(page);
  await expect
    .poll(async () => {
      const state = await readSolarObserverVisualState(page);

      return {
        observerModeActive: state.observerModeActive,
        sunVisible: state.sunVisible,
        moonVisible: state.moonVisible,
        earthVisible: state.earthVisible,
        coronaVisible: state.coronaVisible,
        sunOnScreen: state.sunOnScreen,
        moonOnScreen: state.moonOnScreen,
      };
    })
    .toEqual({
      observerModeActive: true,
      sunVisible: true,
      moonVisible: true,
      earthVisible: false,
      coronaVisible: true,
      sunOnScreen: true,
      moonOnScreen: true,
    });
  expect((await readSolarObserverVisualState(page)).screenSeparation).toBeLessThan(0.08);

  await timeline.getByRole('button', { name: /Retour en orbite/ }).click();
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  expect(browserErrors).toEqual([]);
});

test('un maximum local distingue la ville, l’UTC et l’heure française', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir les événements astronomiques' }).click();
  const browser = page.getByRole('region', { name: 'Éclipses terrestres' });

  await chooseObserverLocation(
    browser,
    'Lieu d’observation de l’éclipse',
    'Lyon',
    /^Lyon France$/u,
  );
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
  await expect(timeline).toContainText('C1 19:27');
  await expect(timeline).toContainText('Max 20:21');
  await expect(timeline).toContainText('C4 21:12');
  await expect(timeline).toContainText('sous l’horizon');
  await expect(timeline).toContainText('Heure locale');
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => queryParameter(page, 'time')?.startsWith('2026-08-12T18:21')).toBe(true);
  expect(browserErrors).toEqual([]);
});

test('des coordonnées arbitraires exposent les cinq contacts d’une totalité locale', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ selected: '' }));
  await page.getByRole('button', { name: 'Ouvrir les événements astronomiques' }).click();
  const browser = page.getByRole('region', { name: 'Éclipses terrestres' });

  await chooseCustomObserverLocation(
    browser,
    'Lieu d’observation de l’éclipse',
    'Coordonnées personnalisées',
  );
  const localAction = browser.getByRole('button', {
    name: /Voir le maximum local de Éclipse solaire totale, 12 août 2026.+Coordonnées personnalisées/,
  });

  await expect(localAction).toBeDisabled();
  await browser
    .getByRole('spinbutton', { name: 'Latitude d’observation en degrés' })
    .fill('64.1466');
  await browser
    .getByRole('spinbutton', { name: 'Longitude d’observation en degrés' })
    .fill('-21.9426');
  await expect(localAction).toBeEnabled();
  await localAction.click();

  const timeline = page.getByRole('region', { name: 'Contrôle du temps' });

  await expect(timeline).toContainText('Maximum local · Coordonnées personnalisées');
  await expect(timeline).toContainText('Éclipse solaire totale à Coordonnées personnalisées');
  await expect(timeline).toContainText('C1');
  await expect(timeline).toContainText('C2');
  await expect(timeline).toContainText('Max');
  await expect(timeline).toContainText('C3');
  await expect(timeline).toContainText('C4');
  await expect(timeline).toContainText('UTC');
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
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

test('les nouvelles cartes planétaires se chargent au LOD proche avec leur provenance', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const browserErrors = monitorBrowserErrors(page);
  const cases = [
    ['saturn', 2048, 1024, 'NASA VTAD'],
    ['uranus', 1024, 512, 'NASA VTAD'],
    ['neptune', 1024, 512, 'NASA VTAD'],
    ['titan', 1024, 512, 'Cassini ISS'],
  ] as const;

  for (const [id, width, height, provenance] of cases) {
    await openUniverse(
      page,
      universeUrl({ target: id, selected: id, quality: 'high', zoom: '4.8' }),
    );
    await expect
      .poll(() => readBodyTextureState(page, id), { timeout: 30_000 })
      .toEqual({ loaded: true, width, height });
    await expect(
      page.getByRole('complementary', { name: 'Informations sur l’objet sélectionné' }),
    ).toContainText(provenance);
  }
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

test('le mode debug journalise, copie puis efface les interactions de molette', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(
    page,
    universeUrl({ target: 'sun', selected: '', zoom: '2.7', debug: 'true' }),
  );
  const panel = page.getByRole('complementary', { name: 'Statistiques de débogage' });
  const point = await findEmptyWheelCanvasPoint(page);

  await expect
    .poll(async () => {
      const camera = await readCameraInteractionState(page);

      return camera.distance / camera.minDistance;
    })
    .toBeCloseTo(1, 6);

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, -420);
  await expect
    .poll(() =>
      page.evaluate(() => window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().length),
    )
    .toBeGreaterThan(0);

  const entry = await page.evaluate(() =>
    window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().at(-1),
  );

  expect(entry).toMatchObject({
    deltaY: expect.closeTo(-57.7622644064, 9),
    rawDeltaY: -420,
    deltaMode: 0,
    interceptedObjectId: null,
    decision: 'release-target',
    anchor: { anchorType: 'pointer', anchorObjectId: null },
    before: {
      targetId: 'sun',
      referenceFrame: 'solar-system',
    },
    after: {
      targetId: null,
      referenceFrame: 'solar-system',
    },
  });
  expect(entry?.before.cameraPosition).not.toEqual(entry?.after.cameraPosition);

  await panel.getByRole('button', { name: 'Copier la trace' }).click();
  await expect(panel).toContainText('Trace copiée');
  await panel.getByRole('button', { name: 'Effacer' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__UNIVERSE_MAP_OBSERVABILITY__?.getNavigationDebugTrace().length),
    )
    .toBe(0);
  await expect(panel).toContainText('Trace effacée');
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

async function wheelSemanticStep(page: Page, direction: -1 | 1): Promise<void> {
  // Eight full impulses plus the analytically inverted remainder produce exactly
  // 480 normalized units: one semantic scale step under the logarithmic model.
  for (let index = 0; index < 8; index += 1) {
    await page.mouse.wheel(0, direction * 120);
    await waitForWheelSample(page);
  }
  await page.mouse.wheel(0, direction * 23.28379966058013);
  await waitForWheelSample(page);
}

async function clickStableLabel(page: Page, objectId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const label = await waitForStableLabelCenter(page, objectId);

    await page.mouse.move(label.point.x, label.point.y);
    await expect
      .poll(async () => (await readCatalogLabelLayout(page)).hoveredObjectId)
      .toBe(objectId);
    const hoveredLabel = await waitForStableLabelCenter(page, objectId);
    const drift = Math.hypot(
      hoveredLabel.point.x - label.point.x,
      hoveredLabel.point.y - label.point.y,
    );

    if (drift <= 0.5) {
      await page.mouse.down();
      await page.mouse.up();

      return;
    }
  }

  throw new Error(`Le label ${objectId} ne s’est pas stabilisé sous le pointeur.`);
}

async function waitForStableLabelCenter(
  page: Page,
  objectId: string,
): ReturnType<typeof waitForLabelCenter> {
  let previous = await waitForLabelCenter(page, objectId);
  let stable = previous;
  let stableSampleCount = 0;

  await expect
    .poll(
      async () => {
        const current = await readLabelCenter(page, objectId);

        if (!current) {
          stableSampleCount = 0;

          return stableSampleCount;
        }
        const drift = Math.hypot(
          current.point.x - previous.point.x,
          current.point.y - previous.point.y,
        );

        stableSampleCount = drift <= 0.5 ? stableSampleCount + 1 : 0;
        previous = current;
        stable = current;

        return stableSampleCount;
      },
      { intervals: [80], timeout: 4_000 },
    )
    .toBeGreaterThanOrEqual(2);

  return stable;
}

async function waitForWheelSample(page: Page): Promise<void> {
  // Run the interval on the page event loop and leave the 180 ms normalization window between
  // samples. Each raw impulse then has the independent soft-limit used by the analytical 480-unit
  // sequence above, while the object lock remains stable across the complete wheel burst.
  await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 185)));
}

function wrappedHorizontalDelta(currentX: number, previousX: number, width: number): number {
  const delta = currentX - previousX;

  if (delta > width / 2) {
    return delta - width;
  }
  if (delta < -width / 2) {
    return delta + width;
  }

  return delta;
}

async function wasResourceLoaded(page: Page, suffix: string): Promise<boolean> {
  return (await resourceLoadCount(page, suffix)) > 0;
}

async function resourceLoadCount(page: Page, suffix: string): Promise<number> {
  return page.evaluate(
    (resourceSuffix) =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.endsWith(resourceSuffix)).length,
    suffix,
  );
}

async function readDebugNumber(panel: Locator, stat: string): Promise<number> {
  const text = await panel.locator(`[data-debug-stat="${stat}"]`).textContent();

  return Number(text?.trim().replace('×', ''));
}

async function readDebugTimings(panel: Locator, stat: string): Promise<number[]> {
  const text = await panel.locator(`[data-debug-stat="${stat}"]`).textContent();

  return [...(text?.matchAll(/(-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?) ms/gi) ?? [])].map(
    (match) => Number(match[1]),
  );
}

async function locatorCenter(
  locator: Locator,
): Promise<{ readonly x: number; readonly y: number }> {
  const bounds = await locator.boundingBox();

  if (!bounds) {
    throw new Error('Élément visible attendu pour mesurer son centre.');
  }

  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

async function rasterizedSvgOpaquePixelCount(locator: Locator): Promise<number> {
  return locator.evaluate(async (element) => {
    const source = element.cloneNode(true) as SVGSVGElement;

    source.setAttribute('height', '184');
    source.setAttribute('width', '800');
    source.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([new XMLSerializer().serializeToString(source)], {
      type: 'image/svg+xml',
    });
    const sourceUrl = URL.createObjectURL(blob);

    try {
      const image = new Image();

      image.src = sourceUrl;
      await new Promise<void>((resolve, reject) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => reject(new Error('Unable to rasterize SVG.')), {
          once: true,
        });
      });
      const canvas = document.createElement('canvas');

      canvas.width = 800;
      canvas.height = 184;
      const context = canvas.getContext('2d');

      if (!context) {
        return 0;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaquePixels = 0;

      for (let offset = 3; offset < pixels.length; offset += 4) {
        if (pixels[offset]! > 0) {
          opaquePixels += 1;
        }
      }

      return opaquePixels;
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  });
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

function maximumAngularStepDrift(
  angularSteps: readonly number[],
  elapsedSteps: readonly number[],
  averageAngularSpeed: number,
): number {
  return Math.max(
    ...angularSteps.map((step, index) =>
      Math.abs(step - averageAngularSpeed * elapsedSteps[index]!),
    ),
  );
}

function vectorDistance(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
): number {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function vectorDifference(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return { x: first.x - second.x, y: first.y - second.y, z: first.z - second.z };
}

function vectorLength(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function vectorDot(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function vectorAngularDistance(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
): number {
  const firstLength = Math.hypot(first.x, first.y, first.z);
  const secondLength = Math.hypot(second.x, second.y, second.z);
  const cosine =
    (first.x * second.x + first.y * second.y + first.z * second.z) / (firstLength * secondLength);

  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

function rgbDistance(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}
