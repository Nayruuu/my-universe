import {
  BackdatePosition,
  Body,
  C_AUDAY,
  HelioVector,
  JupiterMoons,
  RotateVector,
  Rotation_EQJ_ECL,
} from 'astronomy-engine';
import type {
  EphemerisBody,
  JovianMoon,
  SpaceObject,
  UniverseTime,
  Vector3Like,
} from '../../data/models/universe.models';
import { astronomyEngineDaysSinceJ2000 } from './astronomy-engine-time-domain';
import { calculateKeplerianEclipticPositionAu } from './keplerian-orbit';
import {
  JULIAN_DAYS_PER_YEAR,
  LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR,
  resolveReceivedStellarMotion,
  type StellarMotionDomainStatus,
  UNIFORM_RECTILINEAR_MOTION_SOURCE_URL,
} from './stellar-space-motion';
import { JULIAN_DAY_J2000 } from './time-utils';

export const ASTRONOMY_ENGINE_LIGHT_TIME_SOURCE_URL =
  'https://github.com/cosinekitty/astronomy/blob/v2.1.19/source/js/astronomy.ts';

export const HYG_RECEIVED_LIGHT_MODEL =
  'Uniform rectilinear HYG motion with an analytic barycentric light-time solution';

export const JPL_SMALL_BODY_LIGHT_TIME_SOURCE_URL = 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html';

export const JPL_SATELLITE_LIGHT_TIME_SOURCE_URL = 'https://ssd.jpl.nasa.gov/sats/elem/';

export const NASA_EXOPLANET_DISTANCE_SOURCE_URL =
  'https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html';

export const HYG_REFERENCE_POSITION_METADATA_KEYS = {
  x: 'stellarReferencePositionParsecX',
  y: 'stellarReferencePositionParsecY',
  z: 'stellarReferencePositionParsecZ',
  velocityX: 'stellarVelocityParsecPerYearX',
  velocityY: 'stellarVelocityParsecPerYearY',
  velocityZ: 'stellarVelocityParsecPerYearZ',
} as const;

type LightTimedEphemerisBody = Exclude<EphemerisBody, JovianMoon>;
export type SolarSystemLightTarget = 'sun' | LightTimedEphemerisBody;

export interface ReceivedLightEpoch {
  readonly receptionTime: UniverseTime;
  readonly emissionTime: UniverseTime;
  readonly requestedEmissionTime: UniverseTime;
  readonly lightTravelDays: number;
  readonly confidence: 'calculated' | 'extrapolated';
  readonly model:
    | 'astronomy-engine-light-time'
    | 'astronomy-engine-jovian-light-time'
    | 'keplerian-earth-light-time'
    | 'exoplanet-system-distance-light-time'
    | 'hyg-uniform-rectilinear-light-time';
  readonly status: 'within-model-domain' | StellarMotionDomainStatus;
  readonly sourceUrl: string;
}

export interface SolarSystemLightDeparture extends ReceivedLightEpoch {
  readonly relativePositionEquatorialAu: Vector3Like;
  readonly receptionDaysSinceJ2000: number;
}

const SOLAR_SYSTEM_BODIES: Readonly<Record<SolarSystemLightTarget, Body>> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  moon: Body.Moon,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

const JOVIAN_MOONS = new Set<EphemerisBody>(['io', 'europa', 'ganymede', 'callisto']);
const KEPLERIAN_LIGHT_TYPES = new Set<SpaceObject['type']>([
  'moon',
  'dwarf-planet',
  'asteroid',
  'comet',
]);
const KEPLERIAN_PARENT_BODIES: Readonly<Record<string, Body>> = {
  sun: Body.Sun,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};
const EQUATORIAL_TO_ECLIPTIC = Rotation_EQJ_ECL();

