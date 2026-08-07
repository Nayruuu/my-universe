import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from './astronomy-engine-time-domain';
import { calculateSolarSystemSky } from './solar-system-sky';
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
      lunarIllumination: null,
      observation: {
        altitudeDegrees: expect.any(Number),
        azimuthDegrees: expect.any(Number),
      },
    });
    expect(observations.find(({ id }) => id === 'neptune')).toMatchObject({
      angularSizeClass: 'stellar',
      assistedVisibility: true,
    });
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
    expect(() =>
      calculateSolarSystemSky({ julianDay: 2_451_545 }, { ...PARIS, latitude: Number.NaN }),
    ).toThrow(/latitude/i);
  });
});
