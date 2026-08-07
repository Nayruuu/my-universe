import { expect, test } from '@playwright/test';
import {
  monitorBrowserErrors,
  openUniverse,
  readCameraInteractionState,
  readMilkyWayDetailState,
  universeUrl,
  waitForCameraPoseStable,
} from './universe-test-helpers';
import { readRenderedFrameSignature } from './support/visual-regression-helpers';

/**
 * Reproducible views used during a visual review with the product team. They deliberately open
 * the desired state directly: this is a rendering review, not a navigation or camera test.
 */
const MILKY_WAY_REVIEW_VIEWS = [
  {
    id: 'local-group-arrival',
    description: 'arrivée depuis le Groupe local, avant que la Voie lactée ne devienne le volume',
    parameters: {
      target: 'milky-way',
      selected: '',
      quality: 'high',
      zoom: '24000',
      orientation: '0.294575,-0.139892,0.945334',
    },
  },
  {
    id: 'galactic-disc',
    description: 'silhouette pointilliste du disque au début de l’approche galactique',
    parameters: {
      target: 'milky-way',
      selected: '',
      quality: 'high',
      zoom: '3600',
      orientation: '0.294575,-0.139892,0.945334',
    },
  },
  {
    id: 'stellar-cloud',
    description: 'nuage de poussières et première révélation stellaire',
    parameters: {
      target: 'sun',
      selected: '',
      quality: 'high',
      zoom: '600',
      orientation: '0.294575,-0.139892,0.945334',
    },
  },
  {
    id: 'solar-neighborhood',
    description: 'voisinage solaire où le catalogue stellaire prend le relais',
    parameters: {
      target: 'sun',
      selected: '',
      quality: 'high',
      zoom: '300',
      orientation: '0.294575,-0.139892,0.945334',
    },
  },
] as const;

test('le parcours visuel Voie lactée capture les repères sans déplacer la caméra', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const browserErrors = monitorBrowserErrors(page);

  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const view of MILKY_WAY_REVIEW_VIEWS) {
    await openUniverse(page, universeUrl(view.parameters));
    await waitForCameraPoseStable(page);

    const cameraBeforeReview = await readCameraInteractionState(page);
    const milkyWay = await readMilkyWayDetailState(page);
    const signature = await readRenderedFrameSignature(page);

    await waitForCameraPoseStable(page);
    const cameraAfterReview = await readCameraInteractionState(page);

    expect(milkyWay.visible, view.id).toBe(true);
    expect(milkyWay.particleCount, view.id).toBeGreaterThan(100_000);
    expect(milkyWay.worldDiameter, view.id).toBeCloseTo(milkyWay.physicalWorldDiameter, 8);
    expect(signature.visiblePixelRatio, view.id).toBeGreaterThan(0.015);
    expect(signature.luminousPixelRatio, view.id).toBeGreaterThan(0.000_01);
    expect(signature.chromaticPixelRatio, view.id).toBeGreaterThan(0.002);
    expect(signature.luminanceDeviation, view.id).toBeGreaterThan(2);
    expectCameraPoseUnchanged(cameraBeforeReview, cameraAfterReview, view.id);

    await testInfo.attach(`${view.id}-review.json`, {
      body: JSON.stringify(
        {
          description: view.description,
          parameters: view.parameters,
          milkyWay,
          signature,
          cameraBeforeReview,
          cameraAfterReview,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    await testInfo.attach(`${view.id}.png`, {
      body: await page.locator('canvas.universe-canvas').screenshot(),
      contentType: 'image/png',
    });
  }

  expect(browserErrors).toEqual([]);
});

function expectCameraPoseUnchanged(
  before: Awaited<ReturnType<typeof readCameraInteractionState>>,
  after: Awaited<ReturnType<typeof readCameraInteractionState>>,
  viewId: string,
): void {
  expect(after.distance, viewId).toBeCloseTo(before.distance, 6);
  expect(after.fieldOfView, viewId).toBeCloseTo(before.fieldOfView, 6);

  for (const vector of ['position', 'target', 'direction'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(after[vector][axis], `${viewId}:${vector}.${axis}`).toBeCloseTo(
        before[vector][axis],
        6,
      );
    }
  }
}