/** Calculates when light left a supported Solar-System body to reach Earth's centre. */
export function calculateSolarSystemLightDeparture(
  target: SolarSystemLightTarget,
  time: UniverseTime,
): SolarSystemLightDeparture {
  if (!Number.isFinite(time.julianDay)) {
    throw new Error('Date de réception lumineuse non finie.');
  }
  const receptionDaysSinceJ2000 = astronomyEngineDaysSinceJ2000(time);
  const receptionJulianDay = JULIAN_DAY_J2000 + receptionDaysSinceJ2000;

  if (target === 'earth') {
    const receptionTime = { julianDay: receptionJulianDay };

    return {
      receptionTime,
      emissionTime: receptionTime,
      requestedEmissionTime: receptionTime,
      lightTravelDays: 0,
      confidence: 'calculated',
      model: 'astronomy-engine-light-time',
      status: 'within-model-domain',
      sourceUrl: ASTRONOMY_ENGINE_LIGHT_TIME_SOURCE_URL,
      relativePositionEquatorialAu: { x: 0, y: 0, z: 0 },
      receptionDaysSinceJ2000,
    };
  }
  const backdated = BackdatePosition(
    receptionDaysSinceJ2000,
    Body.Earth,
    SOLAR_SYSTEM_BODIES[target],
    false,
  );
  const emissionJulianDay = JULIAN_DAY_J2000 + backdated.t.ut;
  const emissionTime = { julianDay: emissionJulianDay };

  return {
    receptionTime: { julianDay: receptionJulianDay },
    emissionTime,
    requestedEmissionTime: emissionTime,
    lightTravelDays: receptionDaysSinceJ2000 - backdated.t.ut,
    confidence: 'calculated',
    model: 'astronomy-engine-light-time',
    status: 'within-model-domain',
    sourceUrl: ASTRONOMY_ENGINE_LIGHT_TIME_SOURCE_URL,
    relativePositionEquatorialAu: { x: backdated.x, y: backdated.y, z: backdated.z },
    receptionDaysSinceJ2000,
  };
}

/** Calculates the received epoch of a Galilean moon from Astronomy Engine's JUP365 model. */
export function calculateJovianMoonLightDeparture(
  target: JovianMoon,
  time: UniverseTime,
): ReceivedLightEpoch {
  const reception = resolveReceptionTime(time);
  const earthAtReception = HelioVector(Body.Earth, reception.daysSinceJ2000);
  const solved = solveEarthReceivedLightTime(reception.daysSinceJ2000, (emissionDays) => {
    const modelDays = astronomyEngineDaysSinceJ2000({
      julianDay: JULIAN_DAY_J2000 + emissionDays,
    });
    const jupiter = HelioVector(Body.Jupiter, modelDays);
    const moon = JupiterMoons(modelDays)[target];

    return {
      x: jupiter.x + moon.x - earthAtReception.x,
      y: jupiter.y + moon.y - earthAtReception.y,
      z: jupiter.z + moon.z - earthAtReception.z,
    };
  });

  return createReceivedLightEpoch(
    reception.julianDay,
    solved,
    'calculated',
    'astronomy-engine-jovian-light-time',
    ASTRONOMY_ENGINE_LIGHT_TIME_SOURCE_URL,
  );
}

/** Resolves an Earth-received epoch from the catalogue's documented two-body elements. */
export function calculateKeplerianLightDeparture(
  object: SpaceObject,
  time: UniverseTime,
): ReceivedLightEpoch | null {
  const definition = object.positionProvider;
  const parentBody = object.parentId ? KEPLERIAN_PARENT_BODIES[object.parentId] : undefined;

  if (
    object.referenceFrame !== 'solar-system' ||
    definition.type !== 'keplerian' ||
    !KEPLERIAN_LIGHT_TYPES.has(object.type) ||
    !parentBody
  ) {
    return null;
  }
  const reception = resolveReceptionTime(time);
  const earthEquatorial = HelioVector(Body.Earth, reception.daysSinceJ2000);
  const earthAtReception = RotateVector(EQUATORIAL_TO_ECLIPTIC, earthEquatorial);
  const solved = solveEarthReceivedLightTime(reception.daysSinceJ2000, (emissionDays) => {
    const emissionTime = { julianDay: JULIAN_DAY_J2000 + emissionDays };
    const parentModelDays = astronomyEngineDaysSinceJ2000(emissionTime);
    const parentEquatorial = HelioVector(parentBody, parentModelDays);
    const parent = RotateVector(EQUATORIAL_TO_ECLIPTIC, parentEquatorial);
    const local = calculateKeplerianEclipticPositionAu(definition, emissionTime);

    return {
      x: parent.x + local.x - earthAtReception.x,
      y: parent.y + local.y - earthAtReception.y,
      z: parent.z + local.z - earthAtReception.z,
    };
  });
  const sourceUrl =
    object.type === 'moon'
      ? JPL_SATELLITE_LIGHT_TIME_SOURCE_URL
      : JPL_SMALL_BODY_LIGHT_TIME_SOURCE_URL;

  return createReceivedLightEpoch(
    reception.julianDay,
    solved,
    'extrapolated',
    'keplerian-earth-light-time',
    sourceUrl,
  );
}

