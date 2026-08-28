import {
  assertStarClusterTileMatchesIndex,
  parseStarClusterTile,
  parseStarClusterTilePack,
  parseStarTileIndex,
} from './star-tile-index';

describe('index spatial stellaire hiérarchique', () => {
  it('valide les racines, les enfants, les bornes et les paquets mutualisés', () => {
    const index = parseStarTileIndex(validIndex(), 'gaia-tiles');

    expect(index.rootIds).toEqual(['root-a', 'root-b']);
    expect(index.nodes).toHaveLength(4);
    expect(index.nodes[0]).toMatchObject({
      id: 'root-a',
      childIds: ['a-0', 'a-1'],
      lodLevel: 4,
      url: '/data/stars/tiles/lod4/pack-0.json',
    });
  });

  it.each([
    null,
    [],
    {},
    { ...validIndex(), version: 1 },
    { ...validIndex(), sourceCatalog: 42 },
    { ...validIndex(), sourceStarCount: 0 },
    { ...validIndex(), referenceEpochJulianDay: Number.NaN },
    { ...validIndex(), referenceFrame: 'galactic' },
    { ...validIndex(), distanceUnit: 'light-year' },
    { ...validIndex(), magnitudeBand: 'johnson-r' },
    { ...validIndex(), colorIndexSystem: 'temperature' },
    { ...validIndex(), source: null },
    { ...validIndex(), source: { ...validSource(), name: '' } },
    { ...validIndex(), source: { ...validSource(), url: '' } },
    { ...validIndex(), source: { ...validSource(), doi: 42 } },
    { ...validIndex(), source: { ...validSource(), credit: '' } },
    { ...validIndex(), source: { ...validSource(), retrievedAt: 'hier' } },
    { ...validIndex(), source: { ...validSource(), query: '' } },
    { ...validIndex(), selection: null },
    { ...validIndex(), selection: { ...validSelection(), maximumDistanceParsec: 0 } },
    { ...validIndex(), selection: { ...validSelection(), maximumApparentMagnitude: null } },
    { ...validIndex(), selection: { ...validSelection(), minimumParallaxOverError: 0 } },
    { ...validIndex(), sampling: null },
    {
      ...validIndex(),
      sampling: { ...validSampling(), brightestSamplesPerLeaf: 97 },
    },
    { ...validIndex(), scientificConfidence: 'observed' },
    { ...validIndex(), representation: 'physical' },
    { ...validIndex(), rootIds: [] },
    { ...validIndex(), rootIds: [1] },
    { ...validIndex(), nodes: [] },
  ])('rejette une racine d’index invalide', (value) => {
    expect(() => parseStarTileIndex(value, 'invalid')).toThrow('Index spatial stellaire invalide');
  });

  it.each([
    null,
    {},
    { ...validRoot(), id: '' },
    { ...validRoot(), parentId: 42 },
    { ...validRoot(), parentId: '' },
    { ...validRoot(), lodLevel: -1 },
    { ...validRoot(), lodLevel: 2.5 },
    { ...validRoot(), childIds: [2] },
    { ...validRoot(), childIds: ['a-0', 'a-0'] },
    { ...validRoot(), boundsParsec: null },
    { ...validRoot(), boundsParsec: { min: [0, 0], max: [1, 1, 1] } },
    { ...validRoot(), boundsParsec: { min: [0, 0, 0], max: [0, 1, 1] } },
    { ...validRoot(), sourceStarCount: 0 },
    { ...validRoot(), clusterCount: 0 },
    { ...validRoot(), cellSizeParsec: 0 },
    { ...validRoot(), representation: 'individual-object' },
    { ...validRoot(), url: '' },
  ])('rejette un nœud spatial invalide', (node) => {
    expect(() => parseStarTileIndex({ ...validIndex(), nodes: [node] }, 'invalid')).toThrow(
      'Nœud spatial stellaire invalide',
    );
  });

  it('rejette les identifiants dupliqués', () => {
    expect(() =>
      parseStarTileIndex(
        { ...validIndex(), nodes: [...validNodes(), { ...validRoot(), id: 'root-a' }] },
        'duplicates',
      ),
    ).toThrow('Nœud spatial stellaire dupliqué : root-a');
    expect(() =>
      parseStarTileIndex({ ...validIndex(), rootIds: ['root-a', 'root-a'] }, 'duplicates'),
    ).toThrow('Racine spatiale stellaire dupliquée');
  });

  it.each([
    [{ rootIds: ['unknown', 'root-b'] }, 'Racine spatiale stellaire invalide'],
    [
      {
        nodes: validNodes().map((node) =>
          node['id'] === 'root-a' ? { ...node, lodLevel: 3 } : node,
        ),
      },
      'Racine spatiale stellaire invalide',
    ],
    [{ sourceStarCount: 5 }, 'Comptage des racines stellaires incohérent'],
    [{ rootIds: ['root-a'], sourceStarCount: 3 }, 'Nœud spatial orphelin'],
    [
      {
        nodes: validNodes().map((node) =>
          node['id'] === 'root-a' ? { ...node, childIds: ['a-1'] } : node,
        ),
      },
      'Relation spatiale stellaire invalide',
    ],
    [
      {
        nodes: validNodes().map((node) =>
          node['id'] === 'a-0'
            ? { ...node, childIds: ['a-1'] }
            : node['id'] === 'a-1'
              ? { ...node, parentId: 'a-0' }
              : node['id'] === 'root-a'
                ? { ...node, childIds: ['a-0'] }
                : node,
        ),
      },
      'Relation spatiale stellaire invalide',
    ],
    [
      {
        nodes: validNodes().map((node) =>
          node['id'] === 'root-a' ? { ...node, childIds: ['unknown', 'a-1'] } : node,
        ),
      },
      'Relation spatiale stellaire invalide',
    ],
    [
      {
        nodes: validNodes().map((node) =>
          node['id'] === 'a-0' ? { ...node, parentId: 'root-b' } : node,
        ),
      },
      'Relation spatiale stellaire invalide',
    ],
    [
      {
        nodes: validNodes().map((node) => (node['id'] === 'a-0' ? { ...node, lodLevel: 4 } : node)),
      },
      'Relation spatiale stellaire invalide',
    ],
    [
      {
        nodes: validNodes().map((node) =>
          node['id'] === 'a-0'
            ? { ...node, boundsParsec: { min: [-1, 0, 0], max: [1, 1, 1] } }
            : node,
        ),
      },
      'Relation spatiale stellaire invalide',
    ],
    [
      {
        nodes: validNodes().map((node) =>
          node['id'] === 'a-0' ? { ...node, sourceStarCount: 3 } : node,
        ),
      },
      'Comptage des enfants stellaires incohérent',
    ],
  ])('rejette une hiérarchie incohérente : %s', (changes, message) => {
    expect(() => parseStarTileIndex({ ...validIndex(), ...changes }, 'invalid')).toThrow(message);
  });
});

