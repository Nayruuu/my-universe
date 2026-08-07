import { expect, test, type Page } from '@playwright/test';
import type { PerspectiveCamera, Vector3 } from 'three';
import type { CameraController } from '../src/engine/camera/camera-controller';
import {
  monitorBrowserErrors,
  openUniverse,
  queryParameter,
  universeUrl,
} from './support/navigation-helpers';

interface FocusFrame {
  readonly distance: number;
  readonly destinationDistance: number;
  readonly targetError: number;
  readonly forwardDistance: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly depth: number;
}

interface FocusEngine {
  readonly targetId: string | null;
  readonly camera: PerspectiveCamera;
  readonly cameraController: CameraController;
  getWorldPosition(objectId: string): Vector3 | null;
}

for (const scenario of [
  { zoom: '2800', quality: 'low' },
  { zoom: '17000', quality: 'high' },
]) {
  test(`Andromède → Sagittarius A* garde sa destination pendant le trajet à ${scenario.zoom}`, async ({
    page,
  }, testInfo) => {
    const errors = monitorBrowserErrors(page);

    await openUniverse(
      page,
      universeUrl({
        target: 'andromeda',
        selected: '',
        mode: 'state',
        orientation: '-0.875355,-0.179560,-0.448900',
        ...scenario,
      }),
    );
    await page
      .getByRole('searchbox', { name: 'Rechercher un objet astronomique' })
      .fill('Sagittarius A');
    const recording = recordFocusTransition(page, 'sagittarius-a-star');

    await page.getByRole('option', { name: /Sagittarius A\* Trou noir · Voie lactée/ }).click();
    const frames = await recording;

    await testInfo.attach('direct-focus-frames', {
      body: JSON.stringify(frames),
      contentType: 'application/json',
    });
    expect(frames.length).toBeGreaterThan(30);
    expect(Math.min(...frames.map((frame) => frame.forwardDistance))).toBeGreaterThan(0);
    const acquisitionIndex = frames.findIndex((frame) => frame.targetError < 1e-5);

    expect(acquisitionIndex).toBeGreaterThanOrEqual(0);
    expect(acquisitionIndex).toBeLessThan(frames.length / 2);
    const approach = frames.slice(acquisitionIndex);

    for (const frame of approach) {
      expect(Math.hypot(frame.screenX, frame.screenY)).toBeLessThan(0.005);
      expect(frame.depth).toBeGreaterThan(-1);
      expect(frame.depth).toBeLessThan(1);
    }
    const last = frames.at(-1)!;

    expect(last.distance).toBeCloseTo(38.4, 4);
    expect(last.destinationDistance).toBeCloseTo(38.4, 4);
    await expect.poll(() => queryParameter(page, 'target')).toBe('sagittarius-a-star');
    await expect(page.getByRole('heading', { name: 'Sagittarius A*' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

async function recordFocusTransition(page: Page, objectId: string): Promise<FocusFrame[]> {
  return page.evaluate((requestedId) => {
    const root = document.querySelector('app-root');
    const debug = (window as unknown as { ng: { getComponent(element: Element): object } }).ng;
    const component = root && debug.getComponent(root);
    const facade = component && (Reflect.get(component, 'facade') as object);
    const client = facade && (Reflect.get(facade, 'engine') as object);
    const engine = client && ((Reflect.get(client, 'engine') ?? client) as FocusEngine);

    if (!engine) {
      throw new Error('Moteur de navigation indisponible.');
    }

    return new Promise<FocusFrame[]>((resolve, reject) => {
      const frames: FocusFrame[] = [];
      const startedAt = performance.now();
      let started = false;

      function sample(): void {
        if (performance.now() - startedAt > 30_000) {
          reject(new Error('Le ciblage direct ne se termine pas.'));

          return;
        }
        const { camera, cameraController } = engine!;

        if (engine!.targetId === requestedId && cameraController.isTransitioning) {
          started = true;
        }
        if (started) {
          const destination = engine!.getWorldPosition(requestedId)!;
          const screen = destination.clone().project(camera);
          const offset = destination.clone().sub(camera.position);
          const forward = camera.getWorldDirection(destination.clone());

          frames.push({
            distance: cameraController.distanceToTarget,
            destinationDistance: offset.length(),
            targetError: cameraController.controls.target.distanceTo(destination),
            forwardDistance: forward.dot(offset),
            screenX: screen.x,
            screenY: screen.y,
            depth: screen.z,
          });
          if (!cameraController.isTransitioning) {
            resolve(frames);

            return;
          }
        }
        requestAnimationFrame(sample);
      }

      requestAnimationFrame(sample);
    });
  }, objectId);
}
