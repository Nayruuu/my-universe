import * as THREE from 'three';
import { CosmicStructureType } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  CosmicStructureCatalog,
  CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { CosmicStructureCatalogRegistry } from './cosmic-structure-catalog-registry';

describe('CosmicStructureCatalogRegistry', () => {
  it('indexe les détections de catalogues dans le référentiel cosmique', () => {
    const registry = createRegistry();

    expect(registry.objectIds).toEqual([
      'lss-sdss-main50-239-027-0091',
      'lss-boss-voids-cmass-north-60',
    ]);
    expect(registry.has(registry.objectIds[0]!)).toBe(true);
    expect(registry.getIndex(registry.objectIds[1]!)).toBe(1);
    expect(registry.getIndex('missing')).toBeNull();
    expect(registry.renderPositions).toEqual(
      new Float32Array([-35_220, 32_740, -57_559.996_093_75, -157_020, 287_680, 337_280]),
    );
  });

  it('matérialise une fiche de superamas traçable vers la détection source', () => {
    const registry = createRegistry();
    const definition = registry.getDefinition('lss-sdss-main50-239-027-0091');

    expect(definition).toMatchObject({
      id: 'lss-sdss-main50-239-027-0091',
      name: 'Superamas SDSS 239+027+0091',
      aliases: ['239+027+0091', 'sdss-main50 239+027+0091'],
      type: 'supercluster',
      parentId: 'cosmic-web',
      referenceFrame: 'cosmic-web',
      scientificConfidence: 'calculated',
      referenceEpoch: 2_451_545,
      positionProvider: { type: 'static', unit: 'megaparsec' },
      metadata: {
        source: 'Liivamägi et al. (2012)',
        sourceUrl: 'https://example.test/superclusters',
        catalogName: 'SDSS superclusters',
        catalogIdentifier: '239+027+0091',
        detectionMethod: 'Luminosity density field',
        structureType: 'supercluster',
        distanceMpc: expect.any(Number),
        receivedLightDistanceModel: 'flat-lambda-cdm-comoving-distance',
        cosmologicalRedshift: expect.any(Number),
        cosmologicalRedshiftOrigin: 'inferred-from-comoving-distance',
        cosmologicalModel: 'Flat ΛCDM · H0=70 km/s/Mpc · Ωm=0.3 · ΩΛ=0.7',
        effectiveRadiusMpc: expect.closeTo(35.9, 4),
        memberGalaxyCount: 1_038,
        catalogConfidence: expect.closeTo(0.98, 5),
        surveyEdge: false,
      },
    });
    expect(definition?.visual.color).toBe('#d6a8ff');
    expect(definition?.metadata?.['cosmologicalRedshift']).toBeCloseTo(0.08, 1);
    expect(registry.getDefinition(definition!.id)).toBe(definition);
    expect(registry.getDefinition('missing')).toBeUndefined();
  });

  it('matérialise un vide avec son contraste et sa distance à la limite du relevé', () => {
    const definition = createRegistry().getDefinition('lss-boss-voids-cmass-north-60');

    expect(definition).toMatchObject({
      name: 'Vide BOSS CMASS-North-60',
      type: 'cosmic-void',
      metadata: {
        densityContrast: expect.closeTo(-0.717, 5),
        boundaryDistanceMpc: expect.closeTo(75.006, 4),
        sample: 'CMASS North',
      },
    });
    expect(definition?.description).toContain('sous-dense');
    expect(definition?.visual.color).toBe('#6ea8ff');
  });

  it('expose toutes les détections à la recherche et borne les labels cartographiques', () => {
    const registry = createRegistry();
    const entries = registry.getSearchEntries();

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'lss-sdss-main50-239-027-0091',
        name: 'Superamas SDSS 239+027+0091',
        type: 'supercluster',
        parentName: 'Réseau cosmique · SDSS superclusters',
      }),
      expect.objectContaining({
        id: 'lss-boss-voids-cmass-north-60',
        name: 'Vide BOSS CMASS-North-60',
        type: 'cosmic-void',
      }),
    ]);
    expect(registry.getSearchEntries()).toBe(entries);
    expect(registry.getLabelObjects(-1)).toEqual([]);
    expect(registry.getLabelObjects(1.9)).toHaveLength(1);
    expect(registry.getLabelObjects(99)).toHaveLength(2);
    expect(registry.getLabelObjects(2)[0]?.metadata?.['cosmicStructureRank']).toBe(0);
  });

  it('stabilise le classement lorsque deux détections ont exactement le même score', () => {
    const catalog = createCatalog();
    const tiedCatalog: CosmicStructureCatalog = {
      ...catalog,
      radiiMpc: new Float32Array([10, 10]),
      confidences: new Float32Array([1, 1]),
      galaxyCounts: new Uint32Array([10, 10]),
      structureTypes: ['void', 'void'],
    };
    const registry = new CosmicStructureCatalogRegistry(tiedCatalog, new CoordinateSystem());

    expect(registry.getLabelObjects(2).map(({ id }) => id)).toEqual(registry.objectIds);
  });

  it('préserve le nom, les alias et le sens scientifique d’un bassin nommé', () => {
    const registry = createNamedLandmarkRegistry();
    const definition = registry.getDefinition('lss-valade-pboa-shapley-basin');
    const entry = registry.getSearchEntries()[0];

    expect(entry).toMatchObject({
      name: 'Bassin de Shapley',
      aliases: expect.arrayContaining(['Shapley p-BoA', 'shapley-basin']),
      type: 'cosmic-basin',
    });
    expect(definition).toMatchObject({
      name: 'Bassin de Shapley',
      aliases: expect.arrayContaining(['Shapley p-BoA', 'shapley-basin']),
      scientificConfidence: 'calculated',
      description: expect.stringContaining('Bassin d’attraction probabiliste'),
      metadata: {
        catalogConfidenceMeaning: 'Intrinsic p-BoA probability',
        extentMeaning: 'Equivalent spherical display radius',
        mapPriority: 'landmark',
      },
    });
    expect(registry.getLabelObjects(1)[0]?.name).toBe('Bassin de Shapley');
  });

  it('retourne une position locale dans un vecteur réutilisable', () => {
    const registry = createRegistry();
    const target = new THREE.Vector3();

    expect(registry.getLocalPosition(registry.objectIds[1]!, target)).toBe(target);
    expect(target.toArray()).toEqual([-157_020, 287_680, 337_280]);
    expect(registry.getLocalPosition('missing')).toBeNull();
  });

  it('distingue la longueur des filaments des propriétés non publiées des amas Planck', () => {
    const filamentRegistry = createSingleStructureRegistry('filament', 'F42', 12.4, 0, 1);
    const filament = filamentRegistry.getDefinition('lss-test-filament-f42');

    expect(filament).toMatchObject({
      name: 'Filament test F42',
      type: 'cosmic-filament',
      metadata: {
        lengthMpc: expect.closeTo(24.8, 4),
      },
    });
    expect(filament?.description).toContain('épine publiée');
    expect(filament?.metadata?.['effectiveRadiusMpc']).toBeUndefined();
    expect(filament?.metadata?.['memberGalaxyCount']).toBeUndefined();
    expect(filament?.metadata?.['surveyEdge']).toBeUndefined();
    expect(filament?.metadata?.['visualAdaptation']).toContain('points publiés');

    const clusterRegistry = createSingleStructureRegistry('cluster', 'PSZ2 G000.04+45.13', 0, 0, 0);
    const cluster = clusterRegistry.getDefinition('lss-test-cluster-psz2-g000-04-45-13');

    expect(cluster).toMatchObject({
      name: 'Amas test PSZ2 G000.04+45.13',
      type: 'galaxy-cluster',
    });
    expect(cluster?.description).toContain('Structure de galaxies');
    expect(cluster?.metadata?.['effectiveRadiusMpc']).toBeUndefined();
    expect(cluster?.metadata?.['memberGalaxyCount']).toBeUndefined();
  });
});