describe('paquets de tuiles stellaires', () => {
  it('convertit plusieurs tuiles en buffers typés', () => {
    const pack = parseStarClusterTilePack(validPack(), 'root-a-pack');

    expect(pack.tiles).toHaveLength(2);
    expect(pack.tiles[0]?.cellCoordinates).toBeInstanceOf(Int32Array);
    expect(pack.tiles[0]?.positionsParsec).toBeInstanceOf(Float32Array);
    expect(pack.tiles[0]?.starCounts).toBeInstanceOf(Uint32Array);
    expect(pack.tiles[0]?.apparentMagnitudes).toBeInstanceOf(Float32Array);
    expect(pack.tiles[0]?.colorIndices).toBeInstanceOf(Float32Array);
  });

  it.each([
    null,
    [],
    {},
    { ...validPack(), version: 1 },
    { ...validPack(), sourceCatalog: 42 },
    { ...validPack(), referenceEpochJulianDay: Number.NaN },
    { ...validPack(), magnitudeBand: 'johnson-r' },
    { ...validPack(), colorIndexSystem: 'temperature' },
    { ...validPack(), tiles: [] },
  ])('rejette un paquet invalide', (value) => {
    expect(() => parseStarClusterTilePack(value, 'invalid')).toThrow(
      'Paquet de tuiles stellaires invalide',
    );
  });

  it('rejette les tuiles dupliquées et les métadonnées divergentes', () => {
    const tile = validTile('a-0', 'root-a');

    expect(() =>
      parseStarClusterTilePack({ ...validPack(), tiles: [tile, tile] }, 'duplicate'),
    ).toThrow('Tuile stellaire dupliquée');
    expect(() =>
      parseStarClusterTilePack(
        { ...validPack(), tiles: [{ ...tile, sourceCatalog: 'other' }] },
        'metadata',
      ),
    ).toThrow('Métadonnées de tuile stellaire incohérentes');
    expect(() =>
      parseStarClusterTilePack(
        { ...validPack(), tiles: [{ ...tile, colorIndexSystem: 'johnson-b-v' }] },
        'metadata',
      ),
    ).toThrow('Métadonnées de tuile stellaire incohérentes');
  });

  it.each([
    null,
    [],
    {},
    { ...validTile(), id: '' },
    { ...validTile(), parentId: 42 },
    { ...validTile(), parentId: '' },
    { ...validTile(), version: 1 },
    { ...validTile(), sourceCatalog: 42 },
    { ...validTile(), sourceStarCount: 0 },
    { ...validTile(), referenceEpochJulianDay: Number.NaN },
    { ...validTile(), magnitudeBand: 'johnson-r' },
    { ...validTile(), colorIndexSystem: 'temperature' },
    { ...validTile(), lodLevel: -1 },
    { ...validTile(), cellSizeParsec: 0 },
    { ...validTile(), representation: 'individual-object' },
    { ...validTile(), cellCoordinates: [0, 0] },
    { ...validTile(), cellCoordinates: [0, 0, 0, 1, 1, 1.5] },
    { ...validTile(), positionsParsec: [1, 2] },
    { ...validTile(), positionsParsec: [1, 2, Number.NaN, 4, 5, 6] },
    { ...validTile(), starCounts: [2] },
    { ...validTile(), starCounts: [2, 0] },
    { ...validTile(), apparentMagnitudes: [-1, Number.NaN] },
    { ...validTile(), colorIndices: [0.2] },
  ])('rejette une tuile incohérente', (value) => {
    expect(() => parseStarClusterTile(value, 'invalid')).toThrow(
      'Tuile de cellules stellaires invalide',
    );
  });

  it('rejette un comptage local incohérent', () => {
    expect(() => parseStarClusterTile({ ...validTile(), sourceStarCount: 4 }, 'invalid')).toThrow(
      'comptage stellaire incohérent',
    );
  });

  it('recoupe une tuile avec son nœud et son index source indépendant de HYG', () => {
    const index = parseStarTileIndex(validIndex(), 'gaia-tiles');
    const tile = parseStarClusterTile(validTile(), 'a-0');

    expect(() => assertStarClusterTileMatchesIndex(tile, index, index.nodes[2]!)).not.toThrow();
  });

  it.each([
    [{ sourceCatalog: 'other' }, 'catalogue source'],
    [{ sourceStarCount: 3, starCounts: [2, 1] }, 'nombre d’étoiles'],
    [{ referenceEpochJulianDay: 2_451_546 }, 'époque de référence'],
    [{ magnitudeBand: 'johnson-v' }, 'système photométrique'],
    [{ colorIndexSystem: 'johnson-b-v' }, 'système photométrique'],
    [{ id: 'wrong' }, 'nœud spatial'],
    [{ parentId: 'wrong' }, 'nœud spatial'],
    [{ lodLevel: 4 }, 'niveau de détail'],
    [{ cellSizeParsec: 80 }, 'taille de cellule'],
    [{ representation: 'aggregate-cell' }, 'représentation'],
    [
      {
        sourceStarCount: 2,
        cellCoordinates: [0, 0, 0],
        positionsParsec: [1, 2, 3],
        starCounts: [2],
        apparentMagnitudes: [-1],
        colorIndices: [0.2],
      },
      'nombre de cellules',
    ],
  ])('détecte un recoupement invalide : %s', (changes, message) => {
    const index = parseStarTileIndex(validIndex(), 'gaia-tiles');
    const tile = parseStarClusterTile({ ...validTile(), ...changes }, 'a-0');

    expect(() => assertStarClusterTileMatchesIndex(tile, index, index.nodes[2]!)).toThrow(message);
  });

  it('détecte une tuile issue d’une autre version d’index', () => {
    const index = parseStarTileIndex(validIndex(), 'gaia-tiles');
    const tile = {
      ...parseStarClusterTile(validTile(), 'a-0'),
      version: '5.0.0',
    };

    expect(() => assertStarClusterTileMatchesIndex(tile, index, index.nodes[2]!)).toThrow(
      'version d’index',
    );
  });
});

