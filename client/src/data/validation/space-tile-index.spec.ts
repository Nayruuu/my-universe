import { parseSpaceTileIndex } from './space-tile-index';

describe('index de tuiles spatiales', () => {
  it('valide un index complet et conserve les métadonnées de recherche', () => {
    const index = parseSpaceTileIndex(validIndex(), 'nearby-universe');

    expect(index.tiles).toEqual([
      {
        id: 'tile-a',
        level: 0,
        referenceFrame: 'nearby-universe',
        url: '/data/tiles/tile-a.json',
        bounds: {
          min: [-2, -2, -2],
          max: [2, 2, 2],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-a'],
      },
    ]);
    expect(index.searchEntries[0]).toEqual(
      expect.objectContaining({
        id: 'galaxy-a',
        name: 'Galaxie A',
        aliases: ['A'],
      }),
    );
    expect(index.overviewEntries).toEqual([
      {
        id: 'galaxy-a',
        position: [1, 2, 3],
        unit: 'megaparsec',
        color: '#9fb9dd',
        visualRadius: 12,
      },
    ]);
  });

  it('valide une hiérarchie réciproque dont les enfants restent dans les bornes du parent', () => {
    const index = parseSpaceTileIndex(hierarchicalIndex(), 'hierarchical');

    expect(index.tiles).toEqual([
      expect.objectContaining({ id: 'tile-root', level: 0, childIds: ['tile-child'] }),
      expect.objectContaining({ id: 'tile-child', level: 1, parentId: 'tile-root' }),
    ]);
  });

  it.each([null, [], {}, { version: 1, tiles: [], searchEntries: [] }])(
    'rejette une racine invalide',
    (value) => {
      expect(() => parseSpaceTileIndex(value, 'invalid')).toThrow(
        'Index de tuiles spatiales invalide',
      );
    },
  );

  it.each([
    null,
    {},
    { ...validTile(), id: 42 },
    { ...validTile(), level: -1 },
    { ...validTile(), level: 0.5 },
    { ...validTile(), referenceFrame: 'unknown' },
    { ...validTile(), url: 42 },
    { ...validTile(), objectIds: [] },
    { ...validTile(), objectIds: ['galaxy-a', 42] },
    { ...validTile(), parentId: 42 },
    { ...validTile(), parentId: '' },
    { ...validTile(), childIds: 'tile-child' },
    { ...validTile(), childIds: ['tile-child', 'tile-child'] },
  ])('rejette une tuile structurellement invalide', (tile) => {
    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [tile],
          searchEntries: [],
        },
        'invalid',
      ),
    ).toThrow('Tuile spatiale invalide');
  });

  it.each([
    null,
    {},
    { min: [0, 0], max: [1, 1, 1], unit: 'megaparsec' },
    { min: [0, 0, 0], max: [1, Number.NaN, 1], unit: 'megaparsec' },
    { min: [2, 0, 0], max: [1, 1, 1], unit: 'megaparsec' },
    { min: [0, 0, 0], max: [1, 1, 1], unit: 'furlong' },
  ])('rejette des limites spatiales invalides', (bounds) => {
    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [{ ...validTile(), bounds }],
          searchEntries: [],
        },
        'invalid',
      ),
    ).toThrow('Limites invalides');
  });

  it('rejette les identifiants de tuiles et d’objets dupliqués', () => {
    const tile = validTile();

    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [tile, { ...tile, objectIds: ['galaxy-b'] }],
          searchEntries: [],
        },
        'duplicates',
      ),
    ).toThrow('Identifiant de tuile dupliqué');
    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [tile, { ...tile, id: 'tile-b' }],
          searchEntries: [],
        },
        'duplicates',
      ),
    ).toThrow('Objet référencé par plusieurs tuiles');
  });

  it.each([
    null,
    {},
    { ...validSearchEntry(), id: 42 },
    { ...validSearchEntry(), aliases: ['A', 42] },
    { ...validSearchEntry(), type: 'spaceship' },
    { ...validSearchEntry(), parentName: 42 },
    { ...validSearchEntry(), keywords: ['galaxie', 42] },
  ])('rejette une entrée de recherche invalide', (searchEntry) => {
    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [validTile()],
          searchEntries: [searchEntry],
        },
        'invalid',
      ),
    ).toThrow('Entrée de recherche spatiale invalide');
  });

  it.each([
    null,
    {},
    { ...validOverviewEntry(), id: 42 },
    { ...validOverviewEntry(), position: [1, 2] },
    { ...validOverviewEntry(), position: [1, Number.NaN, 3] },
    { ...validOverviewEntry(), unit: 'furlong' },
    { ...validOverviewEntry(), color: 42 },
    { ...validOverviewEntry(), visualRadius: 0 },
  ])('rejette une entrée d’aperçu spatial invalide', (overviewEntry) => {
    expect(() =>
      parseSpaceTileIndex(
        {
          ...validIndex(),
          overviewEntries: [overviewEntry],
        },
        'invalid-overview',
      ),
    ).toThrow('Entrée d’aperçu spatial invalide');
  });

  it('rejette les aperçus dupliqués ou absents de l’index de recherche', () => {
    expect(() =>
      parseSpaceTileIndex(
        {
          ...validIndex(),
          overviewEntries: [validOverviewEntry(), validOverviewEntry()],
        },
        'duplicate-overview',
      ),
    ).toThrow('Entrée d’aperçu dupliquée');
    expect(() =>
      parseSpaceTileIndex(
        {
          ...validIndex(),
          overviewEntries: [{ ...validOverviewEntry(), id: 'unknown' }],
        },
        'unknown-overview',
      ),
    ).toThrow('Objet d’aperçu absent de la recherche');
  });

  it('exige une entrée de recherche unique pour chaque objet tuilé', () => {
    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [validTile()],
          searchEntries: [],
        },
        'missing',
      ),
    ).toThrow('Entrée de recherche manquante');
    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [validTile()],
          searchEntries: [validSearchEntry(), validSearchEntry()],
        },
        'duplicate',
      ),
    ).toThrow('Entrée de recherche dupliquée');
    expect(() =>
      parseSpaceTileIndex(
        {
          version: '1.0.0',
          tiles: [validTile()],
          searchEntries: [{ ...validSearchEntry(), id: 'unknown' }],
        },
        'unknown',
      ),
    ).toThrow('Objet de recherche absent des tuiles');
  });

  it.each([
    [
      {
        tiles: hierarchicalTiles().map((tile) =>
          tile['id'] === 'tile-root' ? { ...tile, level: 1 } : tile,
        ),
      },
      'Niveau hiérarchique invalide pour la racine',
    ],
    [
      {
        tiles: hierarchicalTiles().map((tile) =>
          tile['id'] === 'tile-root' ? { ...tile, childIds: ['unknown'] } : tile,
        ),
      },
      'Relation hiérarchique invalide',
    ],
    [
      {
        tiles: hierarchicalTiles().map((tile) =>
          tile['id'] === 'tile-child' ? { ...tile, parentId: 'unknown' } : tile,
        ),
      },
      'Relation hiérarchique invalide',
    ],
    [
      {
        tiles: hierarchicalTiles().map((tile) =>
          tile['id'] === 'tile-child' ? { ...tile, level: 2 } : tile,
        ),
      },
      'Niveau hiérarchique invalide',
    ],
    [
      {
        tiles: hierarchicalTiles().map((tile) =>
          tile['id'] === 'tile-child'
            ? { ...tile, bounds: { ...(tile['bounds'] as object), min: [-3, -1, -1] } }
            : tile,
        ),
      },
      'Bornes hiérarchiques invalides',
    ],
    [
      {
        tiles: hierarchicalTiles().map((tile) =>
          tile['id'] === 'tile-child' ? { ...tile, referenceFrame: 'local-group' } : tile,
        ),
      },
      'Référentiel hiérarchique invalide',
    ],
    [
      {
        tiles: hierarchicalTiles().map((tile) =>
          tile['id'] === 'tile-root' ? { ...tile, childIds: [] } : tile,
        ),
      },
      'Relation hiérarchique invalide',
    ],
  ])('rejette une hiérarchie spatiale incohérente', (changes, message) => {
    expect(() =>
      parseSpaceTileIndex({ ...hierarchicalIndex(), ...changes }, 'invalid-hierarchy'),
    ).toThrow(message);
  });
});

