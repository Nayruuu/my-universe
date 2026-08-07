import * as THREE from 'three';
import { MinimumDistanceTraversal } from './minimum-distance-traversal';

describe('MinimumDistanceTraversal', () => {
  it('annule exactement les translations dans l’ordre inverse', () => {
    const traversal = new MinimumDistanceTraversal();

    traversal.record(new THREE.Vector3(1, 0, -2), 0.4);
    traversal.record(new THREE.Vector3(0, 3, -1), 0.6);

    expect(traversal.active).toBe(true);
    expect(traversal.logarithmicAmount).toBeCloseTo(1, 12);
    expect(traversal.unwind(0.3)).toEqual({
      translation: new THREE.Vector3(0, 1.5, -0.5),
      remainingLogarithmicAmount: 0,
    });
    expect(traversal.logarithmicAmount).toBeCloseTo(0.7, 12);
    const remainder = traversal.unwind(0.7);

    expect(remainder.translation.x).toBeCloseTo(1, 12);
    expect(remainder.translation.y).toBeCloseTo(1.5, 12);
    expect(remainder.translation.z).toBeCloseTo(-2.5, 12);
    expect(remainder.remainingLogarithmicAmount).toBe(0);
    expect(traversal.active).toBe(false);
    expect(traversal.logarithmicAmount).toBe(0);
  });

  it('restitue le surplus, ignore les entrées invalides et borne son historique', () => {
    const traversal = new MinimumDistanceTraversal();

    traversal.record(new THREE.Vector3(), 1);
    traversal.record(new THREE.Vector3(1, 2, 3), 0);
    traversal.record(new THREE.Vector3(1, 2, 3), Number.NaN);
    for (let index = 0; index < 80; index += 1) {
      traversal.record(new THREE.Vector3(0.1, 0, 0), 0.1);
    }
    expect(traversal.logarithmicAmount).toBeCloseTo(8, 12);

    const result = traversal.unwind(10);

    expect(result.translation.x).toBeCloseTo(8, 12);
    expect(result.remainingLogarithmicAmount).toBeCloseTo(2, 12);
    expect(traversal.active).toBe(false);
    expect(traversal.unwind(Number.NaN)).toEqual({
      translation: new THREE.Vector3(),
      remainingLogarithmicAmount: 0,
    });

    traversal.record(new THREE.Vector3(1, 0, 0), 1);
    traversal.clear();
    expect(traversal.active).toBe(false);
    expect(traversal.logarithmicAmount).toBe(0);
  });
});
