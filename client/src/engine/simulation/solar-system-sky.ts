import { Body, Equator, Illumination, MakeTime, MoonPhase, Observer } from 'astronomy-engine';
import type { UniverseTime, Vector3Like } from '../../data/models/universe.models';
import { astronomyEngineDaysSinceJ2000 } from './astronomy-engine-time-domain';
import {
  calculateEarthObserverReferenceFrame,
  createStellarObservationCalculator,
  type EarthObservationLocation,
  type StellarObservation,
} from './stellar-observation';

export type SolarSystemSkyBodyId =
  'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface LunarSkyIllumination {
  readonly illuminatedFraction: number;
  readonly waxing: boolean;
}

export interface SolarSystemSkyBody {
  readonly id: SolarSystemSkyBodyId;
  readonly fallbackName: string;
  readonly color: string;
  readonly angularSizeClass: 'stellar' | 'planet' | 'moon';
  readonly assistedVisibility: boolean;
  readonly textureUrl: string | null;
  readonly appearanceConfidence: 'observed' | 'observed-adapted' | 'illustrative';
}

export interface SolarSystemSkyObservation extends SolarSystemSkyBody {
  readonly observation: StellarObservation;
  readonly direction: Vector3Like;
  readonly lunarIllumination: LunarSkyIllumination | null;
  readonly angularDiameterDegrees: number;
  readonly angularDiameterConfidence: 'calculated';
}

interface SolarSystemSkyDefinition extends SolarSystemSkyBody {
  readonly body: Body;
  readonly radiusKm: number;
}

// Exact IAU 2012 astronomical unit; body radii and appearance provenance mirror the locally
// validated NASA/LRO records in public/data/solar-system/system.json.
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;

const SOLAR_SYSTEM_SKY_DEFINITIONS: readonly SolarSystemSkyDefinition[] = [
  {
    id: 'moon',
    fallbackName: 'Lune',
    body: Body.Moon,
    color: '#e9eff4',
    angularSizeClass: 'moon',
    assistedVisibility: false,
    radiusKm: 1_737.4,
    textureUrl: '/textures/moon-lroc-1024.jpg',
    appearanceConfidence: 'observed',
  },
  {
    id: 'mercury',
    fallbackName: 'Mercure',
    body: Body.Mercury,
    color: '#d8c5aa',
    angularSizeClass: 'planet',
    assistedVisibility: false,
    radiusKm: 2_439.7,
    textureUrl: '/textures/mercury-messenger-usgs-1024.jpg',
    appearanceConfidence: 'observed',
  },
  {
    id: 'venus',
    fallbackName: 'Vénus',
    body: Body.Venus,
    color: '#fff0bd',
    angularSizeClass: 'planet',
    assistedVisibility: false,
    radiusKm: 6_051.8,
    textureUrl: null,
    appearanceConfidence: 'illustrative',
  },
  {
    id: 'mars',
    fallbackName: 'Mars',
    body: Body.Mars,
    color: '#ef9a6b',
    angularSizeClass: 'planet',
    assistedVisibility: false,
    radiusKm: 3_389.5,
    textureUrl: '/textures/mars-viking-1024.jpg',
    appearanceConfidence: 'observed-adapted',
  },
  {
    id: 'jupiter',
    fallbackName: 'Jupiter',
    body: Body.Jupiter,
    color: '#f1d4ad',
    angularSizeClass: 'planet',
    assistedVisibility: false,
    radiusKm: 69_911,
    textureUrl: '/textures/jupiter-hubble-1024.jpg',
    appearanceConfidence: 'observed-adapted',
  },
  {
    id: 'saturn',
    fallbackName: 'Saturne',
    body: Body.Saturn,
    color: '#e7d29c',
    angularSizeClass: 'planet',
    assistedVisibility: false,
    radiusKm: 58_232,
    textureUrl: '/textures/saturn-nasa-vtad-2048.jpg',
    appearanceConfidence: 'illustrative',
  },
  {
    id: 'uranus',
    fallbackName: 'Uranus',
    body: Body.Uranus,
    color: '#b8e7e6',
    angularSizeClass: 'stellar',
    assistedVisibility: true,
    radiusKm: 25_362,
    textureUrl: '/textures/uranus-nasa-vtad-1024.jpg',
    appearanceConfidence: 'illustrative',
  },
  {
    id: 'neptune',
    fallbackName: 'Neptune',
    body: Body.Neptune,
    color: '#91b8ff',
    angularSizeClass: 'stellar',
    assistedVisibility: true,
    radiusKm: 24_622,
    textureUrl: '/textures/neptune-nasa-vtad-1024.jpg',
    appearanceConfidence: 'illustrative',
  },
];

