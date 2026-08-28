import gaiaIndexSource from '../../../public/data/stars/gaia-dr3-tiles/index.json';
import gaiaChildPackSource from '../../../public/data/stars/gaia-dr3-tiles/lod3/r-p0-p0-p0.json';
import gaiaRootPackSource from '../../../public/data/stars/gaia-dr3-tiles/lod4/pack-p0-p0-p0.json';
import {
  assertStarClusterTileMatchesIndex,
  parseStarClusterTilePack,
  parseStarTileIndex,
} from './star-tile-index';

describe('artefacts stellaires Gaia DR3', () => {
  it('valide l’index déployé et un paquet racine avec le parseur de production', () => {
    const index = parseStarTileIndex(gaiaIndexSource, 'gaia-dr3-tiles/index.json');
    const pack = parseStarClusterTilePack(
      gaiaRootPackSource,
      'gaia-dr3-tiles/lod4/pack-p0-p0-p0.json',
    );
    const nodesById = new Map(index.nodes.map((node) => [node.id, node]));

    expect(index).toMatchObject({
      version: '4.0.0',
      sourceCatalog: 'gaia-dr3-bright-high-confidence',
      sourceStarCount: 2_923_790,
      referenceEpochJulianDay: 2_457_388.5,
      referenceFrame: 'icrs',
      magnitudeBand: 'gaia-g',
      colorIndexSystem: 'gaia-bp-rp',
      sampling: {
        method: 'brightest-plus-deterministic-uniform',
        maximumSamplesPerLeaf: 96,
        brightestSamplesPerLeaf: 32,
      },
      scientificConfidence: 'calculated',
      representation: 'hierarchical-aggregation-with-deterministic-samples',
    });
    expect(index.rootIds).toHaveLength(127);
    expect(index.nodes.filter((node) => node.parentId !== undefined)).toHaveLength(3_837);
    expect(pack.sourceCatalog).toBe(index.sourceCatalog);

    for (const tile of pack.tiles) {
      const node = nodesById.get(tile.id);

      expect(node).toBeDefined();
      assertStarClusterTileMatchesIndex(tile, index, node!);
    }
  });

  it('valide les échantillons mesurés du paquet raffiné autour du Soleil', () => {
    const index = parseStarTileIndex(gaiaIndexSource, 'gaia-dr3-tiles/index.json');
    const pack = parseStarClusterTilePack(
      gaiaChildPackSource,
      'gaia-dr3-tiles/lod3/r-p0-p0-p0.json',
    );
    const nodesById = new Map(index.nodes.map((node) => [node.id, node]));

    expect(pack.tiles).toHaveLength(64);
    expect(pack.tiles.reduce((count, tile) => count + tile.clusterCount, 0)).toBe(5_789);
    for (const tile of pack.tiles) {
      const node = nodesById.get(tile.id);

      expect(node).toBeDefined();
      expect(tile.representation).toBe('sampled-source');
      expect(tile.clusterCount).toBeLessThanOrEqual(index.sampling.maximumSamplesPerLeaf);
      expect(tile.starCounts.reduce((count, weight) => count + weight, 0)).toBe(
        tile.sourceStarCount,
      );
      assertStarClusterTileMatchesIndex(tile, index, node!);
    }
  });
});
