import type { SpaceObject } from '../../../data/models/universe.models';
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
      formatNumber: (value, maximumFractionDigits = 1) =>
        new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value),
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
});

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