export function calculateSolarSystemSky(
  time: UniverseTime,
  location: EarthObservationLocation,
): readonly SolarSystemSkyObservation[] {
  const calculateObservation = createStellarObservationCalculator(time, location);

  if (!calculateObservation) {
    return [];
  }
  const referenceFrame = calculateEarthObserverReferenceFrame(time, location)!;
  const astronomyTime = MakeTime(astronomyEngineDaysSinceJ2000(time));
  const observer = new Observer(location.latitude, location.longitude, location.heightMeters ?? 0);
  const lunarIllumination: LunarSkyIllumination = {
    illuminatedFraction: Illumination(Body.Moon, astronomyTime).phase_fraction,
    waxing: MoonPhase(astronomyTime) < 180,
  };

  return SOLAR_SYSTEM_SKY_DEFINITIONS.map(({ body, radiusKm, ...definition }) => {
    const equatorial = Equator(body, astronomyTime, observer, false, true);
    const observation = calculateObservation({
      rightAscensionDegrees: equatorial.ra * 15,
      declinationDegrees: equatorial.dec,
    });

    return {
      ...definition,
      observation,
      direction: calculateHorizontalDirection(
        observation.altitudeDegrees,
        observation.azimuthDegrees,
        referenceFrame,
      ),
      lunarIllumination: body === Body.Moon ? lunarIllumination : null,
      angularDiameterDegrees: calculateAngularDiameterDegrees(radiusKm, equatorial.dist),
      angularDiameterConfidence: 'calculated',
    };
  });
}

export function calculateAngularDiameterDegrees(radiusKm: number, distanceAu: number): number {
  return 2 * Math.asin(radiusKm / (distanceAu * ASTRONOMICAL_UNIT_KM)) * (180 / Math.PI);
}

function calculateHorizontalDirection(
  altitudeDegrees: number,
  azimuthDegrees: number,
  referenceFrame: {
    readonly northDirection: Vector3Like;
    readonly zenithDirection: Vector3Like;
  },
): Vector3Like {
  const north = referenceFrame.northDirection;
  const zenith = referenceFrame.zenithDirection;
  // Azimuth increases eastward from north. In the galactic scene, north x zenith therefore
  // supplies the same horizon-right axis used by EarthObserverOrientation.
  const right = {
    x: north.y * zenith.z - north.z * zenith.y,
    y: north.z * zenith.x - north.x * zenith.z,
    z: north.x * zenith.y - north.y * zenith.x,
  };
  const altitudeRadians = (altitudeDegrees * Math.PI) / 180;
  const azimuthRadians = (azimuthDegrees * Math.PI) / 180;
  const horizontalScale = Math.cos(altitudeRadians);
  const direction = {
    x:
      north.x * Math.cos(azimuthRadians) * horizontalScale +
      right.x * Math.sin(azimuthRadians) * horizontalScale +
      zenith.x * Math.sin(altitudeRadians),
    y:
      north.y * Math.cos(azimuthRadians) * horizontalScale +
      right.y * Math.sin(azimuthRadians) * horizontalScale +
      zenith.y * Math.sin(altitudeRadians),
    z:
      north.z * Math.cos(azimuthRadians) * horizontalScale +
      right.z * Math.sin(azimuthRadians) * horizontalScale +
      zenith.z * Math.sin(altitudeRadians),
  };
  const length = Math.hypot(direction.x, direction.y, direction.z);

  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
}
