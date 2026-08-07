import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { LabelOcclusionManager, type LabelOcclusionCandidate } from './label-occlusion-manager';
import type { LabelObject } from './label-visibility-policy';

describe('LabelOcclusionManager', () => {
  it('collecte uniquement les disques apparents capables de masquer un label', () => {
    const occlusion = new LabelOcclusionManager();
    const venus = createLabelObject('venus', 'planet');
    const missingBody = createLabelObject('missing-body', 'planet');
    const tinyBody = createLabelObject('tiny-body', 'planet');
    const outsideBody = createLabelObject('outside-body', 'planet');
    const zeroBody = createLabelObject('zero-body', 'planet');
    const region = createLabelObject('region', 'region');
    const camera = perspectiveCamera();
    const positions = new Map<string, THREE.Vector3>([
      ['venus', new THREE.Vector3(0, 0, 0)],
      ['tiny-body', new THREE.Vector3(4, 0, 0)],
      ['outside-body', new THREE.Vector3(0, 0, 20)],
      ['zero-body', new THREE.Vector3(0, 0, 0)],
      ['region', new THREE.Vector3(0, 0, 0)],
    ]);
    const reader = positionReader(positions);

    venus.visual.visualRadius = 2;
    tinyBody.visual.visualRadius = 0.001;
    outsideBody.visual.visualRadius = 2;
    zeroBody.visual.visualRadius = 0;
    region.visual.visualRadius = 2;

    occlusion.collect(
      new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100),
      [venus],
      reader,
      400,
      300,
    );
    expect(occlusion.occluderCount).toBe(0);

    occlusion.collect(
      camera,
      [venus, missingBody, tinyBody, outsideBody, zeroBody, region],
      reader,
      400,
      300,
    );
    expect(occlusion.occluderCount).toBe(1);

    occlusion.clear();
    expect(occlusion.occluderCount).toBe(0);
  });

  it('masque les objets plus lointains sans cacher le disque lui-même ni les objets proches', () => {
    const occlusion = new LabelOcclusionManager();
    const venus = createLabelObject('venus', 'planet');
    const behindStar = createBareLabelObject('behind-star', 'star');
    const frontStar = createBareLabelObject('front-star', 'star');
    const camera = perspectiveCamera();

    venus.visual.visualRadius = 2;
    occlusion.collect(
      camera,
      [venus, behindStar, frontStar],
      positionReader(
        new Map([
          ['venus', new THREE.Vector3(0, 0, 0)],
          ['behind-star', new THREE.Vector3(0, 0, -10)],
          ['front-star', new THREE.Vector3(0, 0, 5)],
        ]),
      ),
      400,
      300,
    );

    const rectangle = { left: 160, top: 120, right: 240, bottom: 145 };

    expect(occlusion.isOccluded(candidate(behindStar, 400), rectangle, 200, 150)).toBe(true);
    expect(
      occlusion.isOccluded(
        candidate(behindStar, 400),
        { left: 230, top: 130, right: 280, bottom: 150 },
        280,
        150,
      ),
    ).toBe(true);
    expect(occlusion.isOccluded(candidate(frontStar, 25), rectangle, 200, 150)).toBe(false);
    expect(occlusion.isOccluded(candidate(behindStar, 400, true), rectangle, 200, 150)).toBe(false);
    expect(occlusion.isOccluded(candidate(venus, 100), rectangle, 200, 150)).toBe(false);
    expect(
      occlusion.isOccluded(
        candidate(behindStar, 400),
        { left: 8, top: 8, right: 40, bottom: 30 },
        24,
        38,
      ),
    ).toBe(false);
  });

  it('masque aussi un label sélectionné derrière une étoile ou un trou noir', () => {
    const occlusion = new LabelOcclusionManager();
    const sun = createLabelObject('sun', 'star');
    const blackHole = createLabelObject('black-hole', 'black-hole');
    const selectedPlanet = createLabelObject('earth', 'planet');
    const camera = perspectiveCamera();
    const rectangle = { left: 160, top: 120, right: 240, bottom: 145 };

    sun.visual.visualRadius = 2;
    blackHole.visual.visualRadius = 2;
    occlusion.collect(
      camera,
      [sun, blackHole, selectedPlanet],
      positionReader(
        new Map([
          ['sun', new THREE.Vector3(0, 0, 0)],
          ['black-hole', new THREE.Vector3(3, 0, 0)],
          ['earth', new THREE.Vector3(0, 0, -10)],
        ]),
      ),
      400,
      300,
    );

    expect(occlusion.isOccluded(candidate(selectedPlanet, 400, true), rectangle, 200, 150)).toBe(
      true,
    );
  });
});

function candidate(
  object: LabelObject,
  distanceSquared: number,
  selected = false,
): LabelOcclusionCandidate {
  return { object, distanceSquared, selected };
}

function positionReader(
  positions: ReadonlyMap<string, THREE.Vector3>,
): (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null {
  return (objectId, target) => {
    const position = positions.get(objectId);

    return position ? target.copy(position) : null;
  };
}

function perspectiveCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(48, 4 / 3, 0.1, 100);

  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return camera;
}

function createBareLabelObject(id: string, type: SpaceObject['type']): LabelObject {
  return { id, name: id, type };
}

function createLabelObject(id: string, type: SpaceObject['type']): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: type === 'galaxy' ? 'galactic' : 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'light-year',
    },
  };
}
