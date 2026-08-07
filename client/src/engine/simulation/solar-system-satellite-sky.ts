import {
  Body,
  EquatorFromVector,
  GeoVector,
  JupiterMoons,
  MakeTime,
  Observer,
  ObserverVector,
  RotateVector,
  Rotation_ECL_EQJ,
  Vector,
} from 'astronomy-engine';
import type {
  JovianMoon,
  PhysicalProperties,
  PositionProviderDefinition,
  SpaceObject,
  UniverseTime,
  Vector3Like,
} from '../../data/models/universe.models';
import { astronomyEngineDaysSinceJ2000 } from './astronomy-engine-time-domain';
import { calculateKeplerianEclipticPositionAu } from './keplerian-orbit';
import {
  calculateJovianMoonLightDeparture,
  calculateKeplerianLightDeparture,
} from './received-light-time';
import {
  calculateAngularDiameterDegrees,
  calculateEarthSkyDirection,
  type SolarSystemSkyObservation,
} from './solar-system-sky';
import {
  calculateEarthObserverReferenceFrame,
  createStellarObservationCalculator,
  type EarthObservationLocation,
  type EarthObserverReferenceFrame,
  type StellarObservationCalculator,
} from './stellar-observation';

const EQUATORIAL_FROM_ECLIPTIC = Rotation_ECL_EQJ();
const JOVIAN_MOON_IDS = new Set<string>(['io', 'europa', 'ganymede', 'callisto']);
const SATELLITE_PARENT_BODIES = {
  mars: Body.Mars,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
} as const;

type EphemerisPositionProvider = Extract<PositionProviderDefinition, { type: 'ephemeris' }>;
type KeplerianPositionProvider = Extract<PositionProviderDefinition, { type: 'keplerian' }>;
type SatelliteParentId = keyof typeof SATELLITE_PARENT_BODIES;
type SatellitePhysicalProperties = PhysicalProperties & { readonly radiusKm: number };
type JovianSatelliteSkyTarget = SpaceObject & {
  readonly parentId: 'jupiter';
  readonly physical: SatellitePhysicalProperties;
  readonly positionProvider: EphemerisPositionProvider & {
    readonly body: JovianMoon;
    readonly origin: 'jupiter';
  };
};
type KeplerianSatelliteSkyTarget = SpaceObject & {
  readonly parentId: SatelliteParentId;
  readonly physical: SatellitePhysicalProperties;
  readonly positionProvider: KeplerianPositionProvider & {
    readonly referencePlanePole: NonNullable<KeplerianPositionProvider['referencePlanePole']>;
  };
};
type SolarSystemSatelliteSkyTarget = JovianSatelliteSkyTarget | KeplerianSatelliteSkyTarget;

interface SatelliteSkyContext {
  readonly astronomyTime: ReturnType<typeof MakeTime>;
  readonly calculateObservation: StellarObservationCalculator;
  readonly observerVector: Vector;
  readonly referenceFrame: EarthObserverReferenceFrame;
  readonly parentVectors: Map<Body, Vector3Like>;
}

/**
 * Reports whether a catalogue moon can be placed in the local sky from its physical orbit.
 * The Earth's Moon remains in `solar-system-sky`, where its phase is also calculated.
 */
export function isSolarSystemSatelliteSkyTarget(
  object: SpaceObject,
): object is SolarSystemSatelliteSkyTarget {
  if (
    object.type !== 'moon' ||
    object.id === 'moon' ||
    object.referenceFrame !== 'solar-system' ||
    !isPositiveFinite(object.physical?.radiusKm) ||
    (object.scientificConfidence !== 'calculated' && object.scientificConfidence !== 'extrapolated')
  ) {
    return false;
  }
  const provider = object.positionProvider;

  if (provider.type === 'ephemeris') {
    return (
      object.parentId === 'jupiter' &&
      provider.origin === 'jupiter' &&
      isJovianMoonId(provider.body) &&
      provider.body === object.id
    );
  }

  return (
    provider.type === 'keplerian' &&
    provider.referencePlanePole !== undefined &&
    object.parentId !== undefined &&
    Object.hasOwn(SATELLITE_PARENT_BODIES, object.parentId)
  );
}

/**
 * Calculates every supported catalogue satellite in the observer's topocentric sky.
 * Galilean positions use Astronomy Engine's JUP365 model; the other moons propagate the
 * documented NASA/JPL mean J2000 elements from the validated local catalogue.
 */
export function calculateSolarSystemSatelliteSky(
  time: UniverseTime,
  location: EarthObservationLocation,
  objects: readonly SpaceObject[],
): readonly SolarSystemSkyObservation[] {
  const context = createSatelliteSkyContext(time, location);

  if (!context) {
    return [];
  }

  return objects.flatMap((object): readonly SolarSystemSkyObservation[] => {
    const observation = calculateSatelliteObservation(object, time, context);

    return observation ? [observation] : [];
  });
}

