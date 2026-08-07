import type { SpaceObject } from '../../data/models/universe.models';
import {
  ASTRONOMY_ENGINE_LIGHT_TIME_SOURCE_URL,
  HYG_REFERENCE_POSITION_METADATA_KEYS,
  JPL_SATELLITE_LIGHT_TIME_SOURCE_URL,
  JPL_SMALL_BODY_LIGHT_TIME_SOURCE_URL,
  NASA_EXOPLANET_DISTANCE_SOURCE_URL,
  calculateExoplanetSystemLightDeparture,
  calculateJovianMoonLightDeparture,
  calculateKeplerianLightDeparture,
  calculateSolarSystemLightDeparture,
  resolveObjectReceivedLight,
} from './received-light-time';
import { dateToJulianDay } from './time-utils';

describe('temps de trajet de la lumière reçue', () => {
  it('reproduit le temps de descente Terre–Mars publié par JPL Horizons', () => {
    const time = { julianDay: dateToJulianDay(new Date('2026-01-15T18:00:00.000Z')) };
    const departure = calculateSolarSystemLightDeparture('mars', time);

    // Independent NASA/JPL Horizons query (DE441, target 499, center 500@399,
    // VECTORS table 6, VEC_CORR=LT, AU-D, 2026-01-15 18:00 UTC):
    // one-way Newtonian down-leg LT = 1.384557487047954E-02 day.
    // https://ssd.jpl.nasa.gov/horizons/manual.html
    expect(departure.lightTravelDays).toBeCloseTo(0.013_845_574_870_479_54, 7);
    expect(departure.emissionTime.julianDay).toBeCloseTo(
      departure.receptionTime.julianDay - departure.lightTravelDays,
      10,
    );
    expect(Math.hypot(...Object.values(departure.relativePositionEquatorialAu))).toBeCloseTo(
      2.397_286_975,
      5,
    );
    expect(departure.sourceUrl).toBe(ASTRONOMY_ENGINE_LIGHT_TIME_SOURCE_URL);
  });

  it('conserve la Terre à la date de réception et refuse une date non finie', () => {
    const earth = calculateSolarSystemLightDeparture('earth', { julianDay: 2_451_545 });

    expect(earth).toMatchObject({
      lightTravelDays: 0,
      relativePositionEquatorialAu: { x: 0, y: 0, z: 0 },
      status: 'within-model-domain',
    });
    expect(earth.emissionTime).toBe(earth.receptionTime);
    expect(() => calculateSolarSystemLightDeparture('sun', { julianDay: Number.NaN })).toThrow(
      'non finie',
    );
    expect(() => calculateJovianMoonLightDeparture('io', { julianDay: Number.NaN })).toThrow(
      'non finie',
    );
  });

  it('reproduit les temps de trajet Horizons de Io et Phobos depuis la Terre', () => {
    const time = { julianDay: dateToJulianDay(new Date('2026-01-15T18:00:00.000Z')) };
    const io = calculateJovianMoonLightDeparture('io', time);
    const phobos = calculateKeplerianLightDeparture(
      keplerianObject({
        id: 'phobos',
        objectType: 'moon',
        parentId: 'mars',
        semiMajorAxis: 9_375,
        eccentricity: 0.015,
        inclination: 1.1,
        longitudeOfAscendingNode: 169.2,
        argumentOfPeriapsis: 216.3,
        meanAnomalyAtEpoch: 189.7,
        epochJulianDay: 2_451_545,
        orbitalPeriodDays: 0.3187,
        unit: 'kilometer',
        distanceScale: 1_200,
        referencePlanePole: {
          rightAscensionDegrees: 317.7,
          declinationDegrees: 52.9,
        },
      }),
      time,
    )!;

    // Independent NASA/JPL Horizons queries (DE441, centers 500@399, VEC_CORR=LT,
    // 2026-01-15 18:00 TDB): Io 2116.206545159341 s; Phobos 1196.282128873600 s.
    // https://ssd.jpl.nasa.gov/horizons/manual.html
    expect(Math.abs(io.lightTravelDays * 86_400 - 2_116.206_545_159_341)).toBeLessThan(0.1);
    expect(Math.abs(phobos.lightTravelDays * 86_400 - 1_196.282_128_873_6)).toBeLessThan(0.1);
    expect(io).toMatchObject({
      confidence: 'calculated',
      model: 'astronomy-engine-jovian-light-time',
      sourceUrl: ASTRONOMY_ENGINE_LIGHT_TIME_SOURCE_URL,
    });
    expect(phobos).toMatchObject({
      confidence: 'extrapolated',
      model: 'keplerian-earth-light-time',
      sourceUrl: JPL_SATELLITE_LIGHT_TIME_SOURCE_URL,
    });
  });

  it('borne l’approximation de Cérès par rapport au temps de trajet Horizons', () => {
    const time = { julianDay: dateToJulianDay(new Date('2026-01-15T18:00:00.000Z')) };
    const ceres = calculateKeplerianLightDeparture(
      keplerianObject({
        id: 'ceres',
        objectType: 'dwarf-planet',
        parentId: 'sun',
        semiMajorAxis: 2.77,
        eccentricity: 0.0797,
        inclination: 10.6,
        longitudeOfAscendingNode: 80.2,
        argumentOfPeriapsis: 73.3,
        meanAnomalyAtEpoch: 274,
        epochJulianDay: 2_461_200.5,
        orbitalPeriodDays: 1_680,
        unit: 'astronomical-unit',
      }),
      time,
    )!;
    const horizonsLightSeconds = 1_480.874_302_536_533;
    const relativeError =
      Math.abs(ceres.lightTravelDays * 86_400 - horizonsLightSeconds) / horizonsLightSeconds;

    // Independent NASA/JPL Horizons query (Ceres JPL#48, DE441, center 500@399,
    // VEC_CORR=LT, 2026-01-15 18:00 TDB). Rounded two-body catalogue elements stay within 1%.
    // https://ssd.jpl.nasa.gov/horizons/manual.html
    expect(relativeError).toBeLessThan(0.01);
    expect(ceres).toMatchObject({
      confidence: 'extrapolated',
      model: 'keplerian-earth-light-time',
      sourceUrl: JPL_SMALL_BODY_LIGHT_TIME_SOURCE_URL,
    });
  });

  it('résout le Soleil et les éphémérides prises en charge depuis une fiche objet', () => {
    const time = { julianDay: 2_461_056.25 };
    const sun = resolveObjectReceivedLight(object({ id: 'sun', type: 'star' }), time);
    const mars = resolveObjectReceivedLight(
      object({
        id: 'mars',
        positionProvider: {
          type: 'ephemeris',
          body: 'mars',
          origin: 'sun',
          orbitalPeriodDays: 686.98,
          orbitEpochJulianDay: 2_451_545,
        },
      }),
      time,
    );

    expect(sun?.lightTravelDays).toBeGreaterThan(0.005);
    expect(mars?.model).toBe('astronomy-engine-light-time');
    expect(mars?.confidence).toBe('calculated');
  });

  it('résout une étoile HYG au temps retardé et expose une limite dépassée', () => {
    const time = { julianDay: 2_451_545 };
    const nearby = resolveObjectReceivedLight(hygStar(1, 0.001), time);
    const remote = resolveObjectReceivedLight(hygStar(4_000, 0.001), time);

    expect(nearby).toMatchObject({
      confidence: 'extrapolated',
      model: 'hyg-uniform-rectilinear-light-time',
      status: 'within-model-domain',
    });
    expect(nearby?.lightTravelDays).toBeGreaterThan(3 * 365.25);
    expect(nearby?.emissionTime.julianDay).toBe(nearby?.requestedEmissionTime.julianDay);
    expect(remote?.status).toBe('clamped-to-past-boundary');
    expect(remote?.emissionTime.julianDay).toBe(2_451_545 - 10_000 * 365.25);
    expect(remote?.requestedEmissionTime.julianDay).toBeLessThan(
      remote?.emissionTime.julianDay ?? Number.NEGATIVE_INFINITY,
    );
  });

  it('applique une époque d’émission commune à un système exoplanétaire documenté', () => {
    const time = { julianDay: 2_451_545 };
    const host = object({
      id: 'test-host',
      type: 'star',
      referenceFrame: 'stellar',
      metadata: {
        sourceTable: 'PSCompPars',
        exoplanetHost: true,
        distancePc: 1,
      },
    });
    const planet = object({
      id: 'test-host-b',
      type: 'exoplanet',
      parentId: 'test-host',
      referenceFrame: 'stellar',
      metadata: {
        sourceTable: 'PSCompPars',
        distanceLy: 3.261_563_777_167_433_3,
        orbitRepresentationConfidence: 'illustrative',
      },
    });
    const hostLight = calculateExoplanetSystemLightDeparture(host, time)!;
    const planetLight = resolveObjectReceivedLight(planet, time)!;

    // Independent definitions: IAU 2015 Resolution B2 defines 1 pc as exactly 648000/pi au;
    // the IAU 2012 au and the SI speed of light give 1191.286169610405 Julian days.
    // https://www.iau.org/static/resolutions/IAU2015_English.pdf
    expect(hostLight.lightTravelDays).toBeCloseTo(1_191.286_169_610_405, 9);
    expect(planetLight.lightTravelDays).toBeCloseTo(hostLight.lightTravelDays, 9);
    expect(hostLight).toMatchObject({
      confidence: 'calculated',
      model: 'exoplanet-system-distance-light-time',
      sourceUrl: NASA_EXOPLANET_DISTANCE_SOURCE_URL,
      status: 'within-model-domain',
    });
    expect(hostLight.emissionTime.julianDay).toBeCloseTo(
      time.julianDay - hostLight.lightTravelDays,
      9,
    );
    expect(hostLight.requestedEmissionTime).toEqual(hostLight.emissionTime);
    expect(() => calculateExoplanetSystemLightDeparture(host, { julianDay: Number.NaN })).toThrow(
      'non finie',
    );
  });

  it('n’invente aucun retard exoplanétaire sans distance hôte publiée', () => {
    const time = { julianDay: 2_451_545 };
    const metadata = {
      sourceTable: 'PSCompPars',
      exoplanetHost: true,
    };

    expect(
      calculateExoplanetSystemLightDeparture(
        object({ type: 'star', metadata: { ...metadata, mapDistanceUnavailable: true } }),
        time,
      ),
    ).toBeNull();
    expect(
      calculateExoplanetSystemLightDeparture(
        object({ type: 'star', metadata: { ...metadata, distancePc: Number.NaN } }),
        time,
      ),
    ).toBeNull();
    expect(
      calculateExoplanetSystemLightDeparture(
        object({ type: 'star', metadata: { ...metadata, distancePc: 0, distanceLy: 0 } }),
        time,
      ),
    ).toBeNull();
    expect(
      calculateExoplanetSystemLightDeparture(
        object({ type: 'star', metadata: { ...metadata, distanceLy: Number.NaN } }),
        time,
      ),
    ).toBeNull();
    expect(
      calculateExoplanetSystemLightDeparture(
        object({ type: 'star', metadata: { sourceTable: 'PSCompPars', distancePc: 1 } }),
        time,
      ),
    ).toBeNull();
    expect(
      calculateExoplanetSystemLightDeparture(
        object({ type: 'star', metadata: { ...metadata, distancePc: 'unknown' } }),
        time,
      ),
    ).toBeNull();
  });

  it('corrige les lunes galiléennes et laisse simultanés les modèles hors périmètre', () => {
    const time = { julianDay: 2_451_545 };
    const jovianMoon = object({
      positionProvider: {
        type: 'ephemeris',
        body: 'io',
        origin: 'jupiter',
        orbitalPeriodDays: 1.769,
        orbitEpochJulianDay: 2_451_545,
      },
    });
    const wrongModel = object({ metadata: { properMotionModel: 'Illustrative' } });
    const incompleteHyg = object({
      referenceEpoch: 2_451_545,
      metadata: {
        properMotionModel: 'Uniform rectilinear motion relative to the solar-system barycenter',
        [HYG_REFERENCE_POSITION_METADATA_KEYS.x]: 1,
      },
    });
    const missingEpoch = hygStar(1, 0);
    const wrongReferenceFrame = keplerianObject({ referenceFrame: 'stellar' });
    const wrongKeplerianType = keplerianObject({ objectType: 'planet' });
    const missingParent = keplerianObject({ parentId: null });

    delete missingEpoch.referenceEpoch;
    expect(resolveObjectReceivedLight(jovianMoon, time)?.model).toBe(
      'astronomy-engine-jovian-light-time',
    );
    expect(resolveObjectReceivedLight(object(), time)).toBeNull();
    expect(calculateKeplerianLightDeparture(wrongReferenceFrame, time)).toBeNull();
    expect(calculateKeplerianLightDeparture(wrongKeplerianType, time)).toBeNull();
    expect(calculateKeplerianLightDeparture(missingParent, time)).toBeNull();
    expect(resolveObjectReceivedLight(wrongModel, time)).toBeNull();
    expect(resolveObjectReceivedLight(incompleteHyg, time)).toBeNull();
    expect(resolveObjectReceivedLight(missingEpoch, time)).toBeNull();
  });
});

