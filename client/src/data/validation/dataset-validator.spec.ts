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

  it('valide tous les formats du manifest statique', () => {
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
          {
            id: 'nearby-universe',
            url: '/tiles/index.json',
            type: 'space-tile-index',
            format: 'space-tiles-v2',
          },
          {
            id: 'constellations',
            url: '/stars/constellations.json',
            type: 'constellation-lines',
            format: 'constellation-lines-v1',
          },
          {
            id: 'star-tiles',
            url: '/stars/tiles/index.json',
            type: 'star-tile-index',
            format: 'star-tiles-v2',
            starCatalogId: 'stars',
          },
          {
            id: 'cosmicflows4-groups',
            url: '/galaxies/cosmicflows4-groups.bin',
            type: 'cosmic-group-catalog',
            format: 'cosmicflows4-group-catalog-v2',
          },
          {
            id: 'documented-cosmic-structures',
            url: '/structures/cosmic-structures.bin',
            metadataUrl: '/structures/cosmic-structures.json',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v1',
          },
          {
            id: 'cosmic-web-density',
            url: '/structures/cosmic-web-density.bin',
            type: 'cosmic-web-volume',
            format: 'cosmic-web-volume-v1',
          },
          {
            id: 'tempel-filament-spines',
            url: '/structures/tempel-filament-spines.bin',
            type: 'tempel-filament-spine-catalog',
            format: 'tempel-filament-spines-v1',
          },
          {
            id: 'nasa-exoplanets',
            url: '/exoplanets/catalog.bin',
            metadataUrl: '/exoplanets/catalog.json',
            type: 'exoplanet-catalog',
            format: 'exoplanet-catalog-v1',
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
      {
        id: 'nearby-universe',
        url: '/tiles/index.json',
        type: 'space-tile-index',
        format: 'space-tiles-v2',
      },
      {
        id: 'constellations',
        url: '/stars/constellations.json',
        type: 'constellation-lines',
        format: 'constellation-lines-v1',
      },
      {
        id: 'star-tiles',
        url: '/stars/tiles/index.json',
        type: 'star-tile-index',
        format: 'star-tiles-v2',
        starCatalogId: 'stars',
      },
      {
        id: 'cosmicflows4-groups',
        url: '/galaxies/cosmicflows4-groups.bin',
        type: 'cosmic-group-catalog',
        format: 'cosmicflows4-group-catalog-v2',
      },
      {
        id: 'documented-cosmic-structures',
        url: '/structures/cosmic-structures.bin',
        metadataUrl: '/structures/cosmic-structures.json',
        type: 'cosmic-structure-catalog',
        format: 'cosmic-structure-catalog-v1',
      },
      {
        id: 'cosmic-web-density',
        url: '/structures/cosmic-web-density.bin',
        type: 'cosmic-web-volume',
        format: 'cosmic-web-volume-v1',
      },
      {
        id: 'tempel-filament-spines',
        url: '/structures/tempel-filament-spines.bin',
        type: 'tempel-filament-spine-catalog',
        format: 'tempel-filament-spines-v1',
      },
      {
        id: 'nasa-exoplanets',
        url: '/exoplanets/catalog.bin',
        metadataUrl: '/exoplanets/catalog.json',
        type: 'exoplanet-catalog',
        format: 'exoplanet-catalog-v1',
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

  it('rejette un catalogue d’exoplanètes sans format ou métadonnées valides', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'x',
            url: '/x',
            metadataUrl: '/x.json',
            type: 'exoplanet-catalog',
            format: 'exoplanet-catalog-v0',
          },
        ],
      }),
    ).toThrow('Format de catalogue d’exoplanètes invalide');
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'x',
            url: '/x',
            type: 'exoplanet-catalog',
            format: 'exoplanet-catalog-v1',
          },
        ],
      }),
    ).toThrow('Métadonnées d’exoplanètes manquantes');
  });

  it('rejette un format de tuiles inconnu', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [{ id: 'x', url: '/x', type: 'space-tile-index', format: 'space-tiles-v0' }],
      }),
    ).toThrow('Format de tuiles invalide');
  });

  it('rejette un format de constellations inconnu', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'x',
            url: '/x',
            type: 'constellation-lines',
            format: 'constellation-lines-v0',
          },
        ],
      }),
    ).toThrow('Format de constellations invalide');
  });

  it('rejette un index stellaire sans format ou catalogue associé valide', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'x',
            url: '/x',
            type: 'star-tile-index',
            format: 'star-tiles-v0',
            starCatalogId: 'stars',
          },
        ],
      }),
    ).toThrow('Format de tuiles stellaires invalide');
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'x',
            url: '/x',
            type: 'star-tile-index',
            format: 'star-tiles-v2',
          },
        ],
      }),
    ).toThrow('Catalogue stellaire manquant');
  });

  it('rejette le format de groupes cosmiques sans index de filaments pré-calculé', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'cosmic-groups',
            url: '/cosmic.bin',
            type: 'cosmic-group-catalog',
            format: 'cosmicflows4-group-catalog-v1',
          },
        ],
      }),
    ).toThrow('Format de groupes cosmiques invalide');
  });

  it('rejette une couche de structures cosmiques sans format ou métadonnées compatibles', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'cosmic-structures',
            url: '/structures.bin',
            metadataUrl: '/structures.json',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v2',
          },
        ],
      }),
    ).toThrow('Format de structures cosmiques invalide');
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'cosmic-structures',
            url: '/structures.bin',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v1',
          },
        ],
      }),
    ).toThrow('Métadonnées de structures cosmiques manquantes');
  });

  it('rejette un format volumique cosmique inconnu', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'cosmic-web-density',
            url: '/density.bin',
            type: 'cosmic-web-volume',
            format: 'cosmic-web-volume-v2',
          },
        ],
      }),
    ).toThrow('Format de volume cosmique invalide');
  });

  it('rejette un format d’épines Tempel inconnu', () => {
    expect(() =>
      parseManifest({
        version: '1',
        datasets: [
          {
            id: 'tempel-filament-spines',
            url: '/spines.bin',
            type: 'tempel-filament-spine-catalog',
            format: 'tempel-filament-spines-v2',
          },
        ],
      }),
    ).toThrow('Format d’épines Tempel invalide');
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

  it('valide une exoplanète confirmée avec une orbite visuelle explicitement illustrative', () => {
    const dataset = parseUniverseDataset(
      {
        version: '1.0.0',
        objects: [
          {
            id: 'kepler-452-b',
            name: 'Kepler-452 b',
            type: 'exoplanet',
            parentId: 'kepler-452',
            referenceFrame: 'stellar',
            scientificConfidence: 'observed',
            visual: {
              visualRadius: 0.55,
              scaleMode: 'adaptive',
            },
            positionProvider: {
              type: 'illustrative-orbit',
              semiMajorAxis: 1.046,
              orbitalPeriodDays: 384.843,
              epochJulianDay: 2_451_545,
              visualPhaseAtEpochDegrees: 42,
              visualInclinationDegrees: 4,
              unit: 'astronomical-unit',
              distanceScale: 3_800,
            },
          },
        ],
      },
      'test',
    );

    expect(dataset.objects[0]).toMatchObject({
      type: 'exoplanet',
      positionProvider: { type: 'illustrative-orbit', semiMajorAxis: 1.046 },
    });
  });

  it.each([
    { semiMajorAxis: 0 },
    { orbitalPeriodDays: 0 },
    { epochJulianDay: Number.NaN },
    { visualPhaseAtEpochDegrees: Number.NaN },
    { visualInclinationDegrees: Number.POSITIVE_INFINITY },
    { distanceScale: 0 },
  ])('rejette une orbite exoplanétaire illustrative invalide', (override) => {
    expect(() =>
      parseUniverseDataset(
        {
          version: '1.0.0',
          objects: [
            {
              ...baseObject(),
              id: 'invalid-exoplanet',
              type: 'exoplanet',
              positionProvider: {
                type: 'illustrative-orbit',
                semiMajorAxis: 1,
                orbitalPeriodDays: 365,
                epochJulianDay: 2_451_545,
                visualPhaseAtEpochDegrees: 0,
                visualInclinationDegrees: 0,
                unit: 'astronomical-unit',
                ...override,
              },
            },
          ],
        },
        'test',
      ),
    ).toThrow('Fournisseur de position invalide');
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

  it('valide un trou noir et son niveau d’activité visuelle', () => {
    const dataset = parseUniverseDataset(
      {
        version: '1.0.0',
        objects: [
          {
            id: 'sagittarius-a-star',
            name: 'Sagittarius A*',
            type: 'black-hole',
            referenceFrame: 'galactic',
            scientificConfidence: 'observed',
            visual: {
              visualRadius: 2,
              scaleMode: 'adaptive',
              blackHoleActivity: 'quiescent',
              accretionDiskInclinationDegrees: 50,
            },
            positionProvider: {
              type: 'static',
              position: [0, 0, 0],
              unit: 'kiloparsec',
            },
          },
        ],
      },
      'test',
    );

    expect(dataset.objects[0]?.type).toBe('black-hole');
    expect(dataset.objects[0]?.visual.blackHoleActivity).toBe('quiescent');
  });

  it.each([
    [{}, 'Activité de trou noir invalide'],
    [{ blackHoleActivity: 'unknown' }, 'Activité de trou noir invalide'],
    [{ blackHoleActivity: 'active', accretionDiskInclinationDegrees: 'edge-on' }, 'Inclinaison'],
    [{ blackHoleActivity: 'active', accretionDiskInclinationDegrees: -1 }, 'Inclinaison'],
    [{ blackHoleActivity: 'active', accretionDiskInclinationDegrees: 91 }, 'Inclinaison'],
  ])('rejette un profil visuel de trou noir incohérent', (visualOverrides, message) => {
    expect(() =>
      parseUniverseDataset(
        {
          version: '1.0.0',
          objects: [
            {
              id: 'invalid-black-hole',
              name: 'Invalide',
              type: 'black-hole',
              referenceFrame: 'galactic',
              scientificConfidence: 'calculated',
              visual: {
                visualRadius: 1,
                scaleMode: 'adaptive',
                ...visualOverrides,
              },
              positionProvider: {
                type: 'static',
                position: [0, 0, 0],
                unit: 'kiloparsec',
              },
            },
          ],
        },
        'test',
      ),
    ).toThrow(message);
  });

  it('valide une galaxie du référentiel de l’Univers proche', () => {
    const dataset = parseUniverseDataset(
      {
        version: '1.0.0',
        objects: [
          {
            id: 'm81',
            name: 'M81',
            type: 'galaxy',
            referenceFrame: 'nearby-universe',
            scientificConfidence: 'observed',
            visual: {
              visualRadius: 80,
              scaleMode: 'adaptive',
              galaxyShape: 'spiral',
            },
            positionProvider: {
              type: 'static',
              position: [-1.11, 3.39, 0.67],
              unit: 'megaparsec',
            },
          },
        ],
      },
      'test',
    );

    expect(dataset.objects[0]?.referenceFrame).toBe('nearby-universe');
  });

  it('valide un groupe de galaxies du référentiel cosmique', () => {
    const dataset = parseUniverseDataset(
      {
        version: '1.0.0',
        objects: [
          {
            id: 'cf4-pgc-42',
            name: 'Groupe PGC 42',
            type: 'galaxy-cluster',
            parentId: 'cosmic-web',
            referenceFrame: 'cosmic-web',
            scientificConfidence: 'calculated',
            visual: {
              visualRadius: 80,
              scaleMode: 'adaptive',
            },
            positionProvider: {
              type: 'static',
              position: [120, -40, 10],
              unit: 'megaparsec',
            },
          },
        ],
      },
      'test',
    );

    expect(dataset.objects[0]?.referenceFrame).toBe('cosmic-web');
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

  it('accepte une définition de rotation scientifique séparée du rendu', () => {
    const parsed = datasetWith({
      ...baseObject(),
      rotation: {
        siderealPeriodHours: 23.9344696,
        direction: 'prograde',
        bodyFixedFrame: 'EARTH_GEOGRAPHIC',
        orientationModel: 'earth-geographic',
        scientificConfidence: 'calculated',
        source: 'Astronomy Engine',
      },
    });

    expect(parsed.objects[0]?.rotation?.bodyFixedFrame).toBe('EARTH_GEOGRAPHIC');
  });

  it('accepte un modèle d’activité cométaire explicitement illustratif', () => {
    const parsed = datasetWith({
      ...baseObject(),
      type: 'comet',
      cometActivity: {
        activationDistanceAu: 5,
        saturatedDistanceAu: 0.575,
        scientificConfidence: 'illustrative',
        source: 'NASA comet activity overview',
      },
    });

    expect(parsed.objects[0]?.cometActivity).toMatchObject({
      activationDistanceAu: 5,
      saturatedDistanceAu: 0.575,
      scientificConfidence: 'illustrative',
    });
  });

  it.each([
    null,
    {},
    { activationDistanceAu: 0, saturatedDistanceAu: 0.5 },
    { activationDistanceAu: Number.POSITIVE_INFINITY, saturatedDistanceAu: 0.5 },
    { activationDistanceAu: 5, saturatedDistanceAu: -1 },
    { activationDistanceAu: 5, saturatedDistanceAu: Number.NaN },
    { activationDistanceAu: 1, saturatedDistanceAu: 1 },
    { activationDistanceAu: 1, saturatedDistanceAu: 2 },
    { activationDistanceAu: 5, saturatedDistanceAu: 1, scientificConfidence: 'certain' },
    { activationDistanceAu: 5, saturatedDistanceAu: 1, scientificConfidence: 'illustrative' },
    {
      activationDistanceAu: 5,
      saturatedDistanceAu: 1,
      scientificConfidence: 'illustrative',
      source: '',
    },
  ])('rejette un modèle d’activité cométaire invalide', (cometActivity) => {
    expect(() =>
      datasetWith({
        ...baseObject(),
        type: 'comet',
        cometActivity,
      }),
    ).toThrow('Activité cométaire invalide');
  });

  it('accepte une forme tri-axiale scientifique séparée de l’échelle visuelle', () => {
    const parsed = datasetWith({
      ...baseObject(),
      physical: {
        radiusKm: 11.08,
        shape: {
          type: 'triaxial-ellipsoid',
          dimensionsKm: [26.06, 22.8, 18.28],
          scientificConfidence: 'observed',
          source: 'NASA Planetary Data System',
        },
      },
    });

    expect(parsed.objects[0]?.physical?.shape?.dimensionsKm).toEqual([26.06, 22.8, 18.28]);
  });

  it.each([
    null,
    [],
    {},
    { type: 'mesh' },
    { type: 'triaxial-ellipsoid', dimensionsKm: [1, 2] },
    { type: 'triaxial-ellipsoid', dimensionsKm: [1, 2, 3, 4] },
    { type: 'triaxial-ellipsoid', dimensionsKm: [0, 2, 3] },
    { type: 'triaxial-ellipsoid', dimensionsKm: [1, Number.POSITIVE_INFINITY, 3] },
    { type: 'triaxial-ellipsoid', dimensionsKm: [1, '2', 3] },
    {
      type: 'triaxial-ellipsoid',
      dimensionsKm: [1, 2, 3],
      scientificConfidence: 'certain',
      source: 'NASA',
    },
    {
      type: 'triaxial-ellipsoid',
      dimensionsKm: [1, 2, 3],
      scientificConfidence: 'observed',
      source: '',
    },
  ])('rejette une forme physique invalide', (shape) => {
    expect(() =>
      datasetWith({
        ...baseObject(),
        physical: { radiusKm: 1, shape },
      }),
    ).toThrow('Forme physique invalide');
  });

  it.each([
    { siderealPeriodHours: 0 },
    { siderealPeriodHours: Number.NaN },
    { direction: 'clockwise' },
    { bodyFixedFrame: '' },
    { orientationModel: 'invented' },
    { scientificConfidence: 'certain' },
    { source: '' },
  ])('rejette une définition de rotation invalide', (invalidPart) => {
    expect(() =>
      datasetWith({
        ...baseObject(),
        rotation: {
          siderealPeriodHours: 24,
          direction: 'prograde',
          bodyFixedFrame: 'IAU_TEST',
          orientationModel: 'iau-wgccre-2015',
          scientificConfidence: 'calculated',
          source: 'NASA/JPL',
          ...invalidPart,
        },
      }),
    ).toThrow('Rotation invalide');
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
      {
        type: 'catalog',
        catalogId: 'hyg-v41-bright-stars',
        identifier: 'HIP 32349',
      },
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
    { catalogId: '', identifier: 'HIP 32349' },
    { catalogId: 'hyg-v41-bright-stars', identifier: '' },
    { catalogId: 42, identifier: 'HIP 32349' },
    { catalogId: 'hyg-v41-bright-stars', identifier: 32_349 },
  ])('rejette un lien de catalogue incomplet', (part) => {
    expectInvalidProvider({ type: 'catalog', ...part });
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
    { body: 'eris' },
    { origin: 'mars' },
    { body: 'moon', origin: 'sun' },
    { body: 'io', origin: 'sun' },
    { body: 'earth', origin: 'jupiter' },
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

  it('accepte les origines solaires, terrestre et jovienne cohérentes', () => {
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
    expect(
      datasetWith({
        ...baseObject(),
        positionProvider: {
          ...ephemerisProvider(),
          body: 'io',
          origin: 'jupiter',
        },
      }).objects,
    ).toHaveLength(1);
    expect(
      datasetWith({
        ...baseObject(),
        positionProvider: {
          ...ephemerisProvider(),
          body: 'pluto',
          origin: 'sun',
        },
      }).objects,
    ).toHaveLength(1);
  });

  it('accepte uniquement une exagération képlérienne positive et finie', () => {
    expect(
      datasetWith({
        ...baseObject(),
        positionProvider: { ...keplerianProvider(), distanceScale: 40 },
      }).objects,
    ).toHaveLength(1);

    for (const distanceScale of [0, Number.POSITIVE_INFINITY, 'large']) {
      expectInvalidProvider({ ...keplerianProvider(), distanceScale });
    }
  });

  it('accepte un plan orbital défini par son pôle équatorial J2000', () => {
    expect(
      datasetWith({
        ...baseObject(),
        positionProvider: {
          ...keplerianProvider(),
          referencePlanePole: {
            rightAscensionDegrees: 40.6,
            declinationDegrees: 83.5,
          },
        },
      }).objects[0]?.positionProvider,
    ).toMatchObject({
      type: 'keplerian',
      referencePlanePole: {
        rightAscensionDegrees: 40.6,
        declinationDegrees: 83.5,
      },
    });
  });

  it.each([
    null,
    {},
    { rightAscensionDegrees: -0.1, declinationDegrees: 0 },
    { rightAscensionDegrees: 360, declinationDegrees: 0 },
    { rightAscensionDegrees: 40.6, declinationDegrees: -90.1 },
    { rightAscensionDegrees: 40.6, declinationDegrees: 90.1 },
    { rightAscensionDegrees: Number.NaN, declinationDegrees: 0 },
    { rightAscensionDegrees: 40.6, declinationDegrees: Number.POSITIVE_INFINITY },
  ])('rejette un pôle de plan orbital invalide', (referencePlanePole) => {
    expectInvalidProvider({ ...keplerianProvider(), referencePlanePole });
  });

  it.each([
    { semiMajorAxis: 0 },
    { semiMajorAxis: Number.POSITIVE_INFINITY },
    { eccentricity: -0.01 },
    { eccentricity: 1 },
    { eccentricity: Number.NaN },
    { inclination: Number.POSITIVE_INFINITY },
    { longitudeOfAscendingNode: Number.NaN },
    { argumentOfPeriapsis: Number.NEGATIVE_INFINITY },
    { meanAnomalyAtEpoch: Number.NaN },
    { epochJulianDay: Number.POSITIVE_INFINITY },
    { orbitalPeriodDays: 0 },
    { orbitalPeriodDays: Number.POSITIVE_INFINITY },
  ])('rejette une valeur képlérienne physiquement impossible', (part) => {
    expectInvalidProvider({ ...keplerianProvider(), ...part });
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