function validIndex(): object {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    sourceStarCount: 4,
    referenceEpochJulianDay: 2_457_388.5,
    referenceFrame: 'icrs',
    distanceUnit: 'parsec',
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    source: validSource(),
    selection: validSelection(),
    sampling: validSampling(),
    scientificConfidence: 'calculated',
    representation: 'hierarchical-aggregation-with-deterministic-samples',
    rootIds: ['root-a', 'root-b'],
    nodes: validNodes(),
  };
}

function validNodes(): Array<Record<string, unknown>> {
  return [
    validRoot(),
    {
      ...validRoot(),
      id: 'root-b',
      childIds: [],
      boundsParsec: { min: [2, 0, 0], max: [4, 2, 2] },
      sourceStarCount: 1,
      clusterCount: 1,
      representation: 'aggregate-cell',
      url: '/data/stars/tiles/lod4/pack-1.json',
    },
    {
      id: 'a-0',
      parentId: 'root-a',
      childIds: [],
      lodLevel: 3,
      boundsParsec: { min: [0, 0, 0], max: [1, 2, 2] },
      sourceStarCount: 2,
      clusterCount: 2,
      cellSizeParsec: 40,
      representation: 'sampled-source',
      url: '/data/stars/tiles/lod3/root-a.json',
    },
    {
      id: 'a-1',
      parentId: 'root-a',
      childIds: [],
      lodLevel: 3,
      boundsParsec: { min: [1, 0, 0], max: [2, 2, 2] },
      sourceStarCount: 1,
      clusterCount: 1,
      cellSizeParsec: 40,
      representation: 'sampled-source',
      url: '/data/stars/tiles/lod3/root-a.json',
    },
  ];
}

