import { MakeTime, RotateVector, Rotation_EQJ_ECL, Vector } from 'astronomy-engine';
import type {
  PositionProviderDefinition,
  UniverseTime,
  Vector3Like,
} from '../../data/models/universe.models';
import { convertDistance } from '../coordinates/unit-conversion';

export type KeplerianPositionDefinition = Extract<
  PositionProviderDefinition,
  { type: 'keplerian' }
>;

const EQUATORIAL_TO_ECLIPTIC = Rotation_EQJ_ECL();
const J2000_TIME = MakeTime(0);

/** Propagates the catalogue's two-body elements in the J2000 ecliptic frame. */
export function calculateKeplerianEclipticPositionAu(
  definition: KeplerianPositionDefinition,
  time: UniverseTime,
): Vector3Like {
  return calculateKeplerianPosition(
    definition,
    time,
    convertDistance(definition.semiMajorAxis, definition.unit, 'astronomical-unit'),
  );
}

export function calculateKeplerianRenderPosition(
  definition: KeplerianPositionDefinition,
  time: UniverseTime,
  semiMajorAxisSceneUnits: number,
): Vector3Like {
  const position = calculateKeplerianPosition(definition, time, semiMajorAxisSceneUnits);

  return {
    x: position.x,
    y: position.z,
    // Historical heliocentric catalogue orbits use the map's positive-z convention. Satellite
    // reference planes already pass through the equatorial-to-ecliptic render conversion.
    z: definition.referencePlanePole ? -position.y : position.y,
  };
}

function calculateKeplerianPosition(
  definition: KeplerianPositionDefinition,
  time: UniverseTime,
  semiMajorAxis: number,
): Vector3Like {
  const elapsedDays = (time.julianDay - definition.epochJulianDay) % definition.orbitalPeriodDays;
  const meanMotion = (Math.PI * 2) / definition.orbitalPeriodDays;
  const meanAnomaly = normalizeRadians(
    degreesToRadians(definition.meanAnomalyAtEpoch) + meanMotion * elapsedDays,
  );
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, definition.eccentricity);
  const eccentricity = definition.eccentricity;
  const trueAnomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
      Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
    );
  const radius = semiMajorAxis * (1 - eccentricity * Math.cos(eccentricAnomaly));
  const inclination = degreesToRadians(definition.inclination);
  const ascendingNode = degreesToRadians(definition.longitudeOfAscendingNode);
  const argument = degreesToRadians(definition.argumentOfPeriapsis) + trueAnomaly;
  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);
  const cosArgument = Math.cos(argument);
  const sinArgument = Math.sin(argument);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);
  const orbitalPosition = {
    x: radius * (cosNode * cosArgument - sinNode * sinArgument * cosInclination),
    y: radius * (sinNode * cosArgument + cosNode * sinArgument * cosInclination),
    z: radius * sinArgument * sinInclination,
  };

  if (!definition.referencePlanePole) {
    return orbitalPosition;
  }
  const basis = createReferencePlaneBasis(definition.referencePlanePole);
  const equatorialPosition = transformFromReferencePlane(orbitalPosition, basis);
  const eclipticPosition = RotateVector(
    EQUATORIAL_TO_ECLIPTIC,
    new Vector(equatorialPosition.x, equatorialPosition.y, equatorialPosition.z, J2000_TIME),
  );

  return { x: eclipticPosition.x, y: eclipticPosition.y, z: eclipticPosition.z };
}

interface ReferencePlaneBasis {
  readonly xAxis: Vector3Like;
  readonly yAxis: Vector3Like;
  readonly pole: Vector3Like;
}

function createReferencePlaneBasis(
  pole: NonNullable<KeplerianPositionDefinition['referencePlanePole']>,
): ReferencePlaneBasis {
  const rightAscension = degreesToRadians(pole.rightAscensionDegrees);
  const declination = degreesToRadians(pole.declinationDegrees);
  const sinRightAscension = Math.sin(rightAscension);
  const cosRightAscension = Math.cos(rightAscension);
  const sinDeclination = Math.sin(declination);
  const cosDeclination = Math.cos(declination);

  return {
    xAxis: { x: -sinRightAscension, y: cosRightAscension, z: 0 },
    yAxis: {
      x: -sinDeclination * cosRightAscension,
      y: -sinDeclination * sinRightAscension,
      z: cosDeclination,
    },
    pole: {
      x: cosDeclination * cosRightAscension,
      y: cosDeclination * sinRightAscension,
      z: sinDeclination,
    },
  };
}

function transformFromReferencePlane(
  position: Vector3Like,
  basis: ReferencePlaneBasis,
): Vector3Like {
  return {
    x: position.x * basis.xAxis.x + position.y * basis.yAxis.x + position.z * basis.pole.x,
    y: position.x * basis.xAxis.y + position.y * basis.yAxis.y + position.z * basis.pole.y,
    z: position.x * basis.xAxis.z + position.y * basis.yAxis.z + position.z * basis.pole.z,
  };
}

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  let estimate = eccentricity < 0.8 ? meanAnomaly : Math.PI;

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const correction =
      (estimate - eccentricity * Math.sin(estimate) - meanAnomaly) /
      (1 - eccentricity * Math.cos(estimate));

    estimate -= correction;

    if (Math.abs(correction) < 1e-10) {
      break;
    }
  }

  return estimate;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function normalizeRadians(value: number): number {
  const fullTurn = Math.PI * 2;

  return ((value % fullTurn) + fullTurn) % fullTurn;
}
