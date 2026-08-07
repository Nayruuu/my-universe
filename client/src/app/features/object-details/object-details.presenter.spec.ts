import type { SpaceObject } from '../../../data/models/universe.models';
import { HYG_REFERENCE_POSITION_METADATA_KEYS } from '../../../engine/simulation/received-light-time';
import frContent from '../../core/i18n/locales/content.fr.json';
import { createObjectDetailsPresenter } from './object-details.presenter';

describe('ObjectDetailsPresenter', () => {
  it('presents hierarchy, orbital data, and the best documented distance without Angular', () => {
    const sun = object({ id: 'sun', name: 'Soleil', type: 'star' });
    const earth = object({
      id: 'earth',
      name: 'Terre',
      parentId: 'sun',
      positionProvider: {
        type: 'keplerian',
        semiMajorAxis: 1,
        eccentricity: 0,
        inclination: 0,
        longitudeOfAscendingNode: 0,
        argumentOfPeriapsis: 0,
        meanAnomalyAtEpoch: 0,
        epochJulianDay: 2_451_545,
        orbitalPeriodDays: 365.25,
        unit: 'astronomical-unit',
      },
      metadata: { distanceLy: 0.000_015_812 },
    });
    const presenter = createObjectDetailsPresenter({
      content: () => frContent,
      language: () => 'fr',
      objects: () => [sun, earth],
      currentTime: () => ({ julianDay: 2_451_545 }),
      temporalMode: () => 'state',
      formatNumber: (value, maximumFractionDigits = 1) =>
        new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value),
      formatDate: (time) => `JD ${time.julianDay.toFixed(2)}`,
      objectName: (_objectId, fallback) => fallback,
      interpolate: (template, values) =>
        template.replace(/\{([a-zA-Z]+)\}/gu, (placeholder, key: string) =>
          values[key] === undefined ? placeholder : String(values[key]),
        ),
    });

    expect(presenter.hasOrbit(earth)).toBe(true);
    expect(presenter.parentName(earth)).toBe('Soleil');
    expect(presenter.orbitActionLabel(earth)).toBe('Orbite · Soleil');
    expect(presenter.orbitPeriodLabel(earth)).toContain('365,25 jours');
    expect(presenter.distanceLabel(earth)).toContain('a.l.');
    expect(presenter.typeLabel(earth.type)).toBe('Planète');
    expect(
      presenter.shapeDimensionsLabel(
        object({
          physical: {
            radiusKm: 11.08,
            shape: {
              type: 'triaxial-ellipsoid',
              dimensionsKm: [26.06, 22.8, 18.28],
              scientificConfidence: 'observed',
              source: 'NASA Planetary Data System',
            },
          },
        }),
      ),
    ).toBe('26,06 × 22,8 × 18,28 km');
    expect(presenter.shapeDimensionsLabel(earth)).toBeNull();
  });

  it('affiche le trajet lumineux par unité uniquement dans le mode observable', () => {
    let temporalMode: 'state' | 'observable' = 'state';
    const presenter = createObjectDetailsPresenter({
      content: () => frContent,
      language: () => 'fr',
      objects: () => [],
      currentTime: () => ({ julianDay: 2_461_056.25 }),
      temporalMode: () => temporalMode,
      formatNumber: (value, maximumFractionDigits = 1) =>
        new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value),
      formatDate: (time) => `JD ${time.julianDay.toFixed(2)}`,
      objectName: (_objectId, fallback) => fallback,
      interpolate: (template, values) =>
        template.replace(/\{([a-zA-Z]+)\}/gu, (placeholder, key: string) =>
          values[key] === undefined ? placeholder : String(values[key]),
        ),
    });
    const sun = object({ id: 'sun', type: 'star' });
    const moon = object({
      id: 'moon',
      type: 'moon',
      positionProvider: {
        type: 'ephemeris',
        body: 'moon',
        origin: 'earth',
        orbitalPeriodDays: 27.321_661,
        orbitEpochJulianDay: 2_451_545,
      },
    });
    const ceres = object({
      id: 'ceres',
      type: 'dwarf-planet',
      parentId: 'sun',
      scientificConfidence: 'extrapolated',
      positionProvider: {
        type: 'keplerian',
        semiMajorAxis: 2.77,
        eccentricity: 0.0797,
        inclination: 10.6,
        longitudeOfAscendingNode: 80.2,
        argumentOfPeriapsis: 73.3,
        meanAnomalyAtEpoch: 274,
        epochJulianDay: 2_461_200.5,
        orbitalPeriodDays: 1_680,
        unit: 'astronomical-unit',
      },
    });
    const exoplanet = object({
      id: 'test-host-b',
      type: 'exoplanet',
      referenceFrame: 'stellar',
      metadata: {
        sourceTable: 'PSCompPars',
        distancePc: 10,
        orbitRepresentationConfidence: 'illustrative',
      },
    });

    expect(presenter.receivedLight(sun)).toBeNull();
    temporalMode = 'observable';
    expect(presenter.receivedLight(moon)?.lightTravelLabel).toMatch(/ s$/u);
    expect(presenter.receivedLight(sun)?.lightTravelLabel).toMatch(/ min$/u);
    expect(presenter.receivedLight(ceres)?.lightTravelLabel).toMatch(/ min$/u);
    expect(presenter.receivedLight(hygStar(0.1))?.lightTravelLabel).toMatch(/ jours$/u);
    expect(presenter.receivedLight(hygStar(1))?.lightTravelLabel).toMatch(/ ans$/u);
    expect(presenter.receivedLight(exoplanet)?.lightTravelLabel).toMatch(/ ans$/u);
    expect(presenter.receivedLight(hygStar(4_000))?.modelLimited).toBe(true);
    expect(presenter.receivedLight(object())).toBeNull();
    expect(presenter.receivedLight(sun)?.emissionEpochLabel).toMatch(/^JD /u);
  });
});

function hygStar(distanceParsec: number): SpaceObject {
  return object({
    id: 'hyg-test',
    type: 'star',
    referenceFrame: 'stellar',
    referenceEpoch: 2_451_545,
    metadata: {
      properMotionModel: 'Uniform rectilinear motion relative to the solar-system barycenter',
      [HYG_REFERENCE_POSITION_METADATA_KEYS.x]: distanceParsec,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.y]: 0,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.z]: 0,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityX]: 0,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityY]: 0,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityZ]: 0,
    },
  });
}

function object(overrides: Partial<SpaceObject> = {}): SpaceObject {
  return {
    id: 'object',
    name: 'Objet',
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
    ...overrides,
  };
}