function hygStar(distanceParsec: number, velocityParsecPerYear: number): SpaceObject {
  return object({
    id: 'hyg-test',
    type: 'star',
    referenceEpoch: 2_451_545,
    referenceFrame: 'stellar',
    metadata: {
      properMotionModel: 'Uniform rectilinear motion relative to the solar-system barycenter',
      [HYG_REFERENCE_POSITION_METADATA_KEYS.x]: distanceParsec,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.y]: 0,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.z]: 0,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityX]: velocityParsecPerYear,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityY]: 0,
      [HYG_REFERENCE_POSITION_METADATA_KEYS.velocityZ]: 0,
    },
  });
}

type KeplerianDefinition = Extract<SpaceObject['positionProvider'], { type: 'keplerian' }>;

interface KeplerianObjectFixture extends Partial<Omit<KeplerianDefinition, 'type'>> {
  readonly id?: string;
  readonly objectType?: SpaceObject['type'];
  readonly parentId?: string | null;
  readonly referenceFrame?: SpaceObject['referenceFrame'];
}

function keplerianObject(overrides: KeplerianObjectFixture = {}): SpaceObject {
  const {
    id = 'keplerian-test',
    objectType = 'asteroid',
    parentId = 'sun',
    referenceFrame = 'solar-system',
    ...providerOverrides
  } = overrides;
  const positionProvider = {
    type: 'keplerian' as const,
    semiMajorAxis: 1,
    eccentricity: 0,
    inclination: 0,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    epochJulianDay: 2_451_545,
    orbitalPeriodDays: 365.25,
    unit: 'astronomical-unit' as const,
    ...providerOverrides,
  };

  return object({
    id,
    type: objectType,
    ...(parentId ? { parentId } : {}),
    referenceFrame,
    scientificConfidence: 'extrapolated',
    positionProvider,
  });
}

function object(overrides: Partial<SpaceObject> = {}): SpaceObject {
  return {
    id: 'object',
    name: 'Object',
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
