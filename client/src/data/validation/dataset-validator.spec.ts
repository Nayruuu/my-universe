import { parseManifest, parseUniverseDataset } from './dataset-validator';

describe('validation des données statiques', () => {
  it('accepte un objet minimal valide', () => {
    const dataset = parseUniverseDataset(
      {
        version: '1.0.0',
        objects: [
          {
            id: 'test-star',
            name: 'Étoile test',
            type: 'star',
            referenceFrame: 'stellar',
            scientificConfidence: 'observed',
            visual: {
              visualRadius: 1,
              scaleMode: 'adaptive',
            },
            positionProvider: {
              type: 'static',
              position: [1, 0, 0],
              unit: 'light-year',
            },
          },
        ],
      },
      'test',
    );

    expect(dataset.objects[0]?.id).toBe('test-star');
  });

  it('valide un manifest JSON et un catalogue binaire', () => {
    expect(
      parseManifest({
        version: '1.0.0',
        datasets: [
          { id: 'objects', url: '/objects.json', type: 'json' },
          {
            id: 'stars',
            url: '/stars.bin',
            type: 'binary',
            format: 'star-catalog-v2',
          },
        ],
      }).datasets,
    ).toEqual([
      { id: 'objects', url: '/objects.json', type: 'json' },
      {
        id: 'stars',
        url: '/stars.bin',
        type: 'binary',
        format: 'star-catalog-v2',
      },
    ]);
  });

  it.each([null, [], {}, { version: 1, datasets: [] }, { version: '1', datasets: null }])(
    'rejette un manifest racine invalide',
    (value) => {
      expect(() => parseManifest(value)).toThrow('Manifest de données invalide');
    },
  );

  it.each([
    null,
    { id: 1, url: '/x', type: 'json' },
    { id: 'x', url: 1, type: 'json' },
    { id: 'x', url: '/x', type: 'xml' },
  ])('rejette une entrée de manifest invalide', (entry) => {
    expect(() => parseManifest({ version: '1', datasets: [entry] })).toThrow(
      'Entrée de manifest invalide',
    );
  });

  it('rejette un format binaire inconnu', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [{ id: 'x', url: '/x', type: 'binary', format: 'v1' }],
      }),
    ).toThrow('Format binaire invalide');
  });

  it('rejette une unité ou une échelle visuelle inconnue', () => {
    expect(() =>
      parseUniverseDataset(
        {
          version: '1.0.0',
          objects: [
            {
              id: 'invalid',
              name: 'Invalide',
              type: 'star',
              referenceFrame: 'stellar',
              scientificConfidence: 'observed',
              visual: {
                visualRadius: 1,
                scaleMode: 'cinematic',
              },
              positionProvider: {
                type: 'static',
                position: [1, 0, 0],
                unit: 'unknown-unit',
              },
            },
          ],
        },
        'test',
      ),
    ).toThrow(/visuelle invalide/);
  });

  it('valide une éphéméride solaire locale', () => {
    const dataset = parseUniverseDataset(
      {
        version: '1.0.0',
        objects: [
          {
            id: 'earth',
            name: 'Terre',
            type: 'planet',
            referenceFrame: 'solar-system',
            scientificConfidence: 'calculated',
            visual: {
              visualRadius: 1,
              scaleMode: 'exaggerated',
            },
            positionProvider: {
              type: 'ephemeris',
              body: 'earth',
              origin: 'sun',
              orbitalPeriodDays: 365.256,
              orbitEpochJulianDay: 2_461_249,
            },
          },
        ],
      },
      'test',
    );

    expect(dataset.objects[0]?.positionProvider.type).toBe('ephemeris');
  });

  it('valide une galaxie du référentiel du Groupe local et sa silhouette', () => {
    const dataset = parseUniverseDataset(
      {
        version: '1.0.0',
        objects: [
          {
            id: 'andromeda',
            name: 'Andromède',
            type: 'galaxy',
            referenceFrame: 'local-group',
            scientificConfidence: 'observed',
            visual: {
              visualRadius: 520,
              scaleMode: 'adaptive',
              galaxyShape: 'spiral',
              galaxyAxisRatio: 0.35,
              galaxyRotationDegrees: 35,
            },
            positionProvider: {
              type: 'static',
              position: [-377, -288, 623],
              unit: 'kiloparsec',
            },
          },
        ],
      },
      'test',
    );

    expect(dataset.objects[0]?.visual.galaxyShape).toBe('spiral');
  });

  it('rejette une silhouette galactique incohérente', () => {
    expect(() =>
      parseUniverseDataset(
        {
          version: '1.0.0',
          objects: [
            {
              id: 'invalid-galaxy',
              name: 'Galaxie invalide',
              type: 'galaxy',
              referenceFrame: 'local-group',
              scientificConfidence: 'observed',
              visual: {
                visualRadius: 100,
                scaleMode: 'adaptive',
                galaxyShape: 'spiral',
                galaxyAxisRatio: 1.5,
              },
              positionProvider: {
                type: 'static',
                position: [1, 0, 0],
                unit: 'kiloparsec',
              },
            },
          ],
        },
        'test',
      ),
    ).toThrow(/Forme galactique invalide/);
  });

  it('rejette une origine d’éphéméride incohérente', () => {
    expect(() =>
      parseUniverseDataset(
        {
          version: '1.0.0',
          objects: [
            {
              id: 'moon',
              name: 'Lune',
              type: 'moon',
              referenceFrame: 'solar-system',
              scientificConfidence: 'calculated',
              visual: {
                visualRadius: 1,
                scaleMode: 'exaggerated',
              },
              positionProvider: {
                type: 'ephemeris',
                body: 'moon',
                origin: 'sun',
                orbitalPeriodDays: 27.321661,
                orbitEpochJulianDay: 2_461_249,
              },
            },
          ],
        },
        'test',
      ),
    ).toThrow(/Fournisseur de position invalide/);
  });

  it.each([null, [], {}, { version: 1, objects: [] }, { version: '1', objects: null }])(
    'rejette une racine de jeu invalide',
    (value) => {
      expect(() => parseUniverseDataset(value, 'invalid')).toThrow('Jeu de données invalide');
    },
  );

  it.each([
    null,
    [],
    {},
    { ...baseObject(), id: 42 },
    { ...baseObject(), name: 42 },
    { ...baseObject(), type: 'spaceship' },
    { ...baseObject(), referenceFrame: 'unknown' },
    { ...baseObject(), scientificConfidence: 'certain' },
    { ...baseObject(), visual: null },
  ])('rejette chaque défaut structurel d’un objet', (object) => {
    expect(() => datasetWith(object)).toThrow('Objet invalide');
  });

  it.each([
    { visualRadius: 'large', scaleMode: 'adaptive' },
    { visualRadius: 1, scaleMode: 'cinematic' },
  ])('rejette une définition visuelle élémentaire invalide', (visual) => {
    expect(() => datasetWith({ ...baseObject(), visual })).toThrow('Définition visuelle');
  });

  it.each([
    { galaxyShape: 'lenticular' },
    { galaxyAxisRatio: 'wide' },
    { galaxyAxisRatio: Number.NaN },
    { galaxyAxisRatio: 0 },
    { galaxyAxisRatio: 1.1 },
    { galaxyRotationDegrees: 'north' },
    { galaxyRotationDegrees: Number.POSITIVE_INFINITY },
  ])('rejette chaque propriété galactique invalide', (visualPart) => {
    expect(() =>
      datasetWith({
        ...baseObject(),
        visual: { ...baseObject().visual, ...visualPart },
      }),
    ).toThrow('Forme galactique invalide');
  });

  it('accepte les propriétés optionnelles cohérentes', () => {
    const parsed = datasetWith({
      ...baseObject(),
      aliases: ['Test', 'Alias'],
      parentId: 'sun',
      visual: {
        ...baseObject().visual,
        galaxyShape: 'irregular',
        galaxyAxisRatio: 0.5,
        galaxyRotationDegrees: -12,
      },
    });

    expect(parsed.objects[0]?.aliases).toEqual(['Test', 'Alias']);
  });

  it.each([{ aliases: 'Alias' }, { aliases: ['Alias', 42] }, { parentId: 42 }])(
    'rejette des alias ou un parent invalides',
    (part) => {
      expect(() => datasetWith({ ...baseObject(), ...part })).toThrow('Alias ou parent invalide');
    },
  );

  it.each([null, {}, { type: 42 }, { type: 'unknown' }])(
    'rejette un fournisseur absent ou inconnu',
    (positionProvider) => {
      expect(() => datasetWith({ ...baseObject(), positionProvider })).toThrow(
        /Fournisseur de position/,
      );
    },
  );

  it('accepte tous les fournisseurs de position valides', () => {
    const providers = [
      staticProvider(),
      keplerianProvider(),
      ephemerisProvider(),
      {
        type: 'linear-motion',
        positionAtEpoch: [1, 2, 3],
        velocityPerDay: [0.1, 0.2, 0.3],
        epochJulianDay: 2_451_545,
        unit: 'parsec',
      },
      { type: 'procedural', generatorId: 'galaxy', seed: 42 },
    ];

    for (const provider of providers) {
      expect(datasetWith({ ...baseObject(), positionProvider: provider }).objects).toHaveLength(1);
    }
  });

  it.each([
    { position: null },
    { position: [1, 2] },
    { position: [1, 2, 'x'] },
    { unit: 'furlong' },
  ])('rejette un fournisseur statique incomplet', (part) => {
    expectInvalidProvider({ ...staticProvider(), ...part });
  });

  it.each([
    'semiMajorAxis',
    'eccentricity',
    'inclination',
    'longitudeOfAscendingNode',
    'argumentOfPeriapsis',
    'meanAnomalyAtEpoch',
    'epochJulianDay',
    'orbitalPeriodDays',
    'unit',
  ])('rejette un champ képlérien invalide : %s', (field) => {
    expectInvalidProvider({
      ...keplerianProvider(),
      [field]: field === 'unit' ? 'furlong' : 'invalid',
    });
  });

  it.each([
    { body: 'pluto' },
    { origin: 'mars' },
    { body: 'moon', origin: 'sun' },
    { orbitalPeriodDays: 'year' },
    { orbitalPeriodDays: Number.POSITIVE_INFINITY },
    { orbitalPeriodDays: 0 },
    { orbitEpochJulianDay: 'J2000' },
    { orbitEpochJulianDay: Number.NaN },
    { distanceScale: 'large' },
    { distanceScale: Number.POSITIVE_INFINITY },
    { distanceScale: 0 },
  ])('rejette un champ d’éphéméride invalide', (part) => {
    expectInvalidProvider({ ...ephemerisProvider(), ...part });
  });

  it('accepte une distance d’éphéméride positive et l’origine terrestre de la Lune', () => {
    expect(
      datasetWith({
        ...baseObject(),
        positionProvider: { ...ephemerisProvider(), distanceScale: 2 },
      }).objects,
    ).toHaveLength(1);
    expect(
      datasetWith({
        ...baseObject(),
        positionProvider: {
          ...ephemerisProvider(),
          body: 'moon',
          origin: 'earth',
        },
      }).objects,
    ).toHaveLength(1);
  });

  it.each([
    { positionAtEpoch: [1, 2] },
    { velocityPerDay: [1, 2] },
    { epochJulianDay: 'J2000' },
    { unit: 'furlong' },
  ])('rejette un mouvement linéaire incomplet', (part) => {
    expectInvalidProvider({
      type: 'linear-motion',
      positionAtEpoch: [1, 2, 3],
      velocityPerDay: [0.1, 0.2, 0.3],
      epochJulianDay: 2_451_545,
      unit: 'parsec',
      ...part,
    });
  });

  it.each([
    { generatorId: 42, seed: 1 },
    { generatorId: 'galaxy', seed: 'random' },
  ])('rejette un fournisseur procédural incomplet', (positionProvider) => {
    expectInvalidProvider({ type: 'procedural', ...positionProvider });
  });
});

function datasetWith(object: unknown) {
  return parseUniverseDataset({ version: '1.0.0', objects: [object] }, 'test');
}

function expectInvalidProvider(positionProvider: unknown): void {
  expect(() => datasetWith({ ...baseObject(), positionProvider })).toThrow(
    'Fournisseur de position invalide',
  );
}

function baseObject() {
  return {
    id: 'test-object',
    name: 'Objet test',
    type: 'star',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: staticProvider(),
  };
}

function staticProvider() {
  return {
    type: 'static',
    position: [1, 2, 3],
    unit: 'parsec',
  };
}

function keplerianProvider() {
  return {
    type: 'keplerian',
    semiMajorAxis: 1,
    eccentricity: 0.1,
    inclination: 2,
    longitudeOfAscendingNode: 3,
    argumentOfPeriapsis: 4,
    meanAnomalyAtEpoch: 5,
    epochJulianDay: 2_451_545,
    orbitalPeriodDays: 365,
    unit: 'astronomical-unit',
  };
}

function ephemerisProvider() {
  return {
    type: 'ephemeris',
    body: 'earth',
    origin: 'sun',
    orbitalPeriodDays: 365.256,
    orbitEpochJulianDay: 2_451_545,
  };
}
