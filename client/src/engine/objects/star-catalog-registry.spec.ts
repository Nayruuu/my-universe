import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from './star-catalog-registry';

describe('StarCatalogRegistry', () => {
  it('indexe les étoiles sans créer de représentation Three.js individuelle', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem());

    expect(registry.objectIds).toEqual(['hyg-32263', 'hyg-30365']);
    expect(registry.has('hyg-32263')).toBe(true);
    expect(registry.getIndex('hyg-30365')).toBe(1);
    expect(registry.getIndex('missing')).toBeNull();
  });

  it('matérialise uniquement la fiche demandée avec ses données HYG', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem());
    const sirius = registry.getDefinition('hyg-32263');

    expect(sirius).toMatchObject({
      id: 'hyg-32263',
      name: 'Sirius',
      aliases: ['HIP 32349', 'HD 48915'],
      type: 'star',
      parentId: 'milky-way',
      scientificConfidence: 'observed',
      physical: { spectralType: 'A0m' },
      metadata: {
        hygId: 32263,
      },
    });
    expect(sirius?.metadata?.['apparentMagnitude']).toBeCloseTo(-1.44, 5);
    expect(sirius?.metadata?.['distanceLy']).toBeGreaterThan(8);
    expect(registry.getDefinition('hyg-32263')).toBe(sirius);
    expect(registry.getDefinition('missing')).toBeUndefined();
  });

  it('expose des entrées de recherche et le repère HYG adapté à Three.js', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem());
    const position = registry.getLocalPosition('hyg-32263');
    const entries = registry.getSearchEntries();

    expect(registry.getSearchEntries()).toBe(entries);

    expect(entries[0]).toMatchObject({
      id: 'hyg-32263',
      name: 'Sirius',
      aliases: ['HIP 32349', 'HD 48915'],
      parentName: 'Voie lactée',
    });
    expect(position?.x).toBeLessThan(0);
    expect(position?.y).toBeLessThan(0);
    expect(position?.z).toBeLessThan(0);
    expect(registry.getLocalPosition('missing')).toBeNull();
    const target = new THREE.Vector3();

    expect(registry.getLocalPosition('hyg-32263', target)).toBe(target);
  });

  it('prépare des labels légers par luminosité sans dupliquer les étoiles déjà nommées', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem());
    const labels = registry.getLabelObjects([
      {
        name: 'Étoile du Chien',
        aliases: ['Sirius'],
      },
    ]);

    expect(labels).toEqual([
      {
        id: 'hyg-30365',
        name: 'Canopus',
        type: 'star',
        metadata: {
          apparentMagnitude: expect.closeTo(-0.62, 5),
          catalogRecordIndex: 1,
        },
      },
    ]);
  });

  it('gère les métadonnées optionnelles, les limites de labels et un spectre absent', () => {
    const catalog = createCatalog();
    const registry = new StarCatalogRegistry(
      {
        ...catalog,
        aliases: [catalog.aliases[0]!, undefined as unknown as readonly string[]],
        spectralTypes: ['A0m', null],
      },
      new CoordinateSystem(),
    );

    expect(registry.getDefinition('hyg-30365')?.physical).toBeUndefined();
    expect(registry.getSearchEntries()[1]?.keywords).not.toContain('F0Ib');
    expect(registry.getLabelObjects([{ name: 'Personne' }], -4)).toEqual([]);
    expect(registry.getLabelObjects([{ name: 'Personne' }], 1.8)).toHaveLength(1);
    expect(registry.getLabelObjects([{ name: 'Personne' }], 100)).toHaveLength(2);
  });
});

function createCatalog(): StarCatalog {
  return {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array([
      -0.494323, 2.476731, -0.758485, -0.086_008, -0.195_067, -1.386_851,
    ]),
    apparentMagnitudes: new Float32Array([-1.44, -0.62]),
    colorIndicesBv: new Float32Array([0.009, 0.164]),
    catalogIds: new Uint32Array([32_263, 30_365]),
    names: ['Sirius', 'Canopus'],
    aliases: [['HIP 32349', 'HD 48915'], ['HIP 30438']],
    spectralTypes: ['A0m', 'F0Ib'],
  };
}
