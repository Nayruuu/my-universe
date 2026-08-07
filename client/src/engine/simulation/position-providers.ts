import {
  Body,
  GeoMoon,
  HelioVector,
  JupiterMoons,
  MakeTime,
  RotateVector,
  Rotation_EQJ_ECL,
  Vector,
} from 'astronomy-engine';
import {
  EphemerisBody,
  JovianMoon,
  PositionProviderDefinition,
  ReferenceFrame,
  UniverseTime,
  Vector3Like,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { astronomyEngineDaysSinceJ2000 } from './astronomy-engine-time-domain';
import { calculateKeplerianRenderPosition } from './keplerian-orbit';
import {
  calculateJovianMoonLightDeparture,
  calculateSolarSystemLightDeparture,
  type ReceivedLightEpoch,
  type SolarSystemLightTarget,
} from './received-light-time';
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
  pluto: Body.Pluto,
  io: Body.Jupiter,
  europa: Body.Jupiter,
  ganymede: Body.Jupiter,
  callisto: Body.Jupiter,
};
const JOVIAN_MOONS = new Set<JovianMoon>(['io', 'europa', 'ganymede', 'callisto']);

export interface TemporalPositionProvider {
  getPositionAt(time: UniverseTime): Vector3Like;
  getReceivedPositionAt?(time: UniverseTime): ReceivedTemporalPosition | null;
}

export interface ReceivedTemporalPosition {
  readonly position: Vector3Like;
  readonly light: ReceivedLightEpoch;
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
    this.semiMajorAxisSceneUnits =
      coordinateSystem.toSceneDistance(definition.semiMajorAxis, definition.unit, frame) *
      (definition.distanceScale ?? 1);
  }

  public getPositionAt(time: UniverseTime): Vector3Like {
    return calculateKeplerianRenderPosition(this.definition, time, this.semiMajorAxisSceneUnits);
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
    if (!isValidEphemerisOrigin(definition.body, definition.origin)) {
      throw new Error(`Origine d’éphéméride incohérente pour ${definition.body}.`);
    }

    this.body = EPHEMERIS_BODIES[definition.body];
    this.sceneUnitsPerAstronomicalUnit =
      coordinateSystem.toSceneDistance(1, 'astronomical-unit', frame) *
      (definition.distanceScale ?? 1);
  }

  public getPositionAt(time: UniverseTime): Vector3Like {
    const daysSinceJ2000 = astronomyEngineDaysSinceJ2000(time);
    const equatorialPosition = this.getEquatorialPosition(daysSinceJ2000);

    return this.toScenePosition(equatorialPosition);
  }

  public getReceivedPositionAt(time: UniverseTime): ReceivedTemporalPosition | null {
    if (this.definition.origin === 'jupiter') {
      const body = this.definition.body as JovianMoon;
      const light = calculateJovianMoonLightDeparture(body, time);
      const equatorialPosition = this.getEquatorialPosition(
        astronomyEngineDaysSinceJ2000(light.emissionTime),
      );

      return { position: this.toScenePosition(equatorialPosition), light };
    }
    const light = calculateSolarSystemLightDeparture(
      this.definition.body as SolarSystemLightTarget,
      time,
    );
    const relative = light.relativePositionEquatorialAu;
    let equatorialPosition: Vector;

    if (this.definition.origin === 'earth') {
      equatorialPosition = new Vector(
        relative.x,
        relative.y,
        relative.z,
        MakeTime(light.emissionTime.julianDay - JULIAN_DAY_J2000),
      );
    } else {
      const earthAtReception = HelioVector(Body.Earth, light.receptionDaysSinceJ2000);

      equatorialPosition = new Vector(
        earthAtReception.x + relative.x,
        earthAtReception.y + relative.y,
        earthAtReception.z + relative.z,
        MakeTime(light.emissionTime.julianDay - JULIAN_DAY_J2000),
      );
    }

    return { position: this.toScenePosition(equatorialPosition), light };
  }

  private toScenePosition(equatorialPosition: Vector): Vector3Like {
    const eclipticPosition = RotateVector(EQUATORIAL_TO_ECLIPTIC, equatorialPosition);
    const scale = this.sceneUnitsPerAstronomicalUnit;

    // Astronomy Engine fournit EQJ. Le rendu utilise une rotation propre vers
    // l’écliptique J2000 avec Y vertical, sans réflexion est-ouest.
    return {
      x: eclipticPosition.x * scale,
      y: eclipticPosition.z * scale,
      z: -eclipticPosition.y * scale,
    };
  }

  private getEquatorialPosition(daysSinceJ2000: number): Vector {
    if (this.definition.origin === 'earth') {
      return GeoMoon(daysSinceJ2000);
    }
    if (this.definition.origin === 'jupiter') {
      const body = this.definition.body as JovianMoon;

      const state = JupiterMoons(daysSinceJ2000)[body];

      return new Vector(state.x, state.y, state.z, state.t);
    }

    return HelioVector(this.body, daysSinceJ2000);
  }
}

export class IllustrativeOrbitProvider implements TemporalPositionProvider {
  private readonly semiMajorAxisSceneUnits: number;

  constructor(
    private readonly definition: Extract<
      PositionProviderDefinition,
      { type: 'illustrative-orbit' }
    >,
    coordinateSystem: CoordinateSystem,
    frame: ReferenceFrame,
  ) {
    this.semiMajorAxisSceneUnits =
      coordinateSystem.toSceneDistance(definition.semiMajorAxis, definition.unit, frame) *
      (definition.distanceScale ?? 1);
  }

  public getPositionAt(time: UniverseTime): Vector3Like {
    const elapsedDays =
      (time.julianDay - this.definition.epochJulianDay) % this.definition.orbitalPeriodDays;
    const phase =
      degreesToRadians(this.definition.visualPhaseAtEpochDegrees) +
      (elapsedDays / this.definition.orbitalPeriodDays) * Math.PI * 2;
    const inclination = degreesToRadians(this.definition.visualInclinationDegrees);
    const orbitalPlaneOffset = Math.sin(phase) * this.semiMajorAxisSceneUnits;

    return {
      x: Math.cos(phase) * this.semiMajorAxisSceneUnits,
      y: orbitalPlaneOffset * Math.sin(inclination),
      z: orbitalPlaneOffset * Math.cos(inclination),
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
      case 'catalog':
        throw new Error(
          `Le lien de catalogue ${definition.catalogId}:${definition.identifier} doit être résolu avant le rendu.`,
        );
      case 'keplerian':
        return new KeplerianOrbitProvider(definition, this.coordinateSystem, frame);
      case 'ephemeris':
        return new SolarSystemEphemerisProvider(definition, this.coordinateSystem, frame);
      case 'illustrative-orbit':
        return new IllustrativeOrbitProvider(definition, this.coordinateSystem, frame);
      case 'linear-motion':
        return new LinearProperMotionProvider(definition, this.coordinateSystem, frame);
      case 'procedural':
        return new ProceduralPositionProvider(definition.seed);
    }
  }
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function isValidEphemerisOrigin(
  body: EphemerisBody,
  origin: Extract<PositionProviderDefinition, { type: 'ephemeris' }>['origin'],
): boolean {
  if (body === 'moon') {
    return origin === 'earth';
  }
  if (JOVIAN_MOONS.has(body as JovianMoon)) {
    return origin === 'jupiter';
  }

  return origin === 'sun';
}