/**
 * Interprets an exoplanet system distance as a barycentric light-travel delay. The host remains at
 * its static catalogue position, while a planet's explicitly illustrative local phase is evaluated
 * at the shared system emission epoch.
 */
export function calculateExoplanetSystemLightDeparture(
  object: SpaceObject,
  time: UniverseTime,
): ReceivedLightEpoch | null {
  const distanceParsec = readExoplanetSystemDistanceParsec(object);

  if (distanceParsec === null) {
    return null;
  }
  const reception = resolveReceptionTime(time);
  const lightTravelDays =
    (distanceParsec / LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR) * JULIAN_DAYS_PER_YEAR;

  return createReceivedLightEpoch(
    reception.julianDay,
    {
      emissionDaysSinceJ2000: reception.daysSinceJ2000 - lightTravelDays,
      lightTravelDays,
    },
    'calculated',
    'exoplanet-system-distance-light-time',
    NASA_EXOPLANET_DISTANCE_SOURCE_URL,
  );
}

export function resolveObjectReceivedLight(
  object: SpaceObject,
  time: UniverseTime,
): ReceivedLightEpoch | null {
  const solarSystemTarget = resolveSolarSystemTarget(object);

  if (solarSystemTarget) {
    return calculateSolarSystemLightDeparture(solarSystemTarget, time);
  }
  const jovianMoon = resolveJovianMoonTarget(object);

  if (jovianMoon) {
    return calculateJovianMoonLightDeparture(jovianMoon, time);
  }
  const keplerian = calculateKeplerianLightDeparture(object, time);

  if (keplerian) {
    return keplerian;
  }
  const stellarVectors = readHygStellarVectors(object);
  const referenceEpoch = object.referenceEpoch;

  if (stellarVectors && typeof referenceEpoch === 'number') {
    const receptionElapsedYears = (time.julianDay - referenceEpoch) / JULIAN_DAYS_PER_YEAR;
    const received = resolveReceivedStellarMotion(
      stellarVectors.referencePositionParsec,
      stellarVectors.velocityParsecPerYear,
      receptionElapsedYears,
    );

    return {
      receptionTime: { ...time },
      emissionTime: {
        julianDay: referenceEpoch + received.appliedEmissionElapsedYears * JULIAN_DAYS_PER_YEAR,
      },
      requestedEmissionTime: {
        julianDay: referenceEpoch + received.requestedEmissionElapsedYears * JULIAN_DAYS_PER_YEAR,
      },
      lightTravelDays: received.lightTravelYears * JULIAN_DAYS_PER_YEAR,
      confidence: 'extrapolated',
      model: 'hyg-uniform-rectilinear-light-time',
      status: received.status,
      sourceUrl: UNIFORM_RECTILINEAR_MOTION_SOURCE_URL,
    };
  }

  return calculateExoplanetSystemLightDeparture(object, time);
}

interface ReceptionTime {
  readonly julianDay: number;
  readonly daysSinceJ2000: number;
}

interface SolvedLightTime {
  readonly emissionDaysSinceJ2000: number;
  readonly lightTravelDays: number;
}

function resolveReceptionTime(time: UniverseTime): ReceptionTime {
  if (!Number.isFinite(time.julianDay)) {
    throw new Error('Date de réception lumineuse non finie.');
  }
  const daysSinceJ2000 = astronomyEngineDaysSinceJ2000(time);

  return {
    julianDay: JULIAN_DAY_J2000 + daysSinceJ2000,
    daysSinceJ2000,
  };
}

