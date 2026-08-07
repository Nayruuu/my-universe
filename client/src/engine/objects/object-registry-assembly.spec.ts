import type { SpaceObject } from '../../data/models/universe.models';
import { createObjectRegistryAssemblyPlan } from './object-registry-assembly';

describe('ObjectRegistryAssembly', () => {
  it('separates shared catalogue points and resolves semantic render parents', () => {
    const objects = [
      fixture('milky-way', 'galaxy'),
      fixture('sun', 'star', 'milky-way'),
      fixture('host', 'star', 'milky-way', 'stellar'),
      fixture('nearby-black-hole', 'black-hole', 'milky-way', 'stellar'),
      fixture('planet', 'exoplanet', 'host', 'stellar'),
      {
        ...fixture('catalog-star', 'star'),
        positionProvider: {
          type: 'catalog' as const,
          catalogId: 'hyg',
          identifier: '42',
        },
      },
      {
        ...fixture('resolved-star', 'star'),
        metadata: { catalogPointRepresentation: true },
      },
      {
        ...fixture('catalog-galaxy', 'galaxy'),
        metadata: { nearbyUniversePointBatch: true },
      },
    ];

    const plan = createObjectRegistryAssemblyPlan(objects);

    expect(plan.renderableObjects.map((object) => object.id)).toEqual([
      'milky-way',
      'sun',
      'host',
      'nearby-black-hole',
      'planet',
      'catalog-galaxy',
    ]);
    expect(plan.farObjects.map((object) => object.id)).toEqual([
      'sun',
      'host',
      'planet',
      'catalog-galaxy',
    ]);
    expect(plan.batchedGalaxyTotal).toBe(1);
    expect(plan.farIndexById.get('catalog-galaxy')).toBe(3);
    expect(plan.renderParentById.get('host')).toBe('sun');
    expect(plan.renderParentById.get('nearby-black-hole')).toBe('sun');
    expect(plan.renderParentById.get('planet')).toBe('host');
    expect(plan.renderParentById.get('milky-way')).toBeNull();
  });
});

function fixture(
  id: string,
  type: SpaceObject['type'],
  parentId?: string,
  referenceFrame: SpaceObject['referenceFrame'] = 'solar-system',
): SpaceObject {
  return {
    id,
    name: id,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame,
    scientificConfidence: 'illustrative',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [0, 0, 0], unit: 'astronomical-unit' },
  };
}
