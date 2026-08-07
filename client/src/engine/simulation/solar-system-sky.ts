import { Body, Equator, Illumination, MakeTime, MoonPhase, Observer } from 'astronomy-engine';
import type { UniverseTime } from '../../data/models/universe.models';
import {
  astronomyEngineDaysSinceJ2000,
  isAstronomyEngineTimeSupported,
} from './astronomy-engine-time-domain';
import {
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
}

export interface SolarSystemSkyObservation extends SolarSystemSkyBody {
  readonly observation: StellarObservation;
  readonly lunarIllumination: LunarSkyIllumination | null;
}

interface SolarSystemSkyDefinition extends SolarSystemSkyBody {
  readonly body: Body;
}

const SOLAR_SYSTEM_SKY_DEFINITIONS: readonly SolarSystemSkyDefinition[] = [
  {
    id: 'moon',
    fallbackName: 'Lune',
    body: Body.Moon,
    color: '#e9eff4',
    angularSizeClass: 'moon',
    assistedVisibility: false,
  },
  {
    id: 'mercury',
    fallbackName: 'Mercure',
    body: Body.Mercury,
    color: '#d8c5aa',
    angularSizeClass: 'planet',
    assistedVisibility: false,
  },
  {
    id: 'venus',
    fallbackName: 'Vénus',
    body: Body.Venus,
    color: '#fff0bd',
    angularSizeClass: 'planet',
    assistedVisibility: false,
  },
  {
    id: 'mars',
    fallbackName: 'Mars',
    body: Body.Mars,
    color: '#ef9a6b',
    angularSizeClass: 'planet',
    assistedVisibility: false,
  },
  {
    id: 'jupiter',
    fallbackName: 'Jupiter',
    body: Body.Jupiter,
    color: '#f1d4ad',
    angularSizeClass: 'planet',
    assistedVisibility: false,
  },
  {
    id: 'saturn',
    fallbackName: 'Saturne',
    body: Body.Saturn,
    color: '#e7d29c',
    angularSizeClass: 'planet',
    assistedVisibility: false,
  },
  {
    id: 'uranus',
    fallbackName: 'Uranus',
    body: Body.Uranus,
    color: '#b8e7e6',
    angularSizeClass: 'stellar',
    assistedVisibility: true,
  },
  {
    id: 'neptune',
    fallbackName: 'Neptune',
    body: Body.Neptune,
    color: '#91b8ff',
    angularSizeClass: 'stellar',
    assistedVisibility: true,
  },
];

export function calculateSolarSystemSky(
  time: UniverseTime,
  location: EarthObservationLocation,
): readonly SolarSystemSkyObservation[] {
  const calculateObservation = createStellarObservationCalculator(time, location);

  if (!calculateObservation || !isAstronomyEngineTimeSupported(time)) {
    return [];
  }
  const astronomyTime = MakeTime(astronomyEngineDaysSinceJ2000(time));
  const observer = new Observer(location.latitude, location.longitude, location.heightMeters ?? 0);
  const lunarIllumination: LunarSkyIllumination = {
    illuminatedFraction: Illumination(Body.Moon, astronomyTime).phase_fraction,
    waxing: MoonPhase(astronomyTime) < 180,
  };

  return SOLAR_SYSTEM_SKY_DEFINITIONS.map(({ body, ...definition }) => {
    const equatorial = Equator(body, astronomyTime, observer, false, true);

    return {
      ...definition,
      observation: calculateObservation({
        rightAscensionDegrees: equatorial.ra * 15,
        declinationDegrees: equatorial.dec,
      }),
      lunarIllumination: body === Body.Moon ? lunarIllumination : null,
    };
  });
}
