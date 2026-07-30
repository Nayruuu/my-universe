import { expect, test } from '@playwright/test';
import {
  monitorBrowserErrors,
  numericQueryParameter,
  openUniverse,
  queryParameter,
  readBodyTextureState,
  readCameraInteractionState,
  readCatalogLabelLayout,
  readGalaxyImpostorStates,
  readObjectRotation,
  readOrbitVisualState,
  readPlanetaryRingVisualState,
  readRotationGuideState,
  readSolarEclipseVisualState,
  readStarCatalogBatchState,
  sampleObjectQuaternions,
  universeUrl,
  waitForCameraSettled,
  waitForIsolatedCatalogPoint,
  waitForLabelCenter,
} from './universe-test-helpers';

test('un clic sur un nom sélectionne et centre automatiquement l’étoile', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'milky-way', selected: '', quality: 'low' }));

  const { point } = await waitForLabelCenter(page, 'sirius');

  await page.mouse.move(point.x, point.y);
  await expect(page.locator('canvas.universe-canvas')).toHaveCSS('cursor', 'pointer');
  await page.mouse.click(point.x, point.y);

  await expect.poll(() => queryParameter(page, 'target')).toBe('sirius');
  await expect.poll(() => queryParameter(page, 'selected')).toBe('sirius');
  await expect(page.getByRole('heading', { name: 'Sirius' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('un zoom dans le vide conserve un cadrage minimal et suspend les gestes orbitaux', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sun', selected: '', zoom: '2.7' }));

  const zoomButton = page.getByRole('button', { name: 'Zoomer', exact: true });

  await page.mouse.move(1_020, 600);
  await page.mouse.wheel(0, -160);
  await expect.poll(() => queryParameter(page, 'target')).toBeNull();

  const releasedState = await readCameraInteractionState(page);

  expect(releasedState.rotateEnabled).toBe(false);
  expect(releasedState.panEnabled).toBe(false);
  expect(releasedState.minDistance).toBeGreaterThanOrEqual(0.75);

  for (let index = 0; index < 3; index += 1) {
    await zoomButton.click();
  }

  await expect
    .poll(() => numericQueryParameter(page, 'zoom'))
    .toBeCloseTo(releasedState.minDistance, 1);
  const beforeDrag = await readCameraInteractionState(page);

  await page.mouse.move(850, 450);
  await page.mouse.down();
  await page.mouse.move(1_050, 570, { steps: 8 });
  await page.mouse.up();

  const afterDrag = await readCameraInteractionState(page);

  expect(afterDrag.position.x).toBeCloseTo(beforeDrag.position.x, 5);
  expect(afterDrag.position.y).toBeCloseTo(beforeDrag.position.y, 5);
  expect(afterDrag.position.z).toBeCloseTo(beforeDrag.position.z, 5);
  expect(afterDrag.target.x).toBeCloseTo(beforeDrag.target.x, 5);
  expect(afterDrag.target.y).toBeCloseTo(beforeDrag.target.y, 5);
  expect(afterDrag.target.z).toBeCloseTo(beforeDrag.target.z, 5);

  await openUniverse(page, universeUrl({ target: 'milky-way', selected: '', zoom: '17500' }));
  const zoomOutButton = page.getByRole('button', { name: 'Dézoomer', exact: true });

  await zoomOutButton.click();
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(18_000, 0);
  expect((await readCameraInteractionState(page)).maxDistance).toBe(18_000);
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

test('le sélecteur traverse les cinq échelles et partage le cadrage courant', async ({ page }) => {
  test.setTimeout(60_000);
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth' }));
  const scaleSwitcher = page.getByRole('button', { name: 'Changer d’échelle' });

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Voisinage stellaire' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('sun');
  await expect.poll(() => queryParameter(page, 'selected')).toBeNull();
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(1_350);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(1_450);
  await expect(scaleSwitcher).toContainText('Voisinage stellaire');

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Voie lactée' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('milky-way');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(5_100);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(5_300);
  await expect(scaleSwitcher).toContainText('Voie lactée');

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Groupe local' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('local-group');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeGreaterThan(16_900);
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(17_100);
  await expect(scaleSwitcher).toContainText('Groupe local');

  await scaleSwitcher.click();
  await page.getByRole('button', { name: 'Afficher l’échelle Planétaire' }).click();
  await waitForCameraSettled(page);
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeLessThan(5);
  await expect(scaleSwitcher).toContainText('Planétaire');
  expect(browserErrors).toEqual([]);
});

test('la molette effectue Terre → Groupe local → Terre sans perdre son ancre', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'earth', selected: '', zoom: '4.8' }));
  const canvas = page.locator('canvas.universe-canvas');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);

  for (const expectedDistance of [520, 1_400, 5_200, 17_000]) {
    await page.mouse.wheel(0, 480);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 0);
  }

  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText(
    'Groupe local',
  );
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(17_000, 0);

  for (const expectedDistance of [5_200, 1_400, 520, 4.8]) {
    await page.mouse.wheel(0, -480);
    await expect
      .poll(async () => (await readCameraInteractionState(page)).distance)
      .toBeCloseTo(expectedDistance, 1);
  }

  await expect(page.getByRole('button', { name: 'Changer d’échelle' })).toContainText('Planétaire');
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => numericQueryParameter(page, 'zoom')).toBeCloseTo(4.8, 1);
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
    .toBeGreaterThanOrEqual(10);
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
  expect(browserErrors).toEqual([]);
});

test('les noms HYG restent espacés et centrent directement leur étoile', async ({ page }) => {
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
    .toBeGreaterThan(5);

  const layout = await readCatalogLabelLayout(page);

  expect(layout.totalCount).toBeLessThanOrEqual(40);
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
      zoom: '5200',
    }),
  );
  await expect
    .poll(async () => (await readCatalogLabelLayout(page)).catalogCount)
    .toBeGreaterThan(12);

  const galacticLayout = await readCatalogLabelLayout(page);

  expect(galacticLayout.totalCount).toBeLessThanOrEqual(28);
  expect(galacticLayout.overlapCount).toBe(0);
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

  await browser.getByRole('button', { name: /Voir Éclipse lunaire partielle/ }).click();

  await expect.poll(() => queryParameter(page, 'target')).toBe('moon');
  await expect.poll(() => queryParameter(page, 'time')?.startsWith('2026-08-28T04:12')).toBe(true);
  await expect(page.getByRole('heading', { name: 'Lune' })).toBeVisible();
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

  expect(movingSteps).toBeGreaterThanOrEqual(10);
  expect(angularSteps.reduce((total, distance) => total + distance, 0)).toBeLessThan(0.25);

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
  const state = await readPlanetaryRingVisualState(page, 'saturn');

  expect(state.opacity).toBeGreaterThan(0.85);
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

  const stats = await panel
    .locator('dl > div')
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((row) => [
          row.querySelector('dt')?.textContent?.trim() ?? '',
          row.querySelector('dd')?.textContent?.trim() ?? '',
        ]),
      ),
    );

  expect(Number(stats['Draw calls'])).toBeLessThanOrEqual(10);
  expect(Number(stats['Géométries'])).toBeLessThanOrEqual(25);
  expect(Number(stats['Textures'])).toBeLessThanOrEqual(6);
  expect(Number(stats['Objets visibles'])).toBeGreaterThan(0);
  expect(Number(stats['Étoiles HYG'])).toBeGreaterThan(0);
  await expect(page.locator('canvas.universe-canvas')).toHaveCount(1);
  expect(browserErrors).toEqual([]);
});

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
