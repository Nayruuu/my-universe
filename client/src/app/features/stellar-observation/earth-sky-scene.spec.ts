import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from '../../../engine/simulation/astronomy-engine-time-domain';
import { dateToJulianDay } from '../../../engine/simulation/time-utils';
import type { EarthSkyCatalogStar } from './earth-sky-catalog';
import { createEarthSkyScene } from './earth-sky-scene';
import type { StellarObservationConstellation } from '../../../engine/simulation/stellar-observation';

const SIRIUS: EarthSkyCatalogStar = {
  id: 'sirius',
  name: 'Sirius',
  coordinates: {
    rightAscensionDegrees: 101.287_161_3,
    declinationDegrees: -16.716_122,
  },
  apparentMagnitude: -1.46,
  color: '#b8ccff',
};
const PARIS = {
  id: 'paris',
  name: 'Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: 'Europe/Paris',
};

describe('scène nocturne terrestre', () => {
  it('centre Sirius et projette en lot les étoiles voisines au-dessus de l’horizon', () => {
    const scene = createEarthSkyScene({
      catalog: [
        SIRIUS,
        nearbyStar('bright-neighbour', 101.8, -16.4, -0.5),
        nearbyStar('faint-neighbour', 102.2, -16, 6.5),
        nearbyStar('below-horizon', 101, -80, 0),
      ],
      target: SIRIUS,
      time: winterEvening(),
      location: PARIS,
      width: 1_200,
      height: 800,
      verticalFieldOfViewDegrees: 80,
    });

    expect(scene).not.toBeNull();
    expect(scene?.centerAltitudeDegrees).toBeCloseTo(23.290_15, 5);
    expect(scene?.centerAzimuthDegrees).toBeCloseTo(165.5396, 5);
    expect(scene?.target).toMatchObject({
      x: expect.closeTo(600, 8),
      y: expect.closeTo(400, 8),
      isAboveHorizon: true,
    });
    expect(scene?.horizonY).toBeGreaterThan(400);
    expect(scene?.stars.map(({ id }) => id)).toEqual([
      'sirius',
      'bright-neighbour',
      'faint-neighbour',
    ]);
    expect(scene?.stars[0]).toMatchObject({
      x: expect.closeTo(600, 8),
      y: expect.closeTo(400, 8),
      showLabel: false,
    });
    expect(scene?.stars[1]?.radius).toBeGreaterThan(scene?.stars[2]?.radius ?? 0);
    expect(scene?.stars[1]?.opacity).toBeGreaterThan(scene?.stars[2]?.opacity ?? 0);
    expect(scene?.stars[1]?.showLabel).toBe(true);
    expect(scene?.stars[2]?.showLabel).toBe(false);
  });

  it('épingle une cible sous l’horizon sur la ligne du sol sans la déclarer visible', () => {
    const scene = createEarthSkyScene({
      catalog: [],
      target: SIRIUS,
      time: { julianDay: dateToJulianDay(new Date('2026-07-15T22:00:00Z')) },
      location: PARIS,
      width: 900,
      height: 600,
      verticalFieldOfViewDegrees: 80,
    });

    expect(scene?.centerAltitudeDegrees).toBe(5);
    expect(scene?.target.isAboveHorizon).toBe(false);
    expect(scene?.target.y).toBeCloseTo(scene?.horizonY ?? 0, 8);
  });

  it('masque un horizon hors champ et borne le rendu des magnitudes extrêmes', () => {
    const scene = createEarthSkyScene({
      catalog: [
        nearbyStar('overexposed', 101.8, -16.4, -20),
        nearbyStar('dim', 102.2, -16, 20),
        nearbyStar('far-away-direction', 280, 40, 0),
      ],
      target: SIRIUS,
      time: winterEvening(),
      location: PARIS,
      width: 1_200,
      height: 800,
      verticalFieldOfViewDegrees: 30,
    });

    expect(scene?.horizonY).toBe(801);
    expect(scene?.stars.map(({ id }) => id)).toEqual(['sirius', 'overexposed', 'dim']);
    expect(scene?.stars[1]).toMatchObject({ radius: 2.7, opacity: 0.86, haloOpacity: 0.16 });
    expect(scene?.stars[2]).toMatchObject({ radius: 0.55, opacity: 0.18, haloOpacity: 0 });
  });

  it('projette les figures conventionnelles et illumine celle de la cible', () => {
    const neighbour = nearbyStar('neighbour', 102, -16, 0.2);
    const other = nearbyStar('other', 103, -15, 1);
    const scene = createEarthSkyScene({
      catalog: [SIRIUS, neighbour, other],
      constellations: [
        constellation('canis-major', SIRIUS, neighbour),
        constellation('other', neighbour, other),
      ],
      target: SIRIUS,
      time: winterEvening(),
      location: PARIS,
      width: 1_200,
      height: 800,
      verticalFieldOfViewDegrees: 80,
      showConstellations: true,
      showLabels: true,
    });

    expect(scene?.constellations).toHaveLength(2);
    expect(scene?.constellations[0]).toMatchObject({
      id: 'constellation-canis-major',
      highlighted: true,
      showLabel: true,
    });
    expect(scene?.constellations[0]?.segments).toHaveLength(1);
    expect(scene?.constellations[1]?.highlighted).toBe(false);
  });

  it('conserve une orientation libre et peut masquer figures et noms', () => {
    const neighbour = nearbyStar('neighbour', 102, -16, 0.2);
    const scene = createEarthSkyScene({
      catalog: [SIRIUS, neighbour],
      constellations: [constellation('canis-major', SIRIUS, neighbour)],
      target: SIRIUS,
      time: winterEvening(),
      location: PARIS,
      width: 1_200,
      height: 800,
      verticalFieldOfViewDegrees: 80,
      viewpoint: {
        centerAltitudeDegrees: 30,
        centerAzimuthDegrees: 130,
        verticalFieldOfViewDegrees: 45,
      },
      showConstellations: false,
      showLabels: false,
    });

    expect(scene).toMatchObject({
      centerAltitudeDegrees: 30,
      centerAzimuthDegrees: 130,
      verticalFieldOfViewDegrees: 45,
      constellations: [],
    });
    expect(scene?.target.isInView).toBe(false);
    expect(scene?.stars.every(({ showLabel }) => !showLabel)).toBe(true);
  });

  it('écarte les segments sous l’horizon ou entièrement hors du champ', () => {
    const belowHorizon = nearbyStar('below-segment', 101, -80, 1);
    const outsideView = nearbyStar('outside-segment', 150, -16, 1);
    const scene = createEarthSkyScene({
      catalog: [],
      constellations: [
        constellation('below', SIRIUS, belowHorizon),
        constellation('outside', SIRIUS, outsideView),
      ],
      target: SIRIUS,
      time: winterEvening(),
      location: PARIS,
      width: 1_200,
      height: 800,
      verticalFieldOfViewDegrees: 30,
    });

    expect(scene?.constellations).toEqual([]);
  });

  it('rend les dates hors domaine indisponibles et délègue la validation du viewport', () => {
    expect(
      createEarthSkyScene({
        catalog: [],
        target: SIRIUS,
        time: { julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 },
        location: PARIS,
        width: 900,
        height: 600,
        verticalFieldOfViewDegrees: 80,
      }),
    ).toBeNull();
    expect(() =>
      createEarthSkyScene({
        catalog: [],
        target: SIRIUS,
        time: winterEvening(),
        location: PARIS,
        width: 0,
        height: 600,
        verticalFieldOfViewDegrees: 80,
      }),
    ).toThrow(RangeError);
  });
});

function nearbyStar(
  id: string,
  rightAscensionDegrees: number,
  declinationDegrees: number,
  apparentMagnitude: number,
): EarthSkyCatalogStar {
  return {
    id,
    name: id,
    coordinates: { rightAscensionDegrees, declinationDegrees },
    apparentMagnitude,
    color: '#ffe6c2',
  };
}

function winterEvening() {
  return { julianDay: dateToJulianDay(new Date('2026-01-15T22:00:00Z')) };
}

function constellation(
  id: string,
  from: EarthSkyCatalogStar,
  to: EarthSkyCatalogStar,
): StellarObservationConstellation {
  return {
    id: `constellation-${id}`,
    name: id,
    abbreviation: id.slice(0, 3),
    segments: [{ from, to }],
  };
}