function validRoot(): Record<string, unknown> {
  return {
    id: 'root-a',
    childIds: ['a-0', 'a-1'],
    lodLevel: 4,
    boundsParsec: { min: [0, 0, 0], max: [2, 2, 2] },
    sourceStarCount: 3,
    clusterCount: 2,
    cellSizeParsec: 160,
    representation: 'aggregate-cell',
    url: '/data/stars/tiles/lod4/pack-0.json',
  };
}

function validPack(): object {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    tiles: [validTile('a-0', 'root-a'), validTile('a-1', 'root-a')],
  };
}

function validTile(id = 'a-0', parentId = 'root-a'): object {
  return {
    id,
    parentId,
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    sourceStarCount: id === 'a-0' ? 2 : 1,
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    lodLevel: 3,
    cellSizeParsec: 40,
    representation: 'sampled-source',
    cellCoordinates: id === 'a-0' ? [0, 0, 0, 0, 1, 0] : [1, 0, 0],
    positionsParsec: id === 'a-0' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9],
    starCounts: id === 'a-0' ? [1, 1] : [1],
    apparentMagnitudes: id === 'a-0' ? [-1, 1] : [0],
    colorIndices: id === 'a-0' ? [0.2, 0.8] : [0.5],
  };
}

function validSource(): object {
  return {
    name: 'Gaia Data Release 3 · gaia_source_lite',
    url: 'https://gea.esac.esa.int/archive/',
    doi: '10.5270/esa-qa4lep3',
    credit: 'ESA/Gaia/DPAC',
    retrievedAt: '2026-08-28T00:00:00.000Z',
    query: 'SELECT source_id FROM gaiadr3.gaia_source_lite',
  };
}

function validSelection(): object {
  return {
    maximumDistanceParsec: 5_000,
    maximumApparentMagnitude: 12,
    minimumParallaxOverError: 10,
  };
}

function validSampling(): object {
  return {
    method: 'brightest-plus-deterministic-uniform',
    maximumSamplesPerLeaf: 96,
    brightestSamplesPerLeaf: 32,
  };
}