function validIndex(): Record<string, unknown> {
  return {
    version: '1.0.0',
    tiles: [validTile()],
    searchEntries: [validSearchEntry()],
    overviewEntries: [validOverviewEntry()],
  };
}

function validTile(): object {
  return {
    id: 'tile-a',
    level: 0,
    referenceFrame: 'nearby-universe',
    url: '/data/tiles/tile-a.json',
    bounds: {
      min: [-2, -2, -2],
      max: [2, 2, 2],
      unit: 'megaparsec',
    },
    objectIds: ['galaxy-a'],
  };
}

function validSearchEntry(): object {
  return {
    id: 'galaxy-a',
    name: 'Galaxie A',
    aliases: ['A'],
    type: 'galaxy',
    parentName: 'Univers proche',
    keywords: ['galaxie'],
  };
}

function validOverviewEntry(): object {
  return {
    id: 'galaxy-a',
    position: [1, 2, 3],
    unit: 'megaparsec',
    color: '#9fb9dd',
    visualRadius: 12,
  };
}

function hierarchicalIndex(): object {
  return {
    version: '2.0.0',
    tiles: hierarchicalTiles(),
    searchEntries: [
      validSearchEntry(),
      { ...validSearchEntry(), id: 'galaxy-b', name: 'Galaxie B' },
    ],
  };
}

function hierarchicalTiles(): Array<Record<string, unknown>> {
  return [
    {
      ...validTile(),
      id: 'tile-root',
      childIds: ['tile-child'],
    },
    {
      ...validTile(),
      id: 'tile-child',
      level: 1,
      parentId: 'tile-root',
      objectIds: ['galaxy-b'],
      bounds: {
        min: [-1, -1, -1],
        max: [1, 1, 1],
        unit: 'megaparsec',
      },
    },
  ];
}