function createRegistry(): CosmicStructureCatalogRegistry {
  return new CosmicStructureCatalogRegistry(createCatalog(), new CoordinateSystem());
}

function createCatalog(): CosmicStructureCatalog {
  return {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.hypot(-176.1, 163.7, -287.8),
    maximumDistanceMpc: Math.hypot(-785.1, 1_438.4, 1_686.4),
    positionsMpc: new Float32Array([-176.1, 163.7, -287.8, -785.1, 1_438.4, 1_686.4]),
    distancesMpc: new Float32Array([
      Math.hypot(-176.1, 163.7, -287.8),
      Math.hypot(-785.1, 1_438.4, 1_686.4),
    ]),
    radiiMpc: new Float32Array([35.9, 46.14]),
    confidences: new Float32Array([0.98, 1]),
    densityContrasts: new Float32Array([Number.NaN, -0.717]),
    boundaryDistancesMpc: new Float32Array([Number.NaN, 75.006]),
    galaxyCounts: new Uint32Array([1_038, 35]),
    sourceIndices: new Uint16Array([0, 1]),
    catalogNumericIds: new Uint16Array([1, 60]),
    flags: new Uint8Array([0, 0]),
    identifiers: ['239+027+0091', 'CMASS-North-60'],
    structureTypes: ['supercluster', 'void'],
    metadata: createMetadata(),
  };
}

