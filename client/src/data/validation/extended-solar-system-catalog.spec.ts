import manifestSource from '../../../public/data/manifest.json';
import extendedSolarSystemSource from '../../../public/data/solar-system/extended.json';
import type { SpaceObject } from '../models/universe.models';
import { parseManifest, parseUniverseDataset } from './dataset-validator';

describe('catalogue solaire étendu', () => {
  const dataset = parseUniverseDataset(extendedSolarSystemSource, 'extended-solar-system');
  const byId = new Map(dataset.objects.map((object) => [object.id, object] as const));

  it('est chargé par le manifest statique', () => {
    const manifest = parseManifest(manifestSource);

    expect(manifest.datasets).toContainEqual({
      id: 'extended-solar-system',
      url: '/data/solar-system/extended.json',
      type: 'json',
    });
  });

  it('ajoute les satellites majeurs encore absents', () => {
    expect(idsOfType('moon')).toEqual(
      expect.arrayContaining([
        'phobos',
        'deimos',
        'mimas',
        'enceladus',
        'tethys',
        'dione',
        'rhea',
        'iapetus',
        'miranda',
        'ariel',
        'umbriel',
        'titania',
        'oberon',
        'triton',
        'charon',
      ]),
    );
    expect(idsOfType('moon')).toHaveLength(15);
    expect(parentIds(['phobos', 'deimos'])).toEqual(['mars', 'mars']);
    expect(parentIds(['mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'iapetus'])).toEqual(
      Array(6).fill('saturn'),
    );
    expect(parentIds(['miranda', 'ariel', 'umbriel', 'titania', 'oberon'])).toEqual(
      Array(5).fill('uranus'),
    );
    expect(parentIds(['triton', 'charon'])).toEqual(['neptune', 'pluto']);
  });

  it('complète les planètes naines, astéroïdes et comètes emblématiques', () => {
    expect(idsOfType('dwarf-planet')).toEqual(['eris', 'haumea', 'makemake']);
    expect(idsOfType('asteroid')).toEqual(['pallas', 'hygiea', 'bennu']);
    expect(idsOfType('comet')).toEqual(['67p-churyumov-gerasimenko']);
    expect(parentIds(['eris', 'haumea', 'makemake', 'pallas', 'hygiea', 'bennu'])).toEqual(
      Array(6).fill('sun'),
    );
  });

  it('reprend les éléments moyens JPL J2000 des systèmes de satellites', () => {
    expect(requiredKeplerian('phobos')).toMatchObject({
      semiMajorAxis: 9_375,
      eccentricity: 0.015,
      inclination: 1.1,
      orbitalPeriodDays: 0.3187,
      epochJulianDay: 2_451_545,
      referencePlanePole: { rightAscensionDegrees: 317.7, declinationDegrees: 52.9 },
    });
    expect(requiredKeplerian('iapetus')).toMatchObject({
      semiMajorAxis: 3_561_700,
      eccentricity: 0.028,
      inclination: 7.6,
      orbitalPeriodDays: 79.331002,
      referencePlanePole: { rightAscensionDegrees: 288.7, declinationDegrees: 78.9 },
    });
    expect(requiredKeplerian('ariel')).toMatchObject({
      semiMajorAxis: 190_929,
      eccentricity: 0.001,
      inclination: 0,
      orbitalPeriodDays: 2.520379,
      referencePlanePole: { rightAscensionDegrees: 257.311, declinationDegrees: -15.175 },
    });
    expect(requiredKeplerian('triton')).toMatchObject({
      semiMajorAxis: 354_800,
      inclination: 157.3,
      orbitalPeriodDays: 5.876994,
      referencePlanePole: { rightAscensionDegrees: 299.8, declinationDegrees: 43.1 },
    });
  });

  it('décrit la rotation IAU de chaque lune du catalogue étendu', () => {
    const moonIds = idsOfType('moon');

    expect(moonIds).toHaveLength(15);
    for (const id of moonIds) {
      expect(requiredObject(id).rotation).toMatchObject({
        siderealPeriodHours: expect.any(Number),
        bodyFixedFrame: `IAU_${id.toUpperCase()}`,
        orientationModel: 'iau-wgccre-2015',
        scientificConfidence: 'calculated',
        source: expect.stringContaining('pck00011.tpc'),
      });
    }
    expect(requiredObject('mimas').rotation?.siderealPeriodHours).toBeCloseTo(22.618123444, 8);
    expect(requiredObject('miranda').rotation?.direction).toBe('retrograde');
    expect(requiredObject('triton').rotation?.direction).toBe('retrograde');
    expect(requiredObject('charon').rotation?.direction).toBe('prograde');
  });

  it('reprend les solutions JPL SBDB des petits corps héliocentriques', () => {
    expect(requiredKeplerian('eris')).toMatchObject({
      semiMajorAxis: 67.9,
      eccentricity: 0.438,
      inclination: 43.9,
      orbitalPeriodDays: 205_000,
      epochJulianDay: 2_461_200.5,
    });
    expect(requiredKeplerian('bennu')).toMatchObject({
      semiMajorAxis: 1.13,
      eccentricity: 0.204,
      inclination: 6.03,
      orbitalPeriodDays: 437,
      epochJulianDay: 2_455_562.5,
    });
    expect(requiredKeplerian('67p-churyumov-gerasimenko')).toMatchObject({
      semiMajorAxis: 3.46,
      eccentricity: 0.641,
      inclination: 7.04,
      orbitalPeriodDays: 2_350,
      epochJulianDay: 2_457_305.5,
    });
  });

  it('documente les silhouettes mesurées de Phobos, Déimos et Hauméa', () => {
    expect(requiredObject('phobos').physical?.shape).toMatchObject({
      type: 'triaxial-ellipsoid',
      dimensionsKm: [26.06, 22.8, 18.28],
      scientificConfidence: 'observed',
      source: expect.stringContaining('NASA'),
    });
    expect(requiredObject('phobos').metadata).toMatchObject({
      shapeSource: 'NASA/JPL-Caltech',
      shapeConfidence: 'observed',
      surfaceConfidence: 'observed',
    });
    expect(requiredObject('phobos').rotation).toMatchObject({
      siderealPeriodHours: expect.closeTo(7.653842505, 8),
      bodyFixedFrame: 'IAU_PHOBOS',
      orientationModel: 'iau-wgccre-2015',
      scientificConfidence: 'calculated',
    });
    expect(requiredObject('deimos').physical?.shape).toMatchObject({
      type: 'triaxial-ellipsoid',
      dimensionsKm: [15, 12.1, 10.4],
      scientificConfidence: 'observed',
      source: expect.stringContaining('NASA'),
    });
    expect(requiredObject('deimos').metadata).toMatchObject({
      shapeSource: 'NASA/JPL-Caltech',
      shapeConfidence: 'observed',
      surfaceConfidence: 'observed',
    });
    expect(requiredObject('deimos').rotation).toMatchObject({
      siderealPeriodHours: expect.closeTo(30.298578925, 8),
      bodyFixedFrame: 'IAU_DEIMOS',
      orientationModel: 'iau-wgccre-2015',
      scientificConfidence: 'calculated',
    });
    expect(requiredObject('haumea').physical?.shape).toMatchObject({
      type: 'triaxial-ellipsoid',
      dimensionsKm: [2322, 1704, 1026],
      scientificConfidence: 'calculated',
      source: expect.stringContaining('Ortiz'),
    });
    expect(requiredObject('haumea').visual.hasRings).toBe(true);
  });

  it('documente les formes et rotations reconstruites de Pallas et Hygie', () => {
    expect(requiredObject('pallas').physical?.shape).toMatchObject({
      type: 'triaxial-ellipsoid',
      dimensionsKm: [559.6, 523.5, 432.8],
      scientificConfidence: 'calculated',
      source: expect.stringContaining('DAMIT 4395'),
    });
    expect(requiredObject('pallas').rotation).toMatchObject({
      siderealPeriodHours: expect.closeTo(7.81322, 5),
      direction: 'prograde',
      bodyFixedFrame: 'DAMIT_PALLAS_4395',
      orientationModel: 'damit-iau-2020',
      scientificConfidence: 'calculated',
    });
    expect(requiredObject('pallas').metadata).toMatchObject({
      shapeConfidence: 'calculated',
      surfaceConfidence: 'illustrative',
      shapeQuality: 4,
    });
    expect(requiredObject('hygiea').physical).toMatchObject({
      radiusKm: 217,
      shape: {
        type: 'triaxial-ellipsoid',
        dimensionsKm: [427.4, 452.9, 425.9],
        scientificConfidence: 'calculated',
        source: expect.stringContaining('DAMIT 4392'),
      },
    });
    expect(requiredObject('hygiea').rotation).toMatchObject({
      siderealPeriodHours: expect.closeTo(13.82559, 5),
      direction: 'prograde',
      bodyFixedFrame: 'DAMIT_HYGIEA_4392',
      orientationModel: 'damit-iau-2020',
      scientificConfidence: 'calculated',
    });
    expect(requiredObject('hygiea').metadata).toMatchObject({
      shapeConfidence: 'calculated',
      surfaceConfidence: 'illustrative',
      shapeQuality: 4,
    });
  });

  it('déclare une activité cométaire qualitative et sourcée', () => {
    expect(requiredObject('67p-churyumov-gerasimenko').cometActivity).toMatchObject({
      activationDistanceAu: 4,
      saturatedDistanceAu: 1.3,
      scientificConfidence: 'illustrative',
      source: expect.stringContaining('NASA'),
    });
  });

  it('rend explicites la provenance, l’extrapolation et l’adaptation des distances', () => {
    expect(dataset.objects).toHaveLength(22);
    expect(
      dataset.objects.every(({ scientificConfidence }) => scientificConfidence === 'extrapolated'),
    ).toBe(true);
    expect(
      dataset.objects.every(({ metadata }) => String(metadata?.['source']).includes('NASA/JPL')),
    ).toBe(true);
    expect(
      idsOfType('moon').every(
        (id) => requiredObject(id).metadata?.['visualDistanceExaggerated'] === true,
      ),
    ).toBe(true);
  });

  function idsOfType(type: SpaceObject['type']): string[] {
    return dataset.objects.filter((object) => object.type === type).map(({ id }) => id);
  }

  function parentIds(ids: readonly string[]): Array<string | undefined> {
    return ids.map((id) => requiredObject(id).parentId);
  }

  function requiredObject(id: string): SpaceObject {
    const object = byId.get(id);

    if (!object) {
      throw new Error(`Objet solaire étendu manquant : ${id}.`);
    }

    return object;
  }

  function requiredKeplerian(
    id: string,
  ): Extract<SpaceObject['positionProvider'], { type: 'keplerian' }> {
    const provider = requiredObject(id).positionProvider;

    if (provider.type !== 'keplerian') {
      throw new Error(`Orbite képlérienne manquante pour ${id}.`);
    }

    return provider;
  }
});
