import * as THREE from 'three';
import { ConstellationCatalog, SpaceObject } from '../../data/models/universe.models';
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
        rightAscensionDegrees: expect.closeTo(101.287, 3),
        declinationDegrees: expect.closeTo(-16.716, 3),
        skyCoordinateEpoch: 'J2000',
      },
    });
    expect(sirius?.metadata?.['apparentMagnitude']).toBeCloseTo(-1.44, 5);
    expect(sirius?.metadata?.['distanceLy']).toBeGreaterThan(8);
    expect(sirius?.visual.visualRadius).toBeLessThanOrEqual(0.1);
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
    expect(position?.x).toBeGreaterThan(0);
    expect(position?.y).toBeLessThan(0);
    expect(position?.z).toBeLessThan(0);
    expect(registry.getLocalPosition('missing')).toBeNull();
    const target = new THREE.Vector3();

    expect(registry.getLocalPosition('hyg-32263', target)).toBe(target);
  });

  it('expose à la demande un catalogue léger pour le ciel terrestre', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem());
    const brightest = registry.getStellarObservationCatalog(1);

    expect(brightest).toEqual([
      {
        id: 'hyg-32263',
        name: 'Sirius',
        coordinates: {
          rightAscensionDegrees: expect.closeTo(101.287, 3),
          declinationDegrees: expect.closeTo(-16.716, 3),
        },
        apparentMagnitude: expect.closeTo(-1.44, 5),
        color: expect.stringMatching(/^#[0-9a-f]{6}$/u),
      },
    ]);
    expect(registry.getStellarObservationCatalog(-2)).toEqual([]);
    expect(registry.getStellarObservationCatalog(1.8)).toHaveLength(1);
    expect(registry.getStellarObservationCatalog(100)).toHaveLength(2);
  });

  it('relie les figures de constellation aux entrées légères du ciel terrestre', () => {
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem(), [
      catalogLinkedSirius(),
    ]);
    const catalog = constellationCatalog();
    const constellations = registry.getStellarObservationConstellations(catalog);

    expect(constellations).toEqual([
      {
        id: 'constellation-test',
        name: 'Test',
        abbreviation: 'Tst',
        segments: [
          {
            from: expect.objectContaining({ id: 'sirius', name: 'Sirius' }),
            to: expect.objectContaining({ id: 'hyg-30365', name: 'Canopus' }),
          },
        ],
      },
    ]);
    expect(registry.getStellarObservationConstellations(catalog)).toBe(constellations);
    expect(() =>
      registry.getStellarObservationConstellations({
        ...catalog,
        figures: [{ ...catalog.figures[0]!, segments: [[99_999, 30_365]] }],
      }),
    ).toThrow('HYG 99999');
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

  it('prépare les 3 000 étoiles les plus lumineuses pour le placement adaptatif des noms', () => {
    const registry = new StarCatalogRegistry(createLargeCatalog(3_200), new CoordinateSystem());

    expect(registry.getLabelObjects([])).toHaveLength(3_000);
    expect(registry.getLabelObjects([]).at(-1)).toMatchObject({
      id: 'hyg-3000',
      name: 'HIP 3000',
      metadata: {
        catalogRecordIndex: 2_999,
      },
    });
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

  it('rattache une fiche éditoriale au point HYG sans conserver sa position manuelle', () => {
    const featuredSirius = catalogLinkedSirius();
    const registry = new StarCatalogRegistry(createCatalog(), new CoordinateSystem(), [
      featuredSirius,
    ]);
    const unrelated = {
      ...featuredSirius,
      id: 'future-catalog-star',
      positionProvider: {
        type: 'catalog' as const,
        catalogId: 'future-catalog',
        identifier: 'future-1',
      },
    };
    const resolved = registry.resolveCatalogObjects([featuredSirius, unrelated]);
    const sirius = registry.getDefinition('sirius');

    expect(registry.objectIds).toEqual(['sirius', 'hyg-30365']);
    expect(registry.has('sirius')).toBe(true);
    expect(registry.has('hyg-32263')).toBe(true);
    expect(registry.isCatalogBackedObject('sirius')).toBe(true);
    expect(registry.isCatalogBackedObject('hyg-32263')).toBe(false);
    expect(resolved).toEqual([sirius, unrelated]);
    expect(sirius).toMatchObject({
      id: 'sirius',
      name: 'Sirius',
      referenceEpoch: 2_451_545,
      positionProvider: {
        type: 'static',
        unit: 'parsec',
      },
      metadata: {
        hygId: 32_263,
        catalogIdentifier: 'HIP 32349',
        sourceReferenceFrame: 'J2000 equatorial Cartesian',
        renderReferenceFrame: 'Galactic heliocentric, north Galactic pole on +Y',
      },
    });
    expect(sirius?.positionProvider).not.toEqual(featuredSirius.positionProvider);
    expect(registry.getSearchEntries()).toHaveLength(1);
    expect(registry.getSearchEntries()[0]?.name).toBe('Canopus');
    expect(registry.getLabelObjects([]).map(({ id }) => id)).toEqual(['hyg-30365']);
  });

  it('refuse un identifiant éditorial absent du catalogue chargé', () => {
    const missing = {
      ...catalogLinkedSirius(),
      positionProvider: {
        type: 'catalog' as const,
        catalogId: 'hyg-v41-bright-stars',
        identifier: 'HIP 999999',
      },
    };

    expect(
      () => new StarCatalogRegistry(createCatalog(), new CoordinateSystem(), [missing]),
    ).toThrow('HIP 999999');
  });

  it('refuse deux fiches éditoriales pour le même point HYG', () => {
    const sirius = catalogLinkedSirius();

    expect(
      () =>
        new StarCatalogRegistry(createCatalog(), new CoordinateSystem(), [
          sirius,
          { ...sirius, id: 'sirius-copy' },
        ]),
    ).toThrow('Plusieurs fiches éditoriales');
  });

  it("résout aussi une fiche lorsque l'entrée HYG ne fournit aucun alias", () => {
    const catalog = createCatalog();
    const sirius = catalogLinkedSirius();
    const registry = new StarCatalogRegistry(
      {
        ...catalog,
        aliases: [undefined as unknown as readonly string[], catalog.aliases[1]!],
      },
      new CoordinateSystem(),
      [
        {
          ...sirius,
          positionProvider: {
            type: 'catalog',
            catalogId: 'hyg-v41-bright-stars',
            identifier: 'Sirius',
          },
        },
      ],
    );

    expect(registry.getDefinition('sirius')?.aliases).toEqual(['Alpha Canis Majoris', 'Sirius']);
  });
});

function catalogLinkedSirius(): SpaceObject {
  return {
    id: 'sirius',
    name: 'Sirius',
    aliases: ['Alpha Canis Majoris'],
    type: 'star',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: {
      color: '#dceaff',
      visualRadius: 1.65,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'catalog',
      catalogId: 'hyg-v41-bright-stars',
      identifier: 'HIP 32349',
    },
    metadata: {
      source: 'HYG Database v4.1',
    },
  };
}

function constellationCatalog(): ConstellationCatalog {
  return {
    version: '1.0.0',
    source: { name: 'Test', url: 'https://example.test', license: 'CC0' },
    referenceFrame: 'equatorial-j2000',
    scientificConfidence: 'illustrative',
    starCatalog: 'HYG test',
    figures: [
      {
        id: 'test',
        name: 'Test',
        abbreviation: 'Tst',
        segments: [[32_263, 30_365]],
      },
    ],
  };
}

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

function createLargeCatalog(count: number): StarCatalog {
  const positionsParsec = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    positionsParsec[index * 3] = index + 1;
  }

  return {
    count,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec,
    apparentMagnitudes: Float32Array.from({ length: count }, (_, index) => index / count),
    colorIndicesBv: new Float32Array(count),
    catalogIds: Uint32Array.from({ length: count }, (_, index) => index + 1),
    names: Array.from({ length: count }, (_, index) => `HIP ${index + 1}`),
    aliases: Array.from({ length: count }, () => []),
    spectralTypes: Array.from({ length: count }, () => null),
  };
}
