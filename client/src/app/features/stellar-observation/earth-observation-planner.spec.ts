import type { SolarSystemSkyObservation } from '../../../engine/simulation/solar-system-sky';
import type {
  StellarObservation,
  StellarObservationCatalogEntry,
} from '../../../engine/simulation/stellar-observation';
import { createEarthObservationPlan } from './earth-observation-planner';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';

describe('createEarthObservationPlan', () => {
  const time = { julianDay: 2_451_545 };
  const location = {
    id: 'greenwich-equator',
    name: 'Greenwich equator',
    latitude: 0,
    longitude: 0,
    timeZone: 'UTC',
  };

  it('retient les astres au-dessus de l’horizon et classe les étoiles par éclat', () => {
    const plan = createEarthObservationPlan({
      time,
      location,
      solarSystem: [solarBody('moon', 55), solarBody('mars', 22), solarBody('venus', -5)],
      stars: [
        star('bright', 'Brillante', -1.2, 280.46),
        star('faint', 'Faible', 1.5, 280.46),
        star('opposite', 'Opposée', -2, 100.46),
      ],
      terrainHorizon: null,
      maximumStarCount: 1,
    });

    expect(plan.solarSystem.map(({ id }) => id)).toEqual(['moon', 'mars']);
    expect(plan.stars.map(({ id }) => id)).toEqual(['bright']);
    expect(plan.stars[0]?.observation.altitudeDegrees).toBeGreaterThan(85);
    expect(plan.totalCount).toBe(3);
    expect(plan.terrainApplied).toBe(false);
  });

  it('écarte les objets cachés par le relief calculé', () => {
    const plan = createEarthObservationPlan({
      time,
      location,
      solarSystem: [solarBody('mars', 12), solarBody('jupiter', 48)],
      stars: [star('zenith', 'Zénith', -1, 280.46)],
      terrainHorizon: terrainProfile(20),
    });

    expect(plan.solarSystem.map(({ id }) => id)).toEqual(['jupiter']);
    expect(plan.stars.map(({ id }) => id)).toEqual(['zenith']);
    expect(plan.terrainApplied).toBe(true);
  });

  it('départage deux étoiles de même éclat par leur altitude', () => {
    const plan = createEarthObservationPlan({
      time,
      location,
      solarSystem: [],
      stars: [star('lower', 'Plus basse', -1, 300.46), star('higher', 'Plus haute', -1, 280.46)],
      terrainHorizon: null,
    });

    expect(plan.stars.map(({ id }) => id)).toEqual(['higher', 'lower']);
  });

  it('tolère un domaine temporel invalide', () => {
    const plan = createEarthObservationPlan({
      time: { julianDay: Number.MAX_SAFE_INTEGER },
      location,
      solarSystem: [],
      stars: [star('bright', 'Brillante', -1, 280.46)],
      terrainHorizon: null,
    });

    expect(plan).toEqual({ solarSystem: [], stars: [], totalCount: 0, terrainApplied: false });
  });

  it('normalise une limite non finie à zéro', () => {
    const plan = createEarthObservationPlan({
      time,
      location,
      solarSystem: [],
      stars: [star('bright', 'Brillante', -1, 280.46)],
      terrainHorizon: null,
      maximumStarCount: Number.NaN,
    });

    expect(plan.stars).toEqual([]);
  });
});

function star(
  id: string,
  name: string,
  apparentMagnitude: number,
  rightAscensionDegrees: number,
): StellarObservationCatalogEntry {
  return {
    id,
    name,
    apparentMagnitude,
    color: '#ffffff',
    coordinates: { rightAscensionDegrees, declinationDegrees: 0 },
  };
}

function solarBody(id: 'moon' | 'mars' | 'venus' | 'jupiter', altitudeDegrees: number) {
  const observation: StellarObservation = {
    altitudeDegrees,
    geometricAltitudeDegrees: altitudeDegrees,
    atmosphericRefractionDegrees: 0,
    azimuthDegrees: 180,
    compassDirection: 'south',
    isAboveHorizon: altitudeDegrees > 0,
  };

  return {
    id,
    fallbackName: id,
    color: '#ffffff',
    angularSizeClass: id === 'moon' ? 'moon' : 'planet',
    skyObjectKind: id === 'moon' ? 'moon' : 'planet',
    assistedVisibility: false,
    textureUrl: null,
    appearanceConfidence: 'illustrative',
    positionConfidence: 'calculated',
    observation,
    direction: { x: 0, y: 1, z: 0 },
    lunarIllumination: null,
    angularDiameterDegrees: 0.1,
    angularDiameterConfidence: 'calculated',
  } satisfies SolarSystemSkyObservation;
}

function terrainProfile(obstructionDegrees: number): EarthTerrainHorizonProfile {
  const obstructionAnglesCentidegrees = new Int16Array(360).fill(
    Math.round(obstructionDegrees * 100),
  );

  return {
    locationId: 'greenwich-equator',
    latitude: 0,
    longitude: 0,
    observerElevationMeters: 0,
    azimuthStepDegrees: 1,
    obstructionAnglesCentidegrees,
    distanceLayers: [],
    source: {
      id: 'fixture',
      title: 'Fixture',
      productUrl: 'https://example.com',
      dataUrl: 'fixture.tif',
      doi: 'https://doi.org/10.0/fixture',
      horizontalDatum: 'WGS 84',
      verticalDatum: 'EGM2008',
      resolutionArcSeconds: 60,
    },
    calculation: {
      model: 'spherical-geometric-line-of-sight',
      earthRadiusMeters: 6_371_008.8,
      observerEyeHeightMeters: 2,
      maximumDistanceMeters: 300_000,
      azimuthStepDegrees: 1,
      sampleStepMeters: 1_000,
      distanceBands: [],
      atmosphericRefraction: 'excluded',
      terrainInterpolation: 'bilinear',
      locationAnchor: 'catalogued-city-center',
    },
  };
}
