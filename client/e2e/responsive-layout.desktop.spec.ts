import { expect, test, type Locator } from '@playwright/test';
import { monitorBrowserErrors, openUniverse, universeUrl } from './universe-test-helpers';

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 844, height: 390 },
  { width: 1100, height: 720 },
  { width: 1101, height: 720 },
  { width: 1280, height: 720 },
]) {
  test(`les panneaux restent contenus et la carte accessible à ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = monitorBrowserErrors(page);

    await openUniverse(page, universeUrl({ target: 'earth', selected: 'earth', zoom: '4.96' }));
    const brand = await box(page.locator('.brand'));
    const search = await box(page.locator('.search-shell'));
    const actions = await box(page.locator('.topbar__actions'));

    expect(intersects(brand, search)).toBe(false);
    expect(intersects(search, actions)).toBe(false);
    expect(actions.x + actions.width).toBeLessThanOrEqual(viewport.width);

    const timeline = page.locator('.timeline');
    const details = page.locator('.details');
    const toggle = timeline.locator('.timeline-toggle');

    if (viewport.width <= 1100) {
      expect((await box(timeline)).height).toBeLessThanOrEqual(70);
      await expect(timeline.getByLabel('Mode temporel')).toBeHidden();
      await details.getByRole('button', { name: 'Réduire la fiche', exact: true }).click();
      await expect(details).toHaveAttribute('data-sheet-state', 'summary');
      await expect.poll(async () => (await box(details)).height).toBeLessThanOrEqual(110);
      await expect(
        details.getByRole('button', { name: 'Ouvrir la fiche', exact: true }),
      ).toBeVisible();
      await expect(
        details.getByRole('button', { name: 'Fermer la fiche', exact: true }),
      ).toBeVisible();
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(timeline.getByLabel('Mode temporel')).toBeVisible();
      await expect(
        timeline.getByRole('button', { name: 'Aujourd’hui', exact: true }),
      ).toBeVisible();
    }

    await expect(timeline.getByLabel('Mode temporel')).toBeVisible();
    const timelineBox = await box(timeline);

    for (const control of await timeline
      .locator('button:visible, input:visible, select:visible')
      .all()) {
      const bounds = await box(control);

      expect(bounds.x).toBeGreaterThanOrEqual(timelineBox.x);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(timelineBox.x + timelineBox.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect
      .poll(async () => {
        const bounds = await box(details);

        return bounds.y + bounds.height;
      })
      .toBeLessThanOrEqual(timelineBox.y - 8);

    if (viewport.width <= 1100) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await details.getByRole('button', { name: 'Ouvrir la fiche', exact: true }).click();
      await expect(details.locator('.description')).toBeVisible();
    }

    await details.getByRole('button', { name: 'Fermer la fiche', exact: true }).click();
    await expect(page.locator('app-floating-controls .controls')).toBeVisible();
    await page.getByRole('searchbox').fill('Sirius');
    const results = page.getByRole('listbox', { name: 'Résultats de recherche' });

    await expect(results).toBeVisible();
    const resultBox = await box(results);

    expect(resultBox.x).toBeGreaterThanOrEqual(0);
    expect(resultBox.x + resultBox.width).toBeLessThanOrEqual(viewport.width);
    expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(viewport.height);
    expect(errors).toEqual([]);
  });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`la fiche garde deux actions principales et une orbite accessible à ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = monitorBrowserErrors(page);

    await openUniverse(page, universeUrl({ target: 'mars', selected: 'mars', orbits: '0' }));
    const details = page.locator('.details');
    const actions = details.locator('.details__actions button');

    await expect(actions).toHaveCount(2);
    await actions.first().scrollIntoViewIfNeeded();
    const first = await box(actions.first());
    const second = await box(actions.last());

    expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
    expect(intersects(first, second)).toBe(false);
    const orbit = details.locator('.facts').getByRole('button', { name: 'Orbite · Soleil' });

    await orbit.scrollIntoViewIfNeeded();
    await orbit.click({ trial: true });
    expect((await box(orbit)).height).toBeGreaterThanOrEqual(44);
    await orbit.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => new URL(page.url()).searchParams.get('target')).toBe('sun');
    await expect.poll(() => new URL(page.url()).searchParams.get('orbits')).toBe('1');
    await expect(details.locator('h2')).toHaveText('Mars');
    expect(errors).toEqual([]);
  });

  test(`Lumière reçue conserve ses précisions sans toast à ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = monitorBrowserErrors(page);

    await openUniverse(page, universeUrl({ target: 'sun', selected: 'sun', mode: 'state' }));
    const timeline = page.locator('.timeline');
    const mode = timeline.getByLabel('Mode temporel', { exact: true });
    const context = timeline.locator('.received-light-context');

    if (viewport.width <= 1100) {
      await timeline.locator('.timeline-toggle').click();
    }
    await mode.selectOption('observable');
    await expect(context).toContainText('Retard calculé/extrapolé');
    await expect(page.locator('.notice--warning')).toHaveCount(0);
    await expect(page.locator('.details')).toContainText('Époque d’émission');
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('observable');

    await openUniverse(page, page.url());
    await expect(context).toContainText('Lumière reçue');
    await expect(page.locator('.notice--warning')).toHaveCount(0);
    if (viewport.width <= 1100) {
      await timeline.locator('.timeline-toggle').click();
    }
    await mode.selectOption('state');
    await expect(context).toHaveCount(0);
    await expect(page.locator('.notice--warning')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const viewport of [
  { width: 390, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
]) {
  test(`le planétarium garde sa recherche et son retour accessibles à ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = monitorBrowserErrors(page);

    await openUniverse(
      page,
      universeUrl({ target: 'mars', selected: 'mars', view: 'planetarium' }),
    );
    const sky = page.locator('#earth-sky-view');

    await expect(sky).toHaveAttribute('data-phase', 'open');
    const close = sky.locator('.earth-sky-view__close');
    const search = await box(sky.locator('.search-shell'));

    expect(intersects(await box(close), search)).toBe(false);
    expect(search.x).toBeGreaterThanOrEqual(0);
    expect(search.x + search.width).toBeLessThanOrEqual(viewport.width);
    const timeline = page.locator('.timeline');

    expect(await timeline.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
      await timeline.evaluate((element) => element.clientWidth),
    );
    const controls = await box(sky.locator('.earth-sky-view__controls'));

    expect(controls.y + controls.height).toBeLessThanOrEqual((await box(timeline)).y - 8);
    const details = page.locator('.details');

    await expect(details).toBeVisible();
    expect(
      intersects(await box(details), await box(sky.locator('.earth-sky-view__location'))),
    ).toBe(false);
    for (const name of ['Déployer la fiche', 'Réduire la fiche']) {
      await details.getByRole('button', { name, exact: true }).click();
      for (const button of await sky.locator('.earth-sky-view__controls button:visible').all()) {
        await button.click({ trial: true });
      }
    }
    await details.getByRole('button', { name: 'Ouvrir la fiche', exact: true }).click();
    await sky.getByRole('searchbox').fill('a');
    const results = sky.getByRole('listbox', { name: 'Résultats de recherche' });

    await expect(results).toBeVisible();
    await results.getByRole('option').last().click({ trial: true });
    await sky.getByRole('searchbox').fill('');
    if (viewport.height < 520) {
      await sky.locator('.earth-sky-view__planner-launch').click();
      const planner = sky.locator('.earth-observation-planner');

      await expect(planner).toBeVisible();
      await planner
        .getByRole('button', { name: 'Observer à cet instant' })
        .first()
        .click({ trial: true });
      expect(await planner.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
        await planner.evaluate((element) => element.clientWidth),
      );
      await planner.locator('.earth-observation-planner__close').click();
    }
    await close.click();
    await expect(sky).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('.topbar')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

async function box(locator: Locator): Promise<Box> {
  const bounds = await locator.boundingBox();

  expect(bounds).not.toBeNull();

  return bounds!;
}

function intersects(first: Box, second: Box): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}
