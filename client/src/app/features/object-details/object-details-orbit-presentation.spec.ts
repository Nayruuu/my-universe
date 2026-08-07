import type { PositionProviderDefinition, SpaceObject } from '../../../data/models/universe.models';
import frContent from '../../core/i18n/locales/content.fr.json';
import { createObjectDetailsOrbitPresentation } from './object-details-orbit-presentation';

describe('object details orbit presentation', () => {
  const presentation = createObjectDetailsOrbitPresentation({
    content: () => frContent,
    formatNumber: (value, maximumFractionDigits = 1) =>
      new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value),
    interpolate: (template, values) =>
      template.replace(/\{([a-zA-Z]+)\}/gu, (placeholder, key: string) =>
        values[key] === undefined ? placeholder : String(values[key]),
      ),
    parentName: (object) => (object.parentId === 'sun' ? 'Soleil' : null),
  });

  it('distingue les fournisseurs orbitaux et formate leur période', () => {
    const staticChild = object({ parentId: 'sun' });
    const keplerian = object({ parentId: 'sun', positionProvider: keplerianProvider(365.25) });
    const ephemeris = object({ parentId: 'sun', positionProvider: ephemerisProvider(730.5) });
    const illustrative = object({
      parentId: 'sun',
      positionProvider: illustrativeOrbitProvider(20),
    });

    expect(presentation.hasOrbit(object())).toBe(false);
    expect(presentation.hasOrbit(staticChild)).toBe(false);
    expect(presentation.hasOrbit(keplerian)).toBe(true);
    expect(presentation.hasOrbit(ephemeris)).toBe(true);
    expect(presentation.hasOrbit(illustrative)).toBe(true);
    expect(presentation.orbitPeriodLabel(staticChild)).toBeNull();
    expect(presentation.orbitPeriodLabel(keplerian)).toContain('365,25 jours');
    expect(presentation.orbitPeriodLabel(ephemeris)).toContain('2 ans');
    expect(presentation.orbitActionLabel(keplerian)).toBe('Orbite · Soleil');
    expect(presentation.orbitActionLabel(object({ parentId: 'missing' }))).toBe(
      'Orbite · corps parent',
    );
  });

  it('présente la rotation axiale sans perdre son sens', () => {
    expect(presentation.rotationPeriodLabel(object())).toBeNull();
    expect(presentation.rotationPeriodLabel(object({ rotation: rotation(23.5) }))).toBe(
      '23 h 30 min',
    );
    expect(presentation.rotationPeriodLabel(object({ rotation: rotation(-48) }))).toContain(
      '2 jours',
    );
    expect(presentation.rotationDirectionLabel(object({ rotation: rotation(-10) }))).toBe(
      'Rétrograde',
    );
    expect(presentation.rotationDirectionLabel(object({ rotation: rotation(10) }))).toBe(
      'Prograde',
    );
  });

  it('explique la provenance des orbites adaptées', () => {
    expect(presentation.hasIllustrativeOrbit(object())).toBe(false);
    expect(
      presentation.hasIllustrativeOrbit(
        object({ positionProvider: illustrativeOrbitProvider(20) }),
      ),
    ).toBe(true);
    expect(
      presentation.orbitApproximationNote(
        object({
          metadata: {
            semiMajorAxisSource: 'Illustrative map spacing',
            orbitalPeriodSource: 'Illustrative map timing',
          },
        }),
      ),
    ).toContain('espacement et la période sont illustratifs');
    expect(
      presentation.orbitApproximationNote(
        object({ metadata: { semiMajorAxisSource: 'Calculated from Kepler’s third law' } }),
      ),
    ).toContain('troisième loi de Kepler');
    expect(
      presentation.orbitApproximationNote(
        object({ metadata: { orbitalPeriodSource: 'Illustrative map timing' } }),
      ),
    ).toContain('Un paramètre orbital absent');
    expect(presentation.orbitApproximationNote(object())).toContain('proviennent du catalogue');
  });

  it('présente uniquement les valeurs documentées des exoplanètes', () => {
    const documented = object({
      metadata: {
        mapDistanceUnavailable: true,
        mapDistanceFallbackPc: 1_000,
        equilibriumTemperatureK: 265,
        discoveryYear: 2015,
        massProvenance: 'M-R relationship',
        semiMajorAxisAu: 1.046,
      },
    });

    expect(presentation.mapDistanceNotice(documented)).toContain('1 000 pc');
    expect(
      presentation.mapDistanceNotice(object({ metadata: { mapDistanceUnavailable: true } })),
    ).toContain('profondeur illustrative de inconnue pc');
    expect(presentation.mapDistanceNotice(object())).toBeNull();
    expect(presentation.equilibriumTemperatureLabel(documented)).toBe('265 K');
    expect(presentation.discoveryYearLabel(documented)).toBe('2 015');
    expect(presentation.massProvenanceLabel(documented)).toBe('Estimée par relation masse–rayon');
    expect(presentation.massProvenanceLabel(object({ metadata: { massProvenance: 'Mass' } }))).toBe(
      'Masse mesurée',
    );
    expect(presentation.semiMajorAxisLabel(documented)).toBe('1,046 UA');
    expect(presentation.equilibriumTemperatureLabel(object())).toBeNull();
    expect(presentation.discoveryYearLabel(object())).toBeNull();
    expect(presentation.massProvenanceLabel(object())).toBeNull();
    expect(presentation.semiMajorAxisLabel(object())).toBeNull();
  });
});

function object(overrides: Partial<SpaceObject> = {}): SpaceObject {
  return {
    id: 'earth',
    name: 'Terre',
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [0, 0, 0], unit: 'astronomical-unit' },
    ...overrides,
  };
}

function rotation(periodHours: number): NonNullable<SpaceObject['rotation']> {
  return {
    siderealPeriodHours: Math.abs(periodHours),
    direction: periodHours < 0 ? 'retrograde' : 'prograde',
    bodyFixedFrame: 'IAU_TEST',
    orientationModel: 'iau-wgccre-2015',
    scientificConfidence: 'calculated',
    source: 'NASA/JPL test fixture',
  };
}

function keplerianProvider(orbitalPeriodDays: number): PositionProviderDefinition {
  return {
    type: 'keplerian',
    semiMajorAxis: 1,
    eccentricity: 0,
    inclination: 0,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    epochJulianDay: 2_451_545,
    orbitalPeriodDays,
    unit: 'astronomical-unit',
  };
}

function ephemerisProvider(orbitalPeriodDays: number): PositionProviderDefinition {
  return {
    type: 'ephemeris',
    body: 'earth',
    origin: 'sun',
    orbitalPeriodDays,
    orbitEpochJulianDay: 2_451_545,
  };
}

function illustrativeOrbitProvider(orbitalPeriodDays: number): PositionProviderDefinition {
  return {
    type: 'illustrative-orbit',
    semiMajorAxis: 1,
    epochJulianDay: 2_451_545,
    visualPhaseAtEpochDegrees: 0,
    visualInclinationDegrees: 0,
    orbitalPeriodDays,
    unit: 'astronomical-unit',
  };
}
