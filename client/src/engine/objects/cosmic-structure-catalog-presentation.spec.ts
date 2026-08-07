import type { CosmicStructureCatalog } from '../loaders/cosmic-structure-catalog';
import {
  cosmicStructureAliases,
  cosmicStructureDescription,
  cosmicStructureName,
  cosmicStructureScore,
} from './cosmic-structure-catalog-presentation';

describe('cosmic structure catalog presentation', () => {
  it('privilégie les noms publiés et conserve un libellé de repli traçable', () => {
    const source = catalog.metadata.sources[0]!;

    expect(cosmicStructureName(source, 'shapley')).toBe('Bassin de Shapley');
    expect(cosmicStructureName(source, 'unknown')).toBe('Bassin unknown');
    expect(cosmicStructureAliases(source, 'shapley')).toEqual([
      'shapley',
      'landmarks shapley',
      'Shapley p-BoA',
    ]);
    expect(cosmicStructureAliases(source, 'unknown')).toEqual(['unknown', 'landmarks unknown']);
  });

  it('décrit les familles scientifiques et classe les repères nommés en priorité', () => {
    expect(cosmicStructureDescription('wall')).toContain('Mur cosmique');
    expect(cosmicStructureDescription('basin')).toContain('Bassin d’attraction');
    expect(cosmicStructureDescription('attractor')).toContain('convergence');
    expect(cosmicStructureDescription('repeller')).toContain('divergence');
    expect(cosmicStructureDescription('void')).toContain('sous-dense');
    expect(cosmicStructureDescription('filament')).toContain('Filament');
    expect(cosmicStructureDescription('cluster')).toContain('Structure de galaxies');
    expect(cosmicStructureScore(catalog, 0)).toBeGreaterThan(cosmicStructureScore(catalog, 1));
  });
});

const catalog: CosmicStructureCatalog = {
  count: 2,
  referenceEpochJulianDay: 2_451_545,
  minimumDistanceMpc: 100,
  maximumDistanceMpc: 200,
  positionsMpc: new Float32Array([100, 0, 0, 200, 0, 0]),
  distancesMpc: new Float32Array([100, 200]),
  radiiMpc: new Float32Array([50, 50]),
  confidences: new Float32Array([1, 1]),
  densityContrasts: new Float32Array([Number.NaN, Number.NaN]),
  boundaryDistancesMpc: new Float32Array([Number.NaN, Number.NaN]),
  galaxyCounts: new Uint32Array([0, 10_000]),
  sourceIndices: new Uint16Array([0, 1]),
  catalogNumericIds: new Uint16Array([1, 2]),
  flags: new Uint8Array([128, 0]),
  identifiers: ['shapley', 'cluster'],
  structureTypes: ['basin', 'cluster'],
  metadata: {
    version: '1.0.0',
    recordCount: 2,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'landmarks',
        name: 'Named landmarks',
        citation: 'Reference et al. (2024)',
        sourceUrl: 'https://example.test/landmarks',
        structureType: 'basin',
        method: 'Probabilistic reconstruction',
        objectNamePrefix: 'Bassin',
        scientificConfidence: 'calculated',
        mapPriority: 'landmark',
        recordNames: { shapley: 'Bassin de Shapley' },
        recordAliases: { shapley: ['Shapley p-BoA'] },
        recordCount: 1,
      },
      {
        id: 'clusters',
        name: 'Clusters',
        citation: 'Reference et al. (2020)',
        sourceUrl: 'https://example.test/clusters',
        structureType: 'cluster',
        method: 'Published catalogue',
        objectNamePrefix: 'Amas',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
    ],
  },
};