function solveEarthReceivedLightTime(
  receptionDaysSinceJ2000: number,
  relativePositionAtEmission: (emissionDaysSinceJ2000: number) => Vector3Like,
): SolvedLightTime {
  let emissionDaysSinceJ2000 = receptionDaysSinceJ2000;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const relative = relativePositionAtEmission(emissionDaysSinceJ2000);
    const lightTravelDays = Math.hypot(relative.x, relative.y, relative.z) / C_AUDAY;

    emissionDaysSinceJ2000 = receptionDaysSinceJ2000 - lightTravelDays;
  }
  const relative = relativePositionAtEmission(emissionDaysSinceJ2000);
  const lightTravelDays = Math.hypot(relative.x, relative.y, relative.z) / C_AUDAY;

  return {
    emissionDaysSinceJ2000: receptionDaysSinceJ2000 - lightTravelDays,
    lightTravelDays,
  };
}

function createReceivedLightEpoch(
  receptionJulianDay: number,
  solved: SolvedLightTime,
  confidence: ReceivedLightEpoch['confidence'],
  model: ReceivedLightEpoch['model'],
  sourceUrl: string,
): ReceivedLightEpoch {
  const emissionTime = {
    julianDay: JULIAN_DAY_J2000 + solved.emissionDaysSinceJ2000,
  };

  return {
    receptionTime: { julianDay: receptionJulianDay },
    emissionTime,
    requestedEmissionTime: emissionTime,
    lightTravelDays: solved.lightTravelDays,
    confidence,
    model,
    status: 'within-model-domain',
    sourceUrl,
  };
}

function resolveSolarSystemTarget(object: SpaceObject): SolarSystemLightTarget | null {
  if (object.id === 'sun') {
    return 'sun';
  }
  const provider = object.positionProvider;

  if (provider.type !== 'ephemeris' || JOVIAN_MOONS.has(provider.body)) {
    return null;
  }

  return provider.body as LightTimedEphemerisBody;
}

function resolveJovianMoonTarget(object: SpaceObject): JovianMoon | null {
  const provider = object.positionProvider;

  return provider.type === 'ephemeris' && JOVIAN_MOONS.has(provider.body)
    ? (provider.body as JovianMoon)
    : null;
}

function readExoplanetSystemDistanceParsec(object: SpaceObject): number | null {
  const metadata = object.metadata;

  if (
    !metadata ||
    metadata['sourceTable'] !== 'PSCompPars' ||
    metadata['mapDistanceUnavailable'] === true ||
    (object.type !== 'exoplanet' && metadata['exoplanetHost'] !== true)
  ) {
    return null;
  }
  const distanceParsec = metadata['distancePc'];

  if (typeof distanceParsec === 'number' && Number.isFinite(distanceParsec) && distanceParsec > 0) {
    return distanceParsec;
  }
  const distanceLightYears = metadata['distanceLy'];

  return typeof distanceLightYears === 'number' &&
    Number.isFinite(distanceLightYears) &&
    distanceLightYears > 0
    ? distanceLightYears * LIGHT_SPEED_PARSEC_PER_JULIAN_YEAR
    : null;
}

interface HygStellarVectors {
  readonly referencePositionParsec: Vector3Like;
  readonly velocityParsecPerYear: Vector3Like;
}

function readHygStellarVectors(object: SpaceObject): HygStellarVectors | null {
  const metadata = object.metadata;

  if (
    !metadata ||
    metadata['properMotionModel'] !==
      'Uniform rectilinear motion relative to the solar-system barycenter'
  ) {
    return null;
  }
  const values = [
    metadata[HYG_REFERENCE_POSITION_METADATA_KEYS.x],
    metadata[HYG_REFERENCE_POSITION_METADATA_KEYS.y],
    metadata[HYG_REFERENCE_POSITION_METADATA_KEYS.z],
    metadata[HYG_REFERENCE_POSITION_METADATA_KEYS.velocityX],
    metadata[HYG_REFERENCE_POSITION_METADATA_KEYS.velocityY],
    metadata[HYG_REFERENCE_POSITION_METADATA_KEYS.velocityZ],
  ];

  if (!values.every((value) => typeof value === 'number')) {
    return null;
  }
  const [x, y, z, velocityX, velocityY, velocityZ] = values as number[];

  return {
    referencePositionParsec: { x: x!, y: y!, z: z! },
    velocityParsecPerYear: { x: velocityX!, y: velocityY!, z: velocityZ! },
  };
}
