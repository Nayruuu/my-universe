import {
  ASTRONOMY_ENGINE_MAX_JULIAN_DAY,
  ASTRONOMY_ENGINE_MIN_JULIAN_DAY,
  astronomyEngineDaysSinceJ2000,
  clampAstronomyEngineTime,
  isAstronomyEngineTimeSupported,
} from './astronomy-engine-time-domain';

describe('domaine temporel des éphémérides Astronomy Engine', () => {
  it('conserve les deux bornes documentées de la table de Pluton', () => {
    expect(astronomyEngineDaysSinceJ2000({ julianDay: ASTRONOMY_ENGINE_MIN_JULIAN_DAY })).toBe(
      -730_000,
    );
    expect(astronomyEngineDaysSinceJ2000({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY })).toBe(
      730_000,
    );
    expect(isAstronomyEngineTimeSupported({ julianDay: ASTRONOMY_ENGINE_MIN_JULIAN_DAY })).toBe(
      true,
    );
    expect(isAstronomyEngineTimeSupported({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY })).toBe(
      true,
    );
  });

  it('borne les époques extrêmes sans modifier une date prise en charge', () => {
    const supported = { julianDay: 2_461_250.5 };

    expect(clampAstronomyEngineTime(supported)).toEqual(supported);
    expect(clampAstronomyEngineTime({ julianDay: ASTRONOMY_ENGINE_MIN_JULIAN_DAY - 1 })).toEqual({
      julianDay: ASTRONOMY_ENGINE_MIN_JULIAN_DAY,
    });
    expect(
      clampAstronomyEngineTime({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 365_250_000 }),
    ).toEqual({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY });
    expect(isAstronomyEngineTimeSupported({ julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1 })).toBe(
      false,
    );
  });
});