export function calculateSolarSystemSatelliteSkyObservation(
  time: UniverseTime,
  location: EarthObservationLocation,
  object: SpaceObject,
): SolarSystemSkyObservation | null {
  const context = createSatelliteSkyContext(time, location);

  return context ? calculateSatelliteObservation(object, time, context) : null;
}

function createSatelliteSkyContext(
  time: UniverseTime,
  location: EarthObservationLocation,
): SatelliteSkyContext | null {
  const calculateObservation = createStellarObservationCalculator(time, location);
  const referenceFrame = calculateEarthObserverReferenceFrame(time, location);

  if (!calculateObservation || !referenceFrame) {
    return null;
  }
  const astronomyTime = MakeTime(astronomyEngineDaysSinceJ2000(time));
  const observer = new Observer(location.latitude, location.longitude, location.heightMeters ?? 0);

  return {
    astronomyTime,
    calculateObservation,
    observerVector: ObserverVector(astronomyTime, observer, false),
    referenceFrame,
    parentVectors: new Map(),
  };
}

function calculateSatelliteObservation(
  object: SpaceObject,
  time: UniverseTime,
  context: SatelliteSkyContext,
): SolarSystemSkyObservation | null {
  if (!isSolarSystemSatelliteSkyTarget(object)) {
    return null;
  }
  const geocentricPosition = calculateReceivedGeocentricPosition(object, time, context);
  const topocentricPosition = new Vector(
    geocentricPosition.x - context.observerVector.x,
    geocentricPosition.y - context.observerVector.y,
    geocentricPosition.z - context.observerVector.z,
    context.astronomyTime,
  );
  const equatorial = EquatorFromVector(topocentricPosition);
  const observation = context.calculateObservation({
    rightAscensionDegrees: equatorial.ra * 15,
    declinationDegrees: equatorial.dec,
  });
  const positionConfidence =
    object.scientificConfidence === 'calculated' ? 'calculated' : 'extrapolated';

  return {
    id: object.id,
    fallbackName: object.name,
    color: object.visual.color ?? '#dce9ff',
    angularSizeClass: 'stellar',
    skyObjectKind: 'satellite',
    assistedVisibility: true,
    textureUrl: null,
    appearanceConfidence: resolveAppearanceConfidence(object),
    positionConfidence,
    observation,
    direction: calculateEarthSkyDirection(
      observation.altitudeDegrees,
      observation.azimuthDegrees,
      context.referenceFrame,
    ),
    lunarIllumination: null,
    angularDiameterDegrees: calculateAngularDiameterDegrees(
      object.physical.radiusKm,
      equatorial.dist,
    ),
    angularDiameterConfidence: positionConfidence,
  };
}

function calculateReceivedGeocentricPosition(
  object: SolarSystemSatelliteSkyTarget,
  time: UniverseTime,
  context: SatelliteSkyContext,
): Vector3Like {
  const provider = object.positionProvider;

  if (provider.type === 'ephemeris') {
    const departure = calculateJovianMoonLightDeparture(provider.body, time);
    const emissionDays = astronomyEngineDaysSinceJ2000(departure.emissionTime);
    const moon = JupiterMoons(emissionDays)[provider.body];
    const jupiter = apparentParentVector(Body.Jupiter, context);

    return {
      x: jupiter.x + moon.x,
      y: jupiter.y + moon.y,
      z: jupiter.z + moon.z,
    };
  }
  const keplerianObject = object as KeplerianSatelliteSkyTarget;
  const parentBody = SATELLITE_PARENT_BODIES[keplerianObject.parentId];
  const departure = calculateKeplerianLightDeparture(keplerianObject, time)!;
  const localEcliptic = calculateKeplerianEclipticPositionAu(
    keplerianObject.positionProvider,
    departure.emissionTime,
  );
  const localEquatorial = RotateVector(
    EQUATORIAL_FROM_ECLIPTIC,
    new Vector(localEcliptic.x, localEcliptic.y, localEcliptic.z, context.astronomyTime),
  );
  const parent = apparentParentVector(parentBody, context);

  return {
    x: parent.x + localEquatorial.x,
    y: parent.y + localEquatorial.y,
    z: parent.z + localEquatorial.z,
  };
}

function apparentParentVector(body: Body, context: SatelliteSkyContext): Vector3Like {
  const cached = context.parentVectors.get(body);

  if (cached) {
    return cached;
  }
  const vector = GeoVector(body, context.astronomyTime, true);
  const position = { x: vector.x, y: vector.y, z: vector.z };

  context.parentVectors.set(body, position);

  return position;
}

function isJovianMoonId(objectId: string): objectId is JovianMoon {
  return JOVIAN_MOON_IDS.has(objectId);
}

function resolveAppearanceConfidence(
  object: SpaceObject,
): SolarSystemSkyObservation['appearanceConfidence'] {
  const confidence = object.metadata?.['appearanceConfidence'];

  return confidence === 'observed' || confidence === 'observed-adapted'
    ? confidence
    : 'illustrative';
}

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
