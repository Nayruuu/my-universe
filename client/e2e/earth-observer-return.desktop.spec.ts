import { expect, test } from '@playwright/test';
import {
  findEmptyCanvasPoint,
  monitorBrowserErrors,
  openUniverse,
  queryParameter,
  readCameraInteractionState,
  readObjectScreenPoint,
  universeUrl,
  waitForCameraSettled,
} from './universe-test-helpers';

for (const target of ['sirius', 'moon']) {
  test(`le retour depuis ${target} recule continûment vers une Terre centrée`, async ({ page }) => {
    const browserErrors = monitorBrowserErrors(page);

    await openUniverse(
      page,
      universeUrl({ target, selected: '', view: 'planetarium', observer: 'paris' }),
    );
    const sky = page.locator('#earth-sky-view');
    const canvas = await page.locator('canvas.universe-canvas').elementHandle();

    await expect(sky).toHaveAttribute('data-phase', 'open');
    const before = await readCameraInteractionState(page);

    await sky.locator('.earth-sky-view__close').click();
    await expect(sky).toHaveAttribute('data-phase', 'returning');
    await expect(sky).toHaveAttribute('aria-busy', 'true');
    const frames = [await readCameraInteractionState(page)];

    expect(frames[0]!.transitioning).toBe(true);
    expect(vectorDistance(before.position, frames[0]!.position)).toBeLessThan(0.08);
    expect(vectorDistance(before.direction, frames[0]!.direction)).toBeLessThan(0.02);
    for (let frame = 0; frame < 10; frame += 1) {
      await page.waitForTimeout(120);
      frames.push(await readCameraInteractionState(page));
    }
    await expect(sky).toHaveCSS('opacity', '0');
    await expect(sky).toHaveCount(0, { timeout: 5_000 });
    await waitForCameraSettled(page);
    const arrival = await readCameraInteractionState(page);
    const radii = frames.map((frame) => vectorDistance(frame.position, arrival.target));

    for (let index = 1; index < radii.length; index += 1) {
      expect(radii[index]!).toBeGreaterThanOrEqual(radii[index - 1]! - 1e-6);
    }
    expect(radii[0]!).toBeGreaterThan(0.62);
    expect(radii.at(-1)!).toBeGreaterThan(radii[0]! * 2);
    expect(arrival.distance).toBeCloseTo(4.96, 5);
    expect(arrival.fieldOfView).toBe(48);
    expect(arrival.observerModeActive).toBe(false);
    expect(arrival.controlsEnabled && arrival.rotateEnabled && arrival.panEnabled).toBe(true);
    expect(queryParameter(page, 'view')).toBe('map');
    expect(queryParameter(page, 'target')).toBe('earth');
    expect(queryParameter(page, 'mode')).toBe('state');
    expect(queryParameter(page, 'orientation')).not.toBeNull();
    expect(
      await canvas!.evaluate(
        (element) => element === document.querySelector('canvas.universe-canvas'),
      ),
    ).toBe(true);
    const earth = await readObjectScreenPoint(page, 'earth');
    const viewport = page.viewportSize()!;

    expect(earth.x).toBeCloseTo(viewport.width / 2, 0);
    expect(earth.y).toBeCloseTo(viewport.height / 2, 0);
    expect(browserErrors).toEqual([]);
  });
}

test('un geste arrête le retour et la caméra ne reprend pas sa trajectoire', async ({ page }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sirius', selected: '', view: 'planetarium' }));
  const sky = page.locator('#earth-sky-view');

  await expect(sky).toHaveAttribute('data-phase', 'open');
  await sky.locator('.earth-sky-view__close').click();
  await expect(sky).toHaveAttribute('data-phase', 'returning');
  await page.waitForTimeout(500);
  const empty = await findEmptyCanvasPoint(page);

  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await expect(sky).toHaveCount(0);
  await page.mouse.move(empty.x + 50, empty.y + 20, { steps: 6 });
  await page.mouse.up();
  await waitForCameraSettled(page);
  await page.waitForTimeout(1_200);
  const interrupted = await readCameraInteractionState(page);

  await page.waitForTimeout(1_600);
  const later = await readCameraInteractionState(page);

  expect(interrupted.distance).toBeLessThan(2);
  expect(later.transitioning).toBe(false);
  expect(vectorDistance(interrupted.position, later.position)).toBeLessThan(0.002);
  expect(later.distance).toBeCloseTo(interrupted.distance, 5);
  expect(browserErrors).toEqual([]);
});

test('la préférence de mouvement réduit rend immédiatement la carte utilisable', async ({
  page,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openUniverse(page, universeUrl({ target: 'sirius', selected: '', view: 'planetarium' }));
  const sky = page.locator('#earth-sky-view');

  await expect(sky).toHaveAttribute('data-phase', 'open');
  await sky.locator('.earth-sky-view__close').click();
  await expect(sky).toHaveCount(0);
  const arrival = await readCameraInteractionState(page);

  expect(arrival.transitioning).toBe(false);
  expect(arrival.controlsEnabled).toBe(true);
  expect(arrival.distance).toBeCloseTo(4.96, 5);
  expect(arrival.fieldOfView).toBe(48);
  await expect.poll(() => queryParameter(page, 'target')).toBe('earth');
  await expect.poll(() => queryParameter(page, 'zoom')).toBe('4.96');
  expect(queryParameter(page, 'view')).toBe('map');
  expect(browserErrors).toEqual([]);
});

function vectorDistance(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}
