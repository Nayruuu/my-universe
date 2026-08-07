import solarSystemSource from '../../../public/data/solar-system/system.json';
import { SpaceObject } from '../models/universe.models';
import { parseUniverseDataset } from './dataset-validator';

describe('catalogue du Système solaire', () => {
  const dataset = parseUniverseDataset(solarSystemSource, 'solar-system');
  const byId = new Map(dataset.objects.map((object) => [object.id, object] as const));

  it('fournit les huit planètes et une première sélection de petits corps', () => {
    expect(objectsOfType('planet')).toHaveLength(8);
    expect(objectsOfType('moon').map(({ id }) => id)).toEqual(
      expect.arrayContaining(['moon', 'io', 'europa', 'ganymede', 'callisto', 'titan']),
    );
    expect(objectsOfType('dwarf-planet').map(({ id }) => id)).toEqual(['pluto', 'ceres']);
    expect(objectsOfType('asteroid').map(({ id }) => id)).toEqual(['vesta']);
    expect(objectsOfType('comet').map(({ id }) => id)).toEqual(['halley']);
  });

  it('conserve la hiérarchie physique des satellites majeurs', () => {
    expect(parentIds(['io', 'europa', 'ganymede', 'callisto'])).toEqual([
      'jupiter',
      'jupiter',
      'jupiter',
      'jupiter',
    ]);
    expect(byId.get('titan')?.parentId).toBe('saturn');
    expect(parentIds(['pluto', 'ceres', 'vesta', 'halley'])).toEqual(['sun', 'sun', 'sun', 'sun']);
  });

  it('décrit la rotation scientifique de chaque lune du catalogue principal', () => {
    const moonIds = objectsOfType('moon').map(({ id }) => id);

    expect(moonIds).toHaveLength(6);
    for (const id of moonIds) {
      const rotation = requiredObject(id).rotation;

      expect(rotation).toMatchObject({
        siderealPeriodHours: expect.any(Number),
        bodyFixedFrame: `IAU_${id.toUpperCase()}`,
        scientificConfidence: 'calculated',
        source: expect.stringMatching(/Astronomy Engine|pck00011\.tpc/u),
      });
      expect(rotation?.siderealPeriodHours).toBeGreaterThan(0);
    }
  });

  it('place le Soleil hors du centre galactique dans un référentiel documenté', () => {
    const sun = requiredObject('sun');

    expect(sun.referenceFrame).toBe('galactic');
    expect(sun.positionProvider).toEqual({
      type: 'static',
      position: [8.178, 0, 0],
      unit: 'kiloparsec',
    });
    expect(sun.metadata).toMatchObject({
      galactocentricDistanceKpc: 8.178,
      galactocentricPositionSource: expect.stringContaining('GRAVITY Collaboration 2019'),
      galactocentricReferenceFrame: expect.stringMatching(/centre galactique/iu),
    });
  });

  it('documente séparément la reconstruction spirale illustrative de la Voie lactée', () => {
    const milkyWay = requiredObject('milky-way');

    expect(milkyWay.scientificConfidence).toBe('illustrative');
    expect(milkyWay.metadata).toMatchObject({
      spiralStructureSource: expect.stringContaining('10.3847/1538-4357/ab4a11'),
      spiralArmCount: 4,
      spiralPitchDegrees: 13,
      visualAdaptation: expect.stringMatching(/galactocentrique/iu),
    });
  });

  it('documente les sources, l’époque et l’adaptation visuelle des nouvelles orbites', () => {
    const newObjects = [
      'io',
      'europa',
      'ganymede',
      'callisto',
      'titan',
      'pluto',
      'ceres',
      'vesta',
      'halley',
    ].map(requiredObject);

    expect(
      ['io', 'europa', 'ganymede', 'callisto', 'pluto'].every(
        (id) => requiredObject(id).scientificConfidence === 'calculated',
      ),
    ).toBe(true);
    expect(
      ['titan', 'ceres', 'vesta', 'halley'].every(
        (id) => requiredObject(id).scientificConfidence === 'extrapolated',
      ),
    ).toBe(true);
    expect(newObjects.every(({ metadata }) => String(metadata?.['source']).includes('JPL'))).toBe(
      true,
    );
    expect(
      newObjects.every(({ positionProvider }) => orbitEpoch(positionProvider) > 2_400_000),
    ).toBe(true);
    expect(
      ['io', 'europa', 'ganymede', 'callisto', 'titan'].every((id) => {
        const provider = requiredObject(id).positionProvider;

        return (
          provider.type === 'ephemeris' ||
          (provider.type === 'keplerian' && provider.distanceScale === 40)
        );
      }),
    ).toBe(true);
  });

  it('reprend les éléments J2000 publiés par JPL pour Titan', () => {
    const provider = requiredKeplerian('titan');

    expect(provider).toMatchObject({
      semiMajorAxis: 1_221_900,
      eccentricity: 0.029,
      inclination: 0.3,
      longitudeOfAscendingNode: 78.6,
      argumentOfPeriapsis: 78.3,
      meanAnomalyAtEpoch: 11.7,
      epochJulianDay: 2_451_545,
      orbitalPeriodDays: 15.945448,
      unit: 'kilometer',
      distanceScale: 40,
    });
  });

  it('reprend les solutions JPL SBDB de Cérès, Vesta et Halley', () => {
    expect(requiredKeplerian('ceres')).toMatchObject({
      semiMajorAxis: 2.77,
      eccentricity: 0.0797,
      inclination: 10.6,
      longitudeOfAscendingNode: 80.2,
      argumentOfPeriapsis: 73.3,
      meanAnomalyAtEpoch: 274,
      epochJulianDay: 2_461_200.5,
      orbitalPeriodDays: 1_680,
      unit: 'astronomical-unit',
    });
    expect(requiredKeplerian('vesta')).toMatchObject({
      semiMajorAxis: 2.36,
      eccentricity: 0.0902,
      inclination: 7.14,
      longitudeOfAscendingNode: 104,
      argumentOfPeriapsis: 151,
      meanAnomalyAtEpoch: 81.2,
      epochJulianDay: 2_461_200.5,
      orbitalPeriodDays: 1_330,
      unit: 'astronomical-unit',
    });
    expect(requiredKeplerian('halley')).toMatchObject({
      semiMajorAxis: 17.9,
      eccentricity: 0.968,
      inclination: 162,
      longitudeOfAscendingNode: 59.1,
      argumentOfPeriapsis: 112,
      meanAnomalyAtEpoch: 274,
      epochJulianDay: 2_439_875.5,
      orbitalPeriodDays: 27_700,
      unit: 'astronomical-unit',
    });
    expect(requiredObject('halley').cometActivity).toMatchObject({
      activationDistanceAu: 5,
      saturatedDistanceAu: 0.575,
      scientificConfidence: 'illustrative',
      source: expect.stringContaining('NASA'),
    });
  });

  it('documente les silhouettes mesurées de Cérès, Vesta et Halley', () => {
    expect(requiredObject('ceres').physical?.shape).toMatchObject({
      type: 'triaxial-ellipsoid',
      dimensionsKm: [965.6, 961.2, 890],
      scientificConfidence: 'calculated',
      source: expect.stringContaining('Dawn'),
    });
    expect(requiredObject('vesta').physical?.shape).toMatchObject({
      type: 'triaxial-ellipsoid',
      dimensionsKm: [570.4, 555.4, 447.6],
      scientificConfidence: 'calculated',
      source: expect.stringContaining('Dawn'),
    });
    expect(requiredObject('halley').physical?.shape).toMatchObject({
      type: 'triaxial-ellipsoid',
      dimensionsKm: [15, 8, 8],
      scientificConfidence: 'observed',
      source: expect.stringContaining('NASA'),
    });
    for (const id of ['ceres', 'vesta']) {
      expect(requiredObject(id).metadata).toMatchObject({
        shapeSource: 'NASA Visualization Technology Applications and Development',
        shapeReference: expect.stringContaining(`/${id}-3d-model/`),
        shapeConfidence: 'observed',
        surfaceConfidence: 'observed',
      });
    }
  });

  it('documente séparément les cartes observées et leurs traitements visuels', () => {
    expect(requiredObject('moon').metadata).toMatchObject({
      textureSource: expect.stringContaining('LRO'),
      reliefSource: expect.stringContaining('LOLA'),
      visualConfidence: 'observed-with-illustrative-relief-scale',
    });
    expect(requiredObject('mars').metadata).toMatchObject({
      textureSource: expect.stringContaining('Viking'),
      visualConfidence: 'observed-with-illustrative-colorization',
    });
    expect(requiredObject('venus').metadata).toMatchObject({
      textureSource: expect.stringContaining('Magellan'),
      visualConfidence: 'observed-radar-with-simulated-color',
    });
    expect(requiredObject('mercury').metadata).toMatchObject({
      textureSource: expect.stringContaining('MESSENGER MDIS'),
      textureReference: expect.stringContaining('astrogeology.usgs.gov'),
      appearanceConfidence: 'observed',
    });
    expect(requiredObject('titan').metadata).toMatchObject({
      visualSource: expect.stringContaining('Cassini'),
      appearanceConfidence: 'observed',
      textureReference: expect.stringContaining('astrogeology.usgs.gov'),
    });
    for (const id of ['saturn', 'uranus', 'neptune']) {
      expect(requiredObject(id).metadata).toMatchObject({
        visualSource: expect.stringContaining('NASA VTAD'),
        appearanceConfidence: 'illustrative',
        textureReference: expect.stringContaining('science.nasa.gov/resource'),
      });
    }
  });

  function objectsOfType(type: SpaceObject['type']): SpaceObject[] {
    return dataset.objects.filter((object) => object.type === type);
  }

  function parentIds(ids: readonly string[]): Array<string | undefined> {
    return ids.map((id) => requiredObject(id).parentId);
  }

  function requiredObject(id: string): SpaceObject {
    const object = byId.get(id);

    if (!object) {
      throw new Error(`Objet solaire manquant : ${id}.`);
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

function orbitEpoch(provider: SpaceObject['positionProvider']): number {
  if (provider.type === 'keplerian') {
    return provider.epochJulianDay;
  }
  if (provider.type === 'ephemeris') {
    return provider.orbitEpochJulianDay;
  }

  return Number.NEGATIVE_INFINITY;
}
