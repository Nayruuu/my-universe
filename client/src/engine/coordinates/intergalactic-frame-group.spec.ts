import * as THREE from 'three';
import {
  COSMIC_WEB_SCALE_DISTANCE,
  LOCAL_GROUP_SCALE_DISTANCE,
  NEARBY_UNIVERSE_SCALE_DISTANCE,
} from './intergalactic-scale-model';
import { IntergalacticFrameGroup } from './intergalactic-frame-group';

describe('IntergalacticFrameGroup', () => {
  it('convertit les trois référentiels vers la même distance monde', () => {
    const parent = new THREE.Group();
    const frames = new IntergalacticFrameGroup(parent, 'test');
    const local = point(10_000);
    const nearby = point(4_000);
    const cosmic = point(200);

    frames.localGroupRoot.add(local);
    frames.nearbyUniverseRoot.add(nearby);
    frames.cosmicWebRoot.add(cosmic);

    for (const [cameraDistance, expectedDistance] of [
      [LOCAL_GROUP_SCALE_DISTANCE, 10_000],
      [NEARBY_UNIVERSE_SCALE_DISTANCE, 4_000],
      [COSMIC_WEB_SCALE_DISTANCE, 200],
    ] as const) {
      frames.update(cameraDistance);
      parent.updateMatrixWorld(true);

      expect(local.getWorldPosition(new THREE.Vector3()).length()).toBeCloseTo(expectedDistance, 8);
      expect(nearby.getWorldPosition(new THREE.Vector3()).length()).toBeCloseTo(
        expectedDistance,
        8,
      );
      expect(cosmic.getWorldPosition(new THREE.Vector3()).length()).toBeCloseTo(
        expectedDistance,
        8,
      );
    }
    expect(frames.getRoot('stellar')).toBeNull();
    frames.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('signale uniquement un changement effectif de métrique', () => {
    const frames = new IntergalacticFrameGroup(new THREE.Group(), 'test');

    expect(frames.update(LOCAL_GROUP_SCALE_DISTANCE)).toBe(false);
    expect(frames.update(50_000)).toBe(true);
    expect(frames.update(50_000)).toBe(false);
    expect(frames.currentScale.referenceFrameBlend).toBe('local-group-to-nearby-universe');
  });
});

function point(nativeSceneDistance: number): THREE.Object3D {
  const object = new THREE.Object3D();

  object.position.x = nativeSceneDistance;

  return object;
}