function createMetadata(): CosmicStructureCatalogMetadata {
  return {
    version: '1.0.0',
    recordCount: 2,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'sdss-main50',
        name: 'SDSS superclusters',
        citation: 'Liivamägi et al. (2012)',
        sourceUrl: 'https://example.test/superclusters',
        structureType: 'supercluster',
        method: 'Luminosity density field',
        objectNamePrefix: 'Superamas SDSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
      {
        id: 'boss-voids',
        name: 'BOSS voids',
        citation: 'Mao et al. (2017)',
        sourceUrl: 'https://example.test/voids',
        structureType: 'void',
        method: 'ZOBOV',
        objectNamePrefix: 'Vide BOSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
    ],
  };
}

function createSingleStructureRegistry(
  structureType: CosmicStructureType,
  identifier: string,
  radiusMpc: number,
  galaxyCount: number,
  flags: number,
): CosmicStructureCatalogRegistry {
  const sourceId = `test-${structureType}`;
  const position = [10, 20, 30] as const;
  const catalog: CosmicStructureCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.hypot(...position),
    maximumDistanceMpc: Math.hypot(...position),
    positionsMpc: new Float32Array(position),
    distancesMpc: new Float32Array([Math.hypot(...position)]),
    radiiMpc: new Float32Array([radiusMpc]),
    confidences: new Float32Array([0.94]),
    densityContrasts: new Float32Array([Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN]),
    galaxyCounts: new Uint32Array([galaxyCount]),
    sourceIndices: new Uint16Array([0]),
    catalogNumericIds: new Uint16Array([42]),
    flags: new Uint8Array([flags]),
    identifiers: [identifier],
    structureTypes: [structureType],
    metadata: {
      version: '1.0.0',
      recordCount: 1,
      referenceEpochJulianDay: 2_451_545,
      referenceFrame: 'equatorial-j2000',
      distanceUnit: 'megaparsec',
      scientificConfidence: 'calculated',
      sources: [
        {
          id: sourceId,
          name: `${structureType} test catalogue`,
          citation: 'Test et al. (2026)',
          sourceUrl: 'https://example.test/structures',
          structureType,
          method: 'Documented test method',
          objectNamePrefix: structureType === 'filament' ? 'Filament test' : 'Amas test',
          scientificConfidence: 'calculated',
          recordCount: 1,
        },
      ],
    },
  };

  return new CosmicStructureCatalogRegistry(catalog, new CoordinateSystem());
}

function createNamedLandmarkRegistry(): CosmicStructureCatalogRegistry {
  const catalog: CosmicStructureCatalog = {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 220,
    maximumDistanceMpc: 220,
    positionsMpc: new Float32Array([220, 0, 0]),
    distancesMpc: new Float32Array([220]),
    radiiMpc: new Float32Array([100]),
    confidences: new Float32Array([0.9]),
    densityContrasts: new Float32Array([Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN]),
    galaxyCounts: new Uint32Array([0]),
    sourceIndices: new Uint16Array([0]),
    catalogNumericIds: new Uint16Array([4]),
    flags: new Uint8Array([128]),
    identifiers: ['shapley-basin'],
    structureTypes: ['basin'],
    metadata: {
      version: '1.0.0',
      recordCount: 1,
      referenceEpochJulianDay: 2_451_545,
      referenceFrame: 'equatorial-j2000',
      distanceUnit: 'megaparsec',
      scientificConfidence: 'calculated',
      sources: [
        {
          id: 'valade-pboa',
          name: 'Probabilistic basins',
          citation: 'Valade et al. (2024)',
          sourceUrl: 'https://example.test/pboa',
          structureType: 'basin',
          method: 'Constrained probabilistic reconstruction',
          objectNamePrefix: 'Bassin',
          scientificConfidence: 'calculated',
          confidenceMeaning: 'Intrinsic p-BoA probability',
          extentMeaning: 'Equivalent spherical display radius',
          mapPriority: 'landmark',
          recordNames: { 'shapley-basin': 'Bassin de Shapley' },
          recordAliases: { 'shapley-basin': ['Shapley p-BoA'] },
          recordCount: 1,
        },
      ],
    },
  };

  return new CosmicStructureCatalogRegistry(catalog, new CoordinateSystem());
}
