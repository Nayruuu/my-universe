import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { LabelCandidateCollector } from './label-candidate-collector';
import type { LabelObject } from './label-visibility-policy';

describe('LabelCandidateCollector', () => {
  it('conserve la sélection et les repères tout en filtrant les objets invisibles', () => {
    const collector = new LabelCandidateCollector();
    const objects: LabelObject[] = [
      createLabelObject('region', 'region'),
      createLabelObject('hidden-planet', 'planet'),
      createLabelObject('hidden-constellation', 'region', { constellationLabelRank: 0 }),
      createLabelObject('selected-hidden', 'planet'),
      createLabelObject('visible-star', 'star'),
      createLabelObject('missing-star', 'star'),
      createLabelObject('sun', 'star'),
    ];
    const camera = cameraForLabels();
    const reader = positionReader(
      new Map([
        ['hidden-planet', new THREE.Vector3(0.4, 0, 0)],
        ['hidden-constellation', new THREE.Vector3(0.3, 0, 0)],
        ['selected-hidden', new THREE.Vector3(0.2, 0, 0)],
        ['visible-star', new THREE.Vector3(0.1, 0, 0)],
        ['sun', new THREE.Vector3(0, 0, 0)],
      ]),
    );
    const isObjectVisible = (objectId: string): boolean =>
      objectId === 'visible-star' || objectId === 'missing-star';

    const candidates = collector.collect({
      objects,
      transientObject: null,
      camera,
      readWorldPosition: reader,
      lodLevel: 1,
      selectedId: 'selected-hidden',
      quality: 'high',
      density: 'balanced',
      isObjectVisible,
    });

    expect(candidates.map(({ object }) => object.id)).toEqual([
      'selected-hidden',
      'visible-star',
      'sun',
    ]);

    const hiddenConstellation = collector.collect({
      objects,
      transientObject: null,
      camera,
      readWorldPosition: reader,
      lodLevel: 1,
      selectedId: 'hidden-constellation',
      quality: 'high',
      density: 'balanced',
      isObjectVisible,
    });

    expect(hiddenConstellation.some(({ object }) => object.id === 'hidden-constellation')).toBe(
      false,
    );
  });

  it('ajoute un objet transitoire unique et trie par sélection, priorité puis distance', () => {
    const collector = new LabelCandidateCollector();
    const catalogTwo = createLabelObject('catalog-2', 'star', { catalogRecordIndex: 2 });
    const catalogOneFar = createLabelObject('catalog-1-far', 'star', { catalogRecordIndex: 1 });
    const catalogOneNear = createLabelObject('catalog-1-near', 'star', { catalogRecordIndex: 1 });
    const transient = createLabelObject('temporary', 'star');
    const objects = [catalogTwo, catalogOneFar, catalogOneNear];
    const camera = cameraForLabels();
    const reader = positionReader(
      new Map([
        ['catalog-2', new THREE.Vector3(0, 0, 0)],
        ['catalog-1-far', new THREE.Vector3(0, 0, -10)],
        ['catalog-1-near', new THREE.Vector3(0, 0, 5)],
        ['temporary', new THREE.Vector3(0.2, 0, 0)],
      ]),
    );
    const baseOptions = {
      objects,
      camera,
      readWorldPosition: reader,
      lodLevel: 1,
      quality: 'medium' as const,
      density: 'balanced' as const,
      isObjectVisible: () => true,
    };

    const candidates = collector.collect({
      ...baseOptions,
      transientObject: transient,
      selectedId: 'catalog-2',
    });

    expect(candidates.map(({ object }) => object.id)).toEqual([
      'catalog-2',
      'temporary',
      'catalog-1-near',
      'catalog-1-far',
    ]);
    expect(candidates.map(({ priority }) => priority)).toEqual([1_002, 0, 1_001, 1_001]);

    const withoutDuplicate = collector.collect({
      ...baseOptions,
      transientObject: catalogTwo,
      selectedId: null,
    });

    expect(withoutDuplicate.filter(({ object }) => object.id === 'catalog-2')).toHaveLength(1);

    collector.clear();
    expect(collector.candidates).toEqual([]);
  });

  it('applique les priorités propres à chaque niveau cartographique', () => {
    const collector = new LabelCandidateCollector();
    const objects = [
      createLabelObject('earth', 'planet'),
      createLabelObject('pluto', 'dwarf-planet'),
      createLabelObject('moon', 'moon'),
      createLabelObject('exoplanet-host', 'star', { exoplanetHostRank: 0 }),
      createLabelObject('ranked-galaxy', 'galaxy', { mapLabelRank: 2 }),
      createLabelObject('nearby-galaxy', 'galaxy', { nearbyUniverseLabelRank: 3 }),
      createLabelObject('cf4-pgc-35', 'galaxy-cluster', { cosmicCatalogRank: 0 }),
      createLabelObject('lss-supercluster-1', 'supercluster', { cosmicStructureRank: 0 }),
      createLabelObject('constellation-orion', 'region', { constellationLabelRank: 0 }),
    ];
    const camera = cameraForLabels();
    const positions = new Map(objects.map((object) => [object.id, new THREE.Vector3(0, 0, 0)]));
    const baseOptions = {
      objects,
      transientObject: null,
      camera,
      readWorldPosition: positionReader(positions),
      selectedId: null,
      quality: 'medium' as const,
      density: 'balanced' as const,
      isObjectVisible: () => true,
    };

    const planetary = collector.collect({ ...baseOptions, lodLevel: 1 });

    expect(priorityOf(planetary, 'earth')).toBe(-300);
    expect(priorityOf(planetary, 'pluto')).toBe(-240);
    expect(priorityOf(planetary, 'moon')).toBe(-180);
    expect(priorityOf(planetary, 'exoplanet-host')).toBe(600);

    const constellations = collector.collect({ ...baseOptions, lodLevel: 2 });

    expect(priorityOf(constellations, 'constellation-orion')).toBe(400);

    const galactic = collector.collect({ ...baseOptions, lodLevel: 4 });

    expect(priorityOf(galactic, 'ranked-galaxy')).toBe(52);

    const nearby = collector.collect({ ...baseOptions, lodLevel: 5 });

    expect(priorityOf(nearby, 'nearby-galaxy')).toBe(28);

    const cosmic = collector.collect({ ...baseOptions, lodLevel: 6 });

    expect(priorityOf(cosmic, 'cf4-pgc-35')).toBe(300);
    expect(priorityOf(cosmic, 'lss-supercluster-1')).toBe(301);
  });
});

function priorityOf(
  candidates: readonly { object: LabelObject; priority: number }[],
  objectId: string,
): number | undefined {
  return candidates.find(({ object }) => object.id === objectId)?.priority;
}

function positionReader(
  positions: ReadonlyMap<string, THREE.Vector3>,
): (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null {
  return (objectId, target) => {
    const position = positions.get(objectId);

    return position ? target.copy(position) : null;
  };
}

function cameraForLabels(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return camera;
}

function createLabelObject(
  id: string,
  type: SpaceObject['type'],
  metadata?: SpaceObject['metadata'],
): SpaceObject {
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
    ...(metadata ? { metadata } : {}),
  };
}
