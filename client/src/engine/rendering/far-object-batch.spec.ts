import * as THREE from 'three';
import { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { FarObjectBatch } from './far-object-batch';

describe('FarObjectBatch', () => {
  it.each(['low', 'medium', 'high'] as const)(
    'borne le pixel ratio pour la qualité %s',
    (quality: GraphicQuality) => {
      const batch = new FarObjectBatch([object('colored', '#ff0000'), object('default')], quality);

      expect(batch.points.material.uniforms['pixelRatio']?.value).toBeGreaterThan(0);
      expect(batch.points.userData['objectIds']).toEqual(['colored', 'default']);
      batch.points.geometry.dispose();
      batch.points.material.dispose();
    },
  );

  it('ne transfère au GPU que les positions et apparences réellement modifiées', () => {
    const batch = new FarObjectBatch([object('earth')], 'medium');
    const access = batch as unknown as FarBatchAccess;

    batch.updatePoint(0, new THREE.Vector3(0, 0, 0), 0, 0);
    batch.updatePoint(0, new THREE.Vector3(1, 0, 0), 1, 1);
    expect(batch.points.visible).toBe(true);
    expect(access.visibleCount).toBe(1);
    batch.commit();
    expect(access.positionsDirty).toBe(false);
    expect(access.appearanceDirty).toBe(false);

    batch.commit();
    batch.updatePoint(0, new THREE.Vector3(1, 2, 0), 2, 1);
    expect(access.visibleCount).toBe(1);
    batch.updatePoint(0, new THREE.Vector3(1, 2, 3), 2, 0);
    expect(batch.points.visible).toBe(false);
    expect(access.visibleCount).toBe(0);
    batch.updatePoint(0, new THREE.Vector3(1, 2, 3), 3, 0);
    batch.commit();

    batch.points.geometry.dispose();
    batch.points.material.dispose();
  });
});

interface FarBatchAccess {
  positionsDirty: boolean;
  appearanceDirty: boolean;
  visibleCount: number;
}

function object(id: string, color?: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      ...(color ? { color } : {}),
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
