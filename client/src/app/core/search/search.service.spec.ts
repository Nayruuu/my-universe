import { TestBed } from '@angular/core/testing';
import { SpaceObject } from '../../../data/models/universe.models';
import { I18nService } from '../i18n/i18n.service';
import { SearchService } from './search.service';
import { DEFAULT_EXOPLANET_DISCOVERY_FILTERS } from './search.service';

describe('SearchService', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/fr/');
    TestBed.configureTestingModule({ providers: [SearchService] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('construit puis interroge l’index local avec les valeurs par défaut', () => {
    const service = TestBed.inject(SearchService);

    service.setData([object('earth', 'Terre')]);

    expect(service.search('terre')).toEqual([
      expect.objectContaining({ id: 'earth', name: 'Terre', type: 'planet' }),
    ]);
    expect(service.search('inconnu')).toEqual([]);
  });

  it('fusionne les entrées de catalogue et respecte la limite demandée', () => {
    const service = TestBed.inject(SearchService);

    service.setData(
      [object('sun', 'Soleil')],
      [
        {
          id: 'hyg-1',
          name: 'Sirius',
          aliases: ['Alpha Canis Majoris'],
          type: 'star',
        },
        {
          id: 'hyg-2',
          name: 'Sirius B',
          aliases: [],
          type: 'star',
        },
      ],
    );

    expect(service.search('sirius', 1)).toHaveLength(1);
    expect(service.search('alpha')).toEqual([
      expect.objectContaining({ id: 'hyg-1', name: 'Sirius' }),
    ]);
  });

  it('reconstruit l’index avec les noms du catalogue linguistique actif', async () => {
    const i18n = TestBed.inject(I18nService);
    const service = TestBed.inject(SearchService);

    service.setData([object('earth', 'Terre')]);
    TestBed.flushEffects();
    expect(service.revision()).toBe(1);

    await i18n.setLanguage('de');
    TestBed.flushEffects();

    expect(service.search('erde')).toEqual([expect.objectContaining({ id: 'earth' })]);
    expect(service.revision()).toBe(2);
  });

  it('expose toutes les exoplanètes et les classe par distance sans requête textuelle', () => {
    const service = TestBed.inject(SearchService);

    service.setData(
      [featuredExoplanet()],
      [
        exoplanetEntry('near', 4, 1.1, 'Transit', true),
        exoplanetEntry('far', 120, 8, 'Imaging', false),
        exoplanetEntry('unknown', undefined, 3.8, 'Radial Velocity', false),
      ],
    );

    expect(service.exoplanetCount()).toBe(4);
    expect(
      service.discoverExoplanets(DEFAULT_EXOPLANET_DISCOVERY_FILTERS).map(({ id }) => id),
    ).toEqual(['featured-b', 'near', 'far', 'unknown']);
    expect(service.revision()).toBe(1);
  });

  it('combine les filtres de distance, taille, méthode et température indicative', () => {
    const service = TestBed.inject(SearchService);

    service.setData(
      [],
      [
        exoplanetEntry('earth-transit', 20, 1.2, 'Transit', true),
        exoplanetEntry('super-rv', 80, 2.1, 'Radial Velocity', true),
        exoplanetEntry('neptune-transit', 300, 4, 'Transit', false),
        exoplanetEntry('giant-imaging', 50, 10, 'Imaging', false),
      ],
    );

    expect(
      service
        .discoverExoplanets({
          maxDistanceParsec: 100,
          size: 'super-earth',
          discoveryMethod: 'Radial Velocity',
          temperateOnly: true,
        })
        .map(({ id }) => id),
    ).toEqual(['super-rv']);
    expect(
      service
        .discoverExoplanets({
          maxDistanceParsec: null,
          size: 'giant',
          discoveryMethod: 'all',
          temperateOnly: false,
        })
        .map(({ id }) => id),
    ).toEqual(['giant-imaging']);
    expect(service.discoverExoplanets(DEFAULT_EXOPLANET_DISCOVERY_FILTERS, 2)).toHaveLength(2);
  });

  it('couvre les limites, toutes les classes de taille et les valeurs scientifiques absentes', () => {
    const service = TestBed.inject(SearchService);

    service.setData(
      [],
      [
        exoplanetEntry('earth', 10, 1.5, 'Transit', false),
        exoplanetEntry('super', 10, 2, 'Transit', false),
        exoplanetEntry('neptune', 10, 6, 'Transit', false),
        exoplanetEntry('giant', 10, 7, 'Transit', false),
        {
          id: 'unknown-radius',
          name: 'unknown-radius',
          aliases: [],
          type: 'exoplanet',
          metadata: { discoveryMethod: '', temperateCandidate: false },
        },
      ],
    );

    const discoverSize = (size: 'earth-sized' | 'super-earth' | 'neptune-sized' | 'giant') =>
      service
        .discoverExoplanets({
          maxDistanceParsec: null,
          size,
          discoveryMethod: 'all',
          temperateOnly: false,
        })
        .map(({ id }) => id);

    expect(discoverSize('earth-sized')).toEqual(['earth']);
    expect(discoverSize('super-earth')).toEqual(['super']);
    expect(discoverSize('neptune-sized')).toEqual(['neptune']);
    expect(discoverSize('giant')).toEqual(['giant']);
    expect(service.discoverExoplanets(DEFAULT_EXOPLANET_DISCOVERY_FILTERS, 0)).toEqual([]);
    expect(service.discoverExoplanets(DEFAULT_EXOPLANET_DISCOVERY_FILTERS, -1)).toEqual([]);
    expect(service.discoverExoplanets(DEFAULT_EXOPLANET_DISCOVERY_FILTERS, 1.9)).toHaveLength(1);
  });

  it('normalise les fiches éditoriales incomplètes sans inventer de données', () => {
    const service = TestBed.inject(SearchService);
    const withoutMetadata = {
      ...featuredExoplanet(),
      id: 'without-metadata',
      name: 'Without metadata',
      parentId: undefined,
      aliases: ['WM b'],
      metadata: undefined,
    } satisfies SpaceObject;
    const withParsecs = {
      ...featuredExoplanet(),
      id: 'with-parsecs',
      name: 'With parsecs',
      metadata: {
        distancePc: 2,
        radiusEarth: Number.POSITIVE_INFINITY,
        detectionMethod: '',
        controversial: false,
      },
    } satisfies SpaceObject;

    service.setData([withoutMetadata, withParsecs]);
    const discoveries = service.discoverExoplanets();

    expect(discoveries.map(({ id }) => id)).toEqual(['with-parsecs', 'without-metadata']);
    expect(discoveries[0]).toMatchObject({
      aliases: [],
      parentName: undefined,
      metadata: {
        distanceParsec: 2,
        discoveryMethod: 'Non précisée',
        controversial: false,
      },
    });
    expect(discoveries[1]).toMatchObject({
      aliases: ['WM b'],
      parentName: undefined,
      metadata: { discoveryMethod: 'Non précisée', temperateCandidate: false },
    });
  });

  it('classe les distances égales et inconnues par nom puis exclut les filtres incompatibles', () => {
    const service = TestBed.inject(SearchService);

    service.setData(
      [],
      [
        exoplanetEntry('zeta', 5, 2, 'Transit', false),
        exoplanetEntry('alpha', 5, 2, 'Transit', false),
        exoplanetEntry('unknown-zeta', undefined, 2, 'Transit', false),
        exoplanetEntry('unknown-alpha', undefined, 2, 'Transit', false),
      ],
    );

    expect(service.discoverExoplanets().map(({ id }) => id)).toEqual([
      'alpha',
      'zeta',
      'unknown-alpha',
      'unknown-zeta',
    ]);
    expect(
      service.discoverExoplanets({
        maxDistanceParsec: 4,
        size: 'neptune-sized',
        discoveryMethod: 'Imaging',
        temperateOnly: true,
      }),
    ).toEqual([]);
  });
});

function object(id: string, name: string): SpaceObject {
  return {
    id,
    name,
    type: id === 'sun' ? 'star' : 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function featuredExoplanet(): SpaceObject {
  return {
    id: 'featured-b',
    name: 'Featured b',
    type: 'exoplanet',
    parentId: 'featured',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 0.5, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'illustrative-orbit',
      semiMajorAxis: 1,
      orbitalPeriodDays: 365,
      epochJulianDay: 2_451_545,
      visualPhaseAtEpochDegrees: 0,
      visualInclinationDegrees: 0,
      unit: 'astronomical-unit',
    },
    metadata: {
      distanceLy: 3.261563777,
      radiusEarth: 1,
      detectionMethod: 'Transit',
      equilibriumTemperatureK: 288,
    },
  };
}

function exoplanetEntry(
  id: string,
  distanceParsec: number | undefined,
  radiusEarth: number,
  discoveryMethod: string,
  temperateCandidate: boolean,
) {
  return {
    id,
    name: id,
    aliases: [],
    type: 'exoplanet' as const,
    parentName: 'Host',
    metadata: {
      ...(distanceParsec === undefined ? {} : { distanceParsec }),
      radiusEarth,
      discoveryMethod,
      temperateCandidate,
    },
  };
}
