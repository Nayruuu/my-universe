import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from './astronomy-engine-time-domain';
import {
  calculateAngularDiameterDegrees,
  calculateSolarSystemSky,
  calculateSunSkyObservation,
} from './solar-system-sky';
import { calculateEarthObserverReferenceFrame } from './stellar-observation';
import { dateToJulianDay } from './time-utils';

const PARIS = {
  latitude: 48.8566,
  longitude: 2.3522,
  heightMeters: 35,
};

describe('ciel du Système solaire depuis la Terre', () => {
  it('calcule les astres topocentriques du ciel nocturne sans le Soleil ni la Terre', () => {
    const observations = calculateSolarSystemSky(
      { julianDay: dateToJulianDay(new Date('2026-01-15T22:00:00Z')) },
      PARIS,
    );

    expect(observations.map(({ id }) => id)).toEqual([
      'moon',
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ]);
    expect(observations.find(({ id }) => id === 'jupiter')).toMatchObject({
      angularSizeClass: 'planet',
      angularDiameterConfidence: 'calculated',
      angularDiameterDegrees: expect.any(Number),
      lunarIllumination: null,
      textureUrl: '/textures/jupiter-hubble-1024.jpg',
      observation: {
        altitudeDegrees: expect.any(Number),
        azimuthDegrees: expect.any(Number),
      },
      direction: {
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
      },
    });
    expect(observations.find(({ id }) => id === 'neptune')).toMatchObject({
      angularSizeClass: 'stellar',
      assistedVisibility: true,
    });
  });

  it('exprime chaque astre dans le même repère galactique que la caméra terrestre', () => {
    const time = { julianDay: dateToJulianDay(new Date('2026-01-15T22:00:00Z')) };
    const referenceFrame = calculateEarthObserverReferenceFrame(time, PARIS)!;
    const observations = calculateSolarSystemSky(time, PARIS);

    for (const body of observations) {
      const { direction } = body;
      const length = Math.hypot(direction.x, direction.y, direction.z);
      const verticalProjection =
        direction.x * referenceFrame.zenithDirection.x +
        direction.y * referenceFrame.zenithDirection.y +
        direction.z * referenceFrame.zenithDirection.z;

      expect(length).toBeCloseTo(1, 12);
      expect(verticalProjection).toBeCloseTo(
        Math.sin((body.observation.altitudeDegrees * Math.PI) / 180),
        9,
      );
    }
  });

  it('retrouve le diamètre angulaire lunaire moyen à partir de sa distance de référence', () => {
    // Independent reference: NASA Moon mean radius 1,737.4 km and mean distance 384,400 km
    // imply about 0.518 degree across the lunar disk.
    expect(calculateAngularDiameterDegrees(1_737.4, 384_400 / 149_597_870.7)).toBeCloseTo(0.518, 3);
  });

  it('reproduit la position topocentrique indépendante du Soleil à Paris', () => {
    const observation = calculateSunSkyObservation(
      { julianDay: dateToJulianDay(new Date('2026-01-15T18:00:00Z')) },
      PARIS,
    );

    // Independent reference: NASA/JPL Horizons DE441, observer table quantities=4,
    // Paris 2.3522° E / 48.8566° N / 35 m, 2026-01-15 18:00 UTC:
    // apparent azimuth 255.797887° and refracted elevation −15.017410°.
    // https://ssd.jpl.nasa.gov/horizons/manual.html
    expect(observation?.azimuthDegrees).toBeCloseTo(255.797_887, 1);
    expect(Math.abs((observation?.altitudeDegrees ?? 0) - -15.017_41)).toBeLessThan(0.15);
  });

  it('expose la fraction éclairée et le sens réel de la phase lunaire', () => {
    const waxingMoon = calculateSolarSystemSky(
      { julianDay: dateToJulianDay(new Date('2026-08-16T15:08:00Z')) },
      PARIS,
    ).find(({ id }) => id === 'moon');
    const waningMoon = calculateSolarSystemSky(
      { julianDay: dateToJulianDay(new Date('2026-08-29T15:08:00Z')) },
      PARIS,
    ).find(({ id }) => id === 'moon');

    expect(waxingMoon?.lunarIllumination).toEqual({
      illuminatedFraction: expect.closeTo(0.179_244, 5),
      waxing: true,
    });
    expect(waningMoon?.lunarIllumination).toEqual({
      illuminatedFraction: expect.any(Number),
      waxing: false,
    });
  });

  it('respecte le domaine temporel et la validation du lieu partagés avec les étoiles', () => {
    expect(
      calculateSolarSystemSky({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 }, PARIS),
    ).toEqual([]);
    expect(
      calculateSunSkyObservation({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 }, PARIS),
    ).toBeNull();
    expect(() =>
      calculateSolarSystemSky({ julianDay: 2_451_545 }, { ...PARIS, latitude: Number.NaN }),
    ).toThrow(/latitude/i);
  });
});
