import { Body, GeoMoon, HelioVector, RotateVector, Rotation_EQJ_ECL } from 'astronomy-engine';
import {
  EphemerisBody,
  PositionProviderDefinition,
  ReferenceFrame,
  UniverseTime,
  Vector3Like,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { JULIAN_DAY_J2000 } from './time-utils';

const EQUATORIAL_TO_ECLIPTIC = Rotation_EQJ_ECL();
const EPHEMERIS_BODIES: Readonly<Record<EphemerisBody, Body>> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  moon: Body.Moon,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

export interface TemporalPositionProvider {
  getPositionAt(time: UniverseTime): Vector3Like;
}

export class StaticPositionProvider implements TemporalPositionProvider {
  constructor(private readonly position: Vector3Like) {}

  public getPositionAt(): Vector3Like {
    return { ...this.position };
  }
}

export class KeplerianOrbitProvider implements TemporalPositionProvider {
  private readonly semiMajorAxisSceneUnits: number;

  constructor(
    private readonly definition: Extract<PositionProviderDefinition, { type: 'keplerian' }>,
    coordinateSystem: CoordinateSystem,
    frame: ReferenceFrame,
  ) {
    this.semiMajorAxisSceneUnits = coordinateSystem.toSceneDistance(
      definition.semiMajorAxis,
      definition.unit,
      frame,
    );
  }

  public getPositionAt(time: UniverseTime): Vector3Like {
    const elapsedDays = time.julianDay - this.definition.epochJulianDay;
    const meanMotion = (Math.PI * 2) / this.definition.orbitalPeriodDays;
    const meanAnomaly = normalizeRadians(
      degreesToRadians(this.definition.meanAnomalyAtEpoch) + meanMotion * elapsedDays,
    );
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, this.definition.eccentricity);
    const eccentricity = this.definition.eccentricity;
    const trueAnomaly =
      2 *
      Math.atan2(
        Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly / 2),
        Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly / 2),
      );
    const radius = this.semiMajorAxisSceneUnits * (1 - eccentricity * Math.cos(eccentricAnomaly));

    const inclination = degreesToRadians(this.definition.inclination);
    const ascendingNode = degreesToRadians(this.definition.longitudeOfAscendingNode);
    const periapsis = degreesToRadians(this.definition.argumentOfPeriapsis);
    const argument = periapsis + trueAnomaly;

    const cosNode = Math.cos(ascendingNode);
    const sinNode = Math.sin(ascendingNode);
    const cosArgument = Math.cos(argument);
    const sinArgument = Math.sin(argument);
    const cosInclination = Math.cos(inclination);
    const sinInclination = Math.sin(inclination);

    // The astronomical reference plane (x/y) is mapped to Three.js' horizontal x/z plane.
    return {
      x: radius * (cosNode * cosArgument - sinNode * sinArgument * cosInclination),
      y: radius * sinArgument * sinInclination,
      z: radius * (sinNode * cosArgument + cosNode * sinArgument * cosInclination),
    };
  }
}

export class SolarSystemEphemerisProvider implements TemporalPositionProvider {
  private readonly body: Body;
  private readonly sceneUnitsPerAstronomicalUnit: number;

  constructor(
    private readonly definition: Extract<PositionProviderDefinition, { type: 'ephemeris' }>,
    coordinateSystem: CoordinateSystem,
    frame: ReferenceFrame,
  ) {
    if (frame !== 'solar-system') {
      throw new Error('Une éphéméride solaire exige le référentiel solar-system.');
    }
    if (
      (definition.body === 'moon' && definition.origin !== 'earth') ||
      (definition.body !== 'moon' && definition.origin !== 'sun')
    ) {
      throw new Error(`Origine d’éphéméride incohérente pour ${definition.body}.`);
    }

    this.body = EPHEMERIS_BODIES[definition.body];
    this.sceneUnitsPerAstronomicalUnit =
      coordinateSystem.toSceneDistance(1, 'astronomical-unit', frame) *
      (definition.distanceScale ?? 1);
  }

  public getPositionAt(time: UniverseTime): Vector3Like {
    const daysSinceJ2000 = time.julianDay - JULIAN_DAY_J2000;
    const equatorialPosition =
      this.definition.origin === 'earth'
        ? GeoMoon(daysSinceJ2000)
        : HelioVector(this.body, daysSinceJ2000);
    const eclipticPosition = RotateVector(EQUATORIAL_TO_ECLIPTIC, equatorialPosition);
    const scale = this.sceneUnitsPerAstronomicalUnit;

    // Astronomy Engine fournit EQJ. Le rendu utilise l’écliptique J2000 avec Y vertical.
    return {
      x: eclipticPosition.x * scale,
      y: eclipticPosition.z * scale,
      z: eclipticPosition.y * scale,
    };
  }
}

export class LinearProperMotionProvider implements TemporalPositionProvider {
  private readonly initialPosition: Vector3Like;
  private readonly velocityPerDay: Vector3Like;
  private readonly epochJulianDay: number;

  constructor(
    definition: Extract<PositionProviderDefinition, { type: 'linear-motion' }>,
    coordinateSystem: CoordinateSystem,
    frame: ReferenceFrame,
  ) {
    this.initialPosition = coordinateSystem.toRenderPosition(
      definition.positionAtEpoch,
      definition.unit,
      frame,
    );
    const scale = coordinateSystem.getLinearMotionScale(definition.unit, frame);

    this.velocityPerDay = {
      x: definition.velocityPerDay[0] * scale,
      y: definition.velocityPerDay[1] * scale,
      z: definition.velocityPerDay[2] * scale,
    };
    this.epochJulianDay = definition.epochJulianDay;
  }

  public getPositionAt(time: UniverseTime): Vector3Like {
    const elapsedDays = time.julianDay - this.epochJulianDay;

    return {
      x: this.initialPosition.x + this.velocityPerDay.x * elapsedDays,
      y: this.initialPosition.y + this.velocityPerDay.y * elapsedDays,
      z: this.initialPosition.z + this.velocityPerDay.z * elapsedDays,
    };
  }
}

export class ProceduralPositionProvider implements TemporalPositionProvider {
  constructor(private readonly seed: number) {}

  public getPositionAt(time: UniverseTime): Vector3Like {
    const radius = 2_400 + (this.seed % 1_000);
    const phase = this.seed * 0.618_033_988_75 + time.julianDay * 0.000_000_2;

    return {
      x: Math.cos(phase) * radius,
      y: Math.sin(phase * 0.37) * radius * 0.08,
      z: Math.sin(phase) * radius,
    };
  }
}

export class PositionProviderFactory {
  constructor(private readonly coordinateSystem: CoordinateSystem) {}

  public create(
    definition: PositionProviderDefinition,
    frame: ReferenceFrame,
  ): TemporalPositionProvider {
    switch (definition.type) {
      case 'static':
        return new StaticPositionProvider(
          this.coordinateSystem.toRenderPosition(definition.position, definition.unit, frame),
        );
      case 'keplerian':
        return new KeplerianOrbitProvider(definition, this.coordinateSystem, frame);
      case 'ephemeris':
        return new SolarSystemEphemerisProvider(definition, this.coordinateSystem, frame);
      case 'linear-motion':
        return new LinearProperMotionProvider(definition, this.coordinateSystem, frame);
      case 'procedural':
        return new ProceduralPositionProvider(definition.seed);
    }
  }
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
