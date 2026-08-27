import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from './cosmic-group-catalog-registry';

describe('CosmicGroupCatalogRegistry', () => {
  it('indexe tous les groupes dans le référentiel cosmique sans objet Three.js individuel', () => {
    const registry = createRegistry();

    expect(registry.objectIds).toEqual(['cf4-pgc-35', 'cf4-pgc-12']);
    expect(registry.has('cf4-pgc-35')).toBe(true);
    expect(registry.getIndex('cf4-pgc-12')).toBe(1);
    expect(registry.getIndex('missing')).toBeNull();
    expect(registry.renderPositions).toEqual(
      new Float32Array([2_420, 0, 0, 19_798.6, -2_216, 12.4]),
    );
  });

  it('matérialise à la demande une fiche calculée et traçable vers Cosmicflows-4', () => {
    const registry = createRegistry();
    const group = registry.getDefinition('cf4-pgc-12');

    expect(group).toMatchObject({
      id: 'cf4-pgc-12',
      name: 'Groupe PGC 12',
      aliases: ['PGC 12'],
      type: 'galaxy-cluster',
      parentId: 'cosmic-web',
      referenceFrame: 'cosmic-web',
      scientificConfidence: 'calculated',
      referenceEpoch: 2_451_545,
      positionProvider: {
        type: 'static',
        unit: 'megaparsec',
      },
      metadata: {
        pgcId: 12,
        distanceMpc: expect.closeTo(99.611, 4),
        distanceModulusError: expect.closeTo(0.41, 4),
        velocityCmbKmPerSecond: 6_179,
        receivedLightDistanceModel: 'flat-lambda-cdm-luminosity-distance',
        cosmologicalRedshift: expect.any(Number),
        cosmologicalRedshiftOrigin: 'inferred-from-luminosity-distance',
        cosmologicalModel: 'Flat ΛCDM · H0=70 km/s/Mpc · Ωm=0.3 · ΩΛ=0.7',
        source: 'Cosmicflows-4 · Tully et al. (2023)',
        visualAdaptation:
          'Position du groupe calculée ; silhouettes, orientations, luminosités et membres non résolus illustratifs',
      },
    });
    expect(group?.metadata?.['cosmologicalRedshift']).toBeCloseTo(0.023, 2);
    expect(registry.getDefinition('cf4-pgc-12')).toBe(group);
    expect(registry.getDefinition('missing')).toBeUndefined();
  });

  it('expose tous les PGC à la recherche et un nombre borné de labels légers', () => {
    const registry = createRegistry();
    const entries = registry.getSearchEntries();

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'cf4-pgc-35',
        name: 'Groupe PGC 35',
        aliases: ['PGC 35'],
        type: 'galaxy-cluster',
        parentName: 'Réseau cosmique',
      }),
      expect.objectContaining({ id: 'cf4-pgc-12' }),
    ]);
    expect(registry.getSearchEntries()).toBe(entries);
    expect(registry.getLabelObjects(1.9)).toEqual([
      {
        id: 'cf4-pgc-35',
        name: 'PGC 35',
        type: 'galaxy-cluster',
        metadata: {
          cosmicCatalogRank: 0,
          distanceMpc: expect.closeTo(12.1, 5),
          distanceModulusError: expect.closeTo(0.1, 5),
        },
      },
    ]);
    expect(registry.getLabelObjects(-1)).toEqual([]);
    expect(registry.getLabelObjects(99)).toHaveLength(2);
  });

  it('répartit progressivement les labels dans toute la profondeur du catalogue', () => {
    const registry = new CosmicGroupCatalogRegistry(createLinearCatalog(9), new CoordinateSystem());
    const labels = registry.getLabelObjects(5);

    expect(labels.map(({ id }) => id)).toEqual([
      'cf4-pgc-1',
      'cf4-pgc-5',
      'cf4-pgc-3',
      'cf4-pgc-7',
      'cf4-pgc-2',
    ]);
    expect(labels.map(({ metadata }) => metadata?.['cosmicCatalogRank'])).toEqual([0, 1, 2, 3, 4]);
  });

  it('retourne la position locale dans un vecteur réutilisable', () => {
    const registry = createRegistry();
    const target = new THREE.Vector3();

    expect(registry.getLocalPosition('cf4-pgc-12', target)).toBe(target);
    expect(target.toArray()).toEqual([19_798.599_609_375, -2_216, 12.399_999_618_530_273]);
    expect(registry.getLocalPosition('missing')).toBeNull();
  });
});

function createRegistry(): CosmicGroupCatalogRegistry {
  return new CosmicGroupCatalogRegistry(createCatalog(), new CoordinateSystem());
}

function createCatalog(): CosmicGroupCatalog {
  return {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 12.1,
    maximumDistanceMpc: 99.611,
    positionsMpc: new Float32Array([12.1, 0, 0, 98.993, -11.08, 0.062]),
    distancesMpc: new Float32Array([12.1, 99.611]),
    distanceModulusErrors: new Float32Array([0.1, 0.41]),
    velocitiesCmbKmPerSecond: new Int32Array([28, 6_179]),
    pgcIds: new Uint32Array([35, 12]),
    distanceModuli: new Float32Array([30.413, 34.995]),
    filamentPairs: new Uint32Array(),
  };
}

function createLinearCatalog(count: number): CosmicGroupCatalog {
  const positionsMpc = new Float32Array(count * 3);
  const distancesMpc = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const distance = index + 1;

    positionsMpc[index * 3] = distance;
    distancesMpc[index] = distance;
  }

  return {
    count,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 1,
    maximumDistanceMpc: count,
    positionsMpc,
    distancesMpc,
    distanceModulusErrors: new Float32Array(count),
    velocitiesCmbKmPerSecond: new Int32Array(count),
    pgcIds: Uint32Array.from({ length: count }, (_, index) => index + 1),
    distanceModuli: new Float32Array(count),
    filamentPairs: new Uint32Array(),
  };
}
