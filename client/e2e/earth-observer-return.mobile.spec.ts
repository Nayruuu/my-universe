import { expect, test } from '@playwright/test';
import {
  monitorBrowserErrors,
  openUniverse,
  queryParameter,
  readCameraInteractionState,
  universeUrl,
  waitForCameraSettled,
} from './universe-test-helpers';

test('le retour du planétarium est animé et la Terre reste navigable au toucher', async ({
  page,
  context,
}) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'sirius', selected: '', view: 'planetarium' }));
  const sky = page.locator('#earth-sky-view');

  await expect(sky).toHaveAttribute('data-phase', 'open');
  await sky.locator('.earth-sky-view__close').tap();
  await expect(sky).toHaveAttribute('data-phase', 'returning');
  await expect(sky).toHaveCount(0, { timeout: 5_000 });
  await waitForCameraSettled(page);
  const arrival = await readCameraInteractionState(page);

  expect(arrival.distance).toBeCloseTo(4.96, 5);
  expect(arrival.fieldOfView).toBe(48);
  expect(queryParameter(page, 'target')).toBe('earth');
  const session = await context.newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 120, y: 370, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 195, y: 395, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitForCameraSettled(page);
  const moved = await readCameraInteractionState(page);

  expect(
    Math.hypot(
      moved.direction.x - arrival.direction.x,
      moved.direction.y - arrival.direction.y,
      moved.direction.z - arrival.direction.z,
    ),
  ).toBeGreaterThan(0.03);
  expect(moved.distance).toBeCloseTo(arrival.distance, 5);
  await session.detach();
  expect(browserErrors).toEqual([]);
});

test('un pincement reprend immédiatement la main pendant la sortie', async ({ page, context }) => {
  const browserErrors = monitorBrowserErrors(page);

  await openUniverse(page, universeUrl({ target: 'moon', selected: '', view: 'planetarium' }));
  const sky = page.locator('#earth-sky-view');

  await expect(sky).toHaveAttribute('data-phase', 'open');
  await sky.locator('.earth-sky-view__close').tap();
  await expect(sky).toHaveAttribute('data-phase', 'returning');
  await page.waitForTimeout(400);
  const session = await context.newCDPSession(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 120, y: 370, id: 1 },
      { x: 240, y: 370, id: 2 },
    ],
  });
  await expect(sky).toHaveCount(0);
  const initial = await readCameraInteractionState(page);

  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 90, y: 370, id: 1 },
      { x: 270, y: 370, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitForCameraSettled(page);
  const zoomed = await readCameraInteractionState(page);

  expect(zoomed.distance).toBeLessThan(initial.distance);
  await page.waitForTimeout(2_800);
  const later = await readCameraInteractionState(page);

  expect(later.transitioning).toBe(false);
  expect(later.distance).toBeCloseTo(zoomed.distance, 5);
  await session.detach();
  expect(browserErrors).toEqual([]);
});
